const prisma = require('../config/prisma');
const bookingService = require('../services/bookingService');
const visitService = require('../services/visitService');

async function hold(req, res) {
  const { doctorProfileId, startTime } = req.body;
  const appointment = await bookingService.holdSlot({
    doctorProfileId,
    patientId: req.user.id,
    startTime,
  });
  res.status(201).json({ appointment, holdExpiresAt: appointment.holdExpiresAt });
}

async function confirm(req, res) {
  const { symptomText } = req.body;
  const appointment = await bookingService.confirmBooking({
    appointmentId: req.params.id,
    patientId: req.user.id,
    symptomText,
  });
  res.json({ appointment });
}

async function cancel(req, res) {
  const { reason } = req.body;
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: { doctorProfile: true },
  });
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

  const isOwner =
    appointment.patientId === req.user.id ||
    appointment.doctorProfile.userId === req.user.id ||
    req.user.role === 'ADMIN';
  if (!isOwner) return res.status(403).json({ error: 'Not authorised to cancel this appointment' });

  const result = await bookingService.cancelAppointment({
    appointmentId: req.params.id,
    cancelledByUserId: req.user.id,
    reason,
  });
  res.json(result);
}

// Patient: their own appointments. Doctor: their appointments. Admin: all (via query).
async function list(req, res) {
  let where = {};
  if (req.user.role === 'PATIENT') {
    where = { patientId: req.user.id };
  } else if (req.user.role === 'DOCTOR') {
    const profile = await prisma.doctorProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.json({ appointments: [] });
    where = { doctorProfileId: profile.id };
  }
  // ADMIN sees everything by default; optional ?doctorProfileId= filter
  if (req.user.role === 'ADMIN' && req.query.doctorProfileId) {
    where = { doctorProfileId: req.query.doctorProfileId };
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, email: true } },
      doctorProfile: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
    },
    orderBy: { startTime: 'desc' },
  });
  res.json({ appointments });
}

async function getOne(req, res) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, email: true } },
      doctorProfile: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

  const allowed =
    appointment.patientId === req.user.id ||
    appointment.doctorProfile.userId === req.user.id ||
    req.user.role === 'ADMIN';
  if (!allowed) return res.status(403).json({ error: 'Not authorised' });

  res.json({ appointment });
}

async function completeVisit(req, res) {
  const { clinicalNotes, prescription } = req.body;
  const appointment = await visitService.completeVisit({
    appointmentId: req.params.id,
    doctorUserId: req.user.id,
    clinicalNotes,
    prescription,
  });
  res.json({ appointment });
}

module.exports = { hold, confirm, cancel, list, getOne, completeVisit };
