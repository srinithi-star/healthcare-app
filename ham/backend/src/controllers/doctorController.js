const prisma = require('../config/prisma');
const { getAvailableSlots } = require('../services/slotService');

async function searchDoctors(req, res) {
  const { specialisation } = req.query;
  const doctors = await prisma.doctorProfile.findMany({
    where: specialisation
      ? { specialisation: { contains: specialisation, mode: 'insensitive' } }
      : undefined,
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  res.json({ doctors });
}

async function getDoctor(req, res) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      workingHours: true,
    },
  });
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  res.json({ doctor });
}

async function listSlots(req, res) {
  const { date } = req.query; // YYYY-MM-DD
  if (!date) return res.status(400).json({ error: 'date query param (YYYY-MM-DD) is required' });
  const result = await getAvailableSlots(req.params.id, date);
  res.json(result);
}

module.exports = { searchDoctors, getDoctor, listSlots };
