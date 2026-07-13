import {
  buildSessionCookie,
  getSupabaseAdmin,
  getSupabaseAuthClient,
  normalizeEmail,
  readJsonBody,
  sessionPayloadFromUser,
  signSession,
  validateEmail,
  verifyPassword,
} from './_auth.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(request);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');

    if (!validateEmail(email) || !password) {
      return response.status(400).json({ ok: false, error: 'Проверьте почту и пароль' });
    }

    const supabase = getSupabaseAdmin();
    const authClient = getSupabaseAuthClient();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, telegram_id, username, name, email, role')
      .eq('email', email)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) {
      return response.status(401).json({ ok: false, error: 'Неверная почта или пароль' });
    }

    const { data: credentials, error: credentialsError } = await supabase
      .from('site_auth_credentials')
      .select('password_hash')
      .eq('user_id', user.id)
      .maybeSingle();

    let passwordIsValid = false;

    if (!credentialsError && credentials?.password_hash) {
      passwordIsValid = verifyPassword(password, credentials.password_hash);
    }

    if (!passwordIsValid) {
      const { error: authError } = await authClient.auth.signInWithPassword({ email, password });
      passwordIsValid = !authError;
    }

    if (!passwordIsValid) {
      return response.status(401).json({ ok: false, error: 'Неверная почта или пароль' });
    }

    const sessionToken = signSession(sessionPayloadFromUser(user));
    response.setHeader('Set-Cookie', buildSessionCookie(sessionToken, request));
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Site email login failed:', error);
    return response.status(500).json({ ok: false, error: 'Не удалось войти' });
  }
}
