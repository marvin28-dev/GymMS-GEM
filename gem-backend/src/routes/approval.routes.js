const router = require('express').Router();
const ctrl = require('../controllers/approval.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, DESK, MANAGEMENT } = require('../middleware/access');

router.use(authenticate);
// A manager doing the change themselves, applied at once.
router.post('/apply', only(MANAGEMENT), ctrl.applyDirect);
// The front desk asking a manager to approve a change.
router.post('/', only(DESK), ctrl.create);
router.get('/member/:memberId', only(DESK), ctrl.listForMember);
router.post('/:id/approve', only(MANAGEMENT), ctrl.approve);
router.post('/:id/reject', only(MANAGEMENT), ctrl.reject);
// The sender withdrawing their own request before a manager decides.
router.post('/:id/cancel', only(DESK), ctrl.cancel);

module.exports = router;
