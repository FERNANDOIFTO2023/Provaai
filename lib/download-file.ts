import { apiFetch } from './api-client.ts';
import type { Exam } from './model';
import type { FileProgress } from './export';

export async function fetchExamFile(exam: Exam, format: 'pdf' | 'docx', answerKey: boolean, report: FileProgress) {
  const id = crypto.randomUUID();
  const probe = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const poll = async () => {
    try {
      const response = await apiFetch('/api/export/progress/' + id, { signal: probe.signal, cache: 'no-store' });
      if (response.ok) {
        const { stage } = await response.json();
        if (!probe.signal.aborted && stage === 'approved') report(1, 'Montando o documento');
        if (!probe.signal.aborted && stage === 'layout') report(2, 'Convertendo o documento em PDF');
      }
    } catch {
      // A transferência continua se uma consulta de progresso falhar.
    } finally {
      if (!probe.signal.aborted) timer = setTimeout(poll, 900);
    }
  };
  timer = setTimeout(poll, 450);
  try {
    const response = await apiFetch('/api/export/exam', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: exam.id, format, answerKey, progressId: id }),
      signal: AbortSignal.timeout(160_000),
    });
    probe.abort();
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error?.message || body.error || body.message || 'Não foi possível baixar a prova.');
    }
    const ready = format === 'pdf' ? 3 : 2;
    const label = 'Recebendo o arquivo';
    report(ready, label);
    const size = Number(response.headers.get('X-Document-Length'));
    if (!size || !response.body) return await response.blob();
    const reader = response.body.getReader();
    const parts: BlobPart[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value as Uint8Array<ArrayBuffer>);
      received += value.byteLength;
      report(ready + Math.min(1, received / size), label);
    }
    if (received !== size) throw new Error('O arquivo chegou incompleto. Tente baixar novamente.');
    return new Blob(parts, { type: response.headers.get('Content-Type') || '' });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') throw new Error('O download excedeu o tempo de espera. Tente novamente.');
    throw error;
  } finally {
    clearTimeout(timer);
    probe.abort();
  }
}
