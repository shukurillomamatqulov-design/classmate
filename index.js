require('dotenv').config();
const { Bot, session } = require('grammy');
const userHandlers = require('./handlers/user');
const adminHandlers = require('./handlers/admin');

if (!process.env.BOT_TOKEN) {
  console.error('BOT_TOKEN topilmadi!');
  process.exit(1);
}

const bot = new Bot(process.env.BOT_TOKEN);

bot.use(session({ initial: () => ({}) }));

bot.use(userHandlers);
bot.use(adminHandlers);

bot.catch((err) => {
  console.error('Bot xatoligi:', err.error || err);
});

bot.start().then(() => {
  console.log('Bot ishga tushdi!');
}).catch(err => {
  console.error('Bot ishga tushmadi:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());

// Health check server (Railway uchun)
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running');
}).listen(process.env.PORT || 3000);
