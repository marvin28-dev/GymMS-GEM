const router = require('express').Router();
const ctrl = require('../controllers/timecard.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, DESK, MANAGEMENT } = require('../middleware/access');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.post('/', only(DESK), ctrl.createManual);
router.post('/punchin', only(DESK), ctrl.punchIn);
router.get('/shift', only(DESK), ctrl.shiftStatus);
router.post('/shift/start', only(DESK), ctrl.startShift);
router.post('/end-of-day', only(DESK), ctrl.endOfDay);
router.patch('/:id/punchout', only(DESK), ctrl.punchOut);
router.patch('/:id/adjust', only(DESK), ctrl.adjust);
router.patch('/:id/approve', only(MANAGEMENT), ctrl.approve);
router.patch('/:id/reject', only(MANAGEMENT), ctrl.reject);
router.delete('/:id', only(MANAGEMENT), ctrl.remove);

module.exports = router;
