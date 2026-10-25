const router = require('express').Router();
const ctrl = require('../controllers/expense.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, DESK, OWNER, MANAGEMENT } = require('../middleware/access');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.post('/', only(DESK), ctrl.create);
// A manager clears a waiting desk expense into the books.
router.patch('/:id/approve', only(MANAGEMENT), ctrl.approve);
// Anyone at the desk may record what they spent, but only the general manager
// may change a figure or take one out of the books.
router.patch('/:id', only(OWNER), ctrl.update);
router.put('/:id/receipt', only(MANAGEMENT), ctrl.setReceipt);
router.delete('/:id', only(OWNER), ctrl.remove);

module.exports = router;
