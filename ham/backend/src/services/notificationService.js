const prisma = require('../config/prisma');
const { sendEmail } = require('./emailService');
const logger = require('../config/logger');

const MAX_ATTEMPTS = 5;

/**
 * Queues a notification row (status PENDING) and attempts to send it
 * immediately. If the send fails, the row stays in the DB with status
 * FAILED/RETRYING and attempts+1 — the background job (jobs/notificationRetry.js)
 * sweeps these on a schedule so a transient SMTP outage never means a patient
 * silently never hears about their booking.
 */
async function queueAndSend({ userId, appointmentId, type, to, context }) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      appointmentId,
      type,
      channel: 'email',
      status: 'PENDING',
      payload: context,
    },
  });

  await attemptSend(notification.id, to, type, context);
  return notification;
}

async function attemptSend(notificationId, to, type, context) {
  const result = await sendEmail(to, type, context);

  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  const attempts = (notification?.attempts || 0) + 1;

  if (result.ok) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: 'SENT', sentAt: new Date(), attempts },
    });
    return true;
  }

  const status = attempts >= MAX_ATTEMPTS ? 'FAILED' : 'RETRYING';
  await prisma.notification.update({
    where: { id: notificationId },
    data: { status, attempts, lastError: result.error },
  });
  if (status === 'FAILED') {
    logger.error(`Notification ${notificationId} permanently failed after ${attempts} attempts: ${result.error}`);
  }
  return false;
}

/**
 * Called by the cron job. Picks up anything RETRYING (or stuck PENDING from
 * a crashed process) below MAX_ATTEMPTS and tries again. This is what makes
 * "notification failure handling" resilient instead of best-effort.
 */
async function retryFailedNotifications() {
  const pending = await prisma.notification.findMany({
    where: {
      status: { in: ['RETRYING', 'PENDING'] },
      attempts: { lt: MAX_ATTEMPTS },
    },
    include: { user: true },
    take: 100,
  });

  let succeeded = 0;
  for (const n of pending) {
    const to = n.user.email;
    const ok = await attemptSend(n.id, to, n.type, n.payload);
    if (ok) succeeded += 1;
  }
  return { checked: pending.length, succeeded };
}

module.exports = { queueAndSend, retryFailedNotifications };
