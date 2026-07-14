import {
  buildSessionCookie,
  getSiteUrl,
  getSupabaseAdmin,
  sessionPayloadFromUser,
  signSession,
  verifyTelegramLogin,
} from './_auth.js';
import { notifyAdminsNewUserRegistration } from './_telegram-notify.js';

const buildName = (telegramUser) =>
  [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ').trim() ||
  telegramUser.username ||
  'Клиент';

const getReturnPath = (request) => {
  const value = String(request.query?.return_to || '/site/profile');
  if (!value.startsWith('/site') && !value.startsWith('/studio')) return '/site/profile';
  return value;
};

const withAuthParam = (path, value) => `${path}${path.includes('?') ? '&' : '?'}auth=${value}`;

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const verification = verifyTelegramLogin(request.query || {});
  const siteUrl = getSiteUrl(request);
  const returnPath = getReturnPath(request);

  if (!verification.ok) {
    return response.redirect(`${siteUrl}${withAuthParam(returnPath, 'failed')}`);
  }

  try {
    const supabase = getSupabaseAdmin();
    const telegramUser = verification.telegramUser;
    const telegramId = telegramUser.id;
    const displayName = buildName(telegramUser);

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    let user = existingUser;
    let isNewUser = false;

    if (existingUser) {
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          username: telegramUser.username || existingUser.username || null,
          name: existingUser.name || displayName,
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (updateError) throw updateError;
      user = updatedUser;
    } else {
      const { data: createdUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            telegram_id: telegramId,
            username: telegramUser.username || null,
            name: displayName,
            city: null,
            phone: null,
            birth_date: null,
            gender: 'other',
            status: 'Первое знакомство',
            bonus_balance: 0,
            role: 'client',
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;
      user = createdUser;
      isNewUser = true;
    }

    if (isNewUser) {
      const notificationResult = await notifyAdminsNewUserRegistration(supabase, user, 'telegram_login').catch(
        (notificationError) => ({
          ok: false,
          error: notificationError?.message || String(notificationError),
        }),
      );

      if (!notificationResult.ok) {
        console.warn('New Telegram site user notification failed:', notificationResult.error);
      }
    }

    const sessionToken = signSession(sessionPayloadFromUser(user));
    response.setHeader('Set-Cookie', buildSessionCookie(sessionToken, request));
    return response.redirect(`${siteUrl}${withAuthParam(returnPath, 'ok')}`);
  } catch (error) {
    console.error('Site Telegram login failed:', error);
    return response.redirect(`${siteUrl}${withAuthParam(returnPath, 'failed')}`);
  }
}
