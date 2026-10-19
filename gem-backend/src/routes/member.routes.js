const router = require('express').Router();
const ctrl = require('../controllers/member.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, DESK, MANAGEMENT } = require('../middleware/access');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', only(DESK), ctrl.create);
router.post('/:id/send-code', only(DESK), ctrl.sendCode);
router.patch('/:id', only(DESK), ctrl.update);
router.delete('/:id', only(MANAGEMENT), ctrl.remove);

module.exports = router;
