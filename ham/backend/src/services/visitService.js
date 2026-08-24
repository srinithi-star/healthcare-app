const prisma = require('../config/prisma');
const { generatePostVisitSummary } = require('./llmService');
const { queueAndSend } = require('./notificationService');

/**
 * Parses "twice daily" / "every 8 hours" / "once daily" style frequency
 * strings into a list of reminder offsets (minutes from first dose) across
 * the prescription's duration. Falls back to once-daily if unrecognised —
 * we never throw away a prescription because of a parsing miss.
 */
function frequencyToIntervalMinutes(frequency) {
  const f = frequency.toLowerCase();
  if (f.includes('once')) return 24 * 60;
  if (f.includes('twice')) return 12 * 60;
  if (f.includes('three') || f.includes('thrice')) return 8 * 60;
  if (f.includes('four')) return 6 * 60;
  const everyHoursMatch = f.match(/every\s+(\d+)\s*hour/);
  if (everyHoursMatch) return Number(everyHoursMatch[1]) * 60;
  return 24 * 60; // safe default
}

async function scheduleMedicationReminders(appointmentId, prescription, startFrom) {
  if (!Array.isArray(prescription)) return;
  const rows = [];
  for (const item of prescription) {
    const intervalMin = frequencyToIntervalMinutes(item.frequency || 'once daily');
    const doses = Math.max(1, Math.floor(((item.durationDays || 1) * 24 * 60) / intervalMin));
    for (let i = 0; i < doses; i++) {
      rows.push({
        appointmentId,
        drug: item.drug,
        dose: item.dose,
        scheduledFor: new Date(startFrom.getTime() + i * intervalMin * 60000),
      });
    }
  }
  if (rows.length) {
    await prisma.medicationReminder.createMany({ data: rows });
  }
}

/**
 * Doctor submits post-visit clinical notes + prescription. Generates the
 * patient-friendly summary via LLM (best-effort), marks the visit complete,
 * and schedules medication reminders based on prescription frequency.
 */
async function completeVisit({ appointmentId, doctorUserId, clinicalNotes, prescription }) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { doctorProfile: true, patient: true },
  });
  if (!appointment) throw Object.assign(new Error('Appointment not found'), { status: 404 });
  if (appointment.doctorProfile.userId !== doctorUserId) {
    throw Object.assign(new Error('Not your appointment'), { status: 403 });
  }
  if (appointment.status !== 'BOOKED') {
    throw Object.assign(new Error('Only booked appointments can be completed'), { status: 409 });
  }

  const ai = await generatePostVisitSummary(clinicalNotes, prescription);

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: 'COMPLETED',
      clinicalNotes,
      prescription,
      visitCompletedAt: new Date(),
      aiPostVisitSummary: ai.ok
        ? `${ai.data.summary}\n\nMedication schedule: ${ai.data.medicationSchedule}\n\nFollow-up: ${ai.data.followUpSteps}`
        : null,
      aiPostVisitRaw: ai.raw || undefined,
      aiPostVisitError: ai.ok ? null : ai.error,
    },
  });

  await scheduleMedicationReminders(appointmentId, prescription, new Date());

  await queueAndSend({
    userId: appointment.patient.id,
    appointmentId,
    type: 'BOOKING_CONFIRMATION', // reuse-safe generic template; visit summary itself is fetched in-app
    to: appointment.patient.email,
    context: {
      recipientName: appointment.patient.firstName,
      otherPartyName: 'your care team',
      startTime: appointment.startTime,
      role: 'patient',
    },
  }).catch(() => {});

  return updated;
}

module.exports = { completeVisit, scheduleMedicationReminders, frequencyToIntervalMinutes };
