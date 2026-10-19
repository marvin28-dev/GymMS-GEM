const router = require('express').Router();
const ctrl = require('../controllers/attendance.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, DESK } = require('../middleware/access');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/stats', ctrl.stats);
router.post('/checkin', only(DESK), ctrl.checkIn);
router.patch('/:id/checkout', only(DESK), ctrl.checkOut);

module.exports = router;
