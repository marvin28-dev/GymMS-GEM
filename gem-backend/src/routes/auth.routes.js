const router = require('express').Router();
const { register, login, me, verifyManager } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, me);
router.post('/verify-manager', authenticate, verifyManager);

module.exports = router;
