const prisma = require('../config/prisma');
const { generatePreVisitSummary } = require('./llmService');
const { queueAndSend } = require('./notificationService');
const calendarService = require('./calendarService');
const logger = require('../config/logger');

const HOLD_MINUTES = Number(process.env.SLOT_HOLD_MINUTES || 5);

/**
 * Places a short-lived hold on a slot so a patient can fill the symptom
 * form without another patient grabbing the same time underneath them.
 *
 * Concurrency strategy: we don't rely on a "check then insert" race at the
 * application layer. We rely on the DB's @@unique([doctorProfileId, startTime])
 * constraint as the ultimate arbiter — if two requests hit this at the same
 * instant, Postgres allows exactly one INSERT to succeed and the other
 * throws P2002, which the error handler turns into a clean 409. Before that,
 * we opportunistically clear any hold that has already expired so the slot
 * doesn't appear falsely taken.
 */
async function holdSlot({ doctorProfileId, patientId, startTime }) {
  const start = new Date(startTime);

  const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorProfileId } });
  if (!doctor) throw Object.assign(new Error('Doctor not found'), { status: 404 });
  const end = new Date(start.getTime() + doctor.slotDurationMinutes * 60000);

  // Release a stale hold on this exact slot, if any, so it can be re-taken.
  await prisma.appointment.deleteMany({
    where: {
      doctorProfileId,
      startTime: start,
      status: 'HELD',
      holdExpiresAt: { lt: new Date() },
    },
  });

  // This insert is the actual conflict-prevention gate. Duplicate concurrent
  // calls will race here; Postgres's unique index lets only one through.
  const appointment = await prisma.appointment.create({
    data: {
      doctorProfileId,
      patientId,
      startTime: start,
      endTime: end,
      status: 'HELD',
      holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60000),
    },
  });

  return appointment;
}

/**
 * Confirms a held slot: attaches symptoms, generates the AI pre-visit
 * summary (best-effort — never blocks confirmation), sends confirmations,
 * and creates calendar events for both parties.
 */
async function confirmBooking({ appointmentId, patientId, symptomText }) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { doctorProfile: { include: { user: true } }, patient: true },
  });

  if (!appointment) throw Object.assign(new Error('Appointment not found'), { status: 404 });
  if (appointment.patientId !== patientId) {
    throw Object.assign(new Error('Not your appointment'), { status: 403 });
  }
  if (appointment.status !== 'HELD') {
    throw Object.assign(new Error('This hold is no longer active'), { status: 409 });
  }
  if (appointment.holdExpiresAt && appointment.holdExpiresAt < new Date()) {
    await prisma.appointment.delete({ where: { id: appointmentId } });
    throw Object.assign(new Error('Your slot hold expired. Please pick a slot again.'), { status: 410 });
  }

  // Best-effort AI pre-visit summary — failures are recorded, not thrown.
  const ai = await generatePreVisitSummary(symptomText);

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: 'BOOKED',
      symptomText,
      symptomSubmittedAt: new Date(),
      holdExpiresAt: null,
      aiUrgency: ai.ok ? ai.data.urgency : null,
      aiChiefComplaint: ai.ok ? ai.data.chiefComplaint : null,
      aiSuggestedQuestions: ai.ok ? ai.data.suggestedQuestions : undefined,
      aiPreVisitRaw: ai.raw || undefined,
      aiPreVisitError: ai.ok ? null : ai.error,
    },
  });

  const doctorUser = appointment.doctorProfile.user;
  const patientUser = appointment.patient;
  const doctorName = `${doctorUser.firstName} ${doctorUser.lastName}`;
  const patientName = `${patientUser.firstName} ${patientUser.lastName}`;

  // Calendar events — best effort, independent for each party.
  const [patientEventId, doctorEventId] = await Promise.all([
    calendarService.createEvent(patientUser.id, {
      summary: `Appointment with Dr. ${doctorName}`,
      description: 'Booked via Clinic Appointments',
      startTime: appointment.startTime,
      endTime: appointment.endTime,
    }),
    calendarService.createEvent(doctorUser.id, {
      summary: `Appointment with ${patientName}`,
      description: `Chief complaint: ${ai.ok ? ai.data.chiefComplaint : 'Pending review'}`,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
    }),
  ]);

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { patientGoogleEventId: patientEventId, doctorGoogleEventId: doctorEventId },
  });

  // Email confirmations — queued through the notification service so
  // failures are retried by the background job rather than lost.
  await Promise.all([
    queueAndSend({
      userId: patientUser.id,
      appointmentId,
      type: 'BOOKING_CONFIRMATION',
      to: patientUser.email,
      context: { recipientName: patientUser.firstName, otherPartyName: doctorName, startTime: appointment.startTime, role: 'patient' },
    }),
    queueAndSend({
      userId: doctorUser.id,
      appointmentId,
      type: 'BOOKING_CONFIRMATION',
      to: doctorUser.email,
      context: { recipientName: doctorUser.firstName, otherPartyName: patientName, startTime: appointment.startTime, role: 'doctor' },
    }),
  ]);

  return updated;
}

