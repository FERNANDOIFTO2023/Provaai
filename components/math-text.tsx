import { useMemo } from 'react';
import { splitMath } from '../lib/math-text';
import { formulaError, renderFormula } from '../lib/math-render';
import 'katex/dist/katex.min.css';
import '../resources/css/math.css';

export default function MathText({ text }: { text: string }) {
  const parts = useMemo(() => splitMath(text).map(part => {
    if (part.kind === 'text') return part;
    try { return { ...part, html: renderFormula(part), error: false }; }
    catch { return { ...part, html: '', error: true }; }
  }), [text]);
  return <div className="math-text">{parts.map((part, i) => {
    if (part.kind === 'text') return <span key={i}>{part.text}</span>;
    if (part.error) return <span className="math-error" key={i}><code>{part.source}</code><span>{formulaError}</span></span>;
    // Only KaTeX output with trust:false reaches this sink. Plain text stays escaped by React.
    return <span className={part.display ? 'math-display' : 'math-inline'} key={i} dangerouslySetInnerHTML={{ __html: part.html }} />;
  })}</div>;
}
