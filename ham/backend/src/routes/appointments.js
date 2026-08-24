const router = require('express').Router();
const ctrl = require('../controllers/appointmentController');
const { validate, schemas } = require('../utils/validators');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.post('/hold', requireRole('PATIENT'), validate(schemas.holdSlot), ctrl.hold);
router.post('/:id/confirm', requireRole('PATIENT'), validate(schemas.confirmBooking), ctrl.confirm);
router.post('/:id/cancel', validate(schemas.cancelAppointment), ctrl.cancel);
router.post('/:id/complete', requireRole('DOCTOR'), validate(schemas.completeVisit), ctrl.completeVisit);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

module.exports = router;
