const { Composer, InputFile } = require('grammy');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const storage = require('../storage');
const keyboards = require('../keyboards');

const router = new Composer();
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [];

// Admin tekshirish middleware
router.use(async (ctx, next) => {
  if (ctx.from && ADMIN_IDS.includes(ctx.from.id)) {
    await next();
  } else {
    // Agar admin bo'lmasa va callback admin so'rovi bo'lsa
    if (ctx.callbackQuery?.data?.startsWith('admin_') || ctx.message?.text === '/admin') {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: '⛔️ Ruxsat yo\'q', show_alert: true });
      } else {
        await ctx.reply('⛔️ Siz admin emassiz.');
      }
    } else {
      await next();
    }
  }
});

// /admin buyrug'i
router.command('admin', async (ctx) => {
  await ctx.reply(
    '👑 Admin panel\nQuyidagi amallardan birini tanlang:',
    { reply_markup: keyboards.adminPanel() }
  );
});

// Yangilash
router.callbackQuery('admin_refresh', async (ctx) => {
  await ctx.editMessageText(
    '👑 Admin panel\nQuyidagi amallardan birini tanlang:',
    { reply_markup: keyboards.adminPanel() }
  );
  await ctx.answerCallbackQuery();
});

// ZIP yuklash
router.callbackQuery('admin_download', async (ctx) => {
  await ctx.answerCallbackQuery({ text: '⏳ Tayyorlanmoqda...' });
  
  try {
    const allPhotos = storage.getAllPhotosWithUser();
    if (allPhotos.length === 0) {
      await ctx.reply('📭 Hozircha hech qanday rasm yo\'q.');
      return;
    }
    
    const zip = new AdmZip();
    
    allPhotos.forEach(photo => {
      const user = photo.user;
      const userName = user.fullName.replace(/[^a-z0-9\u0400-\u04FF]/gi, '_') || 'user';
      const userFolder = `${userName}_${photo.userId}`;
      const typeFolder = photo.photoType === 'childhood' ? 'Yoshlikdagi' : 'Hozirgi';
      
      const fullPath = path.join(storage.PHOTOS_DIR, photo.filePath);
      if (fs.existsSync(fullPath)) {
        const destPath = path.join(userFolder, typeFolder, path.basename(photo.filePath));
        zip.addLocalFile(fullPath, path.dirname(destPath));
        
        // Izoh fayli qo'shish
        const infoFile = path.join(userFolder, typeFolder, `${photo.id}.txt`);
        const infoContent = 
          `Foydalanuvchi: ${user.fullName} (@${user.username || 'username yo\'q'})\n` +
          `User ID: ${photo.userId}\n` +
          `Rasm turi: ${photo.photoType === 'childhood' ? 'Yoshlikdagi' : 'Hozirgi'}\n` +
          `Yuklangan sana: ${photo.uploadedAt}\n` +
          `Izoh: ${photo.caption || '—'}`;
        zip.addFile(infoFile, Buffer.from(infoContent, 'utf8'));
      }
    });
    
    const zipBuffer = zip.toBuffer();
    const dateStr = new Date().toISOString().slice(0,10);
    
    await ctx.replyWithDocument(
      new InputFile(zipBuffer, `barcha_rasmlar_${dateStr}.zip`),
      { caption: `📦 Jami ${allPhotos.length} ta rasm` }
    );
  } catch (error) {
    console.error('ZIP yaratishda xato:', error);
    await ctx.reply('❌ Xatolik yuz berdi.');
  }
});

// Statistikani ko'rish
router.callbackQuery('admin_stats', async (ctx) => {
  await ctx.answerCallbackQuery();
  
  const stats = storage.getUsersWithPhotoCounts();
  if (stats.length === 0) {
    await ctx.reply('📊 Hozircha rasm yuborgan foydalanuvchilar yo\'q.');
    return;
  }
  
  let text = '👥 <b>Rasm yuborgan foydalanuvchilar:</b>\n\n';
  stats.forEach((u, i) => {
    text += `${i+1}. <b>${u.fullName}</b>`;
    if (u.username) text += ` (@${u.username})`;
    text += `\n🆔 ID: <code>${u.userId}</code>`;
    text += `\n👶 Yoshlikdagi: ${u.childhood} ta`;
    text += `\n🧑 Hozirgi: ${u.current} ta`;
    text += `\n📅 Oxirgi: ${u.lastUpload ? new Date(u.lastUpload).toLocaleString('uz-UZ') : '—'}`;
    text += '\n\n';
  });
  
  // Uzun xabarni bo'lish
  const MAX = 4000;
  for (let i = 0; i < text.length; i += MAX) {
    await ctx.reply(text.substring(i, i + MAX), { parse_mode: 'HTML' });
  }
});

// Qabulni yoqish/o'chirish
router.callbackQuery('admin_toggle', async (ctx) => {
  const current = storage.getSetting('accepting');
  storage.setSetting('accepting', !current);
  const newStatus = !current;
  
  await ctx.answerCallbackQuery({
    text: newStatus ? '✅ Qabul qilish yoqildi' : '⛔️ Qabul qilish o\'chirildi',
    show_alert: true
  });
  
  await ctx.editMessageText(
    '👑 Admin panel\nQuyidagi amallardan birini tanlang:',
    { reply_markup: keyboards.adminPanel() }
  );
});

module.exports = router;
