import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Updater, CommandHandler, CallbackContext

# Включаем логирование
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)

BOT_TOKEN = os.getenv("8844983125:AAEQaH2P8PqG4VnB8iibHyWlaG_an940hPA")
WEB_APP_URL = os.getenv("WEB_APP_URL", "https://tarot-mini-app-ruddy.vercel.app")

def start(update: Update, context: CallbackContext):
    args = context.args
    ref_code = None
    
    if args and args[0].startswith('ref_'):
        ref_code = args[0].replace('ref_', '')
        logging.info(f"🎯 Реферальная ссылка: ref_{ref_code}")
    
    web_app_url = f"{WEB_APP_URL}/?ref={ref_code}" if ref_code else WEB_APP_URL
    
    keyboard = [[InlineKeyboardButton("✨ Открыть приложение", web_app={"url": web_app_url})]]
    
    if ref_code:
        update.message.reply_text(
            "🎉 Вас пригласил друг!\n\n"
            "Нажмите кнопку ниже чтобы зарегистрироваться и получить бонус:",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
    else:
        update.message.reply_text(
            "Добро пожаловать в Tarot by Danil! 🔮\n\n"
            "Нажмите кнопку ниже чтобы начать:",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )

def main():
    updater = Updater(BOT_TOKEN, use_context=True)
    dp = updater.dispatcher
    
    dp.add_handler(CommandHandler("start", start))
    
    updater.start_polling()
    logging.info("🤖 Бот запущен...")
    updater.idle()

if __name__ == '__main__':
    main()