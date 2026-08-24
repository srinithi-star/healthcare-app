const Joi = require('joi');

const register = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(1).required(),
  lastName: Joi.string().min(1).required(),
  phone: Joi.string().allow('', null),
  role: Joi.string().valid('PATIENT', 'DOCTOR', 'ADMIN').default('PATIENT'),
});

const login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const createDoctorProfile = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  phone: Joi.string().allow('', null),
  specialisation: Joi.string().required(),
  bio: Joi.string().allow('', null),
  slotDurationMinutes: Joi.number().integer().min(5).max(180).default(20),
  workingHours: Joi.array().items(
    Joi.object({
      dayOfWeek: Joi.number().integer().min(0).max(6).required(),
      startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
      endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    })
  ).default([]),
});

const updateWorkingHours = Joi.object({
  workingHours: Joi.array().items(
    Joi.object({
      dayOfWeek: Joi.number().integer().min(0).max(6).required(),
      startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
      endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    })
  ).required(),
});

const addLeaveDay = Joi.object({
  date: Joi.date().required(),
  reason: Joi.string().allow('', null),
});

const holdSlot = Joi.object({
  doctorProfileId: Joi.string().uuid().required(),
  startTime: Joi.date().iso().required(),
});

const confirmBooking = Joi.object({
  symptomText: Joi.string().min(3).required(),
});

const cancelAppointment = Joi.object({
  reason: Joi.string().allow('', null),
});

const completeVisit = Joi.object({
  clinicalNotes: Joi.string().min(3).required(),
  prescription: Joi.array().items(
    Joi.object({
      drug: Joi.string().required(),
      dose: Joi.string().required(),
      frequency: Joi.string().required(),
      durationDays: Joi.number().integer().min(1).required(),
    })
  ).default([]),
});

function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ error: error.details.map((d) => d.message).join('; ') });
    req.body = value;
    next();
  };
}

module.exports = {
  validate,
  schemas: {
    register,
    login,
    createDoctorProfile,
    updateWorkingHours,
    addLeaveDay,
    holdSlot,
    confirmBooking,
    cancelAppointment,
    completeVisit,
  },
};
