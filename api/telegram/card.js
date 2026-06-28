import sharp from 'sharp';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const WIDTH = 1200;
const HEIGHT = 630;
const __dirname = dirname(fileURLToPath(import.meta.url));
const BONUS_TEMPLATE_PATH = join(__dirname, '../../public/telegram/bonus-template.png');
const TITLE_X = 238;
const TITLE_Y = 382;
const ACCRUED_X = 612;
const ACCRUED_Y = 584;
const SPENT_X = 570;
const SPENT_Y = 681;
const TOTAL_X = 600;
const TOTAL_Y = 784;

const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '01010', '00100', '00100', '00100', '01010', '10001'],
  Y: ['10001', '01010', '00100', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  Б: ['11111', '10000', '10000', '11110', '10001', '10001', '11110'],
  Н: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  О: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  С: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  У: ['10001', '10001', '01010', '00100', '00100', '01000', '10000'],
  Ы: ['10001', '10001', '10001', '11101', '10011', '10011', '11101'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '₽': ['11110', '10001', '10001', '11110', '10000', '11100', '10000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

const palettes = {
  booking: { bg1: [248, 243, 236], bg2: [56, 81, 68], accent: [184, 121, 92], title: 'BOOKING' },
  admin: { bg1: [234, 241, 234], bg2: [47, 70, 59], accent: [138, 90, 63], title: 'NEW REQUEST' },
  bonus: { bg1: [255, 246, 239], bg2: [184, 121, 92], accent: [56, 81, 68], title: 'BONUS' },
  status: { bg1: [232, 222, 210], bg2: [56, 81, 68], accent: [244, 231, 200], title: 'STATUS' },
};

const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));

const mix = (a, b, t) => a.map((v, index) => clamp(v + (b[index] - v) * t));

const putPixel = (buffer, x, y, color, alpha = 1) => {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;

  const index = (y * WIDTH + x) * 4;
  const inverse = 1 - alpha;

  buffer[index] = clamp(buffer[index] * inverse + color[0] * alpha);
  buffer[index + 1] = clamp(buffer[index + 1] * inverse + color[1] * alpha);
  buffer[index + 2] = clamp(buffer[index + 2] * inverse + color[2] * alpha);
  buffer[index + 3] = 255;
};

const circle = (buffer, centerX, centerY, radius, color, alpha) => {
  const radiusSquared = radius * radius;
  for (let y = Math.max(0, centerY - radius); y < Math.min(HEIGHT, centerY + radius); y += 1) {
    for (let x = Math.max(0, centerX - radius); x < Math.min(WIDTH, centerX + radius); x += 1) {
      const distanceSquared = (x - centerX) ** 2 + (y - centerY) ** 2;
      if (distanceSquared <= radiusSquared) {
        const edge = 1 - Math.sqrt(distanceSquared) / radius;
        putPixel(buffer, x, y, color, alpha * (0.24 + edge * 0.76));
      }
    }
  }
};

const roundedRect = (buffer, x0, y0, x1, y1, radius, color, alpha) => {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const dx = Math.max(x0 + radius - x, 0, x - (x1 - radius - 1));
      const dy = Math.max(y0 + radius - y, 0, y - (y1 - radius - 1));
      if (dx * dx + dy * dy <= radius * radius) {
        putPixel(buffer, x, y, color, alpha);
      }
    }
  }
};

const line = (buffer, x0, y0, x1, y1, color, alpha, width = 3) => {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps;
    const x = Math.round(x0 + (x1 - x0) * progress);
    const y = Math.round(y0 + (y1 - y0) * progress);
    for (let yy = y - width; yy <= y + width; yy += 1) {
      for (let xx = x - width; xx <= x + width; xx += 1) {
        if ((xx - x) ** 2 + (yy - y) ** 2 <= width * width) putPixel(buffer, xx, yy, color, alpha);
      }
    }
  }
};

const drawText = (buffer, text, x, y, scale, color, alpha = 1) => {
  let cursor = x;
  String(text).toUpperCase().split('').forEach((char) => {
    const glyph = FONT[char] || FONT[' '];
    glyph.forEach((row, rowIndex) => {
      row.split('').forEach((cell, cellIndex) => {
        if (cell === '1') {
          roundedRect(
            buffer,
            cursor + cellIndex * scale,
            y + rowIndex * scale,
            cursor + (cellIndex + 1) * scale - Math.max(1, Math.floor(scale / 10)),
            y + (rowIndex + 1) * scale - Math.max(1, Math.floor(scale / 10)),
            Math.max(1, Math.floor(scale / 4)),
            color,
            alpha
          );
        }
      });
    });
    cursor += 6 * scale;
  });
};

const pngChunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
};

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const createPng = (buffer) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8;
  header[9] = 6;

  const raw = Buffer.alloc((WIDTH * 4 + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    raw[y * (WIDTH * 4 + 1)] = 0;
    buffer.copy(raw, y * (WIDTH * 4 + 1) + 1, y * WIDTH * 4, (y + 1) * WIDTH * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
};


const escapeSvg = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatMoney = (value, prefix = '') => {
  const number = Number(value || 0);
  const normalized = Number.isFinite(number) ? number : 0;
  return `${prefix}${Math.round(normalized).toLocaleString('ru-RU')} ₽`;
};

const wrapText = (text, maxLineLength, maxLines) => {
  const words = String(text || 'Консультация').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxLineLength) {
      currentLine = nextLine;
      return;
    }

    if (currentLine) lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) lines.push(currentLine);

  if (lines.length > maxLines) {
    const visibleLines = lines.slice(0, maxLines);
    visibleLines[maxLines - 1] = `${visibleLines[maxLines - 1].replace(/[.,:;!?—-]+$/, '')}…`;
    return visibleLines;
  }

  return lines;
};

const renderTitleTspans = (title) => {
  const lines = wrapText(title, 19, 3);
  const fontSize = lines.length > 2 ? 48 : 58;
  const lineHeight = lines.length > 2 ? 54 : 58;

  return lines.map((line, index) => (
    `<tspan x="${TITLE_X}" dy="${index === 0 ? 0 : lineHeight}">${escapeSvg(line)}</tspan>`
  )).join('');
};

const renderBonusTemplateCard = async ({ amount, spent, total, title }) => {
  const overlay = `
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
      <style>
        .title { font-family: Arial, Helvetica, sans-serif; font-weight: 800; fill: #fff; letter-spacing: -1.4px; }
        .amount { font: 400 34px Arial, Helvetica, sans-serif; fill: #fff; letter-spacing: -0.3px; }
        .total { font: 600 42px Arial, Helvetica, sans-serif; fill: #fff; letter-spacing: -0.6px; }
      </style>
      <text class="title" x="${TITLE_X}" y="${TITLE_Y}" font-size="${wrapText(title, 19, 3).length > 2 ? 48 : 58}">${renderTitleTspans(title)}</text>
      <text class="amount" x="${ACCRUED_X}" y="${ACCRUED_Y}">${escapeSvg(formatMoney(amount, '+'))}</text>
      <text class="amount" x="${SPENT_X}" y="${SPENT_Y}">${escapeSvg(formatMoney(spent))}</text>
      <text class="total" x="${TOTAL_X}" y="${TOTAL_Y}">${escapeSvg(formatMoney(total))}</text>
    </svg>
  `;

  return sharp(BONUS_TEMPLATE_PATH)
    .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
    .png()
    .toBuffer();
};

const renderCard = ({ type, price, date, amount }) => {
  const palette = palettes[type] || palettes.booking;
  const buffer = Buffer.alloc(WIDTH * HEIGHT * 4);

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const color = mix(palette.bg1, palette.bg2, (x / WIDTH) * 0.45 + (y / HEIGHT) * 0.55);
      const index = (y * WIDTH + x) * 4;
      buffer[index] = color[0];
      buffer[index + 1] = color[1];
      buffer[index + 2] = color[2];
      buffer[index + 3] = 255;
    }
  }

  circle(buffer, 1060, 110, 260, palette.accent, 0.32);
  circle(buffer, 145, 540, 230, palette.bg2, 0.18);
  roundedRect(buffer, 70, 78, 1130, 552, 58, [255, 255, 255], 0.23);
  roundedRect(buffer, 100, 108, 1100, 522, 44, palette.bg2, 0.13);

  drawText(buffer, 'TAROT BY DANIL', 145, 135, 10, [255, 255, 255], 0.72);
  drawText(buffer, palette.title, 145, 225, 16, [255, 255, 255], 0.95);

  const priceText = price ? `${price} ₽` : amount ? `+${amount} ₽` : '';
  if (priceText) drawText(buffer, priceText, 145, 350, 18, palette.accent, 0.98);
  if (date) drawText(buffer, date, 145, 505, 8, [255, 255, 255], 0.72);

  roundedRect(buffer, 820, 170, 1005, 355, 42, [255, 255, 255], 0.28);
  circle(buffer, 912, 262, 58, palette.accent, 0.52);
  line(buffer, 912, 210, 912, 314, [255, 255, 255], 0.78, 5);
  line(buffer, 860, 262, 964, 262, [255, 255, 255], 0.78, 5);
  line(buffer, 876, 226, 948, 298, [255, 255, 255], 0.45, 3);
  line(buffer, 948, 226, 876, 298, [255, 255, 255], 0.45, 3);

  return createPng(buffer);
};

export default async function handler(request, response) {
  const url = new URL(request.url || '/api/telegram/card', `https://${request.headers.host || 'localhost'}`);
  const type = url.searchParams.get('type') || 'booking';
  const image = type === 'bonus'
    ? await renderBonusTemplateCard({
      title: url.searchParams.get('title') || '',
      amount: url.searchParams.get('amount') || '',
      spent: url.searchParams.get('spent') || '',
      total: url.searchParams.get('total') || url.searchParams.get('amount') || '',
    })
    : renderCard({
      type,
      price: url.searchParams.get('price') || '',
      amount: url.searchParams.get('amount') || '',
      date: url.searchParams.get('date') || '',
    });

  response.setHeader('Content-Type', 'image/png');
  response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  response.status(200).send(image);
}
