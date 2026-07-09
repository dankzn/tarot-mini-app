import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_SIZE_BYTES = 11 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ALLOWED_EXTENSIONS = /\.(pdf|doc|docx)$/i;
const ALLOWED_PARSE_MODES = new Set(['HTML', 'Markdown', 'MarkdownV2']);
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const getTokenSource = (requestBotToken) => {
  if (process.env.TELEGRAM_BOT_TOKEN) return 'TELEGRAM_BOT_TOKEN';
  if (process.env.BOT_TOKEN) return 'BOT_TOKEN';
  if (process.env.VITE_TELEGRAM_BOT_TOKEN) return 'VITE_TELEGRAM_BOT_TOKEN_SERVER_LEGACY';
  if (requestBotToken) return 'request_legacy';
  return null;
};

const getBotToken = (requestBotToken) => (
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.BOT_TOKEN ||
  process.env.VITE_TELEGRAM_BOT_TOKEN ||
  requestBotToken ||
  ''
);

const readRawBody = async (request) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;

  request.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_REQUEST_SIZE_BYTES) {
      reject(new Error('REQUEST_TOO_LARGE'));
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });

  request.on('end', () => resolve(Buffer.concat(chunks)));
  request.on('error', reject);
});

const parseMultipart = (rawBody, contentType) => {
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];

  if (!boundary) {
    throw new Error('Multipart boundary was not found');
  }

  const fields = {};
  const files = [];
  const delimiter = `--${boundary}`;
  const raw = rawBody.toString('binary');
  const parts = raw.split(delimiter).slice(1, -1);

  parts.forEach((part) => {
    const cleanPart = part.replace(/^\r\n/, '').replace(/\r\n$/, '');
    const separatorIndex = cleanPart.indexOf('\r\n\r\n');
    if (separatorIndex === -1) return;

    const rawHeaders = cleanPart.slice(0, separatorIndex);
    const rawContent = cleanPart.slice(separatorIndex + 4);
    const disposition = rawHeaders.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || '';
    const name = disposition.match(/name="([^"]+)"/i)?.[1];
    const filename = disposition.match(/filename="([^"]*)"/i)?.[1];
    const mimeType = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || 'application/octet-stream';

    if (!name) return;

    if (filename !== undefined) {
      const buffer = Buffer.from(rawContent, 'binary');
      files.push({
        fieldName: name,
        filename,
        mimeType,
        buffer,
        size: buffer.length,
      });
      return;
    }

    fields[name] = Buffer.from(rawContent, 'binary').toString('utf8');
  });

  return { fields, files };
};

const isAllowedDocument = (file) => (
  file &&
  file.size > 0 &&
  file.size <= MAX_FILE_SIZE_BYTES &&
  (ALLOWED_MIME_TYPES.has(file.mimeType) || ALLOWED_EXTENSIONS.test(file.filename))
);

const getAdminRecipientIds = async (chatIds) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return chatIds;
  }

  const numericChatIds = chatIds
    .map((chatId) => Number(chatId))
    .filter((chatId) => Number.isFinite(chatId));

  if (numericChatIds.length === 0) return [];

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase
    .from('users')
    .select('telegram_id')
    .eq('role', 'admin')
    .in('telegram_id', numericChatIds);

  if (error) {
    console.error('Telegram admin recipient check failed:', error);
    return [];
  }

  const allowed = new Set((data || []).map((admin) => String(admin.telegram_id)));
  return chatIds.filter((chatId) => allowed.has(String(chatId)));
};

const sendDocument = async ({ botToken, chatId, caption, parseMode, file }) => {
  const formData = new FormData();
  formData.append('chat_id', String(chatId));
  if (caption) {
    formData.append('caption', caption);
    formData.append('parse_mode', parseMode);
  }
  formData.append('document', new Blob([file.buffer], { type: file.mimeType }), file.filename);

  const telegramResponse = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendDocument`, {
    method: 'POST',
    body: formData,
  });

  const payload = await telegramResponse.json().catch(() => null);

  if (!telegramResponse.ok || payload?.ok !== true) {
    throw new Error(payload?.description || 'Telegram sendDocument failed');
  }

  return payload;
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const tokenSource = getTokenSource();

  try {
    const contentType = request.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      response.status(400).json({ error: 'multipart/form-data is required', code: 'BAD_REQUEST', tokenSource });
      return;
    }

    const rawBody = await readRawBody(request);
    const { fields, files } = parseMultipart(rawBody, contentType);
    const requestBotToken = fields.botToken || '';
    const botToken = getBotToken(requestBotToken);
    const safeTokenSource = getTokenSource(requestBotToken);

    if (!botToken) {
      response.status(400).json({
        error: 'Telegram bot token is not configured',
        code: 'NO_BOT_TOKEN',
        tokenSource: safeTokenSource,
      });
      return;
    }

    const file = files.find((item) => item.fieldName === 'document');
    if (file && fields.fileName) {
      file.filename = String(fields.fileName).slice(0, 180);
    }

    if (!isAllowedDocument(file)) {
      response.status(400).json({
        error: 'Only PDF, DOC or DOCX up to 8 MB are allowed',
        code: 'BAD_DOCUMENT',
        tokenSource: safeTokenSource,
      });
      return;
    }

    const chatIds = JSON.parse(fields.chatIds || '[]')
      .map((chatId) => String(chatId).trim())
      .filter(Boolean);

    const adminChatIds = await getAdminRecipientIds(chatIds);
    if (adminChatIds.length === 0) {
      response.status(403).json({
        error: 'Admin Telegram recipients were not found',
        code: 'NO_ADMIN_RECIPIENTS',
        tokenSource: safeTokenSource,
      });
      return;
    }

    const caption = String(fields.caption || '').slice(0, 1024);
    const parseMode = ALLOWED_PARSE_MODES.has(fields.parseMode) ? fields.parseMode : 'HTML';
    const results = [];

    for (const chatId of adminChatIds) {
      const payload = await sendDocument({ botToken, chatId, caption, parseMode, file });
      results.push({
        chatId,
        messageId: payload?.result?.message_id || null,
        fileId: payload?.result?.document?.file_id || null,
      });
    }

    response.status(200).json({
      ok: true,
      sent: results.length,
      results,
      file: {
        name: file.filename,
        size: file.size,
        type: file.mimeType,
      },
      tokenSource: safeTokenSource,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send Telegram document';
    response.status(message === 'REQUEST_TOO_LARGE' ? 413 : 502).json({
      error: message === 'REQUEST_TOO_LARGE' ? 'Document request is too large' : message,
      code: message === 'REQUEST_TOO_LARGE' ? 'REQUEST_TOO_LARGE' : 'TELEGRAM_DOCUMENT_ERROR',
      tokenSource,
    });
  }
}
