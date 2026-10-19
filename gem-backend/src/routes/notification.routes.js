const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.patch('/mark-read', ctrl.markRead);
router.patch('/:id/read', ctrl.markOneRead);
// Registered before '/:id' so "all" is not read as an id
router.delete('/all', ctrl.deleteAll);
router.delete('/:id', ctrl.deleteOne);

module.exports = router;
