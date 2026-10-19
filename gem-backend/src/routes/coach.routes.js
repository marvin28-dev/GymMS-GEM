const router = require('express').Router();
const ctrl = require('../controllers/coach.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { only, ALL, COACHING } = require('../middleware/access');

router.use(authenticate);
// The signed-in coach's own day
router.get('/overview', only(COACHING), ctrl.overview);
// One coach's clients: a manager's view, or the coach's own
router.get('/clients/:staffId', only(COACHING), ctrl.coachClients);
// Who coaches a member (rules on who may change it live in the controller)
router.post('/assign', only(COACHING), ctrl.assign);
// What a member is working towards (their coach or a manager)
router.put('/goals/:memberId', only(COACHING), ctrl.setGoals);
// A member's progress: everyone who can open the member may read it
router.get('/progress/:memberId', only(ALL), ctrl.listProgress);
router.post('/progress/:memberId', only(COACHING), ctrl.addProgress);
router.delete('/progress/entry/:id', only(COACHING), ctrl.removeProgress);

module.exports = router;
