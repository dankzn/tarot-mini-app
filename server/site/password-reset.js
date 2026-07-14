import {
  getSiteUrl,
  getSupabaseAdmin,
  getSupabaseAuthClient,
  normalizeEmail,
  readJsonBody,
  validateEmail,
} from './_auth.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(request);
    const email = normalizeEmail(body.email);

    if (!validateEmail(email)) {
      return response.status(400).json({ ok: false, error: 'Введите корректную почту' });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (userError) throw userError;

    if (!user) {
      return response.status(404).json({ ok: false, error: 'Профиль с такой почтой не найден' });
    }

    const authClient = getSupabaseAuthClient();
    const { error: resetError } = await authClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteUrl(request)}/site/profile?password_reset=1`,
    });

    if (resetError) throw resetError;

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Site password reset email failed:', error);
    return response.status(500).json({
      ok: false,
      error: 'Не удалось отправить письмо для сброса',
      reason: error?.message || String(error),
      code: error?.code || null,
    });
  }
}
