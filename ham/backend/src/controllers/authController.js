const prisma = require('../config/prisma');
const { hashPassword, verifyPassword, signToken } = require('../utils/auth');

// Public self-registration is for patients only. Doctor and admin accounts
// are provisioned deliberately (see adminController) so a clinic controls
// who can act as clinical staff.
async function register(req, res) {
  const { email, password, firstName, lastName, phone } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, firstName, lastName, phone, role: 'PATIENT' },
  });

  const token = signToken(user);
  res.status(201).json({ token, user: sanitize(user) });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const token = signToken(user);
  res.json({ token, user: sanitize(user) });
}

async function me(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({ user: sanitize(user) });
}

function sanitize(user) {
  const { passwordHash, googleAccessToken, googleRefreshToken, ...safe } = user;
  return { ...safe, googleCalendarConnected: Boolean(user.googleRefreshToken) };
}

module.exports = { register, login, me };
