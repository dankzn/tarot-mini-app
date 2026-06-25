const TELEGRAM_API_BASE = 'https://api.telegram.org';

const getBotToken = () => process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;

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

const sendMessage = async ({ botToken, chatId, message, parseMode = 'HTML' }) => {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const description = payload?.description || 'Telegram API request failed';
    throw new Error(description);
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

  const { chatId, message, parseMode } = parseBody(request.body);

  if (!chatId || typeof message !== 'string' || message.trim().length === 0) {
    response.status(400).json({ error: 'chatId and message are required' });
    return;
  }

  try {
    await sendMessage({ botToken, chatId, message: message.trim(), parseMode });
    response.status(200).json({ ok: true });
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : 'Failed to send Telegram message',
    });
  }
}
