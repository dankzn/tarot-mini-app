const TELEGRAM_API_BASE = 'https://api.telegram.org';

const getBotToken = () => (
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.BOT_TOKEN ||
  process.env.VITE_TELEGRAM_BOT_TOKEN
);

const getAdminChatIds = () => {
  const value = process.env.TELEGRAM_ADMIN_CHAT_IDS || process.env.TELEGRAM_ADMIN_CHAT_ID || '';

  return value
    .split(',')
    .map(chatId => chatId.trim())
    .filter(Boolean);
};

const parseBody = (body) => {
  if (!body || typeof body !== 'string') {
    return body || {};
  }

  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const sendMessage = async ({ botToken, chatId, message }) => {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.description || 'Telegram API request failed');
  }

  return payload;
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const botToken = getBotToken();

  if (!botToken) {
    response.status(500).json({ error: 'Telegram bot token is not configured' });
    return;
  }

  const {
    fallbackChatIds = [],
    clientName,
    clientUsername,
    serviceName,
    dateTime,
    price,
  } = parseBody(request.body);

  const fallbackIds = Array.isArray(fallbackChatIds)
    ? fallbackChatIds.map(chatId => String(chatId).trim()).filter(Boolean)
    : [];
  const chatIds = Array.from(new Set([...getAdminChatIds(), ...fallbackIds]));

  if (chatIds.length === 0) {
    response.status(400).json({
      error: 'Admin chat id is not configured. Set TELEGRAM_ADMIN_CHAT_ID or add admin telegram_id fallback.',
    });
    return;
  }

  if (!serviceName || !dateTime) {
    response.status(400).json({ error: 'serviceName and dateTime are required' });
    return;
  }

  const usernameText = clientUsername ? ` (@${escapeHtml(clientUsername)})` : '';
  const message = `
🔔 <b>Новая запись!</b>

👤 <b>Клиент:</b> ${escapeHtml(clientName || 'Клиент')}${usernameText}
📋 <b>Услуга:</b> ${escapeHtml(serviceName)}
📅 <b>Дата:</b> ${escapeHtml(dateTime)}
💰 <b>Сумма:</b> ${escapeHtml(price || 0)} ₽

⏳ Статус: Ожидает подтверждения
  `.trim();

  const results = await Promise.allSettled(
    chatIds.map(chatId => sendMessage({ botToken, chatId, message }))
  );
  const failed = results
    .map((result, index) => ({ result, chatId: chatIds[index] }))
    .filter(({ result }) => result.status === 'rejected');

  if (failed.length === chatIds.length) {
    response.status(502).json({
      error: failed.map(({ chatId, result }) => (
        `${chatId}: ${result.status === 'rejected' ? result.reason?.message || String(result.reason) : 'unknown error'}`
      )).join('; '),
    });
    return;
  }

  response.status(200).json({
    ok: true,
    sent: results.length - failed.length,
    failed: failed.length,
  });
}
