const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./database');

const onlineUsers = new Map();

function setupSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token diperlukan'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Token tidak valid'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${userId}`);

    onlineUsers.set(userId, socket.id);
    db.run(`UPDATE users SET status = 'online' WHERE id = ?`, [userId]);

    db.get(`SELECT data FROM user_settings WHERE userId = ?`, [userId], (err, row) => {
      const settings = row ? JSON.parse(row.data || '{}') : {};
      const showOnline = settings.lastSeen !== 'Tidak Ada';
      db.all(`SELECT friendId FROM friendships WHERE userId = ? UNION SELECT userId FROM friendships WHERE friendId = ?`,
        [userId, userId], (err, friends) => {
          friends.forEach(f => {
            const friendSocket = onlineUsers.get(f.friendId);
            if (friendSocket && showOnline) {
              io.to(friendSocket).emit('user:online', { userId, status: 'online' });
            }
          });
        });
    });

    socket.on('message:send', (data, callback) => {
      const { chatId, content, type = 'text', fileUrl, fileName, fileSize, replyTo } = data;

      if (!chatId || (!content && type === 'text')) return;

      db.get(`SELECT * FROM chat_members WHERE chatId = ? AND userId = ?`, [chatId, userId], (err, member) => {
        if (!member) {
          if (callback) callback({ error: 'Anda bukan anggota chat ini' });
          return;
        }

        db.get(`SELECT type, sendPermission FROM chats WHERE id = ?`, [chatId], (err, chat) => {
          if (chat && chat.type === 'group' && chat.sendPermission === 'admin' && member.role !== 'admin') {
            if (callback) callback({ error: 'Hanya admin yang dapat mengirim pesan' });
            return;
          }

          const messageId = uuidv4();
          const createdAt = new Date().toISOString();

          db.run(
            `INSERT INTO messages (id, chatId, senderId, content, type, fileUrl, fileName, fileSize, replyTo, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [messageId, chatId, userId, content || '', type, fileUrl || null, fileName || null, fileSize || null, replyTo || null, createdAt],
            function (err) {
              if (err) {
                if (callback) callback({ error: err.message });
                return;
              }

              db.run(`UPDATE chats SET lastMessage = ?, lastMessageAt = ? WHERE id = ?`,
                [type === 'text' ? content : `[${type === 'image' ? 'Gambar' : 'File'}]`, createdAt, chatId]);

              db.all(`SELECT userId FROM chat_members WHERE chatId = ?`, [chatId], (err, members) => {
                const messageData = {
                  id: messageId,
                  chatId,
                  senderId: userId,
                  content,
                  type,
                  fileUrl,
                  fileName,
                  fileSize,
                  replyTo,
                  createdAt
                };

                members.forEach(m => {
                  const socketId = onlineUsers.get(m.userId);
                  if (socketId) {
                    io.to(socketId).emit('message:new', messageData);
                  }
                });
              });

              if (callback) callback({ id: messageId, createdAt });
            });
        });
      });
    });

    socket.on('message:delete', (data, callback) => {
      const { messageId, chatId, deleteForEveryone } = data;
      if (!messageId || !chatId) return;

      if (deleteForEveryone) {
        db.get(`SELECT senderId FROM messages WHERE id = ?`, [messageId], (err, msg) => {
          if (!msg) {
            if (callback) callback({ error: 'Message not found' });
            return;
          }
          if (msg.senderId !== userId) {
            if (callback) callback({ error: 'Not authorized' });
            return;
          }
          
          const deletedText = 'Pesan ini telah dihapus';
          db.run(`UPDATE messages SET content = ?, type = 'system', fileUrl = NULL, fileName = NULL WHERE id = ?`, [deletedText, messageId], function(err) {
            if (err) {
              if (callback) callback({ error: err.message });
              return;
            }
            
            db.all(`SELECT userId FROM chat_members WHERE chatId = ?`, [chatId], (err, members) => {
              members.forEach(m => {
                const socketId = onlineUsers.get(m.userId);
                if (socketId) {
                  io.to(socketId).emit('message:deleted', { messageId, chatId, content: deletedText, type: 'system' });
                }
              });
            });
            if (callback) callback({ success: true });
          });
        });
      }
    });

    socket.on('message:typing', (data) => {
      const { chatId, isTyping } = data;

      db.all(`SELECT userId FROM chat_members WHERE chatId = ? AND userId != ?`,
        [chatId, userId], (err, members) => {
          members.forEach(m => {
            const socketId = onlineUsers.get(m.userId);
            if (socketId) {
              io.to(socketId).emit('message:typing', { chatId, userId, isTyping });
            }
          });
        });
    });

    socket.on('chat:create', (data) => {
      const { type, name, memberIds } = data;

      if (type === 'direct') {
        db.all(`SELECT * FROM friendships WHERE (userId = ? AND friendId = ?) OR (userId = ? AND friendId = ?)`,
          [userId, memberIds[0], memberIds[0], userId], (err, friends) => {
            if (!friends.length) return;

            db.get(`SELECT c.id FROM chats c
              JOIN chat_members cm1 ON c.id = cm1.chatId AND cm1.userId = ?
              JOIN chat_members cm2 ON c.id = cm2.chatId AND cm2.userId = ?
              WHERE c.type = 'direct' LIMIT 1`,
              [userId, memberIds[0]], (err, existing) => {
                if (existing) {
                  socket.emit('chat:created', { id: existing.id, type: 'direct' });
                  return;
                }

                const chatId = uuidv4();
                db.run(`INSERT INTO chats (id, type) VALUES (?, 'direct')`, [chatId]);
                db.run(`INSERT INTO chat_members (chatId, userId) VALUES (?, ?)`, [chatId, userId]);
                db.run(`INSERT INTO chat_members (chatId, userId) VALUES (?, ?)`, [chatId, memberIds[0]]);

                socket.emit('chat:created', { id: chatId, type: 'direct' });
                const friendSocket = onlineUsers.get(memberIds[0]);
                if (friendSocket) io.to(friendSocket).emit('chat:created', { id: chatId, type: 'direct' });
              });
          });
      }
    });

    socket.on('message:delete', (data) => {
      const { messageId, chatId, deleteForEveryone } = data;
      if (!messageId || !chatId) return;

      db.get(`SELECT senderId, type FROM messages WHERE id = ? AND chatId = ?`,
        [messageId, chatId], (err, msg) => {
          if (!msg) return;
          if (msg.type === 'system') return;

          if (deleteForEveryone) {
            if (msg.senderId !== userId) return;
            db.run(`DELETE FROM messages WHERE id = ?`, [messageId]);
            db.all(`SELECT userId FROM chat_members WHERE chatId = ?`, [chatId], (err, members) => {
              members.forEach(m => {
                const socketId = onlineUsers.get(m.userId);
                if (socketId) io.to(socketId).emit('message:deleted', { messageId, chatId });
              });
            });
          } else {
            db.run(`INSERT OR IGNORE INTO message_deleted (messageId, userId) VALUES (?, ?)`,
              [messageId, userId]);
            db.all(`SELECT userId FROM chat_members WHERE chatId = ?`, [chatId], (err, members) => {
              members.forEach(m => {
                const socketId = onlineUsers.get(m.userId);
                if (socketId) io.to(socketId).emit('message:deleted', { messageId, chatId });
              });
            });
          }
        });
    });

    socket.on('message:edit', (data) => {
      const { messageId, chatId, content } = data;
      if (!messageId || !chatId || !content) return;

      db.get(`SELECT senderId FROM messages WHERE id = ? AND chatId = ?`, [messageId, chatId], (err, msg) => {
        if (!msg || msg.senderId !== userId) return;

        db.run(`UPDATE messages SET content = ?, edited = 1 WHERE id = ?`, [content, messageId], function(err) {
          if (err) return;
          db.all(`SELECT userId FROM chat_members WHERE chatId = ?`, [chatId], (err, members) => {
            members.forEach(m => {
              const socketId = onlineUsers.get(m.userId);
              if (socketId) io.to(socketId).emit('message:edited', { messageId, chatId, content });
            });
          });
        });
      });
    });

    socket.on('message:react', (data) => {
      const { messageId, chatId, emoji } = data;
      if (!messageId || !chatId || !emoji) return;

      db.get(`SELECT 1 FROM chat_members WHERE chatId = ? AND userId = ?`, [chatId, userId], (err, member) => {
        if (!member) return;

        // Toggle: if same emoji exists remove it, otherwise upsert
        db.get(`SELECT emoji FROM message_reactions WHERE messageId = ? AND userId = ?`, [messageId, userId], (err, existing) => {
          if (existing && existing.emoji === emoji) {
            db.run(`DELETE FROM message_reactions WHERE messageId = ? AND userId = ?`, [messageId, userId], function() {
              broadcastReaction(messageId, chatId, null);
            });
          } else {
            db.run(`INSERT OR REPLACE INTO message_reactions (messageId, userId, emoji) VALUES (?, ?, ?)`,
              [messageId, userId, emoji], function(err) {
                if (!err) broadcastReaction(messageId, chatId, emoji);
              });
          }
        });
      });
    });

    function broadcastReaction(messageId, chatId, emoji) {
      // Fetch fresh reaction counts for the message
      db.all(`SELECT emoji, userId FROM message_reactions WHERE messageId = ?`, [messageId], (err, rows) => {
        const reactions = {};
        (rows || []).forEach(r => {
          if (!reactions[r.emoji]) reactions[r.emoji] = [];
          reactions[r.emoji].push(r.userId);
        });
        db.all(`SELECT userId FROM chat_members WHERE chatId = ?`, [chatId], (err, members) => {
          members.forEach(m => {
            const socketId = onlineUsers.get(m.userId);
            if (socketId) io.to(socketId).emit('message:reacted', { messageId, chatId, reactions, reactingUserId: userId });
          });
        });
      });
    }

    // --- Call signaling ---
    socket.on('call:offer', (data) => {
      const targetId = data.targetId || data.calleeId;
      const offer = data.offer;
      const type = data.type || 'voice';
      db.get(`SELECT displayName, username, avatar FROM users WHERE id = ?`, [userId], (err, caller) => {
        const calleeSocket = onlineUsers.get(targetId);
        if (calleeSocket) {
          io.to(calleeSocket).emit('call:incoming', {
            callerId: userId,
            callerDisplayName: caller?.displayName || caller?.username || 'Unknown',
            callerAvatar: caller?.avatar,
            offer,
            type,
          });
        } else {
          socket.emit('call:error', { message: 'Pengguna sedang offline' });
        }
      });
    });

    socket.on('call:answer', (data) => {
      const { callerId, answer } = data;
      const callerSocket = onlineUsers.get(callerId);
      if (callerSocket) {
        io.to(callerSocket).emit('call:answered', { answer, calleeId: userId });
      }
    });

    socket.on('call:candidate', (data) => {
      const { targetId, candidate } = data;
      const targetSocket = onlineUsers.get(targetId);
      if (targetSocket) {
        io.to(targetSocket).emit('call:candidate', { candidate, from: userId });
      }
    });

    socket.on('call:end', (data) => {
      const { targetId, duration } = data;
      const targetSocket = onlineUsers.get(targetId);
      if (targetSocket) {
        io.to(targetSocket).emit('call:ended', { from: userId, duration });
      }
      const id = uuidv4();
      const logType = data.type || 'voice';
      const logStatus = duration > 0 ? 'answered' : 'missed';
      if (userId !== targetId) {
        db.run(`INSERT INTO call_logs (id, callerId, calleeId, type, status, duration) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, userId, targetId, logType, logStatus, duration || 0]);
      }
    });

    socket.on('call:ringing', (data) => {
      const { targetId } = data;
      const targetSocket = onlineUsers.get(targetId);
      if (targetSocket) {
        io.to(targetSocket).emit('call:ringing', { from: userId });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId}`);
      onlineUsers.delete(userId);
      db.run(`UPDATE users SET status = 'offline', lastSeen = CURRENT_TIMESTAMP WHERE id = ?`, [userId]);

      db.get(`SELECT data FROM user_settings WHERE userId = ?`, [userId], (err, row) => {
        const settings = row ? JSON.parse(row.data || '{}') : {};
        const showOnline = settings.lastSeen !== 'Tidak Ada';
        db.all(`SELECT friendId FROM friendships WHERE userId = ? UNION SELECT userId FROM friendships WHERE friendId = ?`,
          [userId, userId], (err, friends) => {
            friends.forEach(f => {
              const friendSocket = onlineUsers.get(f.friendId);
              if (friendSocket) {
                const payload = showOnline
                  ? { userId, lastSeen: new Date().toISOString() }
                  : { userId };
                io.to(friendSocket).emit('user:offline', payload);
              }
            });
          });
      });
    });
  });
}

module.exports = { setupSocket, onlineUsers };
