const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'bot.db');
const PHOTOS_DIR = path.join(__dirname, 'data', 'photos');

// Papkalarni yaratish
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}
if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

let dbInstance = null;

async function initDatabase() {
  if (dbInstance) return dbInstance;

  dbInstance = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  // Jadvallarni yaratish
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY,
      full_name TEXT,
      username TEXT,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      photo_type TEXT CHECK(photo_type IN ('childhood', 'current')),
      file_id TEXT,
      file_path TEXT,
      caption TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES ('accepting', 'on');
  `);

  return dbInstance;
}

// Foydalanuvchi qo'shish yoki yangilash
async function addUser(userId, fullName, username) {
  const db = await initDatabase();
  await db.run(
    `INSERT INTO users (user_id, full_name, username) 
     VALUES (?, ?, ?) 
     ON CONFLICT(user_id) DO UPDATE SET 
       full_name=excluded.full_name, 
       username=excluded.username`,
    [userId, fullName, username]
  );
}

// Rasm qo'shish
async function addPhoto(userId, photoType, fileId, filePath, caption) {
  const db = await initDatabase();
  const result = await db.run(
    `INSERT INTO photos (user_id, photo_type, file_id, file_path, caption) 
     VALUES (?, ?, ?, ?, ?)`,
    [userId, photoType, fileId, filePath, caption || '']
  );
  return result.lastID;
}

// Foydalanuvchining rasmlarini olish
async function getUserPhotos(userId, photoType = null) {
  const db = await initDatabase();
  let query = `SELECT * FROM photos WHERE user_id = ?`;
  const params = [userId];
  if (photoType) {
    query += ` AND photo_type = ?`;
    params.push(photoType);
  }
  query += ` ORDER BY uploaded_at DESC`;
  return db.all(query, params);
}

// Rasmni o'chirish
async function deletePhoto(photoId, userId) {
  const db = await initDatabase();
  // Avval fayl yo'lini olamiz
  const photo = await db.get(`SELECT file_path FROM photos WHERE id = ? AND user_id = ?`, [photoId, userId]);
  if (photo && photo.file_path && fs.existsSync(photo.file_path)) {
    fs.unlinkSync(photo.file_path);
  }
  return db.run(`DELETE FROM photos WHERE id = ? AND user_id = ?`, [photoId, userId]);
}

// Admin: Barcha rasmlarni olish
async function getAllPhotos() {
  const db = await initDatabase();
  return db.all(`
    SELECT p.*, u.full_name, u.username 
    FROM photos p 
    JOIN users u ON p.user_id = u.user_id 
    ORDER BY p.uploaded_at DESC
  `);
}

// Admin: Rasm yuborgan foydalanuvchilar ro'yxati (statistika)
async function getUsersWithPhotoStats() {
  const db = await initDatabase();
  return db.all(`
    SELECT 
      u.user_id, u.full_name, u.username,
      COUNT(CASE WHEN p.photo_type = 'childhood' THEN 1 END) as childhood_count,
      COUNT(CASE WHEN p.photo_type = 'current' THEN 1 END) as current_count,
      MAX(p.uploaded_at) as last_upload
    FROM users u
    LEFT JOIN photos p ON u.user_id = p.user_id
    GROUP BY u.user_id
    HAVING childhood_count > 0 OR current_count > 0
    ORDER BY last_upload DESC
  `);
}

// Sozlashlarni olish/o'zgartirish
async function getSetting(key) {
  const db = await initDatabase();
  const row = await db.get(`SELECT value FROM settings WHERE key = ?`, [key]);
  return row ? row.value : null;
}

async function setSetting(key, value) {
  const db = await initDatabase();
  return db.run(`UPDATE settings SET value = ? WHERE key = ?`, [value, key]);
}

module.exports = {
  initDatabase,
  addUser,
  addPhoto,
  getUserPhotos,
  deletePhoto,
  getAllPhotos,
  getUsersWithPhotoStats,
  getSetting,
  setSetting,
  PHOTOS_DIR
};
