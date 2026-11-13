export type MathPart =
  | { kind: 'text'; text: string }
  | { kind: 'math'; text: string; source: string; display: boolean; closed: boolean };

// Single dollar signs remain ordinary text (prices and currency).
const delimiters = [
  { open: '\\(', close: '\\)', display: false },
  { open: '\\[', close: '\\]', display: true },
  { open: '$$', close: '$$', display: true },
];

function escaped(text: string, at: number): boolean {
  let slashes = 0;
  while (at > 0 && text[--at] === '\\') slashes++;
  return slashes % 2 === 1;
}

export function splitMath(text: string): MathPart[] {
  const parts: MathPart[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const delimiter = delimiters.find(d => text.startsWith(d.open, i) && !escaped(text, i));
    if (!delimiter) continue;
    if (i > start) parts.push({ kind: 'text', text: text.slice(start, i) });
    let end = i + delimiter.open.length;
    while (end < text.length && !(text.startsWith(delimiter.close, end) && !escaped(text, end))) end++;
    const closed = end < text.length;
    const after = closed ? end + delimiter.close.length : text.length;
    parts.push({ kind: 'math', text: text.slice(i + delimiter.open.length, end), source: text.slice(i, after), display: delimiter.display, closed });
    start = after;
    i = after - 1;
  }
  if (start < text.length) parts.push({ kind: 'text', text: text.slice(start) });
  return parts;
}

export const hasMath = (text: string) => splitMath(text).some(part => part.kind === 'math');
