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

const sendToAdmins = async (supabase, message) => {
  const botToken = getBotToken();

  if (!botToken) {
    return { ok: false, error: 'Telegram bot token is not configured' };
  }

  const adminTelegramIds = await getAdminTelegramIds(supabase);

  if (adminTelegramIds.length === 0) {
    return { ok: false, error: 'Admin Telegram ID was not found in users table' };
  }

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
      'Some admin Telegram notifications failed:',
      failed.map((result) => result.reason?.message || String(result.reason)).join('; '),
    );
  }

  return { ok: true };
};

const getUserById = async (supabase, userId) => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('users')
    .select('id, telegram_id, username, name, email, phone')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

const formatMoney = (value) => `${Math.max(0, Number(value || 0)).toLocaleString('ru-RU')} ₽`;

const formatCartItems = (items) => {
  const cartItems = Array.isArray(items) ? items : [];
  if (cartItems.length === 0) return 'позиции не переданы';

  return cartItems
    .map((item, index) => {
      const title = item?.title || item?.source || 'Позиция';
      const amount = Number(item?.amount || 0);
      return `${index + 1}. ${escapeHtml(title)}${amount > 0 ? ` — ${escapeHtml(formatMoney(amount))}` : ''}`;
    })
    .join('\n');
};

const getClientLabel = (user) => {
  if (!user) return 'клиент не найден';
  const usernameText = user.username ? ` (@${escapeHtml(user.username)})` : '';
  const emailText = user.email ? `, ${escapeHtml(user.email)}` : '';
  const phoneText = user.phone ? `, ${escapeHtml(user.phone)}` : '';
  return `${escapeHtml(user.name || 'Клиент')}${usernameText}${emailText}${phoneText}`;
};

export const notifyAdminsPaymentEvent = async (supabase, attempt, notification = {}) => {
  const user = await getUserById(supabase, attempt?.user_id);
  const status = notification.Status || attempt?.status || 'updated';
  const paymentId = notification.PaymentId || attempt?.payment_id || 'не указан';
  const orderId = notification.OrderId || attempt?.order_id || 'не указан';
  const errorCode = notification.ErrorCode && String(notification.ErrorCode) !== '0'
    ? `\n⚠️ <b>Код банка:</b> ${escapeHtml(notification.ErrorCode)}`
    : '';

  const message = `
💳 <b>Событие оплаты Т-Банк</b>

👤 <b>Клиент:</b> ${getClientLabel(user)}
📌 <b>Статус:</b> ${escapeHtml(status)}
🧾 <b>Заказ:</b> ${escapeHtml(orderId)}
🏦 <b>PaymentId:</b> ${escapeHtml(paymentId)}
💰 <b>Сумма:</b> ${escapeHtml(formatMoney(attempt?.amount))}
${errorCode}

<b>Позиции:</b>
${formatCartItems(attempt?.cart_items)}
  `.trim();

  return sendToAdmins(supabase, message);
};

export const notifyClientPaymentSucceeded = async (supabase, attempt) => {
  const botToken = getBotToken();

  if (!botToken) {
    return { ok: false, error: 'Telegram bot token is not configured' };
  }

  const user = await getUserById(supabase, attempt?.user_id);

  if (!user?.telegram_id) {
    return { ok: false, error: 'Client Telegram ID was not found' };
  }

  const message = `
✅ <b>Оплата прошла</b>

💰 <b>Сумма:</b> ${escapeHtml(formatMoney(attempt?.amount))}
🧾 <b>Заказ:</b> ${escapeHtml(attempt?.order_id || 'не указан')}

<b>Оплачено:</b>
${formatCartItems(attempt?.cart_items)}

<b>Дальше:</b>
1. Напишите мне в Telegram: <b>@dan_kzn</b>
2. Отправьте голосовое с кратким описанием запроса
3. Я пришлю всю информацию по формату и ближайшим свободным слотам
  `.trim();

  await sendTelegramMessage(botToken, user.telegram_id, message);
  return { ok: true };
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
