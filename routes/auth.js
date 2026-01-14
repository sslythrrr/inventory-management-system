// middlewares/auth.js
const db = require('../db.js');
const logger = require('../utils/logger');

const requireLogin = async (req, res, next) => {
  if (req.session && (req.session.email || req.session.atasanEmail)) {
    if (req.session.email) {
      try {
        const [adminRows] = await db.query(
          'SELECT id_admin FROM Admin WHERE email = ?',
          [req.session.email]
        );
        if (adminRows.length > 0) {
          req.adminId = adminRows[0].id_admin;
          return next();
        } else {
          return res.redirect('/login');
        }
      } catch (error) {
        logger.error('Error fetching admin:', error);
        return res.redirect('/login');
      }
    }
    if (req.session.atasanEmail) {
      try {
        const [atasanRows] = await db.query(
          'SELECT id_atasan FROM atasan WHERE email = ?',
          [req.session.atasanEmail]
        );
        if (atasanRows.length > 0) {
          req.atasanId = atasanRows[0].id_atasan;
          return next();
        } else {
          return res.redirect('/atasan/login');
        }
      } catch (error) {
        logger.error('Error fetching atasan:', error);
        return res.redirect('/atasan/login');
      }
    }
  } else {
    return res.redirect('/login');
  }
};

const requireAtasanLogin = async (req, res, next) => {
  if (req.session && req.session.atasanEmail) {
    try {
      const [atasanRows] = await db.query(
        'SELECT id_atasan FROM atasan WHERE email = ?',
        [req.session.atasanEmail]
      );

      if (atasanRows.length > 0) {
        req.atasanId = atasanRows[0].id_atasan;
        next();
      } else {
        res.redirect('/atasan/login');
      }
    } catch (error) {
      logger.error('Error fetching atasan:', error);
      res.redirect('/atasan/login');
    }
  } else {
    res.redirect('/atasan/login');
  }
};

module.exports = { requireLogin, requireAtasanLogin };
