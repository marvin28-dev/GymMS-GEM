const router = require('express').Router();
const ctrl = require('../controllers/equipment.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);

module.exports = router;
