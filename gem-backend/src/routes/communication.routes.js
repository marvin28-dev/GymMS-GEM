const router = require('express').Router();
const ctrl = require('../controllers/communication.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, MANAGEMENT, DESK } = require('../middleware/access');

router.use(authenticate);
router.get('/', only(MANAGEMENT), ctrl.getAll);
router.get('/channels', only(DESK), ctrl.channels);
router.post('/audience', only(DESK), ctrl.previewAudience);
router.get('/member/:memberId', only(DESK), ctrl.forMember);
router.get('/:id', only(MANAGEMENT), ctrl.getOne);
// The desk may write to one member from their profile; the controller keeps groups to management
router.post('/', only(DESK), ctrl.create);
router.post('/:id/retry', only(MANAGEMENT), ctrl.retry);
router.post('/:id/cancel', only(MANAGEMENT), ctrl.cancelSchedule);
router.delete('/:id', only(MANAGEMENT), ctrl.remove);

module.exports = router;
