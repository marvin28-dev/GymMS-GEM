const router = require('express').Router();
const ctrl = require('../controllers/sale.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, DESK } = require('../middleware/access');

router.use(authenticate);
// Sales are read where they are shown: the Sales page, the desk and the
// Dashboard's money cards, none of which a trainer has (D-24)
router.get('/', only(DESK), ctrl.getAll);
router.post('/', only(DESK), ctrl.create);

module.exports = router;
