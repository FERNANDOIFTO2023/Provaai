/* Materiais de estudo da turma: leitura no envio, consulta privada e preferência aplicada a novas provas. */
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { ClassRoom } from '@/lib/model';
import { BookOpen, Upload } from './animated-icons';

type Material = { id: string; filename: string; size: number; extracted_text: string };

export default function ClassMaterials({ room, demo, busy, onBusy }: {
  room: ClassRoom; demo: boolean; busy: boolean; onBusy: (value: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [external, setExternal] = useState(false);
  const [searchAvailable, setSearchAvailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const url = `/api/classes/${encodeURIComponent(room.id)}/materials`;
  const disabled = busy || pending || !!room.archived_at || demo;
  useEffect(() => { onBusy(pending); return () => onBusy(false); }, [pending, onBusy]);

  async function request(endpoint: string, init?: RequestInit) {
    const response = await apiFetch(endpoint, init);
    if (response.status === 204) return null;
    const result = await response.json();
    if (!response.ok) throw Error(Object.values(result.errors ?? {}).flat()[0] as string || result.message || 'Não foi possível concluir. Tente novamente.');
    return result;
  }

  async function act(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setPending(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Falha de conexão. Tente novamente.'); }
    finally { setPending(false); running.current = false; }
  }

  async function show() {
    setExpanded(value => !value);
    if (loaded || demo) return;
    await act(async () => {
      const data = await request(url);
      setMaterials(data.materials); setExternal(data.allow_external_sources);
      setSearchAvailable(data.external_search_available); setLoaded(true);
    });
  }

  return <section className="class-materials" aria-label="Materiais da turma" aria-busy={pending}>
    <div className="class-materials-heading"><BookOpen size={22} /><div><h2>Conteúdo para as provas</h2>
      <p>Anexe os materiais que a IA deve usar nesta turma.</p></div>
      <button className="button secondary" disabled={pending} aria-expanded={expanded} aria-controls="class-materials-body" onClick={() => void show()}>
        {expanded ? 'Fechar materiais' : 'Materiais da turma'}
      </button></div>
    {expanded && <div id="class-materials-body" className="class-materials-body">
      <p>PDF, Word (.doc/.docx) e PowerPoint (.ppt/.pptx). Até 5 arquivos, 20 MB por arquivo e 60.000 caracteres de texto no total. A leitura é feita uma vez no envio para agilizar as próximas gerações.</p>
      <p className="materials-warning"><strong>Atenção ao PowerPoint:</strong> animações avançadas, vídeos e elementos visuais complexos podem causar falhas na leitura ou na geração das questões. Prefira exportar uma versão simples em PDF com texto selecionável.</p>
      <p>Imagens e PDFs digitalizados não passam por OCR aqui. Confira o texto lido antes de preparar a prova. Os arquivos são privados e não acompanham o compartilhamento de cópias da turma.</p>
      {demo ? <p>Entre na sua conta para anexar materiais. A demonstração mantém a geração original.</p> : <>
        <label className="materials-upload"><span><Upload size={16} />Anexar material de estudo</span>
          <input ref={input} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" disabled={disabled || !loaded || materials.length >= 5}
            onChange={e => {
              const file = e.target.files?.[0]; if (!file) return;
              // Limpa também quando houver falha, permitindo selecionar o mesmo arquivo novamente.
              e.target.value = '';
              void act(async () => {
                if (!/\.(pdf|docx?|pptx?)$/i.test(file.name) || file.size > 20 * 1024 * 1024) throw Error('Escolha PDF, Word ou PowerPoint de até 20 MB.');
                const form = new FormData(); form.set('file', file);
                const result = await request(url, { method: 'POST', body: form });
                setMaterials(previous => [...previous, result.material]);
                if (input.current) input.current.value = '';
                setNotice('Material lido. Confira o texto abaixo; as próximas provas usarão esta referência.');
              });
            }} />
        </label>
        <label className="materials-toggle"><input type="checkbox" checked={external} disabled={disabled || !loaded || (!searchAvailable && !external)}
          onChange={e => { const value = e.target.checked; const previous = external; setExternal(value); void act(async () => {
            try {
              const result = await request(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ allow_external_sources: value }) });
              setExternal(result.allow_external_sources); setNotice('Preferência salva para as próximas provas.');
            } catch (error) { setExternal(previous); throw error; }
          }); }} />Permitir pesquisa e conteúdos externos aos anexos</label>
        <p className={external ? 'materials-warning' : ''}>{external
          ? 'Ao habilitar, a IA pode pesquisar na web e gerar questões sobre conteúdos que não estão nos arquivos anexados. Essa pesquisa pode aumentar o tempo de geração.'
          : 'Desmarcado: com anexos, a IA deve se limitar ao conteúdo lido desses materiais, sem pesquisa externa. A conferência bloqueia questões que não tenham apoio nas fontes.'}</p>
        {loaded && !searchAvailable && <p>A pesquisa externa está indisponível até o Gemini ser configurado no servidor.</p>}
        {!materials.length && loaded && <p>Sem materiais anexados, a geração continua usando a matéria, os tópicos e os critérios informados, como antes.</p>}
        <p>Alterações valem para novas provas. Rascunhos e lotes já preparados preservam os materiais e a opção usados na preparação. As questões são novas em cada geração; somente a leitura dos arquivos é reutilizada.</p>
        <ul className="materials-list">{materials.map(material => <li key={material.id}>
          <div><strong>{material.filename}</strong><span>{material.extracted_text.length.toLocaleString('pt-BR')} caracteres lidos</span></div>
          <div className="actions"><a className="button secondary small-button" href={`${url}/${material.id}`}>Baixar original</a>
            <button className="button secondary small-button" disabled={disabled} onClick={() => void act(async () => {
              await request(`${url}/${material.id}`, { method: 'DELETE' });
              setMaterials(previous => previous.filter(item => item.id !== material.id)); setNotice('Material removido das próximas provas.');
            })}>Remover material</button></div>
          <details><summary>Conferir texto lido</summary><pre>{material.extracted_text}</pre></details>
        </li>)}</ul>
      </>}
      {pending && <p role="status">Processando material ou preferência… Aguarde antes de preparar a prova.</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {!!room.archived_at && <p>Reative a turma para alterar seus materiais.</p>}
    </div>}
  </section>;
}
