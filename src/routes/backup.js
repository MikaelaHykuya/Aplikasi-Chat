const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  // Ambil semua obrolan (chats) di mana user berada
  db.all(
    `SELECT c.id, c.name, c.type, c.avatar, c.createdAt 
     FROM chats c
     JOIN chat_members cm ON c.id = cm.chatId
     WHERE cm.userId = ?`,
    [req.userId],
    (err, chats) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const chatIds = chats.map(c => c.id);
      if (chatIds.length === 0) {
        return res.json({ chats: [], messages: [] });
      }

      const placeholders = chatIds.map(() => '?').join(',');
      // Ambil pesan-pesan dari obrolan tersebut
      db.all(
        `SELECT id, chatId, senderId, content, type, fileUrl, fileName, fileSize, replyTo, createdAt
         FROM messages
         WHERE chatId IN (${placeholders})`,
        chatIds,
        (err, messages) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({
            version: 1,
            timestamp: new Date().toISOString(),
            chats,
            messages
          });
        }
      );
    }
  );
});

router.post('/', authenticate, (req, res) => {
  const { chats, messages } = req.body;
  if (!chats || !messages) {
    return res.status(400).json({ error: 'Format JSON tidak valid' });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    try {
      // Upsert chats
      chats.forEach(c => {
        db.run(
          `INSERT OR IGNORE INTO chats (id, name, type, avatar, createdAt) VALUES (?, ?, ?, ?, ?)`,
          [c.id, c.name, c.type, c.avatar, c.createdAt]
        );
        db.run(
          `INSERT OR IGNORE INTO chat_members (chatId, userId) VALUES (?, ?)`,
          [c.id, req.userId]
        );
      });

      // Upsert messages
      messages.forEach(m => {
        db.run(
          `INSERT OR IGNORE INTO messages (id, chatId, senderId, content, type, fileUrl, fileName, fileSize, replyTo, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [m.id, m.chatId, m.senderId, m.content, m.type, m.fileUrl, m.fileName, m.fileSize, m.replyTo, m.createdAt]
        );
      });

      db.run("COMMIT", (err) => {
        if (err) throw err;
        res.json({ message: 'Restore berhasil', chatsRestored: chats.length, messagesRestored: messages.length });
      });
    } catch (error) {
      db.run("ROLLBACK");
      res.status(500).json({ error: error.message });
    }
  });
});

module.exports = router;
