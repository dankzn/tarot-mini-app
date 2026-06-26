# Tarot Mini App

Telegram Mini App для записи на консультации, бонусной программы, рефералов и админ-панели.

## Стек

- React, TypeScript, Vite
- Supabase
- Telegram Web App SDK
- Python Telegram bot для команды `/start`, реферальных переходов и уведомлений

## Переменные окружения

Скопируйте `.env.example` в `.env` для локальной разработки и настройте эти же переменные на хостинге.

```bash
cp .env.example .env
```

Клиентские переменные:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Серверные переменные:

- `BOT_TOKEN`, `WEB_APP_URL`, `SUPABASE_URL`, `SUPABASE_KEY` для Python-бота

Мини-приложение не хранит Telegram bot token и не отправляет сообщения напрямую. Оно добавляет уведомления в `notification_queue` в Supabase, а Python-бот читает очередь и отправляет сообщения через свой `BOT_TOKEN`.

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

Для уведомлений примените SQL из `supabase/migrations/20260626_notification_queue.sql`.
Он добавляет очередь, которую обрабатывает Python-бот.
