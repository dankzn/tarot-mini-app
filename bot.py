import os
import time
import threading
import requests
from http.server import HTTPServer, BaseHTTPRequestHandler
import telebot
from telebot.apihelper import ApiTelegramException

BOT_TOKEN = os.environ["BOT_TOKEN"]
WEB_APP_URL = os.environ.get("WEB_APP_URL", "https://tarot-mini-app-ruddy.vercel.app")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

print("✅ BOT_TOKEN: SET")
print(f"✅ WEB_APP_URL: {WEB_APP_URL}")
print(f"✅ SUPABASE_URL: {SUPABASE_URL[:30] if SUPABASE_URL else 'NOT SET'}...")

bot = telebot.TeleBot(BOT_TOKEN, parse_mode=None)

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

try:
    bot.infinity_polling(timeout=10, long_polling_timeout=5)
except ApiTelegramException as e:
    if "Conflict" in str(e) or "409" in str(e):
        print("❌ КОНФЛИКТ: Где-то уже работает другой бот!")
        time.sleep(60)
        exit(1)
    else:
        raise
