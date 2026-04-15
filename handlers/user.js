const { Composer, InputFile } = require('grammy');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // Node 18+ da global fetch bor, lekin ishonch uchun
const storage = require('../storage');
const keyboards = require('../keyboards');

const router = new Composer();

// /start
router.command('start', async (ctx) => {
  const user = ctx.from;
  storage.saveUser(user.id, user.first_name + (user.last_name ? ' ' + user.last_name : ''), user.username);
  
  await ctx.reply(
    `👋 Assalomu alaykum, ${user.first_name}!\n\n` +
    `Ushbu bot orqali yoshlikdagi va hozirgi rasmlaringizni yuborishingiz mumkin.\n` +
    `Quyidagi menyudan tanlang:`,
    { reply_markup: keyboards.mainMenu() }
  );
});

// Asosiy menyuga qaytish
router.callbackQuery('main_menu', async (ctx) => {
  await ctx.editMessageText(
    `👋 Assalomu alaykum, ${ctx.from.first_name}!\nQuyidagi menyudan tanlang:`,
    { reply_markup: keyboards.mainMenu() }
  );
  await ctx.answerCallbackQuery();
});

// Rasm yuborish so'rovi
router.callbackQuery(/^send_(childhood|current)$/, async (ctx) => {
  const photoType = ctx.match[1];
  
  // Qabul yoqilganligini tekshirish
  if (!storage.getSetting('accepting')) {
    await ctx.answerCallbackQuery({ text: '❌ Hozirda rasmlar qabul qilinmayapti.', show_alert: true });
    return;
  }
  
  ctx.session.step = 'waiting_photo';
  ctx.session.photoType = photoType;
  
  const msg = photoType === 'childhood' 
    ? '👶 Iltimos, yoshlikdagi rasmingizni yuboring:' 
    : '🧑 Iltimos, hozirgi rasmingizni yuboring:';
  
  await ctx.reply(msg, { reply_markup: { force_reply: true } });
  await ctx.answerCallbackQuery();
});

// Rasm qabul qilish
router.on(':photo', async (ctx, next) => {
  if (ctx.session?.step !== 'waiting_photo') return next();
  
  const photoType = ctx.session.photoType;
  const user = ctx.from;
  
  try {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;
    
    // Telegram'dan fayl ma'lumotini olish
    const file = await ctx.api.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    
    // Fayl kengaytmasini aniqlash
    const ext = path.extname(file.file_path) || '.jpg';
    const fileName = `${Date.now()}_${user.id}${ext}`;
    
    // User papkasini yaratish
    const userDir = path.join(storage.PHOTOS_DIR, String(user.id));
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    
    const filePath = path.join(userDir, fileName);
    
    // Rasmni yuklab olish va saqlash
    const response = await fetch(fileUrl);
    const buffer = await response.buffer();
    fs.writeFileSync(filePath, buffer);
    
    // Metama'lumotlarni saqlash
    const photoData = {
      id: storage.generateId(),
      userId: user.id,
      photoType: photoType,
      fileId: fileId,
      filePath: path.join(String(user.id), fileName), // nisbiy yo'l
      caption: ctx.message.caption || '',
      uploadedAt: new Date().toISOString()
    };
    storage.savePhotoMeta(photoData);
    
    // Holatni tozalash
    ctx.session.step = null;
    ctx.session.photoType = null;
    
    const typeName = photoType === 'childhood' ? 'Yoshlikdagi' : 'Hozirgi';
    await ctx.reply(
      `✅ ${typeName} rasmingiz muvaffaqiyatli saqlandi!`,
      { reply_markup: keyboards.mainMenu() }
    );
  } catch (error) {
    console.error('Rasm saqlashda xato:', error);
    await ctx.reply('❌ Xatolik yuz berdi. Keyinroq qayta urinib ko\'ring.');
    ctx.session.step = null;
  }
});

// "Rasmlarim" menyusi
router.callbackQuery('my_photos', async (ctx) => {
  await ctx.editMessageText(
    '📸 Qaysi turdagi rasmlaringizni ko\'rmoqchisiz?',
    { reply_markup: keyboards.myPhotosMenu() }
  );
  await ctx.answerCallbackQuery();
});

