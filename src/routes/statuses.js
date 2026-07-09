const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticate, (req, res) => {
  const { content, type, mediaUrl } = req.body;
  if (!content) return res.status(400).json({ error: 'Konten diperlukan' });
  const id = uuidv4();
  db.run(`INSERT INTO statuses (id, userId, content, type, mediaUrl) VALUES (?, ?, ?, ?, ?)`,
    [id, req.userId, content, type || 'text', mediaUrl || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id, content, type, mediaUrl, createdAt: new Date().toISOString() });
    });
});

router.get('/friends', authenticate, (req, res) => {
  db.all(
    `SELECT s.*, u.username, u.displayName, u.avatar
     FROM statuses s JOIN users u ON s.userId = u.id
     WHERE (s.userId = ? OR s.userId IN (
       SELECT friendId FROM friendships WHERE userId = ?
       UNION SELECT userId FROM friendships WHERE friendId = ?
     )) AND s.createdAt > datetime('now', '-24 hours')
     ORDER BY s.createdAt DESC`,
    [req.userId, req.userId, req.userId],
    (err, statuses) => {
      if (err) return res.status(500).json({ error: err.message });
      const grouped = {};
      statuses.forEach(s => {
        if (!grouped[s.userId]) grouped[s.userId] = { user: { id: s.userId, username: s.username, displayName: s.displayName, avatar: s.avatar }, statuses: [] };
        grouped[s.userId].statuses.push({ id: s.id, content: s.content, type: s.type, mediaUrl: s.mediaUrl, createdAt: s.createdAt });
      });
      res.json(Object.values(grouped));
    });
});

router.delete('/:id', authenticate, (req, res) => {
  db.run(`DELETE FROM statuses WHERE id = ? AND userId = ?`, [req.params.id, req.userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Status dihapus' });
  });
});

module.exports = router;
