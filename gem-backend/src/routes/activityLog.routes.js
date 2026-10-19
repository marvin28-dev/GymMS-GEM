const router = require('express').Router();
const ctrl = require('../controllers/activityLog.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, OWNER } = require('../middleware/access');

router.use(authenticate, only(OWNER));
router.get('/', ctrl.list);

module.exports = router;
