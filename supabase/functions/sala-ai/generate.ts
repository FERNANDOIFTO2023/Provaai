import { generate as generateExam } from '../_shared/generate.ts';

export function generate(req: Request) {
  return generateExam(req, {
    url: Deno.env.get('SUPABASE_URL')!,
    anonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
    provider: 'gemini',
    model: Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite',
    apiKey: Deno.env.get('GEMINI_API_KEY') || req.headers.get('x-gemini-key'),
  });
}
