const { InlineKeyboard, Keyboard } = require('grammy');

// ========== Reply Keyboard (oddiy tugmalar) ==========
function mainReplyKeyboard(isAdmin = false) {
  const keyboard = new Keyboard()
    .text('📸 Menyu')
    .text('ℹ️ Yordam');
  
  if (isAdmin) {
    keyboard.row().text('👑 Admin panel');
  }
  
  return keyboard.resized().persistent();
}

// ========== Inline Keyboardlar ==========

// Asosiy menyu (foydalanuvchi)
function mainMenuInline() {
  return new InlineKeyboard()
    .text('👶 Yoshlikdagi rasm', 'send_childhood')
    .text('🧑 Hozirgi rasm', 'send_current')
    .row()
    .text('🖼 Yuborgan rasmlarim', 'my_photos');
}

// Rasmlarim menyusi
function myPhotosMenuInline() {
  return new InlineKeyboard()
    .text('👶 Yoshlikdagi', 'list_childhood')
    .text('🧑 Hozirgi', 'list_current')
    .row()
    .text('🔙 Asosiy menyu', 'main_menu');
}

// Rasm ko'rishda o'chirish va navigatsiya
function photoActionsInline(photoId, photoType) {
  return new InlineKeyboard()
    .text('🗑 O\'chirish', `delete_req_${photoId}_${photoType}`)
    .row()
    .text('🔙 Orqaga', `list_${photoType}`)
    .text('🏠 Bosh menyu', 'main_menu');
}

// O'chirishni tasdiqlash
function confirmDeleteInline(photoId, photoType) {
  return new InlineKeyboard()
    .text('✅ Ha, o\'chirilsin', `confirm_delete_${photoId}_${photoType}`)
    .text('❌ Yo\'q', `list_${photoType}`)
    .row()
    .text('🏠 Bosh menyu', 'main_menu');
}

// Orqaga qaytish (asosiy menyuga)
function backToMainInline() {
  return new InlineKeyboard().text('🔙 Asosiy menyu', 'main_menu');
}

// ========== Admin Inline Keyboard ==========
function adminPanelInline() {
  return new InlineKeyboard()
    .text('📦 Barcha rasmlarni ZIP', 'admin_download')
    .row()
    .text('📊 Foydalanuvchilar statistikasi', 'admin_stats')
    .row()
    .text('🖼 Barcha rasmlarni ko\'rish', 'admin_view_all')
    .row()
    .text('⚙️ Qabulni ochish/yopish', 'admin_toggle')
    .row()
    .text('🔄 Yangilash', 'admin_refresh');
}

// Admin panelga qaytish
function adminBackToPanelInline() {
  return new InlineKeyboard().text('🔙 Admin panelga', 'admin_refresh');
}

// Admin rasm ko'rishda navigatsiya va o'chirish
function adminPhotoViewInline(photoId, currentIndex, total) {
  const keyboard = new InlineKeyboard();
  if (currentIndex > 0) keyboard.text('⬅️ Oldingi', `admin_prev_${currentIndex}`);
  if (currentIndex < total - 1) keyboard.text('➡️ Keyingi', `admin_next_${currentIndex}`);
  keyboard.row();
  keyboard.text('🗑 O\'chirish', `admin_delete_photo_${photoId}_${currentIndex}`);
  keyboard.row();
  keyboard.text('🔙 Admin panelga', 'admin_refresh');
  return keyboard;
}

module.exports = {
  mainReplyKeyboard,
  mainMenuInline,
  myPhotosMenuInline,
  photoActionsInline,
  confirmDeleteInline,
  backToMainInline,
  adminPanelInline,
  adminBackToPanelInline,
  adminPhotoViewInline
};
