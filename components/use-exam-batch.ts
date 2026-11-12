import { apiFetch } from '@/lib/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Batch = {batch_id:string;title:string;exam_ids:string[];completed:number;failed:number;last_error:string|null;lease_until:string|null;stage:'generating'|'reviewing'|null};

export function useExamBatch(userId: string | undefined, onProgress: () => Promise<void>) {
  const [batch,setBatch] = useState<Batch|null>(null);
  const [notice,setNotice] = useState('');
  const [starting,setStarting] = useState(false);
  const [syncError,setSyncError] = useState('');
  const last = useRef<Batch|null>(null), startingRef=useRef(false);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const checking = useRef(false), lastKick = useRef(0);
  const refresh = useCallback(async () => {
    if (!userId || checking.current) return;
    checking.current=true;
    try {
      const {data,error}=await apiClient.from('sala_exam_batches')
        .select('batch_id,title,exam_ids,completed,failed,last_error,lease_until,stage').eq('user_id',userId).maybeSingle();
      if (error) throw error;
      const next = data as Batch|null;
      const prev = last.current;
      last.current=next;
      setBatch(next);
      setSyncError('');
      if (!next) return;
      const running=next.completed<next.exam_ids.length;
      if (prev?.batch_id!==next.batch_id || prev.completed!==next.completed) {
        if (running) setNotice('');
        if (!running && (prev || startingRef.current || next.failed)) setNotice(next.failed
          ? `${next.completed-next.failed} de ${next.exam_ids.length} prova(s) gerada(s). ${next.last_error || 'Confira os rascunhos em Provas.'}`
          : 'Geração concluída. As provas estão prontas para revisão.');
        if (prev || running || startingRef.current) await onProgressRef.current();
      }
      if (running && (!next.lease_until || Date.parse(next.lease_until)<=Date.now()) && Date.now()-lastKick.current>1500) {
        lastKick.current=Date.now();
        const {data:{session}}=await apiClient.auth.getSession();
        if (!session || session.user.id!==userId) return;
        const response=await apiFetch('/api/exam-batch',{method:'POST'});
        if (!response.ok) throw new Error();
      }
    } catch {setSyncError('Não foi possível atualizar a geração. Tentando novamente…');}
    finally {checking.current=false;}
  },[userId]);
  const running=Boolean(batch && batch.completed<batch.exam_ids.length);
  let progress = { percent: 0, label: 'Enviando o pedido' };
  if (batch && running) {
    const total = batch.exam_ids.length;
    const steps = batch.stage === 'reviewing' ? 2 : batch.stage === 'generating' ? 1 : 0;
    const phase = ['Aguardando o preparo', 'Gerando as questões', 'Conferindo matéria e conteúdo'][steps];
    progress = {
      percent: Math.floor(100 * (3 * batch.completed + steps) / (3 * total)),
      label: total === 1 ? phase : `Prova ${batch.completed + 1} de ${total} · ${phase}`,
    };
  } else if (!starting && batch?.exam_ids.length && !batch.failed) {
    progress = { percent: 100, label: 'Prontas para revisão' };
  }
  useEffect(()=>{
    if (!userId) return;
    void refresh();
    const timer=setInterval(()=>void refresh(),running?1500:12000);
    window.addEventListener('focus',refresh);
    return ()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[refresh,running,userId]);
  async function start(input: Record<string,unknown>) {
    if (startingRef.current || running) throw new Error('Aguarde o lote de provas em andamento.');
    startingRef.current=true;setStarting(true);setNotice('');
    try {
      const {error}=await apiClient.rpc('sala_begin_exam_batch',{p_input:input});
      if (error) throw error;
      // Inicia o trabalhador mesmo que outra consulta de progresso esteja em andamento.
      const {data:{session}}=await apiClient.auth.getSession();
      if (session?.user.id===userId && session) {
        await apiFetch('/api/exam-batch',{method:'POST'}).catch(()=>{});
      }
    } finally {await refresh();startingRef.current=false;setStarting(false);}
  }
  return {batch, progress, busy:starting || running,start,notice,syncError,dismiss:()=>setNotice('')};
}
