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

`/api/telegram/send` поддерживает старую переменную `VITE_TELEGRAM_BOT_TOKEN`, если она уже настроена на Vercel. Для прямой клиентской отправки нужен `VITE_TELEGRAM_BOT_TOKEN` в сборке мини-приложения.

## Скрипты

```bash
npm run dev
npm run build
npm run lint
```

## Миграции Supabase

Для кампаний услуг примените SQL из `supabase/migrations/20260626_service_campaigns.sql`.
Он добавляет план повышения цен, акции и функцию `apply_due_service_price_changes`,
которая тихо применяет новую цену при загрузке клиентской части или админки.
