import {
  buildSessionCookie,
  getSupabaseAdmin,
  getSupabaseAuthClient,
  hashPassword,
  normalizeEmail,
  readJsonBody,
  sessionPayloadFromUser,
  signSession,
  validateEmail,
} from './_auth.js';

import crypto from 'crypto';

const selectUserFields = 'id, telegram_id, username, name, city, phone, birth_date, gender, email, status, bonus_balance, role';

const normalizeUsername = (value) =>
  String(value || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();

const isValidUsername = (username) =>
  username.length >= 2 &&
  username.length <= 64 &&
  !/[\u0000-\u001F\u007F<>]/.test(username);

const isAlreadyRegisteredAuthError = (error) =>
  /already|registered|exists|duplicate/i.test(String(error?.message || error || ''));

const buildSiteOnlyTelegramId = (email, username) => {
  const hash = crypto.createHash('sha256').update(`${email}:${username}`).digest('hex');
  const numeric = Number.parseInt(hash.slice(0, 10), 16) % 999_999_999;
  return 8_800_000_000_000 + numeric;
};

const buildProfilePayload = (payload) => ({
  username: payload.username,
  name: payload.name,
  city: payload.city || null,
  phone: payload.phone || null,
  birth_date: payload.birth_date || null,
  gender: payload.gender,
  email: payload.email,
  site_credentials_completed_at: new Date().toISOString(),
});

const syncAuthAccount = async (authClient, user, password) => {
  const { error: authError } = await authClient.auth.signUp({
    email: user.email,
    password,
    options: {
      data: {
        username: user.username,
        name: user.name,
        site_user_id: user.id,
      },
    },
  });

  if (authError && !isAlreadyRegisteredAuthError(authError)) {
    console.warn('Supabase Auth signup skipped:', authError);
  }
};

const persistSiteCredentials = async (supabase, userId, password) => {
  const { error: credentialsError } = await supabase
    .from('site_auth_credentials')
    .upsert(
      {
        user_id: userId,
        password_hash: hashPassword(password),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (credentialsError) {
    console.warn('Site credentials fallback skipped:', credentialsError);
  }
};

const sendSessionResponse = (request, response, user) => {
  const sessionToken = signSession(sessionPayloadFromUser(user));
  response.setHeader('Set-Cookie', buildSessionCookie(sessionToken, request));

  return response.status(200).json({
    ok: true,
    user: {
      ...user,
      has_site_password: true,
    },
  });
};

const createSiteUser = async (supabase, payload) => {
  const basePayload = {
    ...buildProfilePayload(payload),
    status: 'Первое знакомство',
    bonus_balance: 0,
    role: 'client',
  };

  const { data: nullableUser, error: nullableError } = await supabase
    .from('users')
    .insert({
      ...basePayload,
      telegram_id: null,
    })
    .select(selectUserFields)
    .single();

  if (!nullableError) return { data: nullableUser, error: null };

  const shouldRetryWithSyntheticId =
    nullableError.code === '23502' ||
    /telegram_id|null value|not-null|null/i.test(String(nullableError.message || ''));

  if (!shouldRetryWithSyntheticId) return { data: null, error: nullableError };

  return supabase
    .from('users')
    .insert({
      ...basePayload,
      telegram_id: buildSiteOnlyTelegramId(payload.email, payload.username),
    })
    .select(selectUserFields)
    .single();
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let supabase = null;
  let createdUserId = null;

  try {
    const body = await readJsonBody(request);
    const username = normalizeUsername(body.username);
    const name = String(body.name || '').trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const personalDataAccepted = body.personalDataAccepted === true;
    const offerAccepted = body.offerAccepted === true;

    if (!isValidUsername(username)) {
      return response.status(400).json({
        ok: false,
        error: 'Введите Telegram-ник или контактный ник от 2 символов',
      });
    }

    if (!name) {
      return response.status(400).json({ ok: false, error: 'Введите имя' });
    }

    if (!validateEmail(email)) {
      return response.status(400).json({ ok: false, error: 'Введите корректную почту' });
    }

    if (password.length < 8) {
      return response.status(400).json({ ok: false, error: 'Пароль должен быть от 8 символов' });
    }

    if (!personalDataAccepted || !offerAccepted) {
      return response.status(400).json({ ok: false, error: 'Нужно принять условия регистрации' });
    }

    supabase = getSupabaseAdmin();
    const authClient = getSupabaseAuthClient();
    const profilePayload = {
      username,
      name,
      city: body.city ? String(body.city).trim() : null,
      phone: body.phone ? String(body.phone).trim() : null,
      birth_date: body.birth_date || null,
      gender: ['male', 'female', 'other'].includes(body.gender) ? body.gender : 'other',
      email,
    };

    const { data: emailOwner, error: emailOwnerError } = await supabase
      .from('users')
      .select(selectUserFields)
      .eq('email', email)
      .maybeSingle();

    if (emailOwnerError) throw emailOwnerError;
    if (emailOwner) {
      if (emailOwner.username && normalizeUsername(emailOwner.username) !== username) {
        return response.status(409).json({
          ok: false,
          error: 'Эта почта уже привязана к другому профилю',
          reason: `email_owner_username=${emailOwner.username}`,
        });
      }

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(buildProfilePayload(profilePayload))
        .eq('id', emailOwner.id)
        .select(selectUserFields)
        .single();

      if (updateError) throw updateError;

      await syncAuthAccount(authClient, updatedUser, password);
      await persistSiteCredentials(supabase, updatedUser.id, password);

      return sendSessionResponse(request, response, updatedUser);
    }

    const { data: usernameOwner, error: usernameOwnerError } = await supabase
      .from('users')
      .select('id, email')
      .eq('username', username)
      .maybeSingle();

    if (usernameOwnerError) throw usernameOwnerError;
    if (usernameOwner) {
      return response.status(409).json({ ok: false, error: 'Этот Telegram-ник уже есть в системе' });
    }

    const { data: user, error: insertError } = await createSiteUser(supabase, profilePayload);

    if (insertError) throw insertError;
    createdUserId = user.id;

    await syncAuthAccount(authClient, user, password);
    await persistSiteCredentials(supabase, user.id, password);

    return sendSessionResponse(request, response, user);
  } catch (error) {
    console.error('Site registration failed:', error);

    if (createdUserId && supabase) {
      const { error: rollbackError } = await supabase.from('users').delete().eq('id', createdUserId);
      if (rollbackError) console.error('Site registration rollback failed:', rollbackError);
    }

    return response.status(500).json({
      ok: false,
      error: 'Не удалось зарегистрироваться',
      reason: error?.message || String(error),
      code: error?.code || null,
      details: error?.details || null,
    });
  }
}
