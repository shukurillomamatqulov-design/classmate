require('dotenv').config();
const { Bot, session, GrammyError, HttpError } = require('grammy');
const { initDatabase } = require('./database');
const userHandlers = require('./handlers/user');
const adminHandlers = require('./handlers/admin');

const bot = new Bot(process.env.BOT_TOKEN);

// Session (foydalanuvchi holatini saqlash uchun)
bot.use(session({ initial: () => ({ step: null, photoType: null }) }));

// Database bilan ishlash uchun kontekstga qo'shamiz
bot.use(async (ctx, next) => {
  ctx.db = await initDatabase();
  await next();
});

// Handlerlarni ulash
bot.use(userHandlers);
bot.use(adminHandlers);

// Xatoliklarni ushlash
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

// Botni ishga tushirish
bot.start();
console.log('Bot ishga tushdi...');
