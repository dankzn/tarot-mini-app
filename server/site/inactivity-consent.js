import { getSupabaseAdmin, readJsonBody, readSession } from './_auth.js';

const selectUserFields =
  'id, telegram_id, username, name, city, phone, birth_date, gender, email, status, bonus_balance, role, personal_tarologist_until, site_credentials_completed_at, inactivity_notice_accepted_at, last_activity_at';

const buildUserQuery = (supabase, session, body) => {
  let query = supabase.from('users').select(selectUserFields);

  if (session?.id) return query.eq('id', session.id);
  if (session?.telegram_id) return query.eq('telegram_id', session.telegram_id);

  const userId = String(body.user_id || body.userId || '').trim();
  const telegramId = body.telegram_id || body.telegramId;

  if (userId && telegramId) {
    return query.eq('id', userId).eq('telegram_id', telegramId);
  }

  return null;
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(request);

    if (body.accepted !== true) {
      return response.status(400).json({ ok: false, error: 'Нужно подтвердить условие удаления аккаунта' });
    }

    const supabase = getSupabaseAdmin();
    const session = readSession(request);
    const query = buildUserQuery(supabase, session, body);

    if (!query) {
      return response.status(401).json({ ok: false, error: 'Пользователь не найден' });
    }

    const { data: user, error: userError } = await query.maybeSingle();
    if (userError) throw userError;
    if (!user) return response.status(404).json({ ok: false, error: 'Пользователь не найден' });

    const now = new Date().toISOString();
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        inactivity_notice_accepted_at: now,
        last_activity_at: now,
      })
      .eq('id', user.id)
      .select(selectUserFields)
      .single();

    if (updateError) throw updateError;

    return response.status(200).json({ ok: true, user: updatedUser });
  } catch (error) {
    console.error('Inactivity consent failed:', error);
    return response.status(500).json({
      ok: false,
      error: 'Не удалось сохранить подтверждение',
      reason: error?.message || String(error),
      code: error?.code || null,
      details: error?.details || null,
    });
  }
}
