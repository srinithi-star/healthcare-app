const prisma = require('../config/prisma');
const { hashPassword } = require('../utils/auth');
const bookingService = require('../services/bookingService');

// Creates a doctor's User account + DoctorProfile + initial working hours in
// one transaction, so a doctor is never left half-provisioned.
async function createDoctor(req, res) {
  const { email, password, firstName, lastName, phone, specialisation, bio, slotDurationMinutes, workingHours } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const passwordHash = await hashPassword(password);

  const doctor = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash, firstName, lastName, phone, role: 'DOCTOR' },
    });
    const profile = await tx.doctorProfile.create({
      data: {
        userId: user.id,
        specialisation,
        bio,
        slotDurationMinutes,
        workingHours: { create: workingHours },
      },
      include: { workingHours: true, user: true },
    });
    return profile;
  });

  res.status(201).json({ doctor });
}

async function listDoctors(req, res) {
  const doctors = await prisma.doctorProfile.findMany({
    include: { user: true, workingHours: true, leaveDays: true },
  });
  res.json({ doctors });
}

async function updateWorkingHours(req, res) {
  const { doctorProfileId } = req.params;
  const { workingHours } = req.body;

  await prisma.$transaction([
    prisma.workingHour.deleteMany({ where: { doctorProfileId } }),
    prisma.workingHour.createMany({ data: workingHours.map((w) => ({ ...w, doctorProfileId })) }),
  ]);

  const updated = await prisma.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    include: { workingHours: true },
  });
  res.json({ doctor: updated });
}

// Marking a leave day is the trigger for the "doctor leave conflict" flow:
// any existing bookings on that date get cancelled and the patient notified.
async function addLeaveDay(req, res) {
  const { doctorProfileId } = req.params;
  const { date, reason } = req.body;
  const normalizedDate = new Date(date);
  normalizedDate.setUTCHours(0, 0, 0, 0);

  const leave = await prisma.leaveDay.upsert({
    where: { doctorProfileId_date: { doctorProfileId, date: normalizedDate } },
    update: { reason },
    create: { doctorProfileId, date: normalizedDate, reason },
  });

  const conflictResult = await bookingService.handleDoctorLeaveConflicts(doctorProfileId, normalizedDate);

  res.status(201).json({ leave, cancelledAppointments: conflictResult.affectedCount });
}

async function removeLeaveDay(req, res) {
  const { leaveDayId } = req.params;
  await prisma.leaveDay.delete({ where: { id: leaveDayId } });
  res.status(204).send();
}

module.exports = { createDoctor, listDoctors, updateWorkingHours, addLeaveDay, removeLeaveDay };
