import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const SESSION_COOKIE = 'tarot_site_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const fallbackSupabaseUrl = 'https://hhcexivlaqjeuvnzeqnn.supabase.co';
const fallbackSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoY2V4aXZsYXFqZXV2bnplcW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDI1MTAsImV4cCI6MjA5NjgxODUxMH0.nVwKyd_BITZ9SU4LQHXkb89ndUM7O_DGd6ESJx282B0';

export const getBotToken = () =>
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.BOT_TOKEN ||
  process.env.VITE_TELEGRAM_BOT_TOKEN ||
  '';

export const getSiteUrl = (request) => {
  const configured = process.env.SITE_URL || process.env.WEB_APP_URL || '';
  if (configured) return configured.replace(/\/$/, '');

  const host = request?.headers?.host || 'localhost:5173';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
};

export const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || fallbackSupabaseUrl;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    fallbackSupabaseAnonKey;

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
};

export const readJsonBody = async (request) => {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') return JSON.parse(request.body || '{}');

  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
};

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));

export const hashPassword = (password) => {
  const salt = crypto.randomBytes(18).toString('base64url');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('base64url');
  return `scrypt$${salt}$${hash}`;
};

export const verifyPassword = (password, storedHash) => {
  const [method, salt, hash] = String(storedHash || '').split('$');
  if (method !== 'scrypt' || !salt || !hash) return false;

  const calculated = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'base64url');
  return calculated.length === expected.length && crypto.timingSafeEqual(calculated, expected);
};

const getSessionSecret = () => {
  const secret = process.env.SITE_AUTH_SECRET || getBotToken();
  if (!secret) throw new Error('SITE_AUTH_SECRET_OR_BOT_TOKEN_NOT_CONFIGURED');
  return secret;
};

export const verifyTelegramLogin = (query) => {
  const botToken = getBotToken();
  if (!botToken) {
    return { ok: false, error: 'Telegram bot token is not configured' };
  }

  const hash = String(query.hash || '');
  if (!hash) return { ok: false, error: 'Telegram hash is missing' };

  const authDate = Number(query.auth_date || 0);
  if (!authDate) return { ok: false, error: 'Telegram auth_date is missing' };

  const maxAgeSeconds = 60 * 60 * 24;
  if (Math.floor(Date.now() / 1000) - authDate > maxAgeSeconds) {
    return { ok: false, error: 'Telegram login data is expired' };
  }

  const dataCheckString = Object.keys(query)
    .filter((key) => key !== 'hash' && query[key] !== undefined && query[key] !== null)
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const isValid =
    hash.length === calculatedHash.length &&
    crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(calculatedHash));

  if (!isValid) return { ok: false, error: 'Telegram login hash is invalid' };

  return {
    ok: true,
    telegramUser: {
      id: Number(query.id),
      first_name: String(query.first_name || ''),
      last_name: query.last_name ? String(query.last_name) : '',
      username: query.username ? String(query.username) : null,
      photo_url: query.photo_url ? String(query.photo_url) : null,
      auth_date: authDate,
    },
  };
};

export const signSession = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(body)
    .digest('base64url');

  return `${body}.${signature}`;
};

export const readSession = (request) => {
  const cookieHeader = request.headers.cookie || '';
  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));

  if (!cookie) return null;

  const token = decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1));
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = crypto
    .createHmac('sha256', getSessionSecret())
    .update(body)
    .digest('base64url');

  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
};

export const buildSessionCookie = (sessionToken, request) => {
  const host = request.headers.host || '';
  const secure = !host.includes('localhost');

  return [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
};

export const buildLogoutCookie = (request) => {
  const host = request.headers.host || '';
  const secure = !host.includes('localhost');

  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
};

export const sessionPayloadFromUser = (user) => ({
  id: user.id,
  telegram_id: user.telegram_id,
  username: user.username || null,
  name: user.name || 'Клиент',
  email: user.email || null,
  role: user.role || 'client',
  exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
});
