const logger = require('../config/logger');

// Prisma throws structured errors with a `code` — we translate the common
// ones into clean HTTP responses instead of leaking internals to the client.
function errorHandler(err, req, res, next) {
  logger.error(err.message, { stack: err.stack, path: req.path });

  if (err.code === 'P2002') {
    // Unique constraint violation — this is exactly what fires when two
    // requests race to book the same doctor/startTime slot.
    return res.status(409).json({
      error: 'That slot was just taken by another booking. Please pick a different time.',
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Requested record was not found.' });
  }

  if (err.isJoi) {
    return res.status(400).json({ error: err.details.map((d) => d.message).join('; ') });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
  });
}

module.exports = errorHandler;
