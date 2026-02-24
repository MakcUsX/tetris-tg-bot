const { Telegraf } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
    ctx.reply('Нажми кнопку, чтобы сыграть в Тетрис!', {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: 'Играть в Тетрис',
                    web_app: { url: process.env.WEBAPP_URL }
                }
            ]]
        }
    });
});

// Запуск бота
bot.launch();

// Корректное завершение работы (graceful stop)
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));