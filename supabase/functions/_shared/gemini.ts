import { aiFetch, aiJson, AiProviderError } from './ai-error.ts';

export async function geminiQuestions(
  apiKey: string,
  model: string,
  instruction: string,
  context: unknown,
  options: { signal?: AbortSignal; maxOutputTokens?: number; temperature?: number; allowModelFallback?: boolean } = {},
) {
  const deadline = options.signal ?? AbortSignal.timeout(90000);
  const request = (selected: string) => aiFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selected)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruction }] },
        contents: [{ parts: [{ text: JSON.stringify(context) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: options.maxOutputTokens ?? 12000,
          ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
        },
      }),
      signal: deadline,
    },
  );
  let response = await request(model);
  if (response.status === 503 && model === 'gemini-3.5-flash-lite' && options.allowModelFallback !== false) {
    await response.body?.cancel();
    response = await request('gemini-3.1-flash-lite');
  }
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    const reason = String(details.error?.message ?? '');
    if (response.status === 429) throw new AiProviderError('A cota da IA foi atingida. Aguarde antes de tentar novamente.', true);
    if (response.status >= 500 || response.status === 408) throw new AiProviderError('O Gemini está temporariamente indisponível. Tente novamente no rascunho.', true);
    if (/location|region/i.test(reason)) throw new AiProviderError('O Gemini não está disponível na região desta execução.', true);
    if (/API key/i.test(reason) || response.status === 401 || response.status === 403)
      throw new AiProviderError('O Gemini recusou a credencial de geração.', true);
    if (response.status === 404) throw new AiProviderError('O modelo selecionado não está disponível no Gemini.', true);
    throw new AiProviderError(`O Gemini recusou a geração (HTTP ${response.status}).`, false);
  }
  const payload = (await aiJson(response)) as {
    candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    promptFeedback?: { blockReason?: string };
  };
  const candidate = payload.candidates?.[0];
  if (payload.promptFeedback?.blockReason || (candidate?.finishReason && candidate.finishReason !== 'STOP'))
    throw new AiProviderError('O Gemini não concluiu este pedido. Revise os tópicos ou reduza a quantidade de questões.', false);
  const raw = payload.candidates?.[0]?.content?.parts
    ?.filter((p) => !p.thought).map((p) => p.text || '')
    .join('');
  if (!raw) throw new Error('A IA não retornou questões. Revise os tópicos.');
  return raw;
}
