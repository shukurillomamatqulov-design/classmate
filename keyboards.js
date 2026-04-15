const { InlineKeyboard } = require('grammy');

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

function backToMain() {
  return new InlineKeyboard().text('🔙 Asosiy menyu', 'main_menu');
}

function adminPanel() {
  return new InlineKeyboard()
    .text('📦 Barcha rasmlarni ZIP yuklash', 'admin_download')
    .row()
    .text('📊 Foydalanuvchilar statistikasi', 'admin_stats')
    .row()
    .text('⚙️ Qabulni ochish/yopish', 'admin_toggle')
    .row()
    .text('🔄 Yangilash', 'admin_refresh');
}

module.exports = {
  mainMenu,
  myPhotosMenu,
  photoActions,
  backToMain,
  adminPanel
};
