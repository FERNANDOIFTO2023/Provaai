'use client';
import { useState, type ReactNode } from 'react';
import { BookOpen, Check, FileText, Search, Sparkles } from './animated-icons';
import { matchesSearch } from '@/lib/exam-library';
import type { Template } from '@/lib/model';

export default function TemplateLibrary({ templates, selected, renderDefault, renderActions }: {
  templates: Template[];
  selected: string | null;
  renderDefault: () => ReactNode;
  renderActions: (template: Template) => ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState('all');
  const visible = templates.filter(template =>
    matchesSearch(`${template.name} ${template.filename}`, query) &&
    (format === 'all' || (format === 'pdf' ? /\.pdf$/i.test(template.filename) : /\.docx?$/i.test(template.filename))));
  const showBuiltin = format === 'all' && matchesSearch('Modelo Provaai A4', query);
  const selectedName = templates.find(template => template.id === selected)?.name ?? 'Modelo Provaai';
  return <section className="template-library" aria-label="Biblioteca de modelos">
    <div className="library-overview">
      <span className="overview-symbol"><BookOpen size={24} /></span>
      <div><span className="section-kicker">SEU PONTO DE PARTIDA</span><h2>{selectedName}</h2>
        <p>Seu modelo padrão. Você pode escolher outro para cada turma.</p></div>
      <span className="library-total"><strong>{templates.length + 1}</strong> {templates.length ? 'modelos disponíveis' : 'modelo disponível'}</span>
    </div>
    <div className="collection-toolbar">
      <div className="format-switch" role="group" aria-label="Formato dos modelos">
        {[['all', 'Todos'], ['pdf', 'PDF'], ['word', 'Word']].map(([value, label]) =>
          <button type="button" key={value} aria-pressed={format === value} onClick={() => setFormat(value)}>{label}</button>)}
      </div>
      <label className="collection-search"><Search size={17} /><input aria-label="Buscar modelos" placeholder="Buscar um modelo…" value={query} onChange={event => setQuery(event.target.value)} /></label>
    </div>
    <p className="collection-count" role="status">{visible.length + Number(showBuiltin)} {visible.length + Number(showBuiltin) === 1 ? 'modelo nesta seleção' : 'modelos nesta seleção'}</p>
    <div className="model-collection">
      {showBuiltin && <article className={`model-card ${selected === null ? 'is-default' : ''}`}>
        <ModelPreview kind="builtin" selected={selected === null} />
        <div className="model-card-body"><span className="section-kicker">PRONTO PARA USAR</span><h3>Modelo Provaai</h3>
          <p>Formato A4, identificação do aluno e espaço para cada resposta.</p>
          <div className="model-primary-action">{renderDefault()}</div>
          <div className="model-footnote"><Sparkles size={15} />Comece sem enviar um arquivo</div>
        </div>
      </article>}
      {visible.map(template => <article key={template.id} className={`model-card ${selected === template.id ? 'is-default' : ''}`}>
        <ModelPreview kind={/\.pdf$/i.test(template.filename) ? 'pdf' : 'word'} selected={selected === template.id} />
        <div className="model-card-body"><span className="section-kicker">MODELO DA SUA ESCOLA</span>
          <h3>{template.name}</h3><p className="model-filename" title={template.filename}>{template.filename}</p>
          {template.reference_text && <p className="model-description">{template.reference_text.slice(0, 100)}</p>}
          {renderActions(template)}
        </div>
      </article>)}
    </div>
    {!showBuiltin && !visible.length && <div className="collection-empty"><Search size={26} /><h3>Nenhum modelo encontrado</h3>
      <p>{query ? 'Tente outro nome ou remova o filtro de formato.' : `Seus modelos ${format === 'pdf' ? 'PDF' : 'Word'} aparecerão aqui depois do envio.`}</p>
      <button type="button" className="text-button" onClick={() => { setQuery(''); setFormat('all'); }}>Ver todos os modelos</button></div>}
    <div className="model-format-guide"><BookOpen size={19} /><p><strong>Cada formato, um jeito de usar.</strong> No PDF, recorte o cabeçalho. No Word, aproveite a diagramação e revise o texto extraído.</p></div>
  </section>;
}

function ModelPreview({ kind, selected }: { kind: 'builtin' | 'pdf' | 'word'; selected: boolean }) {
  return <div className={`model-preview ${kind}`}>
    <span className="model-format">{kind === 'builtin' ? 'PROVAAI' : kind === 'pdf' ? 'PDF' : 'WORD'}</span>
    {selected && <span className="model-selected"><Check size={13} />Padrão</span>}
    <div className="model-paper" aria-hidden="true"><div className="paper-heading"><FileText size={17} /><span /></div><div className="paper-rule" /><i /><i /><i /><div className="paper-answer" /></div>
    <span className="model-preview-caption">{kind === 'builtin' ? 'Organizado para ensinar' : kind === 'pdf' ? 'Cabeçalho da sua escola' : 'Seu formato, suas questões'}</span>
  </div>;
}
