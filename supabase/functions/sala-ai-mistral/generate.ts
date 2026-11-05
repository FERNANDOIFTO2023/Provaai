import { generate as generateExam } from '../_shared/generate.ts';

export function generate(req: Request) {
  return generateExam(req, {
    url: Deno.env.get('SUPABASE_URL')!,
    anonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
    provider: 'mistral',
    model: Deno.env.get('MISTRAL_MODEL') || 'mistral-small-latest',
    apiKey: Deno.env.get('MISTRAL_API_KEY') || req.headers.get('x-mistral-key'),
  });
}
