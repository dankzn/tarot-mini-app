import { getSupabaseAdmin, readSession } from './_auth.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const session = readSession(request);
    if (!session?.id && !session?.telegram_id) {
      return response.status(200).json({ ok: true, authenticated: false, user: null });
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('users')
      .select('id, telegram_id, username, name, city, phone, birth_date, gender, email, status, bonus_balance, role, personal_tarologist_until, site_credentials_completed_at');

    query = session.id ? query.eq('id', session.id) : query.eq('telegram_id', session.telegram_id);

    const { data: user, error } = await query.maybeSingle();

    if (error) throw error;

    if (!user) {
      return response.status(200).json({
        ok: true,
        authenticated: false,
        user: null,
      });
    }

    return response.status(200).json({
      ok: true,
      authenticated: true,
      user: {
        ...user,
        has_site_password: Boolean(user.site_credentials_completed_at || user.email),
      },
    });
  } catch (error) {
    console.error('Site session failed:', error);
    return response.status(200).json({ ok: true, authenticated: false, user: null });
  }
}
