const router = require('express').Router();
const ctrl = require('../controllers/communication.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.delete('/:id', ctrl.remove);

module.exports = router;
