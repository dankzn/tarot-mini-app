# Tarot Mini App

Telegram Mini App для записи на консультации, бонусной программы, рефералов и админ-панели.

## Стек

- React, TypeScript, Vite
- Supabase
- Telegram Web App SDK
- Vercel Serverless Functions для безопасных уведомлений
- Python Telegram bot для команды `/start` и реферальных переходов

## Переменные окружения

Скопируйте `.env.example` в `.env` для локальной разработки и настройте эти же переменные на хостинге.

```bash
cp .env.example .env
```

Клиентские переменные:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Серверные переменные:

- `TELEGRAM_BOT_TOKEN` или `BOT_TOKEN` для `/api/telegram/send`
- `BOT_TOKEN`, `WEB_APP_URL`, `SUPABASE_URL`, `SUPABASE_KEY` для Python-бота

Никогда не добавляйте bot token в переменные с префиксом `VITE_`: такие значения попадают в браузерный bundle.

## Скрипты

```bash
npm run dev
npm run build
npm run lint
```
