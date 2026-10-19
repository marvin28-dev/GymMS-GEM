const router = require('express').Router();
const { register, login, me, verifyManager, checkGymCode, forgotPassword, resetPassword, verifyResetToken, changePassword, loginStatus, setFirstPassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.post('/register', register);
router.get('/check-code/:code', checkGymCode);
router.post('/login', login);
router.post('/login-status', loginStatus);
router.post('/set-password', setFirstPassword);
router.get('/me', authenticate, me);
router.post('/verify-manager', authenticate, verifyManager);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-reset-token/:token', verifyResetToken);
router.post('/change-password', authenticate, changePassword);

module.exports = router;
