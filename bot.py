import json
import os
import time
import threading
import requests
from datetime import datetime, timezone
from functools import partial
from http.server import HTTPServer, BaseHTTPRequestHandler
import telebot
from telebot.apihelper import ApiTelegramException

print = partial(print, flush=True)

FALLBACK_SUPABASE_URL = "https://hhcexivlaqjeuvnzeqnn.supabase.co"
FALLBACK_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoY2V4aXZsYXFqZXV2bnplcW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDI1MTAsImV4cCI6MjA5NjgxODUxMH0.nVwKyd_BITZ9SU4LQHXkb89ndUM7O_DGd6ESJx282B0"

BOT_TOKEN = os.environ["BOT_TOKEN"]
WEB_APP_URL = os.environ.get("WEB_APP_URL", "https://tarot-mini-app-ruddy.vercel.app")
SUPABASE_URL = os.environ.get("SUPABASE_URL") or FALLBACK_SUPABASE_URL
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_ANON_KEY") or FALLBACK_SUPABASE_ANON_KEY

WORKER_STATE = {
    "started": False,
    "last_tick": None,
    "last_error": None,
    "last_pending_count": 0,
    "sent_count": 0,
    "failed_count": 0,
}

print("✅ BOT_TOKEN: SET")
print(f"✅ WEB_APP_URL: {WEB_APP_URL}")
print(f"✅ SUPABASE_URL: {SUPABASE_URL[:30] if SUPABASE_URL else 'NOT SET'}...")

bot = telebot.TeleBot(BOT_TOKEN, parse_mode=None)

def supabase_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }

