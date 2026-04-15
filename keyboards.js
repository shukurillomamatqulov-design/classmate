const { InlineKeyboard } = require('grammy');

// Asosiy menyu (foydalanuvchi)
function mainMenuKeyboard() {
  return new InlineKeyboard()
    .text('👶 Yoshlikdagi rasm', 'send_childhood')
    .text('🧑 Hozirgi rasm', 'send_current')
    .row()
    .text('🖼 Yuborgan rasmlarim', 'my_photos');
}

// "Rasmlarim" menyusi
function myPhotosMenuKeyboard() {
  return new InlineKeyboard()
    .text('👶 Yoshlikdagi', 'list_childhood')
    .text('🧑 Hozirgi', 'list_current')
    .row()
    .text('🔙 Asosiy menyu', 'main_menu');
}

// Rasm ko'rish va o'chirish
function photoActionsKeyboard(photoId, photoType) {
  return new InlineKeyboard()
    .text('🗑 O\'chirish', `delete_${photoId}_${photoType}`)
    .row()
    .text('🔙 Orqaga', `list_${photoType}`)
    .text('🏠 Bosh menyu', 'main_menu');
}

// Admin panel
function adminPanelKeyboard() {
  return new InlineKeyboard()
    .text('📸 Barcha rasmlarni yuklash', 'admin_download')
    .row()
    .text('👥 Foydalanuvchilar statistikasi', 'admin_stats')
    .row()
    .text('⚙️ Qabulni ochish/yopish', 'admin_toggle')
    .row()
    .text('🔄 Yangilash', 'admin_refresh');
}

// Orqaga qaytish tugmasi
function backToMainKeyboard() {
  return new InlineKeyboard().text('🔙 Asosiy menyu', 'main_menu');
}

// Orqaga qaytish (rasmlar ro'yxatiga)
function backToListKeyboard(photoType) {
  return new InlineKeyboard()
    .text('🔙 Orqaga', `list_${photoType}`)
    .text('🏠 Bosh menyu', 'main_menu');
}

module.exports = {
  mainMenuKeyboard,
  myPhotosMenuKeyboard,
  photoActionsKeyboard,
  adminPanelKeyboard,
  backToMainKeyboard,
  backToListKeyboard
};
