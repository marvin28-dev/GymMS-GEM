const router = require('express').Router();
const ctrl = require('../controllers/lead.controller');

// The landing page's "Book a demo" form: open to anyone, limited per address
router.post('/', ctrl.create);

module.exports = router;
