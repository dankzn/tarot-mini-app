import {
  buildSessionCookie,
  getSupabaseAdmin,
  getSupabaseAuthClient,
  getSiteAuthEmailCandidates,
  hashPassword,
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
    let hasStoredSitePassword = false;

    if (!credentialsError && credentials?.password_hash) {
      hasStoredSitePassword = true;
      passwordIsValid = verifyPassword(password, credentials.password_hash);
    }

    if (credentialsError) {
      console.warn('Site credentials lookup failed:', credentialsError);
    }

    let passwordWasVerifiedBySupabase = false;

    if (!passwordIsValid) {
      for (const authEmail of getSiteAuthEmailCandidates(user)) {
        const { error: authError } = await authClient.auth.signInWithPassword({
          email: authEmail,
          password,
        });

        if (!authError) {
          passwordIsValid = true;
          passwordWasVerifiedBySupabase = true;
          break;
        }
      }
    }

    if (!passwordIsValid) {
      return response.status(401).json({
        ok: false,
        error: hasStoredSitePassword
          ? 'Неверная почта или пароль'
          : 'Для этого профиля пароль на сайте ещё не создан. Откройте регистрацию с этой же почтой и задайте пароль заново',
      });
    }

    if (passwordWasVerifiedBySupabase) {
      const { error: syncError } = await supabase
        .from('site_auth_credentials')
        .upsert(
          {
            user_id: user.id,
            password_hash: hashPassword(password),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );

      if (syncError) {
        console.warn('Site credentials sync after auth login failed:', syncError);
      }
    }

    const sessionToken = signSession(sessionPayloadFromUser(user));
    response.setHeader('Set-Cookie', buildSessionCookie(sessionToken, request));
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Site email login failed:', error);
    return response.status(500).json({ ok: false, error: 'Не удалось войти' });
  }
}
