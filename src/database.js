const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);
db.run('PRAGMA foreign_keys = ON');

function initDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      displayName TEXT,
      avatar TEXT,
      bio TEXT DEFAULT '',
      status TEXT DEFAULT 'offline',
      lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      type TEXT CHECK(type IN ('direct', 'group')) NOT NULL,
      name TEXT,
      avatar TEXT,
      description TEXT DEFAULT '',
      sendPermission TEXT DEFAULT 'all',
      addMemberPermission TEXT DEFAULT 'all',
      approvalRequired INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastMessage TEXT,
      lastMessageAt DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS chat_members (
      chatId TEXT NOT NULL,
      userId TEXT NOT NULL,
      joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      role TEXT DEFAULT 'member' CHECK(role IN ('admin', 'member')),
      PRIMARY KEY (chatId, userId),
      FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chatId TEXT NOT NULL,
      senderId TEXT NOT NULL,
      content TEXT,
      type TEXT DEFAULT 'text' CHECK(type IN ('text', 'image', 'file', 'audio', 'system')),
      fileUrl TEXT,
      fileName TEXT,
      fileSize INTEGER,
      replyTo TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE,
      FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS message_reads (
      messageId TEXT NOT NULL,
      userId TEXT NOT NULL,
      readAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (messageId, userId),
      FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY,
      fromUserId TEXT NOT NULL,
      toUserId TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (fromUserId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (toUserId) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS friendships (
      userId TEXT NOT NULL,
      friendId TEXT NOT NULL,
      blocked INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (userId, friendId),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (friendId) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS message_deleted (
      messageId TEXT NOT NULL,
      userId TEXT NOT NULL,
      PRIMARY KEY (messageId, userId),
      FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS statuses (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text' CHECK(type IN ('text', 'image', 'video')),
      mediaUrl TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      callerId TEXT NOT NULL,
      calleeId TEXT NOT NULL,
      type TEXT DEFAULT 'voice' CHECK(type IN ('voice', 'video')),
      status TEXT DEFAULT 'missed' CHECK(status IN ('missed', 'answered', 'outgoing')),
      duration INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (callerId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (calleeId) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS user_settings (
      userId TEXT PRIMARY KEY,
      data TEXT DEFAULT '{}',
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS message_reactions (
      messageId TEXT NOT NULL,
      userId TEXT NOT NULL,
      emoji TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (messageId, userId),
      FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )`);
  });

  db.serialize(() => {
    db.run(`ALTER TABLE chats ADD COLUMN description TEXT DEFAULT ''`, () => {});
    db.run(`ALTER TABLE chats ADD COLUMN sendPermission TEXT DEFAULT 'all'`, () => {});
    db.run(`ALTER TABLE chats ADD COLUMN addMemberPermission TEXT DEFAULT 'all'`, () => {});
    db.run(`ALTER TABLE chats ADD COLUMN approvalRequired INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE chats ADD COLUMN archived INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE friendships ADD COLUMN blocked INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE messages ADD COLUMN edited INTEGER DEFAULT 0`, () => {});
  });
}

module.exports = { db, initDatabase };
