const router = require('express').Router();
const ctrl = require('../controllers/equipment.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, ALL, DESK } = require('../middleware/access');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.post('/', only(ALL), ctrl.create);
router.patch('/:id', only(DESK), ctrl.update);

module.exports = router;
