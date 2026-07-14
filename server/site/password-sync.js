import {
  buildSessionCookie,
  getSupabaseAdmin,
  getSupabaseAuthClient,
  readJsonBody,
  sessionPayloadFromUser,
  signSession,
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
    const body = await readJsonBody(request);
    const accessToken = String(body.accessToken || '');
    const password = String(body.password || '');
    const passwordRepeat = body.passwordRepeat === undefined ? password : String(body.passwordRepeat || '');

    if (!accessToken) {
      return response.status(401).json({ ok: false, error: 'Сессия сброса пароля не найдена' });
    }

    if (password.length < 8) {
      return response.status(400).json({ ok: false, error: 'Пароль должен быть от 8 символов' });
    }

    if (password !== passwordRepeat) {
      return response.status(400).json({ ok: false, error: 'Пароли не совпадают' });
    }

    const authClient = getSupabaseAuthClient();
    const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError) throw authError;

    const email = authData?.user?.email;
    if (!email) {
      return response.status(401).json({ ok: false, error: 'Почта в сессии сброса не найдена' });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(selectUserFields)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (userError) throw userError;
    if (!user) {
      return response.status(404).json({ ok: false, error: 'Профиль с этой почтой не найден' });
    }

    const now = new Date().toISOString();
    await saveSitePassword(supabase, user.id, password);

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ site_credentials_completed_at: now })
      .eq('id', user.id)
      .select(selectUserFields)
      .single();

    if (updateError) throw updateError;

    const sessionToken = signSession(sessionPayloadFromUser(updatedUser));
    response.setHeader('Set-Cookie', buildSessionCookie(sessionToken, request));

    return response.status(200).json({
      ok: true,
      user: {
        ...updatedUser,
        has_site_password: true,
      },
    });
  } catch (error) {
    console.error('Site password sync failed:', error);
    return response.status(500).json({
      ok: false,
      error: 'Не удалось сохранить новый пароль',
      reason: error?.message || String(error),
      code: error?.code || null,
    });
  }
}
