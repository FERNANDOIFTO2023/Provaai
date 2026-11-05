export async function geminiQuestions(
  apiKey: string,
  model: string,
  instruction: string,
  context: unknown,
) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruction }] },
        contents: [{ parts: [{ text: JSON.stringify(context) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.8,
          maxOutputTokens: 12000,
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
      signal: AbortSignal.timeout(90000),
    },
  );
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? 'A cota da IA foi atingida. Aguarde antes de tentar novamente.'
        : 'O provedor de IA não concluiu a geração.',
    );
  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const raw = payload.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || '')
    .join('');
  if (!raw) throw new Error('A IA não retornou questões. Revise os tópicos.');
  return raw;
}
