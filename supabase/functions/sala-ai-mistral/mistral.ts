// No automatic paid-provider fallback. Account entitlement is verified before activation.
async function requestMistral(
  path: string,
  key: string,
  body: unknown,
  fetcher: typeof fetch,
  signal = AbortSignal.timeout(90000),
) {
  if (!key) throw new Error('Configure MISTRAL_API_KEY no servidor.');
  const response = await fetcher(`https://api.mistral.ai/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    if (response.status === 429)
      throw new Error(
        'A cota gratuita da Mistral foi atingida. Aguarde antes de tentar novamente.',
      );
    if (response.status === 401 || response.status === 403)
      throw new Error(
        'A chave Mistral não tem acesso a este recurso. Confira a chave e as permissões do plano gratuito.',
      );
    if (response.status === 402)
      throw new Error(
        'Este recurso não está incluído na cota disponível. Nenhum plano pago foi ativado pelo site.',
      );
    throw new Error('A Mistral não concluiu o processamento. Tente novamente.');
  }
  return response.json() as Promise<{
    choices?: { finish_reason?: string; message?: { content?: string } }[];
    pages?: { markdown?: string }[];
  }>;
}
export async function mistralQuestions(
  key: string,
  model: string,
  instruction: string,
  context: unknown,
  fetcher: typeof fetch = fetch,
  options: { signal?: AbortSignal; maxOutputTokens?: number; temperature?: number } = {},
) {
  const result = await requestMistral(
    'chat/completions',
    key,
    {
      model,
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: JSON.stringify(context) },
      ],
      response_format: { type: 'json_object' },
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxOutputTokens ?? 12000,
    },
    fetcher,
    options.signal,
  );
  const choice = result.choices?.[0];
  if (choice?.finish_reason === 'length')
    throw new Error(
      'A resposta foi interrompida. Reduza o número de questões.',
    );
  const text = choice?.message?.content;
  if (typeof text !== 'string' || !text.trim())
    throw new Error('A Mistral não retornou questões.');
  return text;
}
export async function mistralPdf(
  key: string,
  model: string,
  base64: string,
  fetcher: typeof fetch = fetch,
) {
  const result = await requestMistral(
    'ocr',
    key,
    {
      model,
      document: {
        type: 'document_url',
        document_url: `data:application/pdf;base64,${base64}`,
      },
      include_image_base64: false,
    },
    fetcher,
  );
  if (!Array.isArray(result.pages) || !result.pages.length)
    throw new Error('O PDF não contém páginas legíveis.');
  const pages = result.pages.map((page: { markdown?: string }) => {
    if (typeof page.markdown !== 'string')
      throw new Error('A leitura do PDF ficou incompleta.');
    return page.markdown;
  });
  return pages.join('\n\n');
}
