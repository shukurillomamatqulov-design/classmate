const { Composer, InputFile } = require('grammy');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { 
  getAllPhotos, getUsersWithPhotoStats, getSetting, setSetting, PHOTOS_DIR 
} = require('../database');
const keyboards = require('../keyboards');

const router = new Composer();
const ADMIN_IDS = process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim()));

// Admin middleware
router.use(async (ctx, next) => {
  if (ctx.from && ADMIN_IDS.includes(ctx.from.id)) {
    await next();
  } else {
    // Admin bo'lmaganlar uchun xatolik (agar admin buyrug'iga kirishga urinsa)
    if (ctx.callbackQuery?.data?.startsWith('admin_') || ctx.message?.text === '/admin') {
      await ctx.answerCallbackQuery?.({ text: '⛔️ Sizda admin huquqi yo\'q.', show_alert: true }) ||
      await ctx.reply('⛔️ Sizda admin huquqi yo\'q.');
    } else {
      await next(); // oddiy foydalanuvchi handlerlariga o'tkazish
    }
  }
});

// /admin buyrug'i
router.command('admin', async (ctx) => {
  await ctx.reply(
    '👑 Admin panelga xush kelibsiz!\nQuyidagi amallardan birini tanlang:',
    { reply_markup: keyboards.adminPanelKeyboard() }
  );
});

// Admin panelni yangilash
router.callbackQuery('admin_refresh', async (ctx) => {
  await ctx.editMessageText(
    '👑 Admin panelga xush kelibsiz!\nQuyidagi amallardan birini tanlang:',
    { reply_markup: keyboards.adminPanelKeyboard() }
  );
  await ctx.answerCallbackQuery();
});

// 1. Barcha rasmlarni ZIP arxivda yuklash
router.callbackQuery('admin_download', async (ctx) => {
  await ctx.answerCallbackQuery({ text: '⏳ Rasmlar yig\'ilmoqda, biroz kuting...' });
  
  const photos = await getAllPhotos();
  if (photos.length === 0) {
    await ctx.reply('📭 Hozircha birorta ham rasm yo\'q.');
    return;
  }
  
  const zip = new AdmZip();
  
  for (const photo of photos) {
    const userFolder = `${photo.full_name} (${photo.user_id})`;
    const typeFolder = photo.photo_type === 'childhood' ? 'Yoshlikdagi' : 'Hozirgi';
    const fileName = `${photo.id}_${path.basename(photo.file_path)}`;
    
    // Fayl mavjudligini tekshirish
    if (fs.existsSync(photo.file_path)) {
      zip.addLocalFile(photo.file_path, path.join(userFolder, typeFolder));
    }
    
    // Har bir rasm uchun izoh fayli
    const captionFile = path.join(userFolder, typeFolder, `${fileName}.txt`);
    const captionContent = `Foydalanuvchi: ${photo.full_name} (@${photo.username || 'username yo\'q'})\n` +
                          `ID: ${photo.user_id}\n` +
                          `Rasm turi: ${photo.photo_type === 'childhood' ? 'Yoshlikdagi' : 'Hozirgi'}\n` +
                          `Yuklangan sana: ${photo.uploaded_at}\n` +
                          `Izoh: ${photo.caption || 'Izoh qoldirilmagan'}`;
    zip.addFile(captionFile, Buffer.from(captionContent, 'utf8'));
  }
  
  const zipBuffer = zip.toBuffer();
  
  await ctx.replyWithDocument(
    new InputFile(zipBuffer, `barcha_rasmlar_${new Date().toISOString().slice(0,10)}.zip`),
    { caption: `📦 Jami ${photos.length} ta rasm` }
  );
});

// 2. Foydalanuvchilar statistikasi
router.callbackQuery('admin_stats', async (ctx) => {
  await ctx.answerCallbackQuery();
  
  const stats = await getUsersWithPhotoStats();
  if (stats.length === 0) {
    await ctx.reply('📊 Hozircha birorta ham rasm yuborgan foydalanuvchi yo\'q.');
    return;
  }
  
  let message = '👥 <b>Rasm yuborgan foydalanuvchilar:</b>\n\n';
  for (const user of stats) {
    message += `👤 <b>${user.full_name}</b> `;
    if (user.username) message += `(@${user.username}) `;
    message += `\n🆔 ID: <code>${user.user_id}</code>\n`;
    message += `👶 Yoshlikdagi: ${user.childhood_count} ta\n`;
    message += `🧑 Hozirgi: ${user.current_count} ta\n`;
    message += `📅 Oxirgi yuklama: ${user.last_upload ? new Date(user.last_upload).toLocaleString('uz-UZ') : '—'}\n\n`;
  }
  
  // Uzun xabarlarni bo'lib yuborish
  const MAX_LENGTH = 4000;
  for (let i = 0; i < message.length; i += MAX_LENGTH) {
    await ctx.reply(message.substring(i, i + MAX_LENGTH), { parse_mode: 'HTML' });
  }
});

// 3. Qabulni ochish/yopish
router.callbackQuery('admin_toggle', async (ctx) => {
  const current = await getSetting('accepting');
  const newStatus = current === 'on' ? 'off' : 'on';
  await setSetting('accepting', newStatus);
  
  const statusText = newStatus === 'on' ? '✅ Qabul qilish yoqildi' : '⛔️ Qabul qilish o\'chirildi';
  await ctx.answerCallbackQuery({ text: statusText, show_alert: true });
  
  // Admin panelni yangilash
  await ctx.editMessageText(
    '👑 Admin panelga xush kelibsiz!\nQuyidagi amallardan birini tanlang:',
    { reply_markup: keyboards.adminPanelKeyboard() }
  );
});

// Admin uchun rasm yuborish va tahrirlash imkoniyati (kerak bo'lsa qo'shimcha)
// Masalan, admin foydalanuvchi nomidan rasm qo'shishi mumkin.

module.exports = router;
