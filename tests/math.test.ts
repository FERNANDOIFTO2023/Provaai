import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { hasMath, splitMath } from '../lib/math-text.ts';
import { renderFormula } from '../lib/math-render.ts';
import { formulaToOmml, formatDocxMath } from '../lib/docx-math.ts';
import { examFile } from '../lib/export.ts';
import { fillDocxLayout } from '../lib/docx-layout.ts';
import { demoData } from '../lib/model.ts';

const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function formula(tex: string, display = false) {
  return { kind: 'math' as const, text: tex, source: tex, display, closed: true };
}
export const examples = [
  [String.raw`\frac{3}{4}+\frac{1}{2}`, 'f'],
  [String.raw`\sqrt{x}+\sqrt[3]{8}`, 'rad'],
  [String.raw`x^{2}+a_{1}`, 'sSup'],
  [String.raw`\int_{0}^{1} x^{2}\,dx`, 'nary'],
  [String.raw`\sum_{i=1}^{n} i`, 'nary'],
  [String.raw`\lim_{x\to 0}\frac{\sin x}{x}`, 'limLow'],
  [String.raw`\begin{pmatrix}1 & 2\\3 & 4\end{pmatrix}`, 'm'],
  [String.raw`\begin{bmatrix}x\\y\end{bmatrix}`, 'm'],
  [String.raw`\vec{v}+\hat{x}+\overline{AB}`, 'acc'],
  [String.raw`x\in\mathbb{R},\quad \alpha\leq\beta,\quad A\cup B`, 'r'],
];

test('delimitadores preservam texto, moeda, barras escapadas e ordem das fórmulas', () => {
  assert.equal(hasMath('R$ 10,00 e US$ 20; $5 + $6'), false);
  assert.equal(hasMath(String.raw`\\(literal\\)`), false);
  const parts = splitMath(String.raw`Calcule \(x^2\). Depois \[\sqrt{x}\] e $$\frac12$$.`);
  assert.deepEqual(parts.filter(p => p.kind === 'math').map(p => p.display), [false, true, true]);
  assert.equal(parts.map(p => p.kind === 'math' ? p.source : p.text).join(''), String.raw`Calcule \(x^2\). Depois \[\sqrt{x}\] e $$\frac12$$.`);
  const unfinished = splitMath(String.raw`Valor \(\frac{1}{`)[1];
  assert(unfinished.kind === 'math' && !unfinished.closed);
  assert.throws(() => renderFormula(unfinished), /Confira/);
});

test('fórmulas usuais produzem HTML/MathML e equações Word estruturadas', () => {
  for (const [tex, tag] of examples) {
    const part = formula(tex, true);
    assert.match(renderFormula(part), /<math /);
    const omml = formulaToOmml(part);
    const xml = new DOMParser().parseFromString(omml, 'application/xml');
    assert(xml.getElementsByTagNameNS(M, tag).length > 0, tex + ' → ' + tag);
    assert(!omml.includes('annotation'));
    assert(!omml.includes('parsererror'));
  }
});

test('entrada inválida, recursos externos e macros não geram HTML confiável nem Word quebrado', () => {
  for (const tex of [String.raw`\frac{1}{`, String.raw`\href{https://example.test}{x}`, String.raw`\includegraphics{https://example.test/a}`, String.raw`\htmlClass{x}{a}`, String.raw`\def\a{\a}\a`, 'x'.repeat(3001)]) {
    assert.throws(() => renderFormula(formula(tex)), /Confira/);
    assert.throws(() => formulaToOmml(formula(tex)), /PROVAAI_INVALID_MATH/);
  }
  const safe = renderFormula(formula(String.raw`\text{<script>alert(1)</script>}`));
  assert(!safe.includes('<script>'));
});

test('integral tem argumento, matrizes têm delimitadores extensíveis e conjuntos mantêm o símbolo', () => {
  const integral = new DOMParser().parseFromString(formulaToOmml(formula(String.raw`\int_0^1 x^2\,dx`)), 'application/xml');
  const nary = integral.getElementsByTagNameNS(M, 'nary')[0];
  const argument = Array.from(nary.childNodes).find(n => n.localName === 'e');
  assert(argument?.textContent?.includes('x'));
  const matrix = formulaToOmml(formula(String.raw`\begin{vmatrix}1&2\\3&4\end{vmatrix}`));
  assert(matrix.includes('<m:d>'));
  assert(matrix.includes('<m:grow m:val="1"'));
  assert(formulaToOmml(formula(String.raw`\mathbb{R}`)).includes('ℝ'));
});

function mathExam() {
  const exam = demoData().exams[0];
  exam.status = 'approved';
  exam.content.instructions = String.raw`Considere \(x\in\mathbb{R}\).`;
  exam.content.questions = [{statement: String.raw`Calcule \(\frac{1}{2}+\frac{1}{4}\).`, type: 'objective',
    options: [String.raw`\(\frac{3}{4}\)`, String.raw`\(\frac{1}{4}\)`, '1', '2'], answer: String.raw`\(\frac{3}{4}\)`, objective: 'Somar frações', points: 10}];
  return exam;
}

test('DOCX sem modelo mantém fórmulas editáveis em enunciado, alternativas e gabarito', async () => {
  const exam = mathExam();
  for (const answerKey of [false, true]) {
    const bytes = new Uint8Array(await (await examFile(exam, 'docx', answerKey)).arrayBuffer());
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file('word/document.xml')!.async('string');
    assert(!xml.includes('\\frac'));
    const parsed = new DOMParser().parseFromString(xml, 'application/xml');
    assert.equal(parsed.getElementsByTagNameNS(M, 'f').length, answerKey ? 3 : 4);
    assert.equal(xml.includes('Resposta:'), answerKey);
    assert.deepEqual(await formatDocxMath(bytes), bytes, 'converter novamente não altera equações existentes');
  }
});

test('DOCX com modelo preserva cabeçalho, margens e equações já existentes', async () => {
  const zip = new JSZip();
  zip.file('word/document.xml', `<w:document xmlns:w="${W}" xmlns:m="${M}"><w:body><w:p><m:oMath><m:r><m:t>H</m:t></m:r></m:oMath><w:r><w:t>Aluno:</w:t></w:r></w:p><w:p><w:r><w:t>Atividade antiga</w:t></w:r></w:p><w:sectPr><w:pgMar w:top="1440"/></w:sectPr></w:body></w:document>`);
  zip.file('word/header1.xml', 'Cabeçalho institucional');
  const bytes = await fillDocxLayout(await zip.generateAsync({type:'uint8array'}), mathExam(), 'Turma A', 'Professor', false);
  const output = await JSZip.loadAsync(bytes);
  const xml = await output.file('word/document.xml')!.async('string');
  assert(xml.includes('<m:t>H</m:t>'));
  assert(xml.includes('w:top="1440"'));
  assert(!xml.includes('Atividade antiga'));
  assert(!xml.includes('\\frac'));
  assert.equal(await output.file('word/header1.xml')!.async('string'), 'Cabeçalho institucional');
});

test('exportação recusa fórmula incompleta e PDF simples da demonstração não imprime LaTeX', async () => {
  const exam = mathExam();
  await assert.rejects(examFile(exam, 'pdf'), /Na demonstração, baixe o DOCX/);
  exam.content.questions[0].statement = String.raw`Calcule \(\frac{1}{`;
  await assert.rejects(examFile(exam, 'docx'), /PROVAAI_INVALID_MATH/);
});
