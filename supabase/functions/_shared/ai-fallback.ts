import { AiProviderError, canUseFallback } from './ai-error.ts';
import { geminiQuestions } from './gemini.ts';
import { groqQuestions } from './groq.ts';

type Settings = { apiKey?: string | null; model: string; groqApiKey?: string | null };

// Uma instância por prova. Se Gemini falhar, a revisão continua na Groq.
// Os prazos das quatro tentativas somam no máximo 100s, abaixo do proxy (120s).
export function examAi(settings: Settings) {
  let useGroq = !settings.apiKey;
  return async (instruction: string, context: unknown, stage: 'generation' | 'review') => {
    const review = stage === 'review';
    if (!useGroq) {
      try {
        return await geminiQuestions(settings.apiKey!, settings.model, instruction, context, {
          signal: AbortSignal.timeout(settings.groqApiKey ? (review ? 10000 : 35000) : (review ? 25000 : 90000)),
          maxOutputTokens: review ? 2048 : 12000,
          ...(review ? { temperature: 0 } : {}),
          allowModelFallback: !settings.groqApiKey,
        });
      } catch (error) {
        if (!settings.groqApiKey || !canUseFallback(error)) throw error;
        useGroq = true;
        // Apenas metadados: nunca registrar contexto, respostas, tokens ou chaves.
        console.info(JSON.stringify({ event: 'ai_fallback', from: 'gemini', to: 'groq', stage }));
      }
    }
    if (!settings.groqApiKey)
      throw new AiProviderError('Configure a chave de IA no servidor.', false);
    return groqQuestions(settings.groqApiKey, instruction, context, {
      signal: AbortSignal.timeout(review ? 15000 : 40000),
      maxOutputTokens: review ? 2048 : 6000,
      ...(review ? { temperature: 0 } : {}),
    });
  };
}
