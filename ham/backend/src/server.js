require('dotenv').config();
const app = require('./app');
const logger = require('./config/logger');
const reminderJob = require('./jobs/reminderJob');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  logger.info(`Healthcare Appointment Manager API listening on port ${PORT}`);
  reminderJob.start();
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection', { message: err.message, stack: err.stack });
});
