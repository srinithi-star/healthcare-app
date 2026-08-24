const router = require('express').Router();
const ctrl = require('../controllers/doctorController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', ctrl.searchDoctors);
router.get('/:id', ctrl.getDoctor);
router.get('/:id/slots', ctrl.listSlots);

module.exports = router;
