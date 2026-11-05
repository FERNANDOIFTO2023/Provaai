import { supabaseUrl, supabaseKey } from '@/lib/supabase';
export async function GET() {
  const provider = process.env.AI_PROVIDER === 'mistral' ? 'mistral' : 'gemini';
  let aiConfigured = !!(provider === 'mistral'
    ? process.env.MISTRAL_API_KEY
    : process.env.GEMINI_API_KEY);
  if (!aiConfigured)
    try {
      const functionName =
        provider === 'mistral' ? 'sala-ai-mistral' : 'sala-ai';
      const r = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        headers: { apikey: supabaseKey },
        signal: AbortSignal.timeout(5000),
      });
      const info = (await r.json()) as {
        aiConfigured?: boolean;
        questionMix?: boolean;
      };
      aiConfigured =
        r.ok && info.aiConfigured === true && info.questionMix === true;
    } catch {
      aiConfigured = false;
    }
  return Response.json(
    {
      aiConfigured,
      provider,
      model:
        provider === 'mistral'
          ? process.env.MISTRAL_MODEL || 'mistral-small-latest'
          : process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
