import { getBotToken } from './_auth.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sendTelegramMessage = async (botToken, chatId, text) => {
  const telegramResponse = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const payload = await telegramResponse.json().catch(() => null);

  if (!telegramResponse.ok || payload?.ok !== true) {
    throw new Error(payload?.description || 'Telegram API request failed');
  }
};

const getAdminTelegramIds = async (supabase) => {
  const { data, error } = await supabase
    .from('users')
    .select('telegram_id')
    .eq('role', 'admin')
    .not('telegram_id', 'is', null);

  if (error) throw error;

  return [...new Set((data || []).map((admin) => admin.telegram_id).filter(Boolean).map(String))];
};

export const notifyAdminsNewUserRegistration = async (supabase, user, source = 'site_registration') => {
  const botToken = getBotToken();

  if (!botToken) {
    return { ok: false, error: 'Telegram bot token is not configured' };
  }

  const adminTelegramIds = await getAdminTelegramIds(supabase);

  if (adminTelegramIds.length === 0) {
    return { ok: false, error: 'Admin Telegram ID was not found in users table' };
  }

  const usernameText = user.username ? ` (@${escapeHtml(user.username)})` : '';
  const telegramIdText = user.telegram_id ? escapeHtml(user.telegram_id) : 'сайт без Telegram ID';
  const cityText = user.city ? `\n📍 <b>Город:</b> ${escapeHtml(user.city)}` : '';
  const emailText = user.email ? `\n✉️ <b>Почта:</b> ${escapeHtml(user.email)}` : '';
  const sourceText = source === 'telegram_login' ? 'Вход через Telegram' : 'Регистрация на сайте';
  const message = `
✨ <b>Новый пользователь зарегистрировался</b>

👤 <b>Клиент:</b> ${escapeHtml(user.name || 'Клиент')}${usernameText}
🆔 <b>Telegram ID:</b> ${telegramIdText}${emailText}${cityText}
📌 <b>Источник:</b> ${sourceText}

Профиль уже создан в базе
  `.trim();

  const results = await Promise.allSettled(
    adminTelegramIds.map((chatId) => sendTelegramMessage(botToken, chatId, message)),
  );
  const failed = results.filter((result) => result.status === 'rejected');

  if (failed.length === results.length) {
    return {
      ok: false,
      error: failed
        .map((result) => result.reason?.message || String(result.reason))
        .filter(Boolean)
        .join('; '),
    };
  }

  if (failed.length > 0) {
    console.warn(
      'Some new user notifications failed:',
      failed.map((result) => result.reason?.message || String(result.reason)).join('; '),
    );
  }

  return { ok: true };
};
