const { google } = require('googleapis');
const prisma = require('../config/prisma');
const logger = require('../config/logger');

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Step 1 of OAuth: URL the frontend redirects the user to.
function getAuthUrl(userId) {
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: 'offline', // needed to receive a refresh_token
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state: userId, // so the callback knows which user to attach tokens to
  });
}

// Step 2: exchange the code Google redirected back with for tokens, store them.
async function handleOAuthCallback(code, userId) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token || undefined, // Google only sends this on first consent
      googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
  });
}

async function clientForUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.googleRefreshToken) return null; // user hasn't connected Google Calendar

  const client = oauthClient();
  client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
    expiry_date: user.googleTokenExpiry?.getTime(),
  });

  // Persist refreshed access tokens so we don't re-hit the token endpoint every call.
  client.on('tokens', async (tokens) => {
    const data = {};
    if (tokens.access_token) data.googleAccessToken = tokens.access_token;
    if (tokens.expiry_date) data.googleTokenExpiry = new Date(tokens.expiry_date);
    if (Object.keys(data).length) {
      await prisma.user.update({ where: { id: userId }, data }).catch(() => {});
    }
  });

  return client;
}

/**
 * Creates a calendar event for one user. Returns the Google event id, or
 * null if the user hasn't connected Google Calendar or the call fails —
 * calendar sync is a nice-to-have, never a reason to block a booking.
 */
async function createEvent(userId, { summary, description, startTime, endTime }) {
  try {
    const auth = await clientForUser(userId);
    if (!auth) return null;
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        description,
        start: { dateTime: new Date(startTime).toISOString() },
        end: { dateTime: new Date(endTime).toISOString() },
        reminders: { useDefault: true },
      },
    });
    return res.data.id;
  } catch (err) {
    logger.error('Google Calendar createEvent failed', { message: err.message, userId });
    return null;
  }
}

async function updateEvent(userId, eventId, { summary, description, startTime, endTime }) {
  if (!eventId) return null;
  try {
    const auth = await clientForUser(userId);
    if (!auth) return null;
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        summary,
        description,
        start: { dateTime: new Date(startTime).toISOString() },
        end: { dateTime: new Date(endTime).toISOString() },
      },
    });
    return eventId;
  } catch (err) {
    logger.error('Google Calendar updateEvent failed', { message: err.message, userId, eventId });
    return null;
  }
}

async function deleteEvent(userId, eventId) {
  if (!eventId) return;
  try {
    const auth = await clientForUser(userId);
    if (!auth) return;
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId: 'primary', eventId });
  } catch (err) {
    // 410/404 just means it's already gone — not worth surfacing.
    logger.warn('Google Calendar deleteEvent failed (may already be deleted)', { message: err.message });
  }
}

module.exports = { getAuthUrl, handleOAuthCallback, createEvent, updateEvent, deleteEvent };
