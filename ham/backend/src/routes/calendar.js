const router = require('express').Router();
const ctrl = require('../controllers/calendarController');
const { requireAuth } = require('../middleware/auth');

router.get('/oauth/connect', requireAuth, ctrl.connect);
router.get('/oauth/callback', ctrl.callback);

module.exports = router;
