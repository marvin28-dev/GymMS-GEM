const express = require('express');
const multer  = require('multer');
const { authenticate } = require('../middleware/auth.middleware');
const { uploadImage } = require('../controllers/upload.controller');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

router.post('/', authenticate, upload.single('file'), uploadImage);

module.exports = router;