// Ro'yxatni ko'rish
router.callbackQuery(/^list_(childhood|current)$/, async (ctx) => {
  const photoType = ctx.match[1];
  const userId = ctx.from.id;
  const photos = storage.getUserPhotos(userId, photoType);
  
  const typeName = photoType === 'childhood' ? 'yoshlikdagi' : 'hozirgi';
  
  if (photos.length === 0) {
    await ctx.editMessageText(
      `📭 Sizda hali ${typeName} rasmlar yo'q.`,
      { reply_markup: keyboards.backToMain() }
    );
    await ctx.answerCallbackQuery();
    return;
  }
  
  // Sessionda ro'yxat va indeks saqlash
  ctx.session.photoList = photos;
  ctx.session.currentIndex = 0;
  ctx.session.photoType = photoType;
  
  await showPhoto(ctx, photos[0], 0, photos.length);
  await ctx.answerCallbackQuery();
});

// Rasmni ko'rsatish yordamchi funksiyasi
async function showPhoto(ctx, photo, index, total) {
  const filePath = path.join(storage.PHOTOS_DIR, photo.filePath);
  
  const caption = `📷 Rasm ${index + 1}/${total}\n` +
                  (photo.caption ? `📝 Izoh: ${photo.caption}\n` : '') +
                  `📅 ${new Date(photo.uploadedAt).toLocaleString('uz-UZ')}`;
  
  const keyboard = new (require('grammy').InlineKeyboard)();
  if (index > 0) keyboard.text('⬅️', `nav_prev`);
  keyboard.text('🗑', `delete_${photo.id}_${ctx.session.photoType}`);
  if (index < total - 1) keyboard.text('➡️', `nav_next`);
  keyboard.row().text('🔙 Ro\'yxatga', `list_${ctx.session.photoType}`).text('🏠 Bosh menyu', 'main_menu');
  
  await ctx.replyWithPhoto(new InputFile(filePath), { caption, reply_markup: keyboard });
}

// Navigatsiya
router.callbackQuery(/^nav_(prev|next)$/, async (ctx) => {
  const dir = ctx.match[1];
  const photos = ctx.session.photoList;
  let index = ctx.session.currentIndex;
  
  if (!photos || photos.length === 0) {
    await ctx.answerCallbackQuery({ text: 'Xatolik' });
    return;
  }
  
  if (dir === 'prev' && index > 0) index--;
  else if (dir === 'next' && index < photos.length - 1) index++;
  else {
    await ctx.answerCallbackQuery();
    return;
  }
  
  ctx.session.currentIndex = index;
  await ctx.deleteMessage();
  await showPhoto(ctx, photos[index], index, photos.length);
  await ctx.answerCallbackQuery();
});

// O'chirish
router.callbackQuery(/^delete_(.+)_(childhood|current)$/, async (ctx) => {
  const photoId = ctx.match[1];
  const photoType = ctx.match[2];
  const userId = ctx.from.id;
  
  const deleted = storage.deletePhotoMeta(photoId, userId);
  if (!deleted) {
    await ctx.answerCallbackQuery({ text: '❌ Rasm topilmadi', show_alert: true });
    return;
  }
  
  await ctx.answerCallbackQuery({ text: '✅ O\'chirildi' });
  
  // Qaytadan ro'yxatni olish
  const photos = storage.getUserPhotos(userId, photoType);
  if (photos.length === 0) {
    await ctx.editMessageText(
      `📭 Sizda ${photoType === 'childhood' ? 'yoshlikdagi' : 'hozirgi'} rasmlar qolmadi.`,
      { reply_markup: keyboards.backToMain() }
    );
  } else {
    ctx.session.photoList = photos;
    ctx.session.currentIndex = 0;
    ctx.session.photoType = photoType;
    await ctx.deleteMessage();
    await showPhoto(ctx, photos[0], 0, photos.length);
  }
});

// Boshqa xabarlar
router.on('message', async (ctx) => {
  if (ctx.session?.step === 'waiting_photo') {
    await ctx.reply('❌ Iltimos, rasm (foto) yuboring.');
  }
});

module.exports = router;
