const cron = require('node-cron');
const prisma = require('../config/prisma');
const { queueAndSend, retryFailedNotifications } = require('../services/notificationService');
const logger = require('../config/logger');

const REMINDER_HOURS = Number(process.env.APPOINTMENT_REMINDER_HOURS || 24);

// Sends the "appointment coming up" email once per appointment, a window
// around REMINDER_HOURS before start time. We use a notification-existence
// check instead of a boolean flag on Appointment so the same mechanism also
// naturally supports future reminder types without a schema change.
async function sendAppointmentReminders() {
  const windowStart = new Date(Date.now() + (REMINDER_HOURS - 0.25) * 60 * 60 * 1000);
  const windowEnd = new Date(Date.now() + (REMINDER_HOURS + 0.25) * 60 * 60 * 1000);

  const upcoming = await prisma.appointment.findMany({
    where: { status: 'BOOKED', startTime: { gte: windowStart, lte: windowEnd } },
    include: { patient: true, doctorProfile: { include: { user: true } } },
  });

  for (const appt of upcoming) {
    const alreadySent = await prisma.notification.findFirst({
      where: { appointmentId: appt.id, type: 'REMINDER' },
    });
    if (alreadySent) continue;

    const doctorName = `${appt.doctorProfile.user.firstName} ${appt.doctorProfile.user.lastName}`;
    const patientName = `${appt.patient.firstName} ${appt.patient.lastName}`;

    await queueAndSend({
      userId: appt.patient.id,
      appointmentId: appt.id,
      type: 'REMINDER',
      to: appt.patient.email,
      context: { recipientName: appt.patient.firstName, otherPartyName: doctorName, startTime: appt.startTime, role: 'patient' },
    });
    await queueAndSend({
      userId: appt.doctorProfile.user.id,
      appointmentId: appt.id,
      type: 'REMINDER',
      to: appt.doctorProfile.user.email,
      context: { recipientName: appt.doctorProfile.user.firstName, otherPartyName: patientName, startTime: appt.startTime, role: 'doctor' },
    });
  }
  if (upcoming.length) logger.info(`Sent reminders for ${upcoming.length} upcoming appointments`);
}

// Medication reminders: any MedicationReminder row whose scheduledFor has
// passed and hasn't been sent yet.
async function sendMedicationReminders() {
  const due = await prisma.medicationReminder.findMany({
    where: { sent: false, scheduledFor: { lte: new Date() } },
    include: { appointment: { include: { patient: true } } },
    take: 200,
  });

  for (const reminder of due) {
    await queueAndSend({
      userId: reminder.appointment.patient.id,
      appointmentId: reminder.appointmentId,
      type: 'MEDICATION_REMINDER',
      to: reminder.appointment.patient.email,
      context: { recipientName: reminder.appointment.patient.firstName, drug: reminder.drug, dose: reminder.dose },
    });
    await prisma.medicationReminder.update({
      where: { id: reminder.id },
      data: { sent: true, sentAt: new Date() },
    });
  }
  if (due.length) logger.info(`Sent ${due.length} medication reminders`);
}

// Releases expired slot holds so they don't ghost-block a slot forever if a
// patient abandons the booking flow after step 1.
async function releaseExpiredHolds() {
  const result = await prisma.appointment.deleteMany({
    where: { status: 'HELD', holdExpiresAt: { lt: new Date() } },
  });
  if (result.count) logger.info(`Released ${result.count} expired slot holds`);
}

async function runSweep() {
  try {
    await releaseExpiredHolds();
    await sendAppointmentReminders();
    await sendMedicationReminders();
    const retryResult = await retryFailedNotifications();
    if (retryResult.checked) {
      logger.info(`Notification retry sweep: ${retryResult.succeeded}/${retryResult.checked} succeeded`);
    }
  } catch (err) {
    logger.error('Reminder job sweep failed', { message: err.message, stack: err.stack });
  }
}

function start() {
  const schedule = process.env.REMINDER_CRON || '*/5 * * * *';
  cron.schedule(schedule, runSweep);
  logger.info(`Reminder/retry background job scheduled: ${schedule}`);
}

module.exports = { start, runSweep };
