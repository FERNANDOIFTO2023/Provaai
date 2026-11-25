/*
 * Integração / cliente HTTP do Laravel
 * Preserva a interface de consultas encadeadas usada pelos componentes, traduzindo-a para /api/data
 * e /api/actions. Os nomes herdados da API não significam conexão direta ao banco.
 * Requisições usam cookie de sessão e proteção CSRF. O marcador access_token serve à interface; não
 * é uma credencial de acesso.
 */
export type User = { id: string; email?: string; user_metadata: { full_name?: string } };
type Session = { access_token: string; refresh_token: string; user: User };
type ApiError = { message: string; code?: string; status?: number };
type Result = { data: any; error: ApiError | null };
type Listener = (event: string, session: Session | null) => void;
const listeners = new Set<Listener>();
let session: Session | null = null, checkedAt = 0;

// Inclui CSRF e cookie da mesma origem em todas as chamadas autenticadas.
export function apiFetch(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  const cookie = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='));
  if(cookie) headers.set('X-XSRF-TOKEN', decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)));
  else {const token=document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;if(token)headers.set('X-CSRF-TOKEN',token);}
  return fetch(url,{...init,headers,credentials:'same-origin'});
}
async function request(url: string, body?: unknown, method='POST', timeoutMs?: number): Promise<Result> {
  const controller = timeoutMs ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
  try {
    const response=await apiFetch(url,{method,signal:controller?.signal,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const result=await response.json();
    if(!response.ok) return {data:null,error:{message:typeof result.error==='string'?result.error:result.error?.message||Object.values(result.errors??{}).flat()[0]||result.message||'Não foi possível concluir.',code:result.code,status:response.status}};
    return {data:result.data===undefined?result:result.data,error:null};
  } catch {
    return {data:null,error:controller?.signal.aborted
      ? {code:'request_timeout',message:'O servidor demorou para confirmar o salvamento. Suas alterações continuam nesta tela. Confira a conexão e tente novamente; o pedido anterior pode ter sido salvo.'}
      : {message:'Não foi possível conectar. Confira sua internet.'}};
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
// As chamadas encadeadas apenas montam a requisição. A execução ocorre no then, quando há await.
// O backend decide quais operações e campos são permitidos para cada recurso.
class Query implements PromiseLike<Result> {
  private input: Record<string,any>={op:'select',filters:[]};
  private readonly resource: string;
  private timeoutMs?: number;
  constructor(resource: string) { this.resource = resource; }
  select(columns='*') {this.input.columns=columns;return this;}
  eq(column: string,value: unknown) {this.input.filters.push([column,value]);return this;}
  order(column: string,options: {ascending?: boolean}={}) {this.input.order=[column,options.ascending??true];return this;}
  limit(value: number) {this.input.limit=value;return this;}
  range(start: number,end: number) {this.input.offset=start;this.input.limit=end-start+1;return this;}
  insert(value: unknown) {this.input.op='insert';this.input.values=value;return this;}
  update(value: unknown) {this.input.op='update';this.input.values=value;return this;}
  upsert(value: unknown,_options?: unknown) {this.input.op='upsert';this.input.values=value;return this;}
  delete() {this.input.op='delete';return this;}
  single() {this.input.single='single';return this;}
  maybeSingle() {this.input.single='maybe';return this;}
  timeout(milliseconds: number) {this.timeoutMs=milliseconds;return this;}
  then<TResult1=Result,TResult2=never>(onfulfilled?: ((value:Result)=>TResult1|PromiseLike<TResult1>)|null,onrejected?:((reason:any)=>TResult2|PromiseLike<TResult2>)|null):Promise<TResult1|TResult2> {
    return request('/api/data/'+encodeURIComponent(this.resource),this.input,'POST',this.timeoutMs).then(onfulfilled,onrejected);
  }
}
// Reaproveita por até um minuto a consulta de sessão; force invalida essa economia de requisições.
async function getSession(force=false) {
  if(force||Date.now()-checkedAt>60_000) {
    const result=await request('/api/auth/session',undefined,'GET');
    if(result.error)return {data:{session:null},error:result.error};
    session=result.data.session;checkedAt=Date.now();
  }
  return {data:{session},error:null};
}
export const apiClient = {
  from: (resource:string)=>new Query(resource),
  rpc: (action:string,values:unknown={})=>request('/api/actions/'+encodeURIComponent(action),values),
  auth: {
    getSession,
    async setSession(_tokens: {access_token:string;refresh_token:string}) {
      const result=await getSession(true);if(!result.error)listeners.forEach(fn=>fn('SIGNED_IN',result.data.session));return result;
    },
    async signOut(_options?:unknown) {
      const result=await request('/api/auth/logout',{});session=null;checkedAt=0;listeners.forEach(fn=>fn('SIGNED_OUT',null));return result;
    },
    onAuthStateChange(fn:Listener) {
      listeners.add(fn);void getSession(true).then(r=>{if(listeners.has(fn))fn('INITIAL_SESSION',r.data.session);});
      return {data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}};
    },
  },
  storage: {from: (bucket:string)=>({
    async upload(path:string,file:Blob,_options?:unknown):Promise<Result> {
      const data=new FormData();data.set('path',path);data.set('file',file);
      try {const response=await apiFetch('/api/files/'+encodeURIComponent(bucket),{method:'POST',body:data});const result=await response.json();return response.ok?{data:result.data,error:null}:{data:null,error:{message:result.message||'Falha ao enviar arquivo.'}};}
      catch{return {data:null,error:{message:'Falha de conexão no envio.'}};}
    },
    // Mantém o nome compatível com o cliente antigo, mas retorna uma rota protegida por sessão.
    // Não cria URL pública assinada nem transforma o parâmetro de expiração em autorização.
    async createSignedUrl(path:string,_expires:number) {return {data:{signedUrl:'/api/files/'+encodeURIComponent(bucket)+'?path='+encodeURIComponent(path)},error:null};},
    remove: (paths:string[])=>request('/api/files/'+encodeURIComponent(bucket),{paths},'DELETE'),
  })},
};
