import {
  getSupabaseAuthClient,
  getSupabaseAdmin,
  hashPassword,
  normalizeEmail,
  readJsonBody,
  validateEmail,
} from './_auth.js';

const allowedProfileFields = ['name', 'city', 'phone', 'birth_date', 'gender'];

const isAlreadyRegisteredAuthError = (error) =>
  /already|registered|exists|duplicate/i.test(String(error?.message || error || ''));

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
      .eq('email', email)
      .maybeSingle();

    if (emailOwnerError) throw emailOwnerError;
    if (emailOwner && emailOwner.id !== user.id) {
      return response.status(409).json({ ok: false, error: 'Эта почта уже привязана к другому профилю' });
    }

    const { error: authError } = await authClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          telegram_id: telegramId,
          username: user.username || null,
          name: body.name || user.name || 'Клиент',
        },
      },
    });

    if (authError && !isAlreadyRegisteredAuthError(authError)) {
      throw authError;
    }

    const profilePatch = allowedProfileFields.reduce((patch, field) => {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        patch[field] = body[field] || null;
      }
      return patch;
    }, {});

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        ...profilePatch,
        email,
        site_credentials_completed_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('id, telegram_id, username, name, city, phone, birth_date, gender, email, status, bonus_balance, role')
      .single();

    if (updateError) throw updateError;

    const { error: credentialsError } = await supabase
      .from('site_auth_credentials')
      .upsert(
        {
          user_id: user.id,
          password_hash: hashPassword(password),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    if (credentialsError) {
      console.warn('Site credentials fallback skipped:', credentialsError);
    }

    return response.status(200).json({
      ok: true,
      user: {
        ...updatedUser,
        has_site_password: true,
      },
    });
  } catch (error) {
    console.error('Site credentials failed:', error);
    return response.status(500).json({ ok: false, error: 'Не удалось сохранить данные для входа' });
  }
}
