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

const normalizeUsername = (value) =>
  String(value || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();

const isValidUsername = (username) => /^[a-z0-9_]{5,32}$/.test(username);

const isAlreadyRegisteredAuthError = (error) =>
  /already|registered|exists|duplicate/i.test(String(error?.message || error || ''));

const buildSiteOnlyTelegramId = (email, username) => {
  const hash = crypto.createHash('sha256').update(`${email}:${username}`).digest('hex');
  const numeric = Number.parseInt(hash.slice(0, 8), 16) % 1_900_000_000;
  return -(numeric + 10_000_000);
};

const createSiteUser = async (supabase, payload) => {
  const selectFields = 'id, telegram_id, username, name, city, phone, birth_date, gender, email, status, bonus_balance, role';
  const basePayload = {
    username: payload.username,
    name: payload.name,
    city: payload.city || null,
    phone: payload.phone || null,
    birth_date: payload.birth_date || null,
    gender: payload.gender,
    email: payload.email,
    status: 'Первое знакомство',
    bonus_balance: 0,
    role: 'client',
    site_credentials_completed_at: new Date().toISOString(),
  };

  const { data: nullableUser, error: nullableError } = await supabase
    .from('users')
    .insert({
      ...basePayload,
      telegram_id: null,
    })
    .select(selectFields)
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
    .select(selectFields)
    .single();
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, error: 'Method not allowed' });
  }

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
        error: 'Введите Telegram-ник без @, пробелов и русских букв',
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

    const supabase = getSupabaseAdmin();
    const authClient = getSupabaseAuthClient();

    const { data: emailOwner, error: emailOwnerError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (emailOwnerError) throw emailOwnerError;
    if (emailOwner) {
      return response.status(409).json({ ok: false, error: 'Эта почта уже используется' });
    }

    const { data: usernameOwner, error: usernameOwnerError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (usernameOwnerError) throw usernameOwnerError;
    if (usernameOwner) {
      return response.status(409).json({ ok: false, error: 'Этот Telegram-ник уже есть в системе' });
    }

    const { error: authError } = await authClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          name,
        },
      },
    });

    if (authError) {
      if (isAlreadyRegisteredAuthError(authError)) {
        return response.status(409).json({ ok: false, error: 'Эта почта уже используется' });
      }
      throw authError;
    }

    const { data: user, error: insertError } = await createSiteUser(supabase, {
      username,
      name,
      city: body.city ? String(body.city).trim() : null,
      phone: body.phone ? String(body.phone).trim() : null,
      birth_date: body.birth_date || null,
      gender: ['male', 'female', 'other'].includes(body.gender) ? body.gender : 'other',
      email,
    });

    if (insertError) throw insertError;

    const { error: credentialsError } = await supabase
      .from('site_auth_credentials')
      .insert({
        user_id: user.id,
        password_hash: hashPassword(password),
        updated_at: new Date().toISOString(),
      });

    if (credentialsError) {
      console.warn('Site credentials fallback skipped:', credentialsError);
    }

    const sessionToken = signSession(sessionPayloadFromUser(user));
    response.setHeader('Set-Cookie', buildSessionCookie(sessionToken, request));

    return response.status(200).json({
      ok: true,
      user: {
        ...user,
        has_site_password: true,
      },
    });
  } catch (error) {
    console.error('Site registration failed:', error);
    return response.status(500).json({ ok: false, error: 'Не удалось зарегистрироваться' });
  }
}
