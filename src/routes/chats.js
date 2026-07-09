const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  db.all(
    `SELECT c.*,
      (SELECT json_group_array(json_object('id', u.id, 'displayName', u.displayName, 'avatar', u.avatar))
       FROM chat_members cm2 JOIN users u ON cm2.userId = u.id WHERE cm2.chatId = c.id) as members
     FROM chats c
     JOIN chat_members cm ON c.id = cm.chatId
     WHERE cm.userId = ?
     ORDER BY c.lastMessageAt DESC`,
    [req.userId], (err, chats) => {
      if (err) return res.status(500).json({ error: err.message });

      const parsed = chats.map(c => ({
        ...c,
        members: JSON.parse(c.members || '[]')
      }));

      res.json(parsed);
    });
});

router.get('/:id', authenticate, (req, res) => {
  db.get(`SELECT * FROM chats WHERE id = ?`, [req.params.id], (err, chat) => {
    if (!chat) return res.status(404).json({ error: 'Chat tidak ditemukan' });

    db.all(`SELECT u.id, u.username, u.displayName, u.avatar, cm.role
            FROM chat_members cm JOIN users u ON cm.userId = u.id WHERE cm.chatId = ?`,
      [req.params.id], (err, members) => {
        chat.members = members;
        res.json(chat);
      });
  });
});

router.post('/group', authenticate, (req, res) => {
  const { name, memberIds } = req.body;
  if (!name || !memberIds || !memberIds.length) {
    return res.status(400).json({ error: 'Nama grup dan anggota diperlukan' });
  }

  const chatId = uuidv4();
  const allMembers = [...new Set([req.userId, ...memberIds])];

  db.run(`INSERT INTO chats (id, type, name) VALUES (?, 'group', ?)`, [chatId, name], function (err) {
    if (err) return res.status(500).json({ error: err.message });

    let inserted = 0;
    allMembers.forEach((mId, i) => {
      const role = mId === req.userId ? 'admin' : 'member';
      db.run(`INSERT INTO chat_members (chatId, userId, role) VALUES (?, ?, ?)`, [chatId, mId, role], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        inserted++;
        if (inserted === allMembers.length) {
          res.status(201).json({ id: chatId, type: 'group', name, members: allMembers });
        }
      });
    });
  });
});

router.get('/:id/messages', authenticate, (req, res) => {
  const { limit = 50, before } = req.query;

  let query = `
    SELECT m.*, u.username as senderUsername, u.displayName as senderDisplayName, u.avatar as senderAvatar,
           m.edited
    FROM messages m JOIN users u ON m.senderId = u.id
    WHERE m.chatId = ?
  `;
  const params = [req.params.id];

  if (before) {
    query += ` AND m.createdAt < ?`;
    params.push(before);
  }

  query += ` ORDER BY m.createdAt DESC LIMIT ?`;
  params.push(parseInt(limit));

  db.all(query, params, (err, messages) => {
    if (err) return res.status(500).json({ error: err.message });

    const replyIds = messages.filter(m => m.replyTo).map(m => m.replyTo);
    let replyMap = {};

    function fetchReads() {
      if (messages.length === 0) return res.json([]);
      db.all(`SELECT messageId, userId FROM message_reads WHERE messageId IN (${messages.map(() => '?').join(',')})`,
        messages.map(m => m.id), (err, reads) => {
          const readMap = {};
          reads.forEach(r => {
            if (!readMap[r.messageId]) readMap[r.messageId] = [];
            readMap[r.messageId].push(r.userId);
          });

          db.all(`SELECT messageId, emoji, userId FROM message_reactions WHERE messageId IN (${messages.map(() => '?').join(',')})`,
            messages.map(m => m.id), (err, reactRows) => {
              const reactMap = {};
              (reactRows || []).forEach(r => {
                if (!reactMap[r.messageId]) reactMap[r.messageId] = {};
                if (!reactMap[r.messageId][r.emoji]) reactMap[r.messageId][r.emoji] = [];
                reactMap[r.messageId][r.emoji].push(r.userId);
              });

              const result = messages.map(m => ({
                ...m,
                readBy: readMap[m.id] || [],
                replyData: m.replyTo ? (replyMap[m.replyTo] || null) : null,
                reactions: reactMap[m.id] || {},
              }));

              res.json(result.reverse());
            });
        });
    }

    if (replyIds.length > 0) {
      db.all(`SELECT id, content, type, fileUrl, fileName, senderId FROM messages WHERE id IN (${replyIds.map(() => '?').join(',')})`,
        replyIds, (err, replies) => {
          replies.forEach(r => { replyMap[r.id] = r; });
          fetchReads();
        });
    } else {
      fetchReads();
    }
  });
});

