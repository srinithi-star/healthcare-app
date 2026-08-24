const calendarService = require('../services/calendarService');

// Returns the Google consent URL for the logged-in user to visit.
async function connect(req, res) {
  const url = calendarService.getAuthUrl(req.user.id);
  res.json({ url });
}

// Google redirects here after consent. We exchange the code for tokens,
// then bounce the browser back to the frontend.
async function callback(req, res) {
  const { code, state } = req.query;
  try {
    await calendarService.handleOAuthCallback(code, state);
    res.redirect(`${process.env.FRONTEND_URL}/settings?calendar=connected`);
  } catch (err) {
    res.redirect(`${process.env.FRONTEND_URL}/settings?calendar=error`);
  }
}

module.exports = { connect, callback };
