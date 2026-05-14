export async function createSupabaseFromEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(url, key, { auth: { persistSession: false } });
  } catch (error) {
    console.warn('[whatsapp-service] Supabase desativado: instale @supabase/supabase-js para persistir histórico no banco.', error.message);
    return null;
  }
}