router.post('/:id/read', authenticate, (req, res) => {
  const { messageIds } = req.body;
  if (!messageIds || !messageIds.length) return res.json({ ok: true });

  db.get(`SELECT data FROM user_settings WHERE userId = ?`, [req.userId], (err, row) => {
    const settings = row ? JSON.parse(row.data || '{}') : {};
    if (settings.readReceipts === false) return res.json({ ok: true });

    let inserted = 0;
    messageIds.forEach((mId, i) => {
      db.run(`INSERT OR IGNORE INTO message_reads (messageId, userId) VALUES (?, ?)`, [mId, req.userId], function () {
        inserted++;
        if (inserted === messageIds.length) {
          res.json({ ok: true });
        }
      });
    });
  });
});

router.post('/:id/members', authenticate, (req, res) => {
  const { userIds } = req.body;
  if (!userIds || !userIds.length) return res.status(400).json({ error: 'userIds diperlukan' });

  db.get(`SELECT cm.role, c.addMemberPermission FROM chat_members cm JOIN chats c ON c.id = cm.chatId WHERE cm.chatId = ? AND cm.userId = ?`,
    [req.params.id, req.userId], (err, result) => {
      if (!result) return res.status(403).json({ error: 'Anda bukan anggota grup ini' });
      if (result.addMemberPermission === 'admin' && result.role !== 'admin') {
        return res.status(403).json({ error: 'Hanya admin yang bisa menambah anggota' });
      }

      let inserted = 0;
      userIds.forEach((uId, i) => {
        db.run(`INSERT OR IGNORE INTO chat_members (chatId, userId, role) VALUES (?, ?, 'member')`,
          [req.params.id, uId], function () {
            inserted++;
            if (inserted === userIds.length) {
              res.json({ message: 'Anggota ditambahkan' });
            }
          });
      });
    });
});

router.delete('/:id/members/:userId', authenticate, (req, res) => {
  db.get(`SELECT role FROM chat_members WHERE chatId = ? AND userId = ?`,
    [req.params.id, req.userId], (err, member) => {
      if (!member || member.role !== 'admin') {
        return res.status(403).json({ error: 'Hanya admin yang bisa menghapus anggota' });
      }

      db.run(`DELETE FROM chat_members WHERE chatId = ? AND userId = ?`,
        [req.params.id, req.params.userId], function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Anggota dihapus' });
        });
    });
});

router.put('/:id/name', authenticate, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nama diperlukan' });

  db.get(`SELECT role FROM chat_members WHERE chatId = ? AND userId = ?`,
    [req.params.id, req.userId], (err, member) => {
      if (!member || member.role !== 'admin') {
        return res.status(403).json({ error: 'Hanya admin yang bisa mengubah nama grup' });
      }

      db.run(`UPDATE chats SET name = ? WHERE id = ?`, [name, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Nama grup diubah', name });
      });
    });
});

