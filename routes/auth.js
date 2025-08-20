const express = require('express');
const passport = require('passport');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { User } = require('../models');
const { redirectIfAuthenticated, ensureAuthenticated } = require('../middleware/auth');
const { validateRegistration, validateLogin, validatePasswordReset, validatePasswordChange, handleValidationErrors } = require('../utils/validation');
const { sendEmail } = require('../utils/notifications');
const router = express.Router();

// Registration page
router.get('/register', redirectIfAuthenticated, (req, res) => {
  res.render('auth/register', {
    title: req.t('auth.register'),
    layout: 'auth-layout'
  });
});

// Registration handler
router.post('/register', redirectIfAuthenticated, validateRegistration, handleValidationErrors, async (req, res) => {
  try {
    const { email, password, first_name, last_name, department, position } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      req.flash('error_msg', req.t('auth.email_already_exists'));
      return res.redirect('/auth/register');
    }

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      first_name,
      last_name,
      department: department || null,
      position: position || null,
      language: req.language || 'pl'
    });

    // Send welcome email
    await sendEmail({
      to_email: user.email,
      subject: req.t('email.welcome_subject'),
      body: req.t('email.welcome_body', { 
        name: user.first_name,
        portal_url: process.env.BASE_URL || 'http://localhost:3000'
      })
    });

    req.flash('success_msg', req.t('auth.registration_success'));
    res.redirect('/auth/login');
  } catch (error) {
    console.error('Registration error:', error);
    req.flash('error_msg', req.t('auth.registration_error'));
    res.redirect('/auth/register');
  }
});

// Login page
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('auth/login', {
    title: req.t('auth.login'),
    layout: 'auth-layout'
  });
});

// Login handler
router.post('/login', redirectIfAuthenticated, validateLogin, handleValidationErrors, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.error('Login error:', err);
      req.flash('error_msg', req.t('auth.login_error'));
      return res.redirect('/auth/login');
    }
    
    if (!user) {
      req.flash('error_msg', info.message || req.t('auth.invalid_credentials'));
      return res.redirect('/auth/login');
    }

    req.logIn(user, async (err) => {
      if (err) {
        console.error('Login session error:', err);
        req.flash('error_msg', req.t('auth.login_error'));
        return res.redirect('/auth/login');
      }

      // Update last login time
      try {
        await user.update({ last_login: new Date() });
      } catch (error) {
        console.error('Failed to update last login:', error);
      }

      // Set language preference
      if (user.language) {
        req.session.language = user.language;
      }

      req.flash('success_msg', req.t('auth.login_success'));
      const redirectTo = req.session.returnTo || '/dashboard';
      delete req.session.returnTo;
      res.redirect(redirectTo);
    });
  })(req, res, next);
});

// Logout handler
router.post('/logout', ensureAuthenticated, (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    req.flash('success_msg', req.t('auth.logout_success'));
    res.redirect('/');
  });
});

// Password reset request page
router.get('/forgot-password', redirectIfAuthenticated, (req, res) => {
  res.render('auth/forgot-password', {
    title: req.t('auth.forgot_password'),
    layout: 'auth-layout'
  });
});

// Password reset request handler
router.post('/forgot-password', redirectIfAuthenticated, validatePasswordReset, handleValidationErrors, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email: email.toLowerCase(), is_active: true } });

    if (!user) {
      req.flash('success_msg', req.t('auth.password_reset_sent'));
      return res.redirect('/auth/login');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await user.update({
      password_reset_token: resetToken,
      password_reset_expires: resetExpires
    });

    // Send reset email
    const resetUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/auth/reset-password/${resetToken}`;
    await sendEmail({
      to_email: user.email,
      subject: req.t('email.password_reset_subject'),
      body: req.t('email.password_reset_body', {
        name: user.first_name,
        reset_url: resetUrl
      })
    });

    req.flash('success_msg', req.t('auth.password_reset_sent'));
    res.redirect('/auth/login');
  } catch (error) {
    console.error('Password reset error:', error);
    req.flash('error_msg', req.t('auth.password_reset_error'));
    res.redirect('/auth/forgot-password');
  }
});

// Password reset form page
router.get('/reset-password/:token', redirectIfAuthenticated, async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({
      where: {
        password_reset_token: token,
        password_reset_expires: { [require('sequelize').Op.gt]: new Date() },
        is_active: true
      }
    });

    if (!user) {
      req.flash('error_msg', req.t('auth.invalid_reset_token'));
      return res.redirect('/auth/forgot-password');
    }

    res.render('auth/reset-password', {
      title: req.t('auth.reset_password'),
      layout: 'auth-layout',
      token
    });
  } catch (error) {
    console.error('Password reset page error:', error);
    req.flash('error_msg', req.t('auth.reset_error'));
    res.redirect('/auth/forgot-password');
  }
});

// Password reset handler
router.post('/reset-password/:token', redirectIfAuthenticated, async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      req.flash('error_msg', req.t('auth.passwords_dont_match'));
      return res.redirect(`/auth/reset-password/${token}`);
    }

    if (password.length < 8) {
      req.flash('error_msg', req.t('auth.password_too_short'));
      return res.redirect(`/auth/reset-password/${token}`);
    }

    const user = await User.findOne({
      where: {
        password_reset_token: token,
        password_reset_expires: { [require('sequelize').Op.gt]: new Date() },
        is_active: true
      }
    });

    if (!user) {
      req.flash('error_msg', req.t('auth.invalid_reset_token'));
      return res.redirect('/auth/forgot-password');
    }

    await user.update({
      password,
      password_reset_token: null,
      password_reset_expires: null
    });

    req.flash('success_msg', req.t('auth.password_reset_success'));
    res.redirect('/auth/login');
  } catch (error) {
    console.error('Password reset handler error:', error);
    req.flash('error_msg', req.t('auth.reset_error'));
    res.redirect('/auth/forgot-password');
  }
});

// Profile page
router.get('/profile', ensureAuthenticated, (req, res) => {
  res.render('auth/profile', {
    title: req.t('auth.profile'),
    user: req.user
  });
});

// Profile update handler
router.post('/profile', ensureAuthenticated, async (req, res) => {
  try {
    const { first_name, last_name, department, position, language } = req.body;
    const supportedLanguages = require('../config/config').i18n.supportedLanguages;

    await req.user.update({
      first_name,
      last_name,
      department: department || null,
      position: position || null,
      language: supportedLanguages.includes(language) ? language : req.user.language
    });

    // Update session language
    if (supportedLanguages.includes(language)) {
      req.session.language = language;
    }

    req.flash('success_msg', req.t('auth.profile_updated'));
    res.redirect('/auth/profile');
  } catch (error) {
    console.error('Profile update error:', error);
    req.flash('error_msg', req.t('auth.profile_update_error'));
    res.redirect('/auth/profile');
  }
});

// Change password handler
router.post('/change-password', ensureAuthenticated, validatePasswordChange, handleValidationErrors, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, req.user.password);
    if (!isCurrentPasswordValid) {
      req.flash('error_msg', req.t('auth.invalid_current_password'));
      return res.redirect('/auth/profile');
    }

    await req.user.update({ password: newPassword });

    req.flash('success_msg', req.t('auth.password_changed'));
    res.redirect('/auth/profile');
  } catch (error) {
    console.error('Password change error:', error);
    req.flash('error_msg', req.t('auth.password_change_error'));
    res.redirect('/auth/profile');
  }
});

module.exports = router;