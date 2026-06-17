import os
import telebot
from telebot import types

# Прямой доступ через os.environ
BOT_TOKEN = os.environ["BOT_TOKEN"]
WEB_APP_URL = os.environ.get("WEB_APP_URL", "https://tarot-mini-app-ruddy.vercel.app")

print(f"✅ BOT_TOKEN: {BOT_TOKEN[:20]}...")
print(f"✅ WEB_APP_URL: {WEB_APP_URL}")

bot = telebot.TeleBot(BOT_TOKEN)

@bot.message_handler(commands=['start'])
def send_welcome(message):
    args = message.text.split()
    ref_code = None
    
    if len(args) > 1 and args[1].startswith('ref_'):
        ref_code = args[1].replace('ref_', '')
        print(f"🎯 Реферальная ссылка: ref_{ref_code}")
    
    web_app_url = f"{WEB_APP_URL}/?ref={ref_code}" if ref_code else WEB_APP_URL
    
    markup = types.InlineKeyboardMarkup()
    btn = types.InlineKeyboardButton("✨ Открыть приложение", url=web_app_url)
    markup.add(btn)
    
    if ref_code:
        bot.reply_to(message, 
            "🎉 Вас пригласил друг!\n\n"
            "Нажмите кнопку ниже чтобы зарегистрироваться и получить бонус:",
            reply_markup=markup
        )
    else:
        bot.reply_to(message,
            "Добро пожаловать в Tarot by Danil! 🔮\n\n"
            "Нажмите кнопку ниже чтобы начать:",
            reply_markup=markup
        )

print("🤖 Бот запущен...")
bot.infinity_polling()