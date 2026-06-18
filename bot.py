import os
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import telebot
from telebot import types
from telebot.apihelper import ApiTelegramException

BOT_TOKEN = os.environ["BOT_TOKEN"]
WEB_APP_URL = os.environ.get("WEB_APP_URL", "https://tarot-mini-app-ruddy.vercel.app")

print(f"✅ BOT_TOKEN: {BOT_TOKEN[:20]}...")
print(f"✅ WEB_APP_URL: {WEB_APP_URL}")

bot = telebot.TeleBot(BOT_TOKEN, parse_mode=None)

@bot.message_handler(commands=['start'])
def send_welcome(message):
    args = message.text.split()
    ref_code = None
    
    if len(args) > 1 and args[1].startswith('ref_'):
        ref_code = args[1].replace('ref_', '')
        print(f"🎯 Реферальная ссылка: ref_{ref_code}")
    
    # Формируем URL с реферальным кодом
    web_app_url = f"{WEB_APP_URL}/?ref={ref_code}" if ref_code else WEB_APP_URL
    
    # ВАЖНО: В pyTelegramBotAPI используем правильный синтаксис
    # Создаём ReplyKeyboardMarkup с WebApp
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)
    
    # Создаём кнопку с WebApp — ПРАВИЛЬНЫЙ СИНТАКСИС
    webapp_btn = types.KeyboardButton(text="✨ Открыть приложение")
    webapp_btn.web_app = types.WebAppInfo(url=web_app_url)
    
    markup.add(webapp_btn)
    
    if ref_code:
        bot.send_message(
            message.chat.id,
            "🎉 Вас пригласил друг!\n\n"
            "Нажмите кнопку ниже чтобы зарегистрироваться и получить бонус:",
            reply_markup=markup
        )
    else:
        bot.send_message(
            message.chat.id,
            "Добро пожаловать в Tarot by Danil! 🔮\n\n"
            "Нажмите кнопку ниже чтобы начать:",
            reply_markup=markup
        )

# Простой HTTP сервер для Render
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
        print("❌ КОНФЛИКТ: Где-то уже работает другой бот с этим токеном!")
        time.sleep(60)
        exit(1)
    else:
        raise