router.delete('/:id', authenticate, (req, res) => {
  db.get(`SELECT role FROM chat_members WHERE chatId = ? AND userId = ?`,
    [req.params.id, req.userId], (err, member) => {
      if (!member || member.role !== 'admin') {
        return res.status(403).json({ error: 'Hanya admin yang bisa membubarkan grup' });
      }
      db.run(`DELETE FROM messages WHERE chatId = ?`, [req.params.id]);
      db.run(`DELETE FROM chat_members WHERE chatId = ?`, [req.params.id]);
      db.run(`DELETE FROM chats WHERE id = ?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Grup dibubarkan' });
      });
    });
});

router.put('/:id/settings', authenticate, (req, res) => {
  const { description, sendPermission, addMemberPermission, approvalRequired } = req.body;
  db.get(`SELECT role FROM chat_members WHERE chatId = ? AND userId = ?`,
    [req.params.id, req.userId], (err, member) => {
      if (!member || member.role !== 'admin') {
        return res.status(403).json({ error: 'Hanya admin yang bisa mengubah pengaturan grup' });
      }
      let sql = 'UPDATE chats SET ';
      const params = [];
      const sets = [];
      if (description !== undefined) { sets.push('description = ?'); params.push(description); }
      if (sendPermission !== undefined) { sets.push('sendPermission = ?'); params.push(sendPermission); }
      if (addMemberPermission !== undefined) { sets.push('addMemberPermission = ?'); params.push(addMemberPermission); }
      if (approvalRequired !== undefined) { sets.push('approvalRequired = ?'); params.push(approvalRequired ? 1 : 0); }
      if (!sets.length) return res.status(400).json({ error: 'Tidak ada pengaturan yang diubah' });
      sql += sets.join(', ') + ' WHERE id = ?';
      params.push(req.params.id);
      db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Pengaturan grup diubah' });
      });
    });
});

router.put('/:id/members/:userId/role', authenticate, (req, res) => {
  const { role } = req.body;
  if (!role || !['admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Role harus admin atau member' });
  }
  db.get(`SELECT role FROM chat_members WHERE chatId = ? AND userId = ?`,
    [req.params.id, req.userId], (err, caller) => {
      if (!caller || caller.role !== 'admin') {
        return res.status(403).json({ error: 'Hanya admin yang bisa mengubah peran anggota' });
      }
      db.run(`UPDATE chat_members SET role = ? WHERE chatId = ? AND userId = ?`,
        [role, req.params.id, req.params.userId], function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Peran anggota diubah' });
        });
    });
});

router.put('/:id/avatar', authenticate, (req, res) => {
  const { avatar } = req.body;
  if (!avatar) return res.status(400).json({ error: 'Avatar diperlukan' });
  db.get(`SELECT role FROM chat_members WHERE chatId = ? AND userId = ?`,
    [req.params.id, req.userId], (err, member) => {
      if (!member || member.role !== 'admin') {
        return res.status(403).json({ error: 'Hanya admin yang bisa mengubah foto grup' });
      }
      db.run(`UPDATE chats SET avatar = ? WHERE id = ?`, [avatar, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Foto grup diubah', avatar });
      });
    });
});

router.put('/:id/archive', authenticate, (req, res) => {
  const { archived } = req.body;
  db.get(`SELECT 1 FROM chat_members WHERE chatId = ? AND userId = ?`,
    [req.params.id, req.userId], (err, member) => {
      if (!member) return res.status(403).json({ error: 'Anda bukan anggota chat ini' });
      db.run(`UPDATE chats SET archived = ? WHERE id = ?`, [archived ? 1 : 0, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Chat diarsipkan', archived: !!archived });
      });
    });
});

router.get('/:id/backup', authenticate, (req, res) => {
  db.get(`SELECT 1 FROM chat_members WHERE chatId = ? AND userId = ?`,
    [req.params.id, req.userId], (err, member) => {
      if (!member) return res.status(403).json({ error: 'Anda bukan anggota chat ini' });
      const query = `
        SELECT m.id, m.content, m.type, m.fileUrl, m.fileName, m.senderId,
               u.displayName as senderName, m.createdAt
        FROM messages m JOIN users u ON m.senderId = u.id
        WHERE m.chatId = ?
        ORDER BY m.createdAt ASC`;
      db.all(query, [req.params.id], (err, messages) => {
        if (err) return res.status(500).json({ error: err.message });
        const backup = {
          chatId: req.params.id,
          exportedAt: new Date().toISOString(),
          messageCount: messages.length,
          messages,
        };
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="zentro-backup-${req.params.id}.json"`);
        res.json(backup);
      });
    });
});

router.post('/:id/restore', authenticate, (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Data pesan tidak valid' });
  }
  db.get(`SELECT 1 FROM chat_members WHERE chatId = ? AND userId = ?`,
    [req.params.id, req.userId], (err, member) => {
      if (!member) return res.status(403).json({ error: 'Anda bukan anggota chat ini' });

      let imported = 0;
      let processed = 0;
      const total = messages.length;

      messages.forEach((msg) => {
        const id = msg.id || require('uuid').v4();
        db.run(
          `INSERT OR IGNORE INTO messages (id, chatId, senderId, content, type, fileUrl, fileName, fileSize, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, req.params.id, msg.senderId || req.userId, msg.content || '', msg.type || 'text',
           msg.fileUrl || null, msg.fileName || null, msg.fileSize || null,
           msg.createdAt || new Date().toISOString()],
          function(err) {
            if (!err && this.changes > 0) imported++;
            processed++;
            if (processed === total) {
              res.json({ message: `${imported} pesan berhasil diimpor`, imported, total });
            }
          }
        );
      });
    });
});

module.exports = router;
