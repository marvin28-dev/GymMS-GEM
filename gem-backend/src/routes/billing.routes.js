const router = require('express').Router();
const ctrl = require('../controllers/billing.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, OWNER } = require('../middleware/access');

// What the gym pays GEM. Reachable while the account is paused (auth.middleware).
router.use(authenticate);
router.get('/status', ctrl.status);
router.get('/', only(OWNER), ctrl.mine);

module.exports = router;
