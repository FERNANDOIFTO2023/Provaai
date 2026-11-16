/*
 * Matemática / renderização
 * Configura o KaTeX usado na prévia e na exportação. Uma fórmula não suportada precisa gerar erro
 * legível, sem aceitar recursos inseguros do conteúdo recebido.
 */
import katex from 'katex';
import type { MathPart } from './math-text.ts';

export const formulaError = 'Confira a fórmula: ela está incompleta ou usa um comando não suportado.';

export function renderFormula(part: Extract<MathPart, { kind: 'math' }>, output: 'htmlAndMathml' | 'mathml' = 'htmlAndMathml'): string {
  if (!part.closed || !part.text.trim() || part.text.length > 3000 ||
      /\\(?:href|url|includegraphics|html\w*|def|gdef|edef|xdef|let|futurelet|newcommand|renewcommand|providecommand|global|color|textcolor|class|style)\b/.test(part.text)) {
    throw new Error(formulaError);
  }
  try {
    return katex.renderToString(part.text, {
      displayMode: part.display, output, throwOnError: true,
      trust: false, strict: 'error', maxExpand: 200, maxSize: 10,
      macros: {},
    });
  } catch {
    // Não exponha mensagens do analisador como HTML: elas podem conter o texto digitado pelo usuário.
    throw new Error(formulaError);
  }
}
