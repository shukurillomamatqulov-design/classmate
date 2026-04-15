const { InlineKeyboard } = require('grammy');

// ========== Foydalanuvchi tugmalari ==========
function mainMenu() {
  return new InlineKeyboard()
    .text('👶 Yoshlikdagi rasm', 'send_childhood')
    .text('🧑 Hozirgi rasm', 'send_current')
    .row()
    .text('🖼 Yuborgan rasmlarim', 'my_photos');
}

function myPhotosMenu() {
  return new InlineKeyboard()
    .text('👶 Yoshlikdagi', 'list_childhood')
    .text('🧑 Hozirgi', 'list_current')
    .row()
    .text('🔙 Asosiy menyu', 'main_menu');
}

function photoActions(photoId, photoType) {
  return new InlineKeyboard()
    .text('🗑 O\'chirish', `delete_${photoId}_${photoType}`)
    .row()
    .text('🔙 Orqaga', `list_${photoType}`)
    .text('🏠 Bosh menyu', 'main_menu');
}

function confirmDeleteKeyboard(photoId, photoType) {
  return new InlineKeyboard()
    .text('✅ Ha, o\'chirilsin', `confirm_delete_${photoId}_${photoType}`)
    .text('❌ Yo\'q', `list_${photoType}`)
    .row()
    .text('🏠 Bosh menyu', 'main_menu');
}

function backToMain() {
  return new InlineKeyboard().text('🔙 Asosiy menyu', 'main_menu');
}

function backToList(photoType) {
  return new InlineKeyboard()
    .text('🔙 Ro\'yxatga', `list_${photoType}`)
    .text('🏠 Bosh menyu', 'main_menu');
}

// ========== Admin tugmalari ==========
function adminPanel() {
  return new InlineKeyboard()
    .text('📦 Barcha rasmlarni ZIP yuklash', 'admin_download')
    .row()
    .text('📊 Foydalanuvchilar statistikasi', 'admin_stats')
    .row()
    .text('🖼 Barcha rasmlarni ko\'rish', 'admin_view_all')
    .row()
    .text('⚙️ Qabulni ochish/yopish', 'admin_toggle')
    .row()
    .text('🔄 Yangilash', 'admin_refresh');
}

function adminBackToPanel() {
  return new InlineKeyboard().text('🔙 Admin panelga', 'admin_refresh');
}

function adminPhotoViewKeyboard(photoId, currentIndex, total, isAccepting) {
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
  mainMenu,
  myPhotosMenu,
  photoActions,
  confirmDeleteKeyboard,
  backToMain,
  backToList,
  adminPanel,
  adminBackToPanel,
  adminPhotoViewKeyboard
};
