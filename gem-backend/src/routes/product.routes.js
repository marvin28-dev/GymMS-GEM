const router = require('express').Router();
const ctrl = require('../controllers/product.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, DESK, MANAGEMENT } = require('../middleware/access');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.post('/', only(DESK), ctrl.create);
router.patch('/:id', only(DESK), ctrl.update);
router.post('/:id/restock', only(DESK), ctrl.restock);
router.delete('/:id', only(MANAGEMENT), ctrl.remove);

module.exports = router;
