const express = require('express');
const router = express.Router();

// Home page - redirect to dashboard if authenticated, otherwise show landing page
router.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  
  res.render('index', {
    title: req.t('general.welcome'),
    layout: 'layout'
  });
});

// Language switcher
router.post('/language', (req, res) => {
  const { language } = req.body;
  const supportedLanguages = require('../config/config').i18n.supportedLanguages;
  
  if (supportedLanguages.includes(language)) {
    req.session.language = language;
    
    // Update user preference if logged in
    if (req.isAuthenticated()) {
      req.user.update({ language: language })
        .catch(err => console.error('Failed to update user language:', err));
    }
  }
  
  res.redirect('back');
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;