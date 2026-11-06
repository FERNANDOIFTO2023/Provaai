export async function geminiQuestions(
  apiKey: string,
  model: string,
  instruction: string,
  context: unknown,
) {
  const deadline = AbortSignal.timeout(90000);
  const request = (selected: string) => fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selected)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruction }] },
        contents: [{ parts: [{ text: JSON.stringify(context) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 12000,
        },
      }),
      signal: deadline,
    },
  );
  let response = await request(model);
  if (response.status === 503 && model === 'gemini-3.5-flash-lite') {
    await response.body?.cancel();
    response = await request('gemini-3.1-flash-lite');
  }
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    const reason = String(details.error?.message ?? '');
    if (response.status === 429) throw new Error('A cota da IA foi atingida. Aguarde antes de tentar novamente.');
    if (response.status === 503) throw new Error('O Gemini está temporariamente indisponível. Tente novamente no rascunho.');
    if (/location|region/i.test(reason)) throw new Error('O Gemini não está disponível na região desta execução.');
    if (/API key/i.test(reason) || response.status === 401 || response.status === 403)
      throw new Error('O Gemini recusou a credencial de geração.');
    if (response.status === 404) throw new Error('O modelo selecionado não está disponível no Gemini.');
    throw new Error(`O Gemini recusou a geração (HTTP ${response.status}).`);
  }
  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const raw = payload.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || '')
    .join('');
  if (!raw) throw new Error('A IA não retornou questões. Revise os tópicos.');
  return raw;
}
