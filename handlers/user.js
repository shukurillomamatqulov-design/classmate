const { Composer, InputFile } = require('grammy');
const fs = require('fs');
const path = require('path');
const storage = require('../storage');
const keyboards = require('../keyboards');

const router = new Composer();

// /start
router.command('start', async (ctx) => {
  try {
    const user = ctx.from;
    storage.saveUser(user.id, user.first_name + (user.last_name ? ' ' + user.last_name : ''), user.username);
    
    const isAdmin = process.env.ADMIN_IDS.split(',').map(id => parseInt(id)).includes(user.id);
    
    await ctx.reply(
      `👋 Assalomu alaykum, ${user.first_name}!\n\n` +
      `Ushbu bot orqali vinetkadagi va hozirgi rasmlaringizni yuborishingiz mumkin.\n` +
      `Pastdagi tugmalar orqali menyuni boshqaring:`,
      { reply_markup: keyboards.mainReplyKeyboard(isAdmin) }
    );
    
    // Asosiy inline menyuni ham ko'rsatamiz
    await ctx.reply('Quyidagi amallardan birini tanlang:', {
      reply_markup: keyboards.mainMenuInline()
    });
  } catch (error) {
    console.error('Start xatosi:', error);
    await ctx.reply('Xatolik yuz berdi. Iltimos, keyinroq urinib ko\'ring.');
  }
});

// /menu – asosiy menyuni qayta ko'rsatish
router.command('menu', async (ctx) => {
  try {
    await ctx.reply('Asosiy menyu:', {
      reply_markup: keyboards.mainMenuInline()
    });
  } catch (error) {
    console.error('Menu xatosi:', error);
  }
});

// "📸 Menyu" tugmasi bosilganda
router.hears('📸 Menyu', async (ctx) => {
  await ctx.reply('Asosiy menyu:', {
    reply_markup: keyboards.mainMenuInline()
  });
});

// "ℹ️ Yordam" tugmasi
router.hears('ℹ️ Yordam', async (ctx) => {
  await ctx.reply(
    '📌 Botdan foydalanish:\n\n' +
    '• Yoshlikdagi yoki hozirgi rasmingizni yuborish uchun tugmalardan foydalaning.\n' +
    '• Yuborgan rasmlaringizni ko\'rish va o\'chirish mumkin.\n' +
    '• Admin panel faqat ruxsat etilgan foydalanuvchilar uchun.\n\n' +
    'Savollaringiz bo\'lsa: @admin_username'
  );
});

// Asosiy menyuga qaytish (callback)
router.callbackQuery('main_menu', async (ctx) => {
  try {
    // Agar xabar eski bo'lsa va tahrirlab bo'lmasa, yangi xabar yuboramiz
    await ctx.editMessageText(
      'Quyidagi menyudan tanlang:',
      { reply_markup: keyboards.mainMenuInline() }
    );
    await ctx.answerCallbackQuery();
  } catch (error) {
    // Agar xabarni tahrirlab bo'lmasa (masalan, xabar o'chirilgan yoki eski), yangisini yuboramiz
    await ctx.reply('Quyidagi menyudan tanlang:', {
      reply_markup: keyboards.mainMenuInline()
    });
    await ctx.answerCallbackQuery();
  }
});


// Rasm yuborish so'rovi
router.callbackQuery(/^send_(childhood|current)$/, async (ctx) => {
  try {
    const photoType = ctx.match[1];
    
    if (!storage.getSetting('accepting')) {
      await ctx.answerCallbackQuery({ text: '❌ Hozirda rasmlar qabul qilinmayapti.', show_alert: true });
      return;
    }
    
    ctx.session.step = 'waiting_photo';
    ctx.session.photoType = photoType;
    
    const msg = photoType === 'childhood' 
      ? '👶 Iltimos, vinetkadagi rasmingizni yuboring:' 
      : '🧑 Iltimos, hozirgi rasmingizni yuboring:';
    
    await ctx.reply(msg);
    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error('Send photo xatosi:', error);
    await ctx.answerCallbackQuery({ text: 'Xatolik', show_alert: true });
  }
});

// Rasm qabul qilish
router.on(':photo', async (ctx, next) => {
  if (ctx.session?.step !== 'waiting_photo') return next();
  
  try {
    const photoType = ctx.session.photoType;
    const user = ctx.from;
    
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;
    
    const file = await ctx.api.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    
    const ext = path.extname(file.file_path) || '.jpg';
    const fileName = `${Date.now()}_${user.id}${ext}`;
    
    const userDir = path.join(storage.PHOTOS_DIR, String(user.id));
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    
    const filePath = path.join(userDir, fileName);
    
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));
    
    const photoData = {
      id: storage.generateId(),
      userId: user.id,
      photoType: photoType,
      fileId: fileId,
      filePath: path.join(String(user.id), fileName),
      caption: ctx.message.caption || '',
      uploadedAt: new Date().toISOString()
    };
    storage.savePhotoMeta(photoData);
    
    ctx.session.step = null;
    ctx.session.photoType = null;
    
    const typeName = photoType === 'childhood' ? 'Yoshlikdagi' : 'Hozirgi';
    await ctx.reply(
      `✅ ${typeName} rasmingiz muvaffaqiyatli saqlandi!`,
      { reply_markup: keyboards.mainMenuInline() }
    );
  } catch (error) {
    console.error('Rasm saqlashda xato:', error);
    await ctx.reply('❌ Xatolik yuz berdi. Keyinroq qayta urinib ko\'ring.');
    ctx.session.step = null;
  }
});

