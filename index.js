require('dotenv').config();
const { Bot, session } = require('grammy');
const userHandlers = require('./handlers/user');
const adminHandlers = require('./handlers/admin');

// Tekshirish
if (!process.env.BOT_TOKEN) {
  console.error('BOT_TOKEN muhit o\'zgaruvchisi topilmadi!');
  process.exit(1);
}

const bot = new Bot(process.env.BOT_TOKEN);

// Session
bot.use(session({ initial: () => ({}) }));

// Handlerlar
bot.use(userHandlers);
bot.use(adminHandlers);

// Xatoliklarni ushlash
bot.catch((err) => {
  console.error('Xatolik:', err.error || err);
});

// Ishga tushirish
bot.start().then(() => {
  console.log('Bot muvaffaqiyatli ishga tushdi!');
}).catch(err => {
  console.error('Bot ishga tushmadi:', err);
  process.exit(1);
});

// To'xtatish signallari
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
