import {
  getSupabaseAuthClient,
  getSupabaseAdmin,
  getSiteAuthEmailCandidates,
  normalizeEmail,
  readJsonBody,
  validateEmail,
} from './_auth.js';
import { saveSitePassword } from './_site-credentials.js';

const allowedProfileFields = ['name', 'city', 'phone', 'birth_date', 'gender'];

const isAlreadyRegisteredAuthError = (error) =>
  /already|registered|exists|duplicate/i.test(String(error?.message || error || ''));

const getPublicCredentialsError = (error) => {
  const message = String(error?.message || error || '');
  const details = String(error?.details || '');
  const code = String(error?.code || '');
  const combined = `${message} ${details} ${code}`;

  if (/duplicate key|users_email_lower_unique|23505/i.test(combined)) {
    return 'Эта почта уже привязана к другому профилю';
  }

  if (/invalid.*email|email.*invalid|validate email/i.test(combined)) {
    return 'Введите корректную почту';
  }

  if (/password/i.test(combined)) {
    return 'Пароль не принят. Используйте минимум 8 символов';
  }

  if (/SITE_AUTH_RPC_FORBIDDEN|28000/i.test(combined)) {
    return 'В Supabase не настроен секрет для сохранения пароля. Запустите настройку site_auth_rpc_secret';
  }

  if (/upsert_site_auth_credentials_rpc|function .* does not exist|42883/i.test(combined)) {
    return 'В Supabase не применена миграция для входа на сайт';
  }

  if (/row-level security|permission denied|SITE_CREDENTIALS_SAVE_FAILED|42501/i.test(combined)) {
    return 'Не удалось сохранить пароль для входа. Проверьте настройки доступа к базе';
  }

  return 'Не удалось сохранить данные для входа';
};

const syncAuthAccount = async (authClient, user, email, password) => {
  let lastError = null;

  for (const authEmail of getSiteAuthEmailCandidates({ ...user, email })) {
    const { error: authError } = await authClient.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: {
          login_email: email,
          telegram_id: user.telegram_id,
          username: user.username || null,
          name: user.name || 'Клиент',
          site_user_id: user.id,
        },
      },
    });

    if (!authError || isAlreadyRegisteredAuthError(authError)) {
      return { ok: true, authEmail, alreadyRegistered: Boolean(authError) };
    }

    lastError = authError;
  }

  return { ok: false, error: lastError?.message || String(lastError || 'Supabase Auth signup failed') };
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(request);
    const telegramId = Number(body.telegram_id || body.telegramId || 0);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');

    if (!telegramId) {
      return response.status(400).json({ ok: false, error: 'Telegram ID не найден' });
    }

    if (!validateEmail(email)) {
      return response.status(400).json({ ok: false, error: 'Введите корректную почту' });
    }

    if (password.length < 8) {
      return response.status(400).json({ ok: false, error: 'Пароль должен быть от 8 символов' });
    }

    if (body.personalDataAccepted !== true || body.offerAccepted !== true) {
      return response.status(400).json({ ok: false, error: 'Нужно принять условия регистрации' });
    }

    const supabase = getSupabaseAdmin();
    const authClient = getSupabaseAuthClient();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, telegram_id, username, name, city, phone, birth_date, gender, email')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) {
      return response.status(404).json({ ok: false, error: 'Пользователь не найден' });
    }

    const { data: emailOwner, error: emailOwnerError } = await supabase
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (emailOwnerError) throw emailOwnerError;
    if (emailOwner && emailOwner.id !== user.id) {
      return response.status(409).json({ ok: false, error: 'Эта почта уже привязана к другому профилю' });
    }

    const authResult = await syncAuthAccount(authClient, { ...user, name: body.name || user.name }, email, password);

    const profilePatch = allowedProfileFields.reduce((patch, field) => {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        patch[field] = body[field] || null;
      }
      return patch;
    }, {});

    const { error: updateError } = await supabase
      .from('users')
      .update({
        ...profilePatch,
        email,
      })
      .eq('id', user.id)
      .select('id, telegram_id, username, name, city, phone, birth_date, gender, email, status, bonus_balance, role')
      .single();

    if (updateError) throw updateError;

    const credentialsResult = await saveSitePassword(supabase, user.id, password, { required: false });

    if (!credentialsResult.ok) {
      console.warn(
        'Site credentials save skipped:',
        credentialsResult.error || credentialsResult.code || 'unknown error',
      );
    }

    if (!authResult.ok && !credentialsResult.ok) {
      throw new Error(
        `${authResult.error}; ${credentialsResult.error || 'SITE_CREDENTIALS_SAVE_FAILED'}`,
      );
    }

    const { data: completedUser, error: completedError } = await supabase
      .from('users')
      .update({ site_credentials_completed_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('id, telegram_id, username, name, city, phone, birth_date, gender, email, status, bonus_balance, role')
      .single();

    if (completedError) throw completedError;

    return response.status(200).json({
      ok: true,
      user: {
        ...completedUser,
        has_site_password: true,
      },
    });
  } catch (error) {
    console.error('Site credentials failed:', error);
    return response.status(500).json({
      ok: false,
      error: getPublicCredentialsError(error),
      reason: error?.message || String(error),
      code: error?.code || null,
      details: error?.details || null,
    });
  }
}
