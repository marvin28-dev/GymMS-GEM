const router = require('express').Router();
const ctrl = require('../controllers/member.controller');
const act = require('../controllers/memberAction.controller');
const notes = require('../controllers/memberNote.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, DESK, MANAGEMENT } = require('../middleware/access');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', only(DESK), ctrl.create);
router.post('/:id/send-code', only(DESK), ctrl.sendCode);
// Each takes the payment and makes the change together (D-20)
router.post('/:id/renew', only(DESK), act.renew);
router.post('/:id/change-package', only(DESK), act.changePackage);
router.post('/:id/day-pass', only(DESK), act.dayPass);
router.post('/:id/visitor-bundle', only(DESK), act.visitorBundle);
router.post('/:id/convert-to-visitor', only(DESK), act.convertToVisitor);
router.post('/:id/registration-fee', only(DESK), act.registrationFee);
// A member's notes are the desk's and management's (D-32)
router.get('/:id/notes', only(DESK), notes.list);
router.post('/:id/notes', only(DESK), notes.add);
router.post('/:id/notes/import', only(DESK), notes.importNotes);
router.patch('/:id', only(DESK), ctrl.update);
router.delete('/:id', only(MANAGEMENT), ctrl.remove);

module.exports = router;
