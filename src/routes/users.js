const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/profile', authenticate, (req, res) => {
  db.get(`SELECT id, username, email, displayName, avatar, bio, status, lastSeen, createdAt FROM users WHERE id = ?`,
    [req.userId], (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
      res.json(user);
    });
});

router.put('/profile', authenticate, (req, res) => {
  const { displayName, bio } = req.body;
  db.run(`UPDATE users SET displayName = COALESCE(?, displayName), bio = COALESCE(?, bio) WHERE id = ?`,
    [displayName, bio, req.userId], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Profil berhasil diperbarui' });
    });
});

router.get('/search', authenticate, (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Parameter q diperlukan' });

  db.all(
    `SELECT id, username, displayName, avatar, status FROM users WHERE (username LIKE ? OR displayName LIKE ?) AND id != ? LIMIT 20`,
    [`%${q}%`, `%${q}%`, req.userId], (err, users) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(users);
    });
});

router.get('/friends', authenticate, (req, res) => {
  db.all(
    `SELECT u.id, u.username, u.displayName, u.avatar, u.status, u.lastSeen, f.createdAt as friendSince
     FROM friendships f JOIN users u ON f.friendId = u.id
     WHERE f.userId = ?
     UNION
     SELECT u.id, u.username, u.displayName, u.avatar, u.status, u.lastSeen, f.createdAt as friendSince
     FROM friendships f JOIN users u ON f.userId = u.id
     WHERE f.friendId = ?`,
    [req.userId, req.userId], (err, friends) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(friends);
    });
});

router.post('/friend-request', authenticate, (req, res) => {
  const { toUserId } = req.body;
  if (!toUserId) return res.status(400).json({ error: 'toUserId diperlukan' });
  if (toUserId === req.userId) return res.status(400).json({ error: 'Tidak bisa berteman dengan diri sendiri' });

  db.get(`SELECT id FROM users WHERE id = ?`, [toUserId], (err, user) => {
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

    db.get(`SELECT * FROM friend_requests WHERE fromUserId = ? AND toUserId = ? AND status = 'pending'`,
      [req.userId, toUserId], (err, existing) => {
        if (existing) return res.status(400).json({ error: 'Permintaan sudah dikirim' });

        const id = uuidv4();
        db.run(`INSERT INTO friend_requests (id, fromUserId, toUserId) VALUES (?, ?, ?)`,
          [id, req.userId, toUserId], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: 'Permintaan pertemanan dikirim', id });
          });
      });
  });
});

router.get('/friend-requests', authenticate, (req, res) => {
  db.all(
    `SELECT fr.id, fr.status, fr.createdAt, u.id as userId, u.username, u.displayName, u.avatar
     FROM friend_requests fr JOIN users u ON fr.fromUserId = u.id
     WHERE fr.toUserId = ? AND fr.status = 'pending'
     ORDER BY fr.createdAt DESC`,
    [req.userId], (err, requests) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(requests);
    });
});

router.post('/friend-request/:id/respond', authenticate, (req, res) => {
  const { action } = req.body;
  if (!['accepted', 'rejected'].includes(action)) {
    return res.status(400).json({ error: 'Action harus accepted atau rejected' });
  }

  db.get(`SELECT * FROM friend_requests WHERE id = ? AND toUserId = ?`,
    [req.params.id, req.userId], (err, request) => {
      if (!request) return res.status(404).json({ error: 'Permintaan tidak ditemukan' });

      db.run(`UPDATE friend_requests SET status = ? WHERE id = ?`, [action, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        if (action === 'accepted') {
          db.run(`INSERT OR IGNORE INTO friendships (userId, friendId) VALUES (?, ?)`,
            [request.fromUserId, request.toUserId]);

          const chatId = uuidv4();
          const chatId2 = uuidv4();

          db.get(`SELECT id FROM chats WHERE id IN (
            SELECT chatId FROM chat_members WHERE userId = ? INTERSECT SELECT chatId FROM chat_members WHERE userId = ?
          ) AND type = 'direct' LIMIT 1`,
            [request.fromUserId, request.toUserId], (err, existingChat) => {
              if (!existingChat) {
                db.run(`INSERT INTO chats (id, type) VALUES (?, 'direct')`, [chatId]);
                db.run(`INSERT INTO chat_members (chatId, userId) VALUES (?, ?)`, [chatId, request.fromUserId]);
                db.run(`INSERT INTO chat_members (chatId, userId) VALUES (?, ?)`, [chatId, request.toUserId]);
              }
            });
        }

        res.json({ message: `Permintaan ${action === 'accepted' ? 'diterima' : 'ditolak'}` });
      });
    });
});

router.put('/avatar', authenticate, (req, res) => {
  const { avatar } = req.body;
  if (!avatar) return res.status(400).json({ error: 'Avatar diperlukan' });
  db.run(`UPDATE users SET avatar = ? WHERE id = ?`, [avatar, req.userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ avatar });
  });
});

router.get('/settings', authenticate, (req, res) => {
  db.get(`SELECT data FROM user_settings WHERE userId = ?`, [req.userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    try {
      res.json(JSON.parse(row?.data || '{}'));
    } catch {
      res.json({});
    }
  });
});

router.put('/settings', authenticate, (req, res) => {
  db.get(`SELECT data FROM user_settings WHERE userId = ?`, [req.userId], (err, row) => {
    const existing = row?.data ? JSON.parse(row.data) : {};
    const merged = JSON.stringify({ ...existing, ...req.body });
    if (row) {
      db.run(`UPDATE user_settings SET data = ? WHERE userId = ?`, [merged, req.userId]);
    } else {
      db.run(`INSERT INTO user_settings (userId, data) VALUES (?, ?)`, [req.userId, merged]);
    }
    res.json({ message: 'Pengaturan disimpan' });
  });
});

router.delete('/account', authenticate, (req, res) => {
  db.run(`DELETE FROM users WHERE id = ?`, [req.userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Akun dihapus' });
  });
});

router.post('/:id/block', authenticate, (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.userId) return res.status(400).json({ error: 'Tidak bisa blokir diri sendiri' });
  db.run(`INSERT OR REPLACE INTO friendships (userId, friendId, blocked) VALUES (?, ?, 1)`,
    [req.userId, targetId], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Pengguna diblokir' });
    });
});

router.post('/:id/unblock', authenticate, (req, res) => {
  const targetId = req.params.id;
  db.run(`UPDATE friendships SET blocked = 0 WHERE userId = ? AND friendId = ?`,
    [req.userId, targetId], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Pengguna dibuka blokirnya' });
    });
});

router.get('/:id', authenticate, (req, res) => {
  db.get(`SELECT id, username, displayName, avatar, bio, status, lastSeen FROM users WHERE id = ?`,
    [req.params.id], (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      res.json(user);
    });
});

module.exports = router;
