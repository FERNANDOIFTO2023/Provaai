import { lazy, Suspense } from 'react';
import { hasMath } from '../lib/math-text';

const MathText = lazy(() => import('./math-text'));

export default function MathPreview({ text, label = 'Prévia da fórmula' }: { text: string; label?: string }) {
  if (!hasMath(text)) return null;
  return (
    <div className="math-preview" role="region" aria-label={label}>
      <span className="math-preview-label">{label}</span>
      <Suspense fallback={<span>Preparando fórmula…</span>}>
        <MathText text={text} />
      </Suspense>
    </div>
  );
}
