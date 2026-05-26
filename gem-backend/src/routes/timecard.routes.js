const router = require('express').Router();
const ctrl = require('../controllers/timecard.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.post('/', ctrl.createManual);
router.post('/punchin', ctrl.punchIn);
router.patch('/:id/punchout', ctrl.punchOut);
router.delete('/:id', ctrl.remove);

module.exports = router;
