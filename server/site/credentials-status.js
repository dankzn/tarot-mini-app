import { getSupabaseAdmin, readJsonBody } from './_auth.js';

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = request.method === 'POST' ? await readJsonBody(request) : {};
    const telegramId = Number(request.query?.telegram_id || body.telegram_id || body.telegramId || 0);

    if (!telegramId) {
      return response.status(400).json({ ok: false, error: 'Telegram ID не найден' });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, site_credentials_completed_at')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) {
      return response.status(404).json({ ok: false, error: 'Пользователь не найден' });
    }

    const { data: credentials, error: credentialsError } = await supabase
      .from('site_auth_credentials')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (credentialsError) {
      console.warn('Site credentials status lookup skipped:', credentialsError);
    }

    const hasSitePassword = Boolean(user.site_credentials_completed_at || credentials);

    return response.status(200).json({
      ok: true,
      email: user.email || null,
      has_site_password: hasSitePassword,
      needs_credentials: !user.email || !hasSitePassword,
      site_credentials_completed_at: user.site_credentials_completed_at || null,
    });
  } catch (error) {
    console.error('Site credentials status failed:', error);
    return response.status(500).json({ ok: false, error: 'Не удалось проверить данные для входа' });
  }
}
