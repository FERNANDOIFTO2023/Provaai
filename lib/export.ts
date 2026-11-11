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
export type FileProgress = (steps: number, label: string) => void;
export type DownloadProgress = { completed: number; total: number; percent: number; label: string };

export async function downloadExams(
  exams: Exam[],
  format: 'pdf' | 'docx',
  answerKey = false,
  render: (exam: Exam, format: 'pdf' | 'docx', key: boolean, report: FileProgress) => Promise<Blob> =
    (exam, format, key) => examFile(exam, format, key),
  report: (progress: DownloadProgress) => void = () => {},
) {
  if (!exams.length)
    throw new Error('Selecione pelo menos uma prova aprovada.');
  const total = exams.length;
  const steps = format === 'pdf' ? 4 : 3;
  const allSteps = steps * total + (total > 1 ? 1 : 0);
  const update = (finished: number, completed: number, label: string) => {
    report({ total, completed, percent: Math.min(99, Math.floor(100 * finished / allSteps)), label });
  };
  const renderAt = (index: number) => {
    const prefix = total > 1 ? `Arquivo ${index + 1} de ${total} · ` : '';
    const progress: FileProgress = (n, label) => update(index * steps + n, index, prefix + label);
    progress(0, 'Preparando a prova');
    return render(exams[index], format, answerKey, progress);
  };
  const finish = () => report({ completed: total, total, percent: 100, label: 'Arquivo pronto' });
  if (total === 1) {
    const blob = await renderAt(0);
    downloadBlob(
      blob,
      `${answerKey ? 'gabarito' : 'prova'}_${safeName(exams[0].profile_snapshot.code)}.${format}`,
    );
    finish();
    return;
  }
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const manifest = ['id,aluno_codigo,formato,arquivo'];
  for (const [index, e] of exams.entries()) {
    const file = `${safeName(e.profile_snapshot.code)}_${e.id}.${format}`;
    zip.file(file, await (await renderAt(index)).arrayBuffer());
    manifest.push(
      `${e.id},${safeName(e.profile_snapshot.code)},${format},${file}`,
    );
    update((index + 1) * steps, index + 1, 'Arquivo preparado');
  }
  zip.file('manifesto.csv', manifest.join('\n'));
  downloadBlob(
    await zip.generateAsync({ type: 'blob' }, ({ percent }) =>
      update(total * steps + percent / 100, total, 'Montando o ZIP')),
    `provas_${new Date().toISOString().slice(0, 10)}.zip`,
  );
  finish();
}
