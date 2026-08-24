const nodemailer = require('nodemailer');
const logger = require('../config/logger');

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) {
    logger.warn('SMTP_HOST not set — emails will be logged, not sent');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

const templates = {
  BOOKING_CONFIRMATION: ({ recipientName, otherPartyName, startTime, role }) => ({
    subject: 'Appointment confirmed',
    body:
      `Hi ${recipientName},\n\n` +
      `Your appointment ${role === 'patient' ? `with Dr. ${otherPartyName}` : `with patient ${otherPartyName}`} ` +
      `is confirmed for ${new Date(startTime).toLocaleString()}.\n\n` +
      `A calendar invite has been sent separately. See you then.\n\nClinic Appointments`,
  }),
  REMINDER: ({ recipientName, otherPartyName, startTime, role }) => ({
    subject: 'Appointment reminder',
    body:
      `Hi ${recipientName},\n\n` +
      `Reminder: your appointment ${role === 'patient' ? `with Dr. ${otherPartyName}` : `with patient ${otherPartyName}`} ` +
      `is coming up on ${new Date(startTime).toLocaleString()}.\n\nClinic Appointments`,
  }),
  CANCELLATION: ({ recipientName, otherPartyName, startTime, reason }) => ({
    subject: 'Appointment cancelled',
    body:
      `Hi ${recipientName},\n\n` +
      `Your appointment with ${otherPartyName} on ${new Date(startTime).toLocaleString()} has been cancelled.` +
      `${reason ? ` Reason: ${reason}` : ''}\n\nPlease book a new slot at your convenience.\n\nClinic Appointments`,
  }),
  DOCTOR_LEAVE: ({ recipientName, otherPartyName, startTime }) => ({
    subject: 'Your appointment needs to be rescheduled',
    body:
      `Hi ${recipientName},\n\n` +
      `Dr. ${otherPartyName} is unavailable on ${new Date(startTime).toLocaleDateString()}, so your appointment ` +
      `originally scheduled for ${new Date(startTime).toLocaleString()} has been cancelled. ` +
      `We're sorry for the inconvenience — please rebook a new slot.\n\nClinic Appointments`,
  }),
  MEDICATION_REMINDER: ({ recipientName, drug, dose }) => ({
    subject: `Medication reminder: ${drug}`,
    body: `Hi ${recipientName},\n\nThis is a reminder to take your medication: ${drug} (${dose}).\n\nClinic Appointments`,
  }),
};

/**
 * Sends an email and returns { ok, error }. Never throws — callers (the
 * notification queue) are responsible for recording status and retrying.
 */
async function sendEmail(to, type, context) {
  const build = templates[type];
  if (!build) return { ok: false, error: `Unknown email template: ${type}` };
  const { subject, body } = build(context);

  const t = getTransporter();
  if (!t) {
    logger.info(`[email:not-configured] to=${to} subject="${subject}"`);
    return { ok: false, error: 'SMTP not configured' };
  }

  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@clinic.example',
      to,
      subject,
      text: body,
    });
    return { ok: true };
  } catch (err) {
    logger.error('Email send failed', { message: err.message, to, type });
    return { ok: false, error: err.message };
  }
}

module.exports = { sendEmail, templates };
