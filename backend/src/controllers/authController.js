// src/controllers/authController.js
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usersDao = require('../dao/usersDao');
const { JWT_SECRET, DEMO_VULN } = require('../config');

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().allow('', null).optional(),
  role: Joi.string().valid('admin', 'user').default('user'),
});

// POST /login
async function login(req, res, next) {
  try {
    const { error, value = {} } = loginSchema.validate(req.body || {}, {
      abortEarly: true,
      stripUnknown: true,
    });

    if (error) return res.status(400).json({ error: error.details[0].message });

    const user = await usersDao.getUserByEmail(value.email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(value.password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { sub: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '4h' }
    );

    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });

  } catch (err) {
    next(err);
  }
}

// POST /register
async function register(req, res, next) {
  try {
    const { error, value = {} } = registerSchema.validate(req.body || {}, {
      abortEarly: true,
      stripUnknown: true,
    });

    if (error) return res.status(400).json({ error: error.details[0].message });

    const existing = await usersDao.getUserByEmail(value.email);
    if (existing) return res.status(400).json({ error: 'Email already in use' });

    const hash = await bcrypt.hash(value.password, 10);

    const newUser = await usersDao.createUser({
      email: value.email,
      password_hash: hash,
      name: value.name,
      role: value.role,
    });

    return res.status(201).json({ user: newUser });

  } catch (err) {
    next(err);
  }
}

// POST /demo/raw-login  (SQL Injection Demo)
async function demoRawLogin(req, res, next) {
  if (!DEMO_VULN) {
    return res.status(403).json({ error: 'Demo mode disabled' });
  }

  try {
    const { email, password } = req.body || {};

    // intentional SQL injection vulnerability
    const user = await usersDao.rawLogin(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // naive compare (for demo only)
    if (password !== user.password_hash)
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '4h' });

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });

  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  register,
  demoRawLogin,
};