// "Yuborgan rasmlarim"
router.callbackQuery('my_photos', async (ctx) => {
  try {
    await ctx.editMessageText(
      '📸 Qaysi turdagi rasmlaringizni ko\'rmoqchisiz?',
      { reply_markup: keyboards.myPhotosMenuInline() }
    );
    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error('My photos xatosi:', error);
    await ctx.answerCallbackQuery({ text: 'Xatolik', show_alert: true });
  }
});

// Ro'yxatni ko'rish
router.callbackQuery(/^list_(childhood|current)$/, async (ctx) => {
  try {
    const photoType = ctx.match[1];
    const userId = ctx.from.id;
    const photos = storage.getUserPhotos(userId, photoType);
    
    const typeName = photoType === 'childhood' ? 'yoshlikdagi' : 'hozirgi';
    
    if (photos.length === 0) {
      await ctx.editMessageText(
        `📭 Sizda hali ${typeName} rasmlar yo'q.`,
        { reply_markup: keyboards.backToMainInline() }
      );
      await ctx.answerCallbackQuery();
      return;
    }
    
    ctx.session.photoList = photos;
    ctx.session.currentIndex = 0;
    ctx.session.photoType = photoType;
    
    await showPhoto(ctx, photos[0], 0, photos.length);
    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error('List photos xatosi:', error);
    await ctx.answerCallbackQuery({ text: 'Xatolik', show_alert: true });
  }
});

// Rasmni ko'rsatish
async function showPhoto(ctx, photo, index, total) {
  try {
    const filePath = path.join(storage.PHOTOS_DIR, photo.filePath);
    
    const caption = `📷 Rasm ${index + 1}/${total}\n` +
                    (photo.caption ? `📝 Izoh: ${photo.caption}\n` : '') +
                    `📅 ${new Date(photo.uploadedAt).toLocaleString('uz-UZ')}`;
    
    const keyboard = new (require('grammy').InlineKeyboard)();
    if (index > 0) keyboard.text('⬅️', `nav_prev`);
    keyboard.text('🗑', `delete_req_${photo.id}_${ctx.session.photoType}`);
    if (index < total - 1) keyboard.text('➡️', `nav_next`);
    keyboard.row().text('🔙 Ro\'yxatga', `list_${ctx.session.photoType}`).text('🏠 Bosh menyu', 'main_menu');
    
    await ctx.replyWithPhoto(new InputFile(filePath), { caption, reply_markup: keyboard });
  } catch (error) {
    console.error('Show photo xatosi:', error);
    await ctx.reply('Rasmni ko\'rsatishda xatolik yuz berdi.');
  }
}

// Navigatsiya
router.callbackQuery(/^nav_(prev|next)$/, async (ctx) => {
  try {
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
  } catch (error) {
    console.error('Navigation xatosi:', error);
    await ctx.answerCallbackQuery({ text: 'Xatolik', show_alert: true });
  }
});

// O'chirish so'rovi
router.callbackQuery(/^delete_req_(.+)_(childhood|current)$/, async (ctx) => {
  try {
    const photoId = ctx.match[1];
    const photoType = ctx.match[2];
    
    await ctx.editMessageCaption({
      caption: `❓ Rostdan ham bu rasmni o'chirmoqchimisiz?`,
      reply_markup: keyboards.confirmDeleteInline(photoId, photoType)
    });
    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error('Delete request xatosi:', error);
    await ctx.answerCallbackQuery({ text: 'Xatolik', show_alert: true });
  }
});

// Tasdiqlangan o'chirish
router.callbackQuery(/^confirm_delete_(.+)_(childhood|current)$/, async (ctx) => {
  try {
    const photoId = ctx.match[1];
    const photoType = ctx.match[2];
    const userId = ctx.from.id;
    
    const deleted = storage.deletePhotoMeta(photoId, userId);
    if (!deleted) {
      await ctx.answerCallbackQuery({ text: '❌ Rasm topilmadi', show_alert: true });
      return;
    }
    
    await ctx.answerCallbackQuery({ text: '✅ O\'chirildi' });
    
    const photos = storage.getUserPhotos(userId, photoType);
    if (photos.length === 0) {
      await ctx.editMessageText(
        `📭 Sizda ${photoType === 'childhood' ? 'yoshlikdagi' : 'hozirgi'} rasmlar qolmadi.`,
        { reply_markup: keyboards.backToMainInline() }
      );
    } else {
      ctx.session.photoList = photos;
      ctx.session.currentIndex = 0;
      ctx.session.photoType = photoType;
      await ctx.deleteMessage();
      await showPhoto(ctx, photos[0], 0, photos.length);
    }
  } catch (error) {
    console.error('Confirm delete xatosi:', error);
    await ctx.answerCallbackQuery({ text: 'Xatolik', show_alert: true });
  }
});

module.exports = router;
