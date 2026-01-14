const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db.js');
const logger = require('../utils/logger');

router.get('/', (req, res) => {
  if (req.session.email) {
    res.redirect('/dashboard');
  }
  res.render('login', { title: 'Login', error: null });
});

router.post('/', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await db.query(
        'SELECT * FROM admin WHERE email = ?',
        [email]
      );

    if (rows.length === 0) {
      return res.json({ success: false, message: 'Email atau password salah atau tidak terdaftar sebagai admin.' });
    }

    const isMatch = await bcrypt.compare(password, rows[0].password);
    if (!isMatch) {
      return res.json({ success: false, message: 'Email atau password salah atau tidak terdaftar sebagai admin.' });
    }

    req.session.email = email;
    req.session.userId = rows[0].id_admin;
    req.session.role = 'admin';
    res.json({ success: true, message: 'Login berhasil' });

  } catch (error) {
    logger.error('Login error:', error);
    res.json({ success: false, message: 'Terjadi kesalahan sistem' });
  }
});

module.exports = router;