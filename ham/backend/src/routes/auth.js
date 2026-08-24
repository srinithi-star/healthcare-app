const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { validate, schemas } = require('../utils/validators');
const { requireAuth } = require('../middleware/auth');

router.post('/register', validate(schemas.register), ctrl.register);
router.post('/login', validate(schemas.login), ctrl.login);
router.get('/me', requireAuth, ctrl.me);

module.exports = router;
