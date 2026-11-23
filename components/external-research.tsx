import type { Exam } from '@/lib/model';

/** Exibe as fontes da consulta externa; HTML do provedor permanece isolado em iframe sem scripts. */
export default function ExternalResearch({ research }: { research: Exam['external_research'] }) {
  if (!research) return null;
  return <details className="external-research"><summary>Fontes externas consultadas nesta prova</summary>
    <p>A pesquisa externa estava habilitada. A prova pode conter assuntos além dos anexos.</p>
    <p className="research-text">{research.text}</p>
    <ul>{research.sources.filter(s => /^https:\/\//.test(s.url)).map((source, i) => <li key={i}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul>
    {research.suggestions && <iframe title="Sugestões de pesquisa do Google" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={research.suggestions} referrerPolicy="no-referrer" />}
  </details>;
}
