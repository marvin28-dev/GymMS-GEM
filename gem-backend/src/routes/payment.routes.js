const router = require('express').Router();
const ctrl = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, DESK } = require('../middleware/access');

router.use(authenticate);
router.get('/', only(DESK), ctrl.getAll);
router.post('/', only(DESK), ctrl.create);
router.post('/:id/receipt', only(DESK), ctrl.sendReceipt);
router.delete('/:id', only(DESK), ctrl.remove);

module.exports = router;
