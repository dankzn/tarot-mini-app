import { getSupabaseAdmin, readSession } from './_auth.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const session = readSession(request);
    if (!session?.telegram_id) {
      return response.status(200).json({ ok: true, authenticated: false, user: null });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, telegram_id, username, name, city, status, bonus_balance, role, personal_tarologist_until')
      .eq('telegram_id', session.telegram_id)
      .maybeSingle();

    if (error) throw error;

    return response.status(200).json({
      ok: true,
      authenticated: Boolean(user),
      user: user || null,
    });
  } catch (error) {
    console.error('Site session failed:', error);
    return response.status(200).json({ ok: true, authenticated: false, user: null });
  }
}
