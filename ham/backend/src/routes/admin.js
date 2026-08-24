const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { validate, schemas } = require('../utils/validators');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('ADMIN'));

router.post('/doctors', validate(schemas.createDoctorProfile), ctrl.createDoctor);
router.get('/doctors', ctrl.listDoctors);
router.put('/doctors/:doctorProfileId/working-hours', validate(schemas.updateWorkingHours), ctrl.updateWorkingHours);
router.post('/doctors/:doctorProfileId/leave', validate(schemas.addLeaveDay), ctrl.addLeaveDay);
router.delete('/leave/:leaveDayId', ctrl.removeLeaveDay);

module.exports = router;
