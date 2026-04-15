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
  const userId = ctx.from?.id;
  if (userId && ADMIN_IDS.includes(userId)) {
    await next();
  } else {
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
  try {
    await ctx.reply(
      '👑 Admin panel\nQuyidagi amallardan birini tanlang:',
      { reply_markup: keyboards.adminPanel() }
    );
  } catch (error) {
    console.error('Admin command xatosi:', error);
  }
});

// Admin panelni yangilash
router.callbackQuery('admin_refresh', async (ctx) => {
  try {
    await ctx.editMessageText(
      '👑 Admin panel\nQuyidagi amallardan birini tanlang:',
      { reply_markup: keyboards.adminPanel() }
    );
    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error('Admin refresh xatosi:', error);
    await ctx.answerCallbackQuery({ text: 'Xatolik', show_alert: true });
  }
});

// ========== 1. ZIP yuklash ==========
router.callbackQuery('admin_download', async (ctx) => {
  try {
    await ctx.answerCallbackQuery({ text: '⏳ Tayyorlanmoqda...' });
    
    const allPhotos = storage.getAllPhotosWithUser();
    if (allPhotos.length === 0) {
      await ctx.reply('📭 Hozircha hech qanday rasm yo\'q.');
      return;
    }
    
    const zip = new AdmZip();
    
    allPhotos.forEach(photo => {
      const user = photo.user;
      const userName = (user.fullName || 'user').replace(/[^a-z0-9\u0400-\u04FF]/gi, '_');
      const userFolder = `${userName}_${photo.userId}`;
      const typeFolder = photo.photoType === 'childhood' ? 'Yoshlikdagi' : 'Hozirgi';
      
      const fullPath = path.join(storage.PHOTOS_DIR, photo.filePath);
      if (fs.existsSync(fullPath)) {
        const destPath = path.join(userFolder, typeFolder, path.basename(photo.filePath));
        zip.addLocalFile(fullPath, path.dirname(destPath));
        
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

// ========== 2. Statistikani ko'rish ==========
router.callbackQuery('admin_stats', async (ctx) => {
  try {
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
    
    // Uzun xabarni bo'lib yuborish
    const MAX = 4000;
    for (let i = 0; i < text.length; i += MAX) {
      await ctx.reply(text.substring(i, i + MAX), { parse_mode: 'HTML' });
    }
    
    // Admin panelga qaytish tugmasi
    await ctx.reply('🔙 Admin panelga qaytish:', { reply_markup: keyboards.adminBackToPanel() });
  } catch (error) {
    console.error('Admin stats xatosi:', error);
    await ctx.reply('❌ Xatolik yuz berdi.');
  }
});

// ========== 3. Barcha rasmlarni ko'rish (pagination) ==========
router.callbackQuery('admin_view_all', async (ctx) => {
  try {
    const allPhotos = storage.getAllPhotosWithUser();
    
    if (allPhotos.length === 0) {
      await ctx.editMessageText(
        '📭 Hozircha hech qanday rasm yo\'q.',
        { reply_markup: keyboards.adminBackToPanel() }
      );
      await ctx.answerCallbackQuery();
      return;
    }
    
    ctx.session.adminPhotoList = allPhotos;
    ctx.session.adminCurrentIndex = 0;
    
    await showAdminPhoto(ctx, allPhotos[0], 0, allPhotos.length);
    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error('Admin view all xatosi:', error);
    await ctx.answerCallbackQuery({ text: 'Xatolik', show_alert: true });
  }
});

async function showAdminPhoto(ctx, photo, index, total) {
  try {
    const filePath = path.join(storage.PHOTOS_DIR, photo.filePath);
    
    const user = photo.user;
    const typeText = photo.photoType === 'childhood' ? '👶 Yoshlikdagi' : '🧑 Hozirgi';
    
    const caption = 
      `👤 <b>${user.fullName}</b>` + (user.username ? ` (@${user.username})` : '') + `\n` +
      `🆔 User ID: <code>${photo.userId}</code>\n` +
      `${typeText}\n` +
      `📝 Izoh: ${photo.caption || '—'}\n` +
      `📅 ${new Date(photo.uploadedAt).toLocaleString('uz-UZ')}\n` +
      `📷 Rasm ${index + 1}/${total}`;
    
    const keyboard = keyboards.adminPhotoViewKeyboard(photo.id, index, total);
    
    await ctx.replyWithPhoto(new InputFile(filePath), { 
      caption, 
      parse_mode: 'HTML',
      reply_markup: keyboard 
    });
  } catch (error) {
    console.error('Show admin photo xatosi:', error);
    await ctx.reply('Rasmni ko\'rsatishda xatolik.');
  }
}

// Admin navigatsiya
router.callbackQuery(/^admin_(prev|next)_(\d+)$/, async (ctx) => {
  try {
    const dir = ctx.match[1];
    const oldIndex = parseInt(ctx.match[2]);
    const photos = ctx.session.adminPhotoList;
    
    if (!photos || photos.length === 0) {
      await ctx.answerCallbackQuery({ text: 'Xatolik' });
      return;
    }
    
    let newIndex = oldIndex;
    if (dir === 'prev' && oldIndex > 0) newIndex--;
    else if (dir === 'next' && oldIndex < photos.length - 1) newIndex++;
    else {
      await ctx.answerCallbackQuery();
      return;
    }
    
    ctx.session.adminCurrentIndex = newIndex;
    await ctx.deleteMessage();
    await showAdminPhoto(ctx, photos[newIndex], newIndex, photos.length);
    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error('Admin navigation xatosi:', error);
    await ctx.answerCallbackQuery({ text: 'Xatolik', show_alert: true });
  }
});

// Admin rasm o'chirish
router.callbackQuery(/^admin_delete_photo_(.+)_(\d+)$/, async (ctx) => {
  try {
    const photoId = ctx.match[1];
    const currentIndex = parseInt(ctx.match[2]);
    
    const deleted = storage.adminDeletePhoto(photoId);
    if (!deleted) {
      await ctx.answerCallbackQuery({ text: '❌ Rasm topilmadi', show_alert: true });
      return;
    }
    
    await ctx.answerCallbackQuery({ text: '✅ O\'chirildi' });
    
    // Yangilangan ro'yxat
    const newPhotos = storage.getAllPhotosWithUser();
    ctx.session.adminPhotoList = newPhotos;
    
    if (newPhotos.length === 0) {
      await ctx.editMessageText(
        '📭 Barcha rasmlar o\'chirildi.',
        { reply_markup: keyboards.adminBackToPanel() }
      );
      return;
    }
    
    // Indeksni sozlash
    let newIndex = currentIndex;
    if (newIndex >= newPhotos.length) newIndex = newPhotos.length - 1;
    ctx.session.adminCurrentIndex = newIndex;
    
    await ctx.deleteMessage();
    await showAdminPhoto(ctx, newPhotos[newIndex], newIndex, newPhotos.length);
  } catch (error) {
    console.error('Admin delete xatosi:', error);
    await ctx.answerCallbackQuery({ text: 'Xatolik', show_alert: true });
  }
});

// ========== 4. Qabulni yoqish/o'chirish ==========
router.callbackQuery('admin_toggle', async (ctx) => {
  try {
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
  } catch (error) {
    console.error('Admin toggle xatosi:', error);
    await ctx.answerCallbackQuery({ text: 'Xatolik', show_alert: true });
  }
});

module.exports = router;
