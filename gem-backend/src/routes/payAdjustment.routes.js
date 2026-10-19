const router = require('express').Router();
const ctrl = require('../controllers/payAdjustment.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, OWNER } = require('../middleware/access');

router.use(authenticate);
router.get('/staff/:staffId', ctrl.listForStaff);
router.get('/staff/:staffId/preview', ctrl.preview);
router.post('/', only(OWNER), ctrl.create);
router.patch('/:id', only(OWNER), ctrl.update);
router.delete('/:id', only(OWNER), ctrl.remove);

module.exports = router;
