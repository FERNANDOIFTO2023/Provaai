import { edgeProxy } from '@/lib/edge-proxy';

export const maxDuration = 150;

export function POST(req: Request) {
  // Uma única execução mantém Gemini e a reserva Groq junto aos secrets do Supabase.
  return edgeProxy(req, 'generate-with-mix');
}
