const router = require('express').Router();
const ctrl = require('../controllers/calendar.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, CLASSES } = require('../middleware/access');

router.use(authenticate);
router.get('/', ctrl.getAll);
// What someone already has on at a given time, for a warning before booking them
router.get('/busy', ctrl.busy);
router.post('/', only(CLASSES), ctrl.create);
router.patch('/:id', only(CLASSES), ctrl.update);
// Who may remove one depends on whose entry it is, which the controller knows
router.delete('/:id', only(CLASSES), ctrl.remove);

module.exports = router;
