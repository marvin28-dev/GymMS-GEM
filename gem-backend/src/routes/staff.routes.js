const router = require('express').Router();
const ctrl = require('../controllers/staff.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, OWNER, MANAGEMENT, DESK } = require('../middleware/access');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/by-code/:code', only(DESK), ctrl.findByCode);
router.get('/:id/code', ctrl.getCode);
router.get('/:id/active', only(DESK), ctrl.checkActive);
router.post('/:id/verify-code', only(DESK), ctrl.verifyCode);
// Only the owner hands out codes, his own included
router.post('/:id/code/regenerate', only(OWNER), ctrl.regenerateCode);
router.get('/:id', ctrl.getOne);
// Taking somebody on is the owner's decision, not a manager's. The controller
// says so in those words, which is friendlier than the blanket role refusal.
router.post('/', ctrl.create);
router.post('/:id/resend-invite', only(MANAGEMENT), ctrl.resendInvite);
router.patch('/:id', ctrl.update);
router.delete('/:id', only(MANAGEMENT), ctrl.remove);

module.exports = router;
