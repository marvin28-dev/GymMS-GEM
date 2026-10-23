const express = require('express');
const multer  = require('multer');
const { authenticate } = require('../middleware/auth.middleware');
const { uploadImage } = require('../controllers/upload.controller');
const { attemptCounter, refuseTooMany } = require('../utils/attempts');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 }, // 20 MB
});

// Every upload is stored, and paid for, so one account may not send an
// endless stream of them (F-011)
const uploads = attemptCounter({ max: 60, windowMs: 10 * 60 * 1000 });
function limitUploads(req, res, next) {
  const key = String(req.user.id);
  const wait = uploads.lockedFor(key);
  if (wait) return refuseTooMany(res, wait, 'Too many uploads. Try again in a few minutes.');
  uploads.count(key);
  next();
}

// multer's own errors would otherwise reach the error handler as a 500
function oneFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'That file is too large. The limit is 20 MB.' });
    return res.status(400).json({ error: 'Send one picture, as "file".' });
  });
}

router.post('/', authenticate, limitUploads, oneFile, uploadImage);

module.exports = router;
