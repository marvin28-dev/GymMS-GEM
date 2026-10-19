const router = require('express').Router();
const ctrl = require('../controllers/package.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, OWNER } = require('../middleware/access');

router.use(authenticate);
router.get('/', ctrl.getAll);
// A manager runs the gym day to day but does not price it, so packages are
// his to read and the owner's to change.
router.post('/', only(OWNER), ctrl.create);
router.patch('/:id', only(OWNER), ctrl.update);
router.delete('/:id', only(OWNER), ctrl.remove);

module.exports = router;
