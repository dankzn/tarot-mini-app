const TELEGRAM_API_BASE = 'https://api.telegram.org';

const getTokenSource = (requestBotToken) => {
  if (process.env.TELEGRAM_BOT_TOKEN) return 'TELEGRAM_BOT_TOKEN';
  if (process.env.BOT_TOKEN) return 'BOT_TOKEN';
  if (process.env.VITE_TELEGRAM_BOT_TOKEN) return 'VITE_TELEGRAM_BOT_TOKEN';
  if (requestBotToken) return 'request';
  return null;
};

const getBotToken = (requestBotToken) => (
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.BOT_TOKEN ||
  process.env.VITE_TELEGRAM_BOT_TOKEN ||
  requestBotToken ||
  ''
);

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

const requestTelegram = async ({ botToken, method, body }) => {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const description = payload?.description || 'Telegram API request failed';
    throw new Error(description);
  }

  return payload;
};

const sendMessage = async ({ botToken, chatId, message, parseMode = 'HTML', replyMarkup }) => (
  requestTelegram({
    botToken,
    method: 'sendMessage',
    body: {
      chat_id: chatId,
      text: message,
      parse_mode: parseMode,
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    },
  })
);

const sendPhoto = async ({ botToken, chatId, message, parseMode = 'HTML', photoUrl, replyMarkup }) => (
  requestTelegram({
    botToken,
    method: 'sendPhoto',
    body: {
      chat_id: chatId,
      photo: photoUrl,
      caption: message,
      parse_mode: parseMode,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    },
  })
);

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const {
    chatId,
    message,
    parseMode,
    photoUrl,
    replyMarkup,
    botToken: requestBotToken,
  } = parseBody(request.body);
  const botToken = getBotToken(requestBotToken);
  const tokenSource = getTokenSource(requestBotToken);

  if (!botToken) {
    response.status(400).json({
      error: 'Telegram bot token is not configured',
      code: 'NO_BOT_TOKEN',
      tokenSource,
    });
    return;
  }

  if (!chatId || typeof message !== 'string' || message.trim().length === 0) {
    response.status(400).json({
      error: 'chatId and message are required',
      code: 'BAD_REQUEST',
      hasChatId: Boolean(chatId),
      hasMessage: typeof message === 'string' && message.trim().length > 0,
      tokenSource,
    });
    return;
  }

  try {
    if (photoUrl) {
      try {
        await sendPhoto({ botToken, chatId, message: message.trim(), parseMode, photoUrl, replyMarkup });
      } catch (photoError) {
        console.error('Telegram sendPhoto failed, fallback to sendMessage:', photoError);
        await sendMessage({ botToken, chatId, message: message.trim(), parseMode, replyMarkup });
      }
    } else {
      await sendMessage({ botToken, chatId, message: message.trim(), parseMode, replyMarkup });
    }
    response.status(200).json({ ok: true, tokenSource });
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : 'Failed to send Telegram message',
      code: 'TELEGRAM_API_ERROR',
      chatId,
      tokenSource,
    });
  }
}
