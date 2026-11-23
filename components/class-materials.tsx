/* Materiais de estudo da turma: leitura no envio, consulta privada e preferência aplicada a novas provas. */
import { useEffect, useId, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { ClassRoom } from '@/lib/model';
import { AlertCircle, BookOpen, CheckCircle2, FileText, Upload } from './animated-icons';

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
  const panelId = useId();
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
    <div className="class-materials-heading">
      <span className="materials-symbol"><BookOpen size={24} /></span>
      <div className="materials-heading-copy"><h2>Conteúdo para as provas</h2>
        <p>Suas aulas como referência para as próximas questões.</p></div>
      <button type="button" className="button secondary" disabled={pending} aria-expanded={expanded} aria-controls={panelId} onClick={() => void show()}>
        {expanded ? 'Fechar materiais' : 'Materiais da turma'}
      </button>
    </div>
    {expanded && <div id={panelId} className="class-materials-body">
      {demo ? <p className="materials-feedback">Entre na sua conta para anexar materiais. A demonstração mantém a geração original.</p> : <>
        {/* Ações principais primeiro; instruções complementares ficam no fim do painel. */}
        <div className="materials-layout">
          <div className="materials-upload-section">
            <div className="materials-section-title"><h3>Materiais de estudo</h3>
              {loaded && <span className="materials-count">{materials.length} de 5 arquivos</span>}</div>
            <div className="materials-upload">
              <Upload size={28} />
              <h4>Adicione o conteúdo das suas aulas</h4>
              <p id={`${panelId}-formats`}>PDF, Word ou PowerPoint · até 20 MB por arquivo</p>
              <button type="button" className="button primary" disabled={disabled || !loaded || materials.length >= 5}
                aria-describedby={`${panelId}-formats`} onClick={() => input.current?.click()}>
                <Upload size={18} />{materials.length >= 5 ? 'Limite de arquivos atingido' : 'Selecionar arquivo'}
              </button>
              {/* O botão nativo recebe foco e abre o seletor; o input mantém o envio original. */}
              <input ref={input} hidden aria-label="Anexar material de estudo" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" disabled={disabled || !loaded || materials.length >= 5}
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
              <small>A leitura é feita uma vez para agilizar as próximas gerações.</small>
            </div>
            <p className="materials-private"><CheckCircle2 size={16} />Seus arquivos ficam privados nesta turma.</p>
          </div>
          <div className={`materials-scope${external ? ' is-external' : ''}`}>
            <div className="materials-section-title"><h3>Pesquisa externa</h3>
              {loaded && <span className="materials-state">{external ? 'Ativada' : 'Desativada'}</span>}</div>
            <p>Escolha se a IA pode ir além dos materiais.</p>
            <label className="materials-toggle"><input type="checkbox" checked={external}
              aria-describedby={`${panelId}-scope`} disabled={disabled || !loaded || (!searchAvailable && !external)}
          onChange={e => { const value = e.target.checked; const previous = external; setExternal(value); void act(async () => {
            try {
              const result = await request(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ allow_external_sources: value }) });
              setExternal(result.allow_external_sources); setNotice('Preferência salva para as próximas provas.');
            } catch (error) { setExternal(previous); throw error; }
          }); }} /><span>Permitir pesquisa fora dos anexos</span></label>
            <div id={`${panelId}-scope`} className="materials-scope-description">
              <strong>{external ? 'Conteúdos além dos seus arquivos' : 'Com anexos, o foco fica no que você ensinou'}</strong>
              <p>{external
                ? 'A IA pode gerar questões sobre conteúdos que não estão nos arquivos anexados. A pesquisa na web pode aumentar o tempo de geração.'
                : 'A IA usa somente o texto lido dos materiais, sem pesquisar fora. A revisão confere se as questões têm apoio nessas fontes.'}</p>
            </div>
            {loaded && !searchAvailable && <p className="materials-unavailable">Pesquisa externa indisponível no momento. Você pode continuar com seus anexos.</p>}
          </div>
        </div>
        {/* Retorno próximo aos controles: mensagens são anunciadas sem depender somente da cor. */}
        {pending && <p role="status" className="materials-feedback">Processando material ou preferência… Aguarde antes de preparar a prova.</p>}
        {notice && <p role="status" className="materials-feedback is-success"><CheckCircle2 size={18} />{notice}</p>}
        {error && <p role="alert" className="materials-feedback is-error"><AlertCircle size={18} />{error}</p>}
        {!!room.archived_at && <p className="materials-feedback">Reative a turma para alterar seus materiais.</p>}
        {!materials.length && loaded && <p className="materials-empty"><strong>Os anexos são opcionais.</strong> Sem materiais anexados, a IA continua gerando provas com a matéria, os tópicos e os critérios informados.</p>}
        {!!materials.length && <div className="materials-files">
          <div className="materials-section-title"><h3>Arquivos da turma</h3><span className="materials-count">{materials.reduce((total, material) => total + material.extracted_text.length, 0).toLocaleString('pt-BR')} / 60.000 caracteres</span></div>
          <p>Confira o texto lido antes de preparar a prova.</p>
          <ul className="materials-list">{materials.map(material => <li key={material.id}>
          <div className="materials-file-heading"><span className="materials-file-icon"><FileText size={22} /></span>
            <div className="materials-file-name"><strong>{material.filename}</strong><span>{material.extracted_text.length.toLocaleString('pt-BR')} caracteres lidos</span></div>
          <div className="actions"><a className="button secondary small-button" href={`${url}/${material.id}`}>Baixar original</a>
            <button className="button secondary small-button" disabled={disabled} onClick={() => void act(async () => {
              await request(`${url}/${material.id}`, { method: 'DELETE' });
              setMaterials(previous => previous.filter(item => item.id !== material.id)); setNotice('Material removido das próximas provas.');
            })}>Remover material</button></div></div>
          <details><summary>Conferir texto lido</summary><pre>{material.extracted_text}</pre></details>
        </li>)}</ul></div>}
      </>}
      <aside className="materials-warning" aria-label="Cuidados com PowerPoint"><AlertCircle size={20} />
        <div><strong>Vai usar PowerPoint?</strong><p>Apresentações com animações avançadas podem falhar na leitura ou na geração de questões. Prefira uma versão simples em PDF com texto selecionável.</p></div>
      </aside>
      <details className="materials-help"><summary>Limites, leitura dos arquivos e uso nas provas</summary>
        <div className="materials-help-grid">
          <div><h4>O que pode ser lido</h4><p>PDF, DOC, DOCX, PPT e PPTX. Até 5 arquivos e 60.000 caracteres no total; 20 MB por arquivo e até 150 páginas PDF ou slides por apresentação.</p>
            <p>Imagens, vídeos e elementos visuais complexos não são interpretados. PDFs digitalizados precisam ter o texto reconhecido antes do envio (OCR).</p></div>
          <div><h4>O que muda nas provas</h4><p>Alterações valem para novas provas. Rascunhos e lotes já preparados mantêm os materiais e a opção usados na preparação.</p>
            <p>Cada geração cria novas questões. Só a leitura dos arquivos é reutilizada. Os anexos não acompanham o compartilhamento de cópias da turma.</p></div>
        </div>
      </details>
    </div>}
  </section>;
}
