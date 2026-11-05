import { createClient } from '@supabase/supabase-js';

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (Boolean(projectUrl) !== Boolean(publicKey)) {
  throw new Error('Configure a URL e a chave pública do Supabase juntas.');
}

export const supabaseUrl = (
  projectUrl || 'https://emtolwnzcrtlbhywfxuc.supabase.co'
).replace(/\/$/, '');
// A chave pública identifica o aplicativo. As políticas de acesso restringem cada conta.
export const supabaseKey =
  publicKey || 'sb_publishable_LgDDzsvH6yDWZWG41wfLug_P5UeffgU';
export const supabase = createClient(supabaseUrl, supabaseKey);
