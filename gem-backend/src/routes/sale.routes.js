const router = require('express').Router();
const ctrl = require('../controllers/sale.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, DESK } = require('../middleware/access');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.post('/', only(DESK), ctrl.create);

module.exports = router;
