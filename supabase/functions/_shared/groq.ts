import { aiFetch, aiJson, AiProviderError } from './ai-error.ts';

export const GROQ_MODEL = 'openai/gpt-oss-120b';

export async function groqQuestions(
  apiKey: string,
  instruction: string,
  context: unknown,
  options: { signal?: AbortSignal; maxOutputTokens?: number; temperature?: number } = {},
) {
  const response = await aiFetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: JSON.stringify(context) },
      ],
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
      include_reasoning: false,
      max_completion_tokens: options.maxOutputTokens ?? 6000,
      temperature: options.temperature ?? 0.7,
    }),
    signal: options.signal ?? AbortSignal.timeout(40000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    const message = response.status === 429
      ? 'A reserva Groq também atingiu seu limite de uso. Aguarde antes de tentar novamente.'
      : response.status === 401 || response.status === 403
        ? 'A Groq recusou a chave configurada no servidor.'
        : response.status === 413
          ? 'O contexto da prova excedeu o limite da Groq. Reduza o material de referência ou a quantidade de questões.'
          : `A Groq não concluiu a etapa (HTTP ${response.status}). Tente novamente mais tarde.`;
    throw new AiProviderError(message, false);
  }
  const result = await aiJson(response);
  const choice = result.choices?.[0];
  if (choice?.finish_reason === 'length')
    throw new AiProviderError('A resposta da Groq ficou incompleta. Reduza a quantidade de questões e tente novamente.', false);
  if (choice?.message?.refusal || choice?.finish_reason === 'content_filter')
    throw new AiProviderError('A Groq não pôde atender este pedido. Revise os tópicos.', false);
  const text = choice?.message?.content;
  if (typeof text !== 'string' || !text.trim())
    throw new AiProviderError('A Groq não retornou uma resposta válida.', false);
  return text;
}
