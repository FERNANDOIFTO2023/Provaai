import { edgeProxy } from '@/lib/edge-proxy';
import { supabaseUrl, supabaseKey } from '@/lib/supabase';
import { generate } from '@/supabase/functions/_shared/generate';

export function POST(req: Request) {
  const provider = process.env.AI_PROVIDER === 'mistral' ? 'mistral' : 'gemini';
  const apiKey =
    provider === 'mistral'
      ? process.env.MISTRAL_API_KEY
      : process.env.GEMINI_API_KEY;
  if (!apiKey) return edgeProxy(req, 'generate-with-mix');
  const model =
    provider === 'mistral'
      ? process.env.MISTRAL_MODEL || 'mistral-small-latest'
      : process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  return generate(req, {
    url: supabaseUrl,
    anonKey: supabaseKey,
    provider,
    model,
    apiKey,
  });
}
