const express = require('express');
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  db.all(
    `SELECT cl.*, 
       CASE WHEN cl.callerId = ? THEN callee.displayName ELSE caller.displayName END as otherName,
       CASE WHEN cl.callerId = ? THEN callee.avatar ELSE caller.avatar END as otherAvatar
     FROM call_logs cl
     JOIN users caller ON cl.callerId = caller.id
     JOIN users callee ON cl.calleeId = callee.id
     WHERE cl.callerId = ? OR cl.calleeId = ?
     ORDER BY cl.createdAt DESC LIMIT 50`,
    [req.userId, req.userId, req.userId, req.userId],
    (err, calls) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(calls);
    });
});

module.exports = router;
