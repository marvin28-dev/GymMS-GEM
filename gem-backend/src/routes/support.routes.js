const router = require('express').Router();
const ctrl = require('../controllers/support.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Anyone signed in may tell GEM something is wrong, whatever their role
router.use(authenticate);
router.get('/', ctrl.getMine);
router.post('/', ctrl.create);

module.exports = router;
