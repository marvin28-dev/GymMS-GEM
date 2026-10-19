const router = require('express').Router();
const ctrl = require('../controllers/report.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, DESK } = require('../middleware/access');

router.use(authenticate);
router.get('/eod', only(DESK), ctrl.eod);

module.exports = router;
