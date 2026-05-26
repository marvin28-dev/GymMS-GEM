const router = require('express').Router();
const ctrl = require('../controllers/attendance.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.post('/checkin', ctrl.checkIn);
router.patch('/:id/checkout', ctrl.checkOut);

module.exports = router;
