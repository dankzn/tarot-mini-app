import { getSupabaseAdmin, readSession } from './_auth.js';

const selectUserFields =
  'id, telegram_id, username, name, city, phone, birth_date, gender, email, status, bonus_balance, role, personal_tarologist_until, site_credentials_completed_at, inactivity_notice_accepted_at, last_activity_at';

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
      .select(selectUserFields);

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

    const now = new Date().toISOString();
    const { data: activeUser, error: activityError } = await supabase
      .from('users')
      .update({ last_activity_at: now })
      .eq('id', user.id)
      .select(selectUserFields)
      .single();

    if (activityError) {
      console.warn('Site activity update skipped in session:', activityError);
    }

    const { data: credentials, error: credentialsError } = await supabase
      .from('site_auth_credentials')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (credentialsError) {
      console.warn('Site credentials lookup skipped in session:', credentialsError);
    }

    return response.status(200).json({
      ok: true,
      authenticated: true,
      user: {
        ...(activeUser || user),
        has_site_password: Boolean((activeUser || user).site_credentials_completed_at || credentials),
      },
    });
  } catch (error) {
    console.error('Site session failed:', error);
    return response.status(200).json({ ok: true, authenticated: false, user: null });
  }
}
