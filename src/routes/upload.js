const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    cb(null, isImage ? 'uploads/images' : (isVideo ? 'uploads/files' : 'uploads/files'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
      'application/pdf', 'application/zip', 'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm',
      'audio/x-m4a', 'audio/aac'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipe file tidak didukung'));
    }
  }
});

router.post('/', authenticate, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

    const isImage = req.file.mimetype.startsWith('image/');
    const isVideo = req.file.mimetype.startsWith('video/');
    res.json({
      url: `/uploads/${isImage ? 'images' : 'files'}/${req.file.filename}`,
      type: isImage ? 'image' : (isVideo ? 'video' : 'file'),
      fileName: req.file.originalname,
      fileSize: req.file.size
    });
  });
});

router.post('/base64', authenticate, (req, res) => {
  const { data, fileName, mimeType } = req.body;
  if (!data) return res.status(400).json({ error: 'Data diperlukan' });

  const base64Data = data.replace(/^data:.*?;base64,/, '');
  const ext = path.extname(fileName) || '.bin';
  const filename = `${uuidv4()}${ext}`;
  const isImage = mimeType?.startsWith('image/');
  const isVideo = mimeType?.startsWith('video/');
  const subdir = isImage ? 'images' : 'files';
  const filePath = path.join(__dirname, '..', '..', 'uploads', subdir, filename);

  fs.writeFile(filePath, base64Data, 'base64', (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      url: `/uploads/${subdir}/${filename}`,
      type: isImage ? 'image' : (isVideo ? 'video' : 'file'),
      fileName,
      fileSize: Buffer.byteLength(base64Data, 'base64'),
    });
  });
});

module.exports = router;