/**
 * Cancels a booked (or held) appointment: notifies the other party,
 * removes calendar events, frees the slot.
 */
async function cancelAppointment({ appointmentId, cancelledByUserId, reason }) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { doctorProfile: { include: { user: true } }, patient: true },
  });
  if (!appointment) throw Object.assign(new Error('Appointment not found'), { status: 404 });
  if (!['BOOKED', 'HELD'].includes(appointment.status)) {
    throw Object.assign(new Error('Appointment cannot be cancelled from its current state'), { status: 409 });
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: cancelledByUserId, cancelReason: reason },
  });

  const doctorUser = appointment.doctorProfile.user;
  const patientUser = appointment.patient;

  await Promise.all([
    calendarService.deleteEvent(patientUser.id, appointment.patientGoogleEventId),
    calendarService.deleteEvent(doctorUser.id, appointment.doctorGoogleEventId),
  ]);

  if (appointment.status !== 'HELD') {
    await Promise.all([
      queueAndSend({
        userId: patientUser.id,
        appointmentId,
        type: 'CANCELLATION',
        to: patientUser.email,
        context: { recipientName: patientUser.firstName, otherPartyName: `Dr. ${doctorUser.lastName}`, startTime: appointment.startTime, reason },
      }),
      queueAndSend({
        userId: doctorUser.id,
        appointmentId,
        type: 'CANCELLATION',
        to: doctorUser.email,
        context: { recipientName: doctorUser.firstName, otherPartyName: `${patientUser.firstName} ${patientUser.lastName}`, startTime: appointment.startTime, reason },
      }),
    ]);
  }

  return { cancelled: true };
}

/**
 * Called when a doctor is marked on leave for a date that already has
 * bookings. Every affected BOOKED appointment is cancelled and the patient
 * is notified with a dedicated DOCTOR_LEAVE email (distinct from a generic
 * cancellation so the patient understands it wasn't their doing).
 */
async function handleDoctorLeaveConflicts(doctorProfileId, date) {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const affected = await prisma.appointment.findMany({
    where: { doctorProfileId, status: 'BOOKED', startTime: { gte: dayStart, lt: dayEnd } },
    include: { doctorProfile: { include: { user: true } }, patient: true },
  });

  for (const appt of affected) {
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'Doctor marked unavailable (leave)' },
    });

    await calendarService.deleteEvent(appt.patient.id, appt.patientGoogleEventId).catch(() => {});
    await calendarService.deleteEvent(appt.doctorProfile.user.id, appt.doctorGoogleEventId).catch(() => {});

    await queueAndSend({
      userId: appt.patient.id,
      appointmentId: appt.id,
      type: 'DOCTOR_LEAVE',
      to: appt.patient.email,
      context: {
        recipientName: appt.patient.firstName,
        otherPartyName: appt.doctorProfile.user.lastName,
        startTime: appt.startTime,
      },
    }).catch((err) => logger.error('Failed to notify patient of doctor leave conflict', { err: err.message }));
  }

  return { affectedCount: affected.length };
}

module.exports = { holdSlot, confirmBooking, cancelAppointment, handleDoctorLeaveConflicts };