def save_pending_referral(telegram_id: int, referrer_id: int):
    """Сохраняем pending referral в базу"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ SUPABASE_URL или SUPABASE_KEY не заданы!")
        return False
    
    try:
        # Проверяем есть уже или нет
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/pending_referrals?telegram_id=eq.{telegram_id}&used=eq.false",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
        )
        
        existing = response.json()
        
        if existing:
            print(f"⚠️ Pending referral уже существует для {telegram_id}")
            return True
        
        # Создаём новый
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/pending_referrals",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            },
            json={
                "telegram_id": telegram_id,
                "referrer_telegram_id": referrer_id
            }
        )
        
        if response.status_code in [200, 201]:
            print(f"✅ Pending referral сохранён: {telegram_id} → {referrer_id}")
            return True
        else:
            print(f"❌ Ошибка сохранения: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False

def update_notification(notification_id: str, payload: dict, status_filter: str = None):
    params = {"id": f"eq.{notification_id}"}

    if status_filter:
        params["status"] = f"eq.{status_filter}"

    response = requests.patch(
        f"{SUPABASE_URL}/rest/v1/notification_queue",
        headers={
            **supabase_headers(),
            "Prefer": "return=minimal",
        },
        params=params,
        json=payload,
        timeout=10,
    )

    if response.status_code not in [200, 204]:
        print(f"❌ Ошибка обновления уведомления {notification_id}: {response.status_code} - {response.text}")
        return False

    return True

def send_queued_notification(notification: dict):
    notification_id = notification["id"]
    attempts = int(notification.get("attempts") or 0) + 1

    locked = update_notification(notification_id, {
        "status": "processing",
        "attempts": attempts,
        "error": None,
    }, status_filter="pending")

    if not locked:
        print(f"⚠️ Уведомление {notification_id} не удалось взять в обработку")
        return

    try:
        bot.send_message(
            notification["chat_id"],
            notification["message"],
            parse_mode=notification.get("parse_mode") or "HTML",
            disable_web_page_preview=True,
        )
        update_notification(notification_id, {
            "status": "sent",
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "error": None,
        }, status_filter="processing")
        WORKER_STATE["sent_count"] += 1
        print(f"✅ Уведомление отправлено: {notification_id} → {notification['chat_id']}")
    except Exception as e:
        next_status = "failed" if attempts >= 3 else "pending"
        error_message = str(e)[:500]

        update_notification(notification_id, {
            "status": next_status,
            "error": error_message,
        }, status_filter="processing")
        WORKER_STATE["failed_count"] += 1
        WORKER_STATE["last_error"] = error_message
        print(f"❌ Ошибка отправки уведомления {notification_id}: {error_message}")

def reset_processing_notifications():
    response = requests.patch(
        f"{SUPABASE_URL}/rest/v1/notification_queue",
        headers={
            **supabase_headers(),
            "Prefer": "return=minimal",
        },
        params={"status": "eq.processing"},
        json={
            "status": "pending",
            "error": "Recovered after bot restart",
        },
        timeout=10,
    )

    if response.status_code in [200, 204]:
        print("♻️ Зависшие processing-уведомления возвращены в очередь")
        return

    print(f"⚠️ Не удалось восстановить processing-уведомления: {response.status_code} - {response.text}")

def run_notification_worker():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("⚠️ Очередь уведомлений отключена: SUPABASE_URL или SUPABASE_KEY не заданы")
        return

    WORKER_STATE["started"] = True
    print("📨 Очередь уведомлений запущена")
    reset_processing_notifications()
    last_idle_log = 0

    while True:
        try:
            WORKER_STATE["last_tick"] = datetime.now(timezone.utc).isoformat()
            response = requests.get(
                f"{SUPABASE_URL}/rest/v1/notification_queue",
                headers=supabase_headers(),
                params={
                    "status": "eq.pending",
                    "select": "id,chat_id,message,parse_mode,attempts",
                    "order": "created_at.asc",
                    "limit": "10",
                },
                timeout=10,
            )

            if response.status_code == 200:
                notifications = response.json()
                WORKER_STATE["last_pending_count"] = len(notifications)
                WORKER_STATE["last_error"] = None

                if notifications:
                    print(f"📬 Найдено уведомлений в очереди: {len(notifications)}")
                elif time.time() - last_idle_log > 60:
                    print("📭 Очередь уведомлений пуста")
                    last_idle_log = time.time()

                for notification in notifications:
                    send_queued_notification(notification)
            else:
                error_message = f"{response.status_code} - {response.text}"
                WORKER_STATE["last_error"] = error_message
                print(f"❌ Ошибка чтения очереди уведомлений: {error_message}")
        except Exception as e:
            WORKER_STATE["last_error"] = str(e)
            print(f"❌ Ошибка воркера уведомлений: {e}")

        time.sleep(3)

@bot.message_handler(commands=['start'])
def send_welcome(message):
    args = message.text.split()
    
    if len(args) > 1 and args[1].startswith('ref_'):
        ref_code = args[1].replace('ref_', '')
        print(f"🎯 Реферальная ссылка: ref_{ref_code}")

        try:
            referrer_id = int(ref_code)
        except ValueError:
            referrer_id = None
        
        if referrer_id and referrer_id != message.from_user.id:
            save_pending_referral(message.from_user.id, referrer_id)
        
        bot.send_message(
            message.chat.id,
            "🎉 Вас пригласил друг!\n\n"
            "Нажмите кнопку **Menu** ⬇️ слева (рядом с полем ввода) чтобы открыть приложение:",
            parse_mode='Markdown'
        )
    else:
        bot.send_message(
            message.chat.id,
            "Добро пожаловать в Tarot by Danil! 🔮\n\n"
            "Нажмите кнопку **Menu** ⬇️ слева (рядом с полем ввода) чтобы открыть приложение:",
            parse_mode='Markdown'
        )

# HTTP сервер для Render
class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/status":
            payload = {
                "ok": True,
                "worker": WORKER_STATE,
                "supabaseConfigured": bool(SUPABASE_URL and SUPABASE_KEY),
            }

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
            return

        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write(b'Bot is running!')
    
    def log_message(self, format, *args):
        pass

def run_health_server():
    port = int(os.environ.get("PORT", 10000))
    server = HTTPServer(('0.0.0.0', port), HealthCheckHandler)
    print(f"🏥 Health check server running on port {port}")
    server.serve_forever()

print("🤖 Бот запущен...")

health_thread = threading.Thread(target=run_health_server, daemon=True)
health_thread.start()

notification_thread = threading.Thread(target=run_notification_worker, daemon=True)
notification_thread.start()

while True:
    try:
        bot.infinity_polling(timeout=10, long_polling_timeout=5)
    except ApiTelegramException as e:
        if "Conflict" in str(e) or "409" in str(e):
            print("⚠️ КОНФЛИКТ polling: где-то уже работает другой экземпляр бота. Уведомления продолжают обрабатываться через очередь.")
            time.sleep(60)
            continue

        print(f"❌ Ошибка Telegram polling: {e}")
        time.sleep(15)
    except Exception as e:
        print(f"❌ Неожиданная ошибка polling: {e}")
        time.sleep(60)
