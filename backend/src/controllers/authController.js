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

    if (!user) {
      await req.audit.commit({
        action: 'LOGIN_FAIL',
        meta: { email: value.email, reason: 'USER_NOT_FOUND' },
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(value.password, user.password_hash);
    if (!ok) {
      // nastavíme req.user kvůli logs.user_id (jinak by bylo NULL)
      req.user = { id: user.id, role: user.role };

      await req.audit.commit({
        action: 'LOGIN_FAIL',
        meta: { email: value.email, reason: 'BAD_PASSWORD' },
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '4h' }
    );

    // nastavíme req.user kvůli logs.user_id
    req.user = { id: user.id, role: user.role };

    await req.audit.commit({
      action: 'LOGIN_SUCCESS',
      meta: { email: user.email, role: user.role },
    });

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
    if (existing) {
      await req.audit.commit({
        action: 'REGISTER_FAIL',
        meta: { email: value.email, reason: 'EMAIL_IN_USE' },
      });
      return res.status(400).json({ error: 'Email already in use' });
    }

    const hash = await bcrypt.hash(value.password, 10);

    const newUser = await usersDao.createUser({
      email: value.email,
      password_hash: hash,
      name: value.name,
      role: value.role,
    });

    if (!newUser) {
      await req.audit.commit({
        action: 'REGISTER_FAIL',
        meta: { email: value.email, reason: 'CREATE_FAILED' },
      });
      return res.status(500).json({ error: 'Failed to create user' });
    }

    // tady typicky req.user ještě není (registrace je veřejná)
    // ale můžeme si ho nastavit, aby logs.user_id mělo hodnotu
    req.user = { id: newUser.id, role: newUser.role };

    await req.audit.commit({
      action: 'REGISTER_SUCCESS',
      meta: { email: newUser.email, role: newUser.role },
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
    if (!user) {
      await req.audit.commit({
        action: 'DEMO_RAW_LOGIN_FAIL',
        meta: { email: email ?? null, reason: 'USER_NOT_FOUND_OR_QUERY_FAILED' },
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // naive compare (for demo only)
    if (password !== user.password_hash) {
      req.user = { id: user.id, role: user.role };

      await req.audit.commit({
        action: 'DEMO_RAW_LOGIN_FAIL',
        meta: { email: user.email, reason: 'BAD_PASSWORD_NAIVE' },
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '4h' }
    );

    req.user = { id: user.id, role: user.role };

    await req.audit.commit({
      action: 'DEMO_RAW_LOGIN_SUCCESS',
      meta: { email: user.email, role: user.role },
    });

    return res.json({
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