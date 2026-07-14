import {
  getSupabaseAdmin,
  normalizeEmail,
  readJsonBody,
  readSession,
  validateEmail,
} from './_auth.js';
import { saveSitePassword } from './_site-credentials.js';

const selectUserFields =
  'id, telegram_id, username, name, city, phone, birth_date, gender, email, status, bonus_balance, role, personal_tarologist_until, site_credentials_completed_at';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const session = readSession(request);
    if (!session?.id && !session?.telegram_id) {
      return response.status(401).json({
        ok: false,
        error: 'Сначала войдите через Telegram или почту',
      });
    }

    const body = await readJsonBody(request);
    const password = String(body.password || '');
    const passwordRepeat = body.passwordRepeat === undefined ? password : String(body.passwordRepeat || '');

    if (password.length < 8) {
      return response.status(400).json({ ok: false, error: 'Пароль должен быть от 8 символов' });
    }

    if (password !== passwordRepeat) {
      return response.status(400).json({ ok: false, error: 'Пароли не совпадают' });
    }

    const supabase = getSupabaseAdmin();
    let query = supabase.from('users').select(selectUserFields);
    query = session.id ? query.eq('id', session.id) : query.eq('telegram_id', session.telegram_id);

    const { data: user, error: userError } = await query.maybeSingle();
    if (userError) throw userError;

    if (!user) {
      return response.status(404).json({ ok: false, error: 'Профиль не найден' });
    }

    const email = normalizeEmail(body.email || user.email);
    if (!validateEmail(email)) {
      return response.status(400).json({ ok: false, error: 'Сначала укажите почту в профиле' });
    }

    if (email !== user.email) {
      const { data: emailOwner, error: emailOwnerError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (emailOwnerError) throw emailOwnerError;
      if (emailOwner && emailOwner.id !== user.id) {
        return response.status(409).json({ ok: false, error: 'Эта почта уже привязана к другому профилю' });
      }
    }

    const now = new Date().toISOString();
    await saveSitePassword(supabase, user.id, password);

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        email,
        site_credentials_completed_at: now,
      })
      .eq('id', user.id)
      .select(selectUserFields)
      .single();

    if (updateError) throw updateError;

    return response.status(200).json({
      ok: true,
      user: {
        ...updatedUser,
        has_site_password: true,
      },
    });
  } catch (error) {
    console.error('Site password update failed:', error);
    return response.status(500).json({
      ok: false,
      error: 'Не удалось обновить пароль',
      reason: error?.message || String(error),
      code: error?.code || null,
      details: error?.details || null,
    });
  }
}
