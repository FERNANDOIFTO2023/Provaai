import type { Exam } from './model.ts';
import type { PdfHeader } from './pdf-header.ts';
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
  header?: PdfHeader,
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
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, Header, ImageRun } = await import(
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
                ...(header ? {size:{width:Math.round(header.width*1440/25.4),height:Math.round(header.height*1440/25.4)}} : {}),
                margin: { top: header ? Math.round((header.headerHeight+12)*1440/25.4) : 1000, right: 1000, bottom: 1000, left: 1000, header: 0 },
              },
            },
            ...(header ? {headers:{default:new Header({children:[new Paragraph({indent:{left:-1000},children:[new ImageRun({type:'png',data:header.image,
              transformation:{width:header.width*96/25.4,height:header.headerHeight*96/25.4}})]})]})}} : {}),
            children,
          },
        ],
      }),
    );
  }
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF(header ? {orientation: header.width > header.height ? 'landscape' : 'portrait', format:[header.width, header.height]} : {});
  const width = pdf.internal.pageSize.getWidth(), height = pdf.internal.pageSize.getHeight();
  const start = header ? header.headerHeight + 10 : 20;
  const drawHeader = () => { if (header) pdf.addImage(header.image,'PNG',0,0,header.width,header.headerHeight); };
  drawHeader();
  let y = start;
  const write = (s: string, size = 11) => {
    pdf.setFontSize(size);
    for (const row of pdf.splitTextToSize(s, width - 40)) {
      if (y > height - 22) {
        pdf.addPage();
        drawHeader();
        y = start;
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
    pdf.text(`${i} / ${pdf.getNumberOfPages()}`, width - 20, height - 10, {align:'right'});
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
