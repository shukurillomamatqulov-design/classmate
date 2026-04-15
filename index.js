require('dotenv').config();
const { Bot, session } = require('grammy');
const userHandlers = require('./handlers/user');
const adminHandlers = require('./handlers/admin');

// Muhit o'zgaruvchilarini tekshirish
if (!process.env.BOT_TOKEN) {
  console.error('BOT_TOKEN muhit o\'zgaruvchisi topilmadi!');
  process.exit(1);
}

const bot = new Bot(process.env.BOT_TOKEN);

// Session (default xotirada)
bot.use(session({ initial: () => ({}) }));

// Handlerlar
bot.use(userHandlers);
bot.use(adminHandlers);

// Global xatolik ushlash
bot.catch((err) => {
  console.error('Bot xatoligi:', err.error || err);
});

// Ishga tushirish
(async () => {
  try {
    console.log('Bot ishga tushmoqda...');
    await bot.start();
    console.log('Bot muvaffaqiyatli ishga tushdi!');
  } catch (err) {
    console.error('Bot ishga tushmadi:', err);
    process.exit(1);
  }
})();

// To'xtatish signallari
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());

// Railway uchun sog'lomlashtirish tekshiruvi (ixtiyoriy, lekin tavsiya qilinadi)
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
});
