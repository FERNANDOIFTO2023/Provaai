import type { ExamContent } from '../lib/exam';
import { isMathematics } from '../lib/answer-space';
import { currentMathResult } from '../lib/math-review';
import '../resources/css/math-review.css';

export default function MathReview({ content, subject, index, demo }: {
  content: ExamContent; subject: string; index: number; demo: boolean;
}) {
  if (!isMathematics(subject)) return null;
  const result = demo ? undefined : currentMathResult(content, subject, index);
  const status = result?.status ?? 'needs_review';
  const title = status === 'verified' ? 'Resultado conferido' :
    status === 'mismatch' ? 'Revise o gabarito' : 'Revisão do professor';
  return <div className={`math-review math-review--${status}`}>
    <strong>{title}</strong>
    <p>{demo ? 'A conferência de cálculos está disponível ao entrar na sua conta.' :
      result?.message ?? 'Salve a revisão para conferir novamente o cálculo e o gabarito.'}</p>
  </div>;
}
