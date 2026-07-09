const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');

const router = express.Router();

router.post('/register', (req, res) => {
  const { username, email, password, displayName } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, dan password wajib diisi' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const id = uuidv4();
  const name = displayName || username;

  db.run(
    `INSERT INTO users (id, username, email, password, displayName) VALUES (?, ?, ?, ?, ?)`,
    [id, username, email, hashedPassword, name],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Username atau email sudah terdaftar' });
        }
        return res.status(500).json({ error: err.message });
      }

      const token = jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({
        token,
        user: { id, username, email, displayName: name, avatar: null, status: 'offline' }
      });
    }
  );
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  db.get(`SELECT * FROM users WHERE username = ? OR email = ?`, [username, username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Username atau password salah' });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Username atau password salah' });

    db.run(`UPDATE users SET status = 'online' WHERE id = ?`, [user.id]);

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
        status: 'online'
      }
    });
  });
});

module.exports = router;
