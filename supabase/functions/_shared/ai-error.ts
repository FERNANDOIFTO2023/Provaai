// Erros de transporte/provedor são separados de recusas e validações pedagógicas.
export class AiProviderError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'AiProviderError';
    this.retryable = retryable;
  }
}

export function canUseFallback(error: unknown) {
  return error instanceof AiProviderError && error.retryable;
}

export async function aiJson(response: Response) {
  try {
    return await response.json();
  } catch (error) {
    if (error instanceof TypeError || error instanceof SyntaxError || (error instanceof Error &&
      ['TimeoutError', 'AbortError'].includes(error.name))) {
      throw new AiProviderError('A resposta da IA não chegou completa. Tente novamente.', true);
    }
    throw error;
  }
}

export async function aiFetch(url: string, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error &&
      ['TimeoutError', 'AbortError'].includes(error.name))) {
      throw new AiProviderError('A IA não respondeu dentro do prazo ou houve uma falha de conexão.', true);
    }
    throw error;
  }
}
