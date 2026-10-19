const router = require('express').Router();
const { getGymByCode, getMyGym, updateMyGym, getSetup, confirmSetupSection } = require('../controllers/gym.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, OWNER } = require('../middleware/access');

router.get('/code/:code', getGymByCode);
router.get('/me', authenticate, getMyGym);
router.patch('/me', authenticate, only(OWNER), updateMyGym);
router.get('/me/setup', authenticate, only(OWNER), getSetup);
router.post('/me/setup/confirm', authenticate, only(OWNER), confirmSetupSection);

module.exports = router;
