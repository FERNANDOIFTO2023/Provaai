/*
 * Documentos / espaço de resposta
 * Centraliza a identificação de matérias matemáticas e a altura das linhas de resposta. Word e
 * geração padrão reutilizam essas medidas para manter espaço consistente.
 */
/** Use the requested subject, not symbols or an unrelated model, to choose the answer area. */
export function isMathematics(subject: string): boolean {
  const normalized = subject.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b(matematica[s]?|mathematics|math|calculo|algebra|geometria|aritmetica|trigonometria|estatistica)\b/.test(normalized);
}

export const answerRows = 5;
export const answerRowTwips = 360;
