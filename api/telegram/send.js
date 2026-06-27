const TELEGRAM_API_BASE = 'https://api.telegram.org';
const FALLBACK_SUPABASE_URL = 'https://hhcexivlaqjeuvnzeqnn.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoY2V4aXZsYXFqZXV2bnplcW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDI1MTAsImV4cCI6MjA5NjgxODUxMH0.nVwKyd_BITZ9SU4LQHXkb89ndUM7O_DGd6ESJx282B0';

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

const getSupabaseUrl = () => (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  FALLBACK_SUPABASE_URL
);

const getSupabaseAnonKey = () => (
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  FALLBACK_SUPABASE_ANON_KEY
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

const enqueueMessage = async ({ chatId, message, parseMode = 'HTML' }) => {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  const queueResponse = await fetch(`${supabaseUrl}/rest/v1/notification_queue`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      chat_id: String(chatId),
      message,
      parse_mode: parseMode,
      status: 'pending',
    }),
  });

  if (!queueResponse.ok) {
    const details = await queueResponse.text().catch(() => '');
    throw new Error(details || 'Failed to enqueue Telegram notification');
  }
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { chatId, message, parseMode, botToken: requestBotToken } = parseBody(request.body);
  const botToken = getBotToken(requestBotToken);
  const tokenSource = getTokenSource(requestBotToken);

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
    if (botToken) {
      await sendMessage({ botToken, chatId, message: message.trim(), parseMode });
      response.status(200).json({ ok: true, tokenSource, queued: false });
      return;
    }

    await enqueueMessage({ chatId, message: message.trim(), parseMode });
    response.status(200).json({ ok: true, tokenSource: 'notification_queue', queued: true });
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : 'Failed to process Telegram notification',
      code: botToken ? 'TELEGRAM_API_ERROR' : 'QUEUE_ERROR',
      chatId,
      tokenSource,
    });
  }
}
