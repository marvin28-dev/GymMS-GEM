const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.patch('/mark-read', ctrl.markRead);
router.patch('/:id/read', ctrl.markOneRead);
router.delete('/:id', ctrl.deleteOne);

module.exports = router;
