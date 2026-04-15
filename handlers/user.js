const { Composer, InputFile } = require('grammy');
const fs = require('fs');
const path = require('path');
const { 
  addUser, addPhoto, getUserPhotos, deletePhoto, getSetting, PHOTOS_DIR 
} = require('../database');
const keyboards = require('../keyboards');

const router = new Composer();

// /start buyrug'i
router.command('start', async (ctx) => {
  const user = ctx.from;
  await addUser(user.id, user.first_name + (user.last_name ? ' ' + user.last_name : ''), user.username);
  
  await ctx.reply(
    `Assalomu alaykum, ${user.first_name}! 👋\n\n` +
    `Bu bot orqali siz yoshlikdagi va hozirgi rasmlaringizni yuborishingiz mumkin.\n` +
    `Quyidagi menyudan kerakli bo'limni tanlang:`,
    { reply_markup: keyboards.mainMenuKeyboard() }
  );
});

// "Asosiy menyu" callback
router.callbackQuery('main_menu', async (ctx) => {
  await ctx.editMessageText(
    `Assalomu alaykum, ${ctx.from.first_name}! 👋\n\nQuyidagi menyudan tanlang:`,
    { reply_markup: keyboards.mainMenuKeyboard() }
  );
  await ctx.answerCallbackQuery();
});

// Rasm yuborish bosqichi (childhood yoki current)
router.callbackQuery(/^send_(childhood|current)$/, async (ctx) => {
  const photoType = ctx.match[1];
  
  // Qabul qilish yoqilganligini tekshirish
  const accepting = await getSetting('accepting');
  if (accepting !== 'on') {
    await ctx.answerCallbackQuery({ text: '❌ Hozirda rasmlar qabul qilinmayapti.', show_alert: true });
    return;
  }
  
  ctx.session.step = 'waiting_photo';
  ctx.session.photoType = photoType;
  
  const message = photoType === 'childhood' 
    ? '👶 Iltimos, yoshlikdagi rasmingizni yuboring:'
    : '🧑 Iltimos, hozirgi rasmingizni yuboring:';
  
  await ctx.reply(message, { reply_markup: { force_reply: true } });
  await ctx.answerCallbackQuery();
});

// Rasm qabul qilish (foto xabar)
router.on(':photo', async (ctx, next) => {
  // Agar kutilayotgan holat bo'lmasa, keyingi middleware'ga o'tamiz
  if (ctx.session?.step !== 'waiting_photo') return next();
  
  const photoType = ctx.session.photoType;
  const user = ctx.from;
  
  // Eng katta rasmni olish
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const fileId = photo.file_id;
  
  // Faylni yuklab olish
  const file = await ctx.api.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
  
  // Fayl nomini yaratish
  const ext = path.extname(file.file_path) || '.jpg';
  const fileName = `${user.id}_${Date.now()}${ext}`;
  const filePath = path.join(PHOTOS_DIR, fileName);
  
  // Faylni saqlash
  const response = await fetch(fileUrl);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(buffer));
  
  // Ma'lumotlar bazasiga qo'shish
  const caption = ctx.message.caption || '';
  await addPhoto(user.id, photoType, fileId, filePath, caption);
  
  // Holatni tozalash
  ctx.session.step = null;
  ctx.session.photoType = null;
  
  const typeName = photoType === 'childhood' ? 'Yoshlikdagi' : 'Hozirgi';
  await ctx.reply(
    `✅ ${typeName} rasmingiz muvaffaqiyatli saqlandi!`,
    { reply_markup: keyboards.mainMenuKeyboard() }
  );
});

// "Yuborgan rasmlarim" menyusi
router.callbackQuery('my_photos', async (ctx) => {
  await ctx.editMessageText(
    '📸 Qaysi turdagi rasmlaringizni ko\'rmoqchisiz?',
    { reply_markup: keyboards.myPhotosMenuKeyboard() }
  );
  await ctx.answerCallbackQuery();
});

