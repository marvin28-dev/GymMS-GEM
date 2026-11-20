// GEM's admin dashboard. Signing in is open; everything else needs the
// admin's own token, which no gym account can get.
const router = require('express').Router();
const { authenticateAdmin } = require('../middleware/admin.middleware');
const admin = require('../controllers/admin.controller');
const gyms = require('../controllers/adminGym.controller');
const invoices = require('../controllers/invoice.controller');
const leads = require('../controllers/lead.controller');
const support = require('../controllers/support.controller');
const announcements = require('../controllers/announcement.controller');

router.post('/login', admin.login);

router.use(authenticateAdmin);
router.post('/logout', admin.logout);
router.get('/me', admin.me);
router.get('/overview', admin.overview);
router.get('/counts', admin.counts);
router.get('/settings', admin.getSettings);
router.put('/settings', admin.updateSettings);

router.get('/gyms', gyms.list);
router.get('/gyms/:id', gyms.getOne);
router.patch('/gyms/:id', gyms.update);
router.post('/gyms/:id/lock', gyms.lock);
router.post('/gyms/:id/unlock', gyms.unlock);

router.get('/invoices', invoices.list);
router.post('/invoices/prepare', invoices.prepare);
router.post('/invoices/send-all', invoices.sendAll);
router.patch('/invoices/:id', invoices.update);
router.post('/invoices/:id/send', invoices.send);
router.post('/invoices/:id/paid', invoices.markPaid);
router.post('/invoices/:id/remind', invoices.remind);
router.post('/invoices/:id/void', invoices.voidOne);

router.get('/leads', leads.list);
router.post('/leads', leads.adminCreate);
router.patch('/leads/:id', leads.update);

router.get('/support', support.adminList);
router.patch('/support/:id', support.adminUpdate);
router.post('/support/:id/reply', support.adminReply);

router.get('/announcements', announcements.list);
router.post('/announcements', announcements.create);

module.exports = router;
