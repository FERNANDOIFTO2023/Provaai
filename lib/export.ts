import type { Exam } from './model.ts';
export const safeName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .slice(0, 70);
export async function examFile(
  exam: Exam,
  format: 'pdf' | 'docx',
  answerKey = false,
): Promise<Blob> {
  if (exam.status !== 'approved')
    throw new Error('Revise e aprove a prova antes de baixar.');
  const lines = [
    answerKey ? 'GABARITO DO PROFESSOR' : exam.title,
    `${exam.subject} | Aluno: ${exam.profile_snapshot.name}`,
    `Código: ${exam.profile_snapshot.code}     Data: ____/____/________`,
    exam.content.instructions,
  ];
  if (format === 'docx') {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import(
      'docx'
    );
    const children = lines.map(
      (l, i) =>
        new Paragraph({
          heading: i === 0 ? HeadingLevel.TITLE : undefined,
          children: [new TextRun(l)],
          spacing: { after: 180 },
        }),
    );
    exam.content.questions.forEach((q, i) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${i + 1}. ${q.statement} (${q.points} pontos)`,
              bold: true,
            }),
          ],
          spacing: { before: 240, after: 180 },
        }),
      );
      if (answerKey) children.push(new Paragraph(`Resposta: ${q.answer}`));
      else {
        q.options.forEach((o, j) =>
          children.push(new Paragraph(`${String.fromCharCode(65 + j)}) ${o}`)),
        );
        if (q.type === 'essay')
          for (let n = 0; n < 5; n++)
            children.push(
              new Paragraph(
                '________________________________________________________________',
              ),
            );
      }
    });
    return Packer.toBlob(
      new Document({
        sections: [
          {
            properties: {
              page: {
                margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
              },
            },
            children,
          },
        ],
      }),
    );
  }
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF();
  let y = 20;
  const write = (s: string, size = 11) => {
    pdf.setFontSize(size);
    for (const row of pdf.splitTextToSize(s, 170)) {
      if (y > 275) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(row, 20, y);
      y += size * 0.48;
    }
    y += 4;
  };
  lines.forEach((l, i) => write(l, i === 0 ? 18 : 11));
  exam.content.questions.forEach((q, i) => {
    write(`${i + 1}. ${q.statement} (${q.points} pontos)`);
    if (answerKey) write(`Resposta: ${q.answer}`);
    else {
      q.options.forEach((o, j) =>
        write(`${String.fromCharCode(65 + j)}) ${o}`),
      );
      if (q.type === 'essay')
        for (let n = 0; n < 5; n++)
          write(
            '________________________________________________________________',
          );
    }
    y += 5;
  });
  for (let i = 1; i <= pdf.getNumberOfPages(); i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.text(`${i} / ${pdf.getNumberOfPages()}`, 180, 290);
  }
  return pdf.output('blob');
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export async function downloadExams(
  exams: Exam[],
  format: 'pdf' | 'docx',
  answerKey = false,
  render: typeof examFile = examFile,
  report: (completed: number) => void = () => {},
) {
  if (!exams.length)
    throw new Error('Selecione pelo menos uma prova aprovada.');
  if (exams.length === 1) {
    const blob = await render(exams[0], format, answerKey);
    report(1);
    downloadBlob(
      blob,
      `${answerKey ? 'gabarito' : 'prova'}_${safeName(exams[0].profile_snapshot.code)}.${format}`,
    );
    return;
  }
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const manifest = ['id,aluno_codigo,formato,arquivo'];
  for (const e of exams) {
    const file = `${safeName(e.profile_snapshot.code)}_${e.id}.${format}`;
    zip.file(file, await (await render(e, format, answerKey)).arrayBuffer());
    manifest.push(
      `${e.id},${safeName(e.profile_snapshot.code)},${format},${file}`,
    );
    report(manifest.length - 1);
  }
  zip.file('manifesto.csv', manifest.join('\n'));
  downloadBlob(
    await zip.generateAsync({ type: 'blob' }),
    `provas_${new Date().toISOString().slice(0, 10)}.zip`,
  );
}
