import {
  buildSessionCookie,
  getSupabaseAdmin,
  hashPassword,
  normalizeEmail,
  readJsonBody,
  sessionPayloadFromUser,
  signSession,
  validateEmail,
} from './_auth.js';

const normalizeUsername = (value) =>
  String(value || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();

const isValidUsername = (username) => /^[a-z0-9_]{5,32}$/.test(username);

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

    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert({
        telegram_id: null,
        username,
        name,
        city: body.city ? String(body.city).trim() : null,
        phone: body.phone ? String(body.phone).trim() : null,
        birth_date: body.birth_date || null,
        gender: ['male', 'female', 'other'].includes(body.gender) ? body.gender : 'other',
        email,
        status: 'Первое знакомство',
        bonus_balance: 0,
        role: 'client',
        site_credentials_completed_at: new Date().toISOString(),
      })
      .select('id, telegram_id, username, name, city, phone, birth_date, gender, email, status, bonus_balance, role')
      .single();

    if (insertError) throw insertError;

    const { error: credentialsError } = await supabase
      .from('site_auth_credentials')
      .insert({
        user_id: user.id,
        password_hash: hashPassword(password),
        updated_at: new Date().toISOString(),
      });

    if (credentialsError) throw credentialsError;

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
