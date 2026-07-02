import { createClient } from '@supabase/supabase-js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const MAX_MESSAGE_LENGTH = 4096;
const ALLOWED_PARSE_MODES = new Set(['HTML', 'Markdown', 'MarkdownV2']);
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const getTokenSource = () => {
  if (process.env.TELEGRAM_BOT_TOKEN) return 'TELEGRAM_BOT_TOKEN';
  if (process.env.BOT_TOKEN) return 'BOT_TOKEN';
  return null;
};

const getBotToken = () => (
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.BOT_TOKEN ||
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

const isKnownTelegramRecipient = async (chatId) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return true;
  }

  const numericChatId = Number(chatId);
  if (!Number.isFinite(numericChatId)) {
    return false;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', numericChatId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Telegram recipient check failed:', error);
    return true;
  }

  return Boolean(data);
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
      ...(message ? { caption: message, parse_mode: parseMode } : {}),
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
  } = parseBody(request.body);
  const botToken = getBotToken();
  const tokenSource = getTokenSource();

  if (!botToken) {
    response.status(400).json({
      error: 'Telegram bot token is not configured',
      code: 'NO_BOT_TOKEN',
      tokenSource,
    });
    return;
  }

  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  const safeParseMode = ALLOWED_PARSE_MODES.has(parseMode) ? parseMode : 'HTML';

  if (!chatId || (!photoUrl && trimmedMessage.length === 0)) {
    response.status(400).json({
      error: 'chatId and message or photoUrl are required',
      code: 'BAD_REQUEST',
      hasChatId: Boolean(chatId),
      hasMessage: trimmedMessage.length > 0,
      hasPhotoUrl: Boolean(photoUrl),
      tokenSource,
    });
    return;
  }

  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    response.status(400).json({
      error: 'Telegram message is too long',
      code: 'MESSAGE_TOO_LONG',
      tokenSource,
    });
    return;
  }

  if (replyMarkup && JSON.stringify(replyMarkup).length > 2048) {
    response.status(400).json({
      error: 'Telegram reply markup is too large',
      code: 'REPLY_MARKUP_TOO_LARGE',
      tokenSource,
    });
    return;
  }

  const recipientAllowed = await isKnownTelegramRecipient(chatId);
  if (!recipientAllowed) {
    response.status(403).json({
      error: 'Telegram recipient is not registered in the app',
      code: 'UNKNOWN_RECIPIENT',
      tokenSource,
    });
    return;
  }

  try {
    if (photoUrl) {
      try {
        await sendPhoto({ botToken, chatId, message: trimmedMessage, parseMode: safeParseMode, photoUrl, replyMarkup });
      } catch (photoError) {
        console.error('Telegram sendPhoto failed, fallback to sendMessage:', photoError);
        if (!trimmedMessage) throw photoError;
        await sendMessage({ botToken, chatId, message: trimmedMessage, parseMode: safeParseMode, replyMarkup });
      }
    } else {
      await sendMessage({ botToken, chatId, message: trimmedMessage, parseMode: safeParseMode, replyMarkup });
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