// Ro'yxatni ko'rish (childhood yoki current)
router.callbackQuery(/^list_(childhood|current)$/, async (ctx) => {
  const photoType = ctx.match[1];
  const userId = ctx.from.id;
  const photos = await getUserPhotos(userId, photoType);
  
  const typeName = photoType === 'childhood' ? 'yoshlikdagi' : 'hozirgi';
  
  if (photos.length === 0) {
    await ctx.editMessageText(
      `📭 Sizda hali ${typeName} rasmlar yo'q.`,
      { reply_markup: keyboards.backToMainKeyboard() }
    );
    await ctx.answerCallbackQuery();
    return;
  }
  
  // Birinchi rasmni ko'rsatamiz va navigatsiya uchun ma'lumotlarni sessionda saqlaymiz
  ctx.session.currentPhotoIndex = 0;
  ctx.session.photoList = photos;
  ctx.session.photoType = photoType;
  
  await showPhoto(ctx, photos[0], 0, photos.length);
  await ctx.answerCallbackQuery();
});

// Rasm ko'rsatish yordamchi funksiyasi
async function showPhoto(ctx, photo, index, total) {
  const caption = `📷 Rasm ${index + 1}/${total}\n` +
                  (photo.caption ? `📝 Izoh: ${photo.caption}\n` : '') +
                  `📅 ${new Date(photo.uploaded_at).toLocaleString('uz-UZ')}`;
  
  // Inline tugmalar: O'chirish, Oldingi, Keyingi, Orqaga
  const keyboard = new (require('grammy').InlineKeyboard)();
  
  if (index > 0) keyboard.text('⬅️', `nav_prev`);
  keyboard.text('🗑', `delete_${photo.id}_${ctx.session.photoType}`);
  if (index < total - 1) keyboard.text('➡️', `nav_next`);
  
  keyboard.row().text('🔙 Ro\'yxatga', `list_${ctx.session.photoType}`).text('🏠 Bosh menyu', 'main_menu');
  
  try {
    // Fayl ID orqali yuborish
    await ctx.replyWithPhoto(photo.file_id, {
      caption,
      reply_markup: keyboard
    });
  } catch (err) {
    // Agar file_id ishlamasa, fayl yo'lidan yuklaymiz
    await ctx.replyWithPhoto(new InputFile(photo.file_path), {
      caption,
      reply_markup: keyboard
    });
  }
}

// Navigatsiya (oldingi/keyingi)
router.callbackQuery(/^nav_(prev|next)$/, async (ctx) => {
  const direction = ctx.match[1];
  const photos = ctx.session.photoList;
  const photoType = ctx.session.photoType;
  let index = ctx.session.currentPhotoIndex;
  
  if (!photos || photos.length === 0) {
    await ctx.answerCallbackQuery({ text: 'Xatolik yuz berdi.' });
    return;
  }
  
  if (direction === 'prev' && index > 0) {
    index--;
  } else if (direction === 'next' && index < photos.length - 1) {
    index++;
  } else {
    await ctx.answerCallbackQuery();
    return;
  }
  
  ctx.session.currentPhotoIndex = index;
  
  // Avvalgi xabarni o'chirish (foydalanuvchi uchun toza ko'rinish)
  await ctx.deleteMessage();
  
  // Yangi rasmni ko'rsatish
  await showPhoto(ctx, photos[index], index, photos.length);
  await ctx.answerCallbackQuery();
});

// Rasmni o'chirish
router.callbackQuery(/^delete_(\d+)_(childhood|current)$/, async (ctx) => {
  const photoId = parseInt(ctx.match[1]);
  const photoType = ctx.match[2];
  const userId = ctx.from.id;
  
  await deletePhoto(photoId, userId);
  
  await ctx.answerCallbackQuery({ text: '✅ Rasm o\'chirildi!' });
  
  // Ro'yxatga qaytish
  const photos = await getUserPhotos(userId, photoType);
  if (photos.length === 0) {
    await ctx.editMessageText(
      `📭 Sizda ${photoType === 'childhood' ? 'yoshlikdagi' : 'hozirgi'} rasmlar qolmadi.`,
      { reply_markup: keyboards.backToMainKeyboard() }
    );
  } else {
    ctx.session.photoList = photos;
    ctx.session.currentPhotoIndex = 0;
    ctx.session.photoType = photoType;
    await ctx.deleteMessage();
    await showPhoto(ctx, photos[0], 0, photos.length);
  }
});

// Boshqa barcha xabarlar uchun (noto'g'ri format)
router.on('message', async (ctx) => {
  if (ctx.session?.step === 'waiting_photo') {
    await ctx.reply('❌ Iltimos, rasm yuboring (foto).');
  }
});

module.exports = router;
