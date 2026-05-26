const router = require('express').Router();
const { getGymByCode, getMyGym, updateMyGym } = require('../controllers/gym.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/code/:code', getGymByCode);
router.get('/me', authenticate, getMyGym);
router.patch('/me', authenticate, updateMyGym);

module.exports = router;
