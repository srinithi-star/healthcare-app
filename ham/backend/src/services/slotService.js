const prisma = require('../config/prisma');

/**
 * Computes bookable slots for a doctor on a given calendar date.
 * A slot is available if it falls within a WorkingHour window, the doctor
 * is not on leave that day, and no Appointment (BOOKED, or HELD-and-not-yet-
 * expired) already occupies that exact startTime.
 */
async function getAvailableSlots(doctorProfileId, dateStr) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    include: { workingHours: true },
  });
  if (!doctor) throw Object.assign(new Error('Doctor not found'), { status: 404 });

  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const dayOfWeek = date.getUTCDay();

  const onLeave = await prisma.leaveDay.findUnique({
    where: { doctorProfileId_date: { doctorProfileId, date } },
  });
  if (onLeave) return { slots: [], onLeave: true, reason: onLeave.reason };

  const windows = doctor.workingHours.filter((w) => w.dayOfWeek === dayOfWeek);
  if (windows.length === 0) return { slots: [], onLeave: false };

  // Existing appointments that occupy a slot: BOOKED always counts; HELD
  // only counts if its hold hasn't expired yet (an expired hold is a
  // released slot, even though the row hasn't been garbage-collected yet).
  const dayStart = date;
  const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const occupied = await prisma.appointment.findMany({
    where: {
      doctorProfileId,
      startTime: { gte: dayStart, lt: dayEnd },
      OR: [{ status: 'BOOKED' }, { status: 'HELD', holdExpiresAt: { gt: new Date() } }],
    },
    select: { startTime: true },
  });
  const occupiedTimes = new Set(occupied.map((o) => o.startTime.getTime()));

  const slots = [];
  const duration = doctor.slotDurationMinutes;
  for (const w of windows) {
    let [h, m] = w.startTime.split(':').map(Number);
    const [endH, endM] = w.endTime.split(':').map(Number);
    let cursor = new Date(date);
    cursor.setUTCHours(h, m, 0, 0);
    const end = new Date(date);
    end.setUTCHours(endH, endM, 0, 0);

    while (cursor.getTime() + duration * 60000 <= end.getTime()) {
      if (!occupiedTimes.has(cursor.getTime()) && cursor.getTime() > Date.now()) {
        slots.push(new Date(cursor));
      }
      cursor = new Date(cursor.getTime() + duration * 60000);
    }
  }

  return { slots, onLeave: false, slotDurationMinutes: duration };
}

module.exports = { getAvailableSlots };
