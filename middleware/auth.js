// Authentication middleware
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error_msg', req.t('auth.login_required'));
  res.redirect('/auth/login');
}

// Role-based authorization middleware
function ensureRole(roles) {
  return function(req, res, next) {
    if (!req.isAuthenticated()) {
      req.flash('error_msg', req.t('auth.login_required'));
      return res.redirect('/auth/login');
    }

    if (!Array.isArray(roles)) {
      roles = [roles];
    }

    if (!roles.includes(req.user.role)) {
      req.flash('error_msg', req.t('auth.access_denied'));
      return res.redirect('/dashboard');
    }

    next();
  };
}

// Check if user is admin (license_admin or system_admin)
function ensureAdmin(req, res, next) {
  return ensureRole(['license_admin', 'system_admin'])(req, res, next);
}

// Check if user is system admin
function ensureSystemAdmin(req, res, next) {
  return ensureRole(['system_admin'])(req, res, next);
}

// Prevent authenticated users from accessing auth pages
function redirectIfAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = {
  ensureAuthenticated,
  ensureRole,
  ensureAdmin,
  ensureSystemAdmin,
  redirectIfAuthenticated
};