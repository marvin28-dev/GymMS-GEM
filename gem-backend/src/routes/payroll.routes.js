const router = require('express').Router();
const ctrl = require('../controllers/payroll.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, OWNER } = require('../middleware/access');

router.use(authenticate);
router.get('/', ctrl.listAll);
router.get('/staff/:staffId', ctrl.listForStaff);
router.post('/', only(OWNER), ctrl.create);
router.patch('/:id/status', only(OWNER), ctrl.setStatus);
router.delete('/:id', only(OWNER), ctrl.remove);

module.exports = router;
