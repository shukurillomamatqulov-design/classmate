const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const META_FILE = path.join(DATA_DIR, 'photos_meta.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Papkalarni yaratish
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });

// Fayllarni yaratish (agar mavjud bo'lmasa)
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '{}');
if (!fs.existsSync(META_FILE)) fs.writeFileSync(META_FILE, '[]');
if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ accepting: true }));

// ========== Foydalanuvchilar ==========
function saveUser(userId, fullName, username) {
  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  users[userId] = { fullName, username, joinedAt: new Date().toISOString() };
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ========== Rasmlar metadata ==========
function getAllPhotosMeta() {
  return JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
}

function savePhotoMeta(photoData) {
  const meta = getAllPhotosMeta();
  meta.push(photoData);
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
  return photoData.id;
}

function getUserPhotos(userId, photoType = null) {
  const meta = getAllPhotosMeta();
  return meta.filter(p => p.userId === userId && (!photoType || p.photoType === photoType))
             .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

function deletePhotoMeta(photoId, userId) {
  const meta = getAllPhotosMeta();
  const photo = meta.find(p => p.id === photoId && p.userId === userId);
  if (!photo) return false;
  
  // Faylni o'chirish
  const filePath = path.join(PHOTOS_DIR, photo.filePath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  
  // Meta'dan o'chirish
  const newMeta = meta.filter(p => !(p.id === photoId && p.userId === userId));
  fs.writeFileSync(META_FILE, JSON.stringify(newMeta, null, 2));
  return true;
}

function getAllPhotosWithUser() {
  const meta = getAllPhotosMeta();
  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  return meta.map(p => ({
    ...p,
    user: users[p.userId] || { fullName: 'Nomaʼlum', username: null }
  }));
}

function getUsersWithPhotoCounts() {
  const meta = getAllPhotosMeta();
  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  const stats = {};
  
  meta.forEach(p => {
    if (!stats[p.userId]) {
      stats[p.userId] = {
        userId: p.userId,
        fullName: users[p.userId]?.fullName || 'Nomaʼlum',
        username: users[p.userId]?.username || null,
        childhood: 0,
        current: 0,
        lastUpload: null
      };
    }
    stats[p.userId][p.photoType]++;
    if (!stats[p.userId].lastUpload || p.uploadedAt > stats[p.userId].lastUpload) {
      stats[p.userId].lastUpload = p.uploadedAt;
    }
  });
  
  return Object.values(stats).sort((a, b) => new Date(b.lastUpload) - new Date(a.lastUpload));
}

// ========== Sozlamalar ==========
function getSetting(key) {
  const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  return settings[key];
}

function setSetting(key, value) {
  const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  settings[key] = value;
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// ========== ID generatsiya ==========
function generateId() {
  return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

module.exports = {
  PHOTOS_DIR,
  saveUser,
  savePhotoMeta,
  getUserPhotos,
  deletePhotoMeta,
  getAllPhotosWithUser,
  getUsersWithPhotoCounts,
  getSetting,
  setSetting,
  generateId
};
