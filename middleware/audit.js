const { AuditLog } = require('../models');

// Audit logging middleware
function auditLog(action, resourceType) {
  return async function(req, res, next) {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the action after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setImmediate(async () => {
          try {
            await AuditLog.logAction({
              user_id: req.user ? req.user.id : null,
              action: action,
              resource_type: resourceType,
              resource_id: req.params.id || req.body.id || null,
              old_values: req.auditOldValues || null,
              new_values: req.auditNewValues || null,
              ip_address: req.ip || req.connection.remoteAddress,
              user_agent: req.get('User-Agent'),
              details: `${req.method} ${req.originalUrl}`
            });
          } catch (error) {
            console.error('Audit logging failed:', error);
          }
        });
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
}

// Helper to capture old values before update/delete
function captureOldValues(model) {
  return async function(req, res, next) {
    try {
      if (req.params.id && ['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const record = await model.findByPk(req.params.id);
        if (record) {
          req.auditOldValues = record.toJSON();
        }
      }
    } catch (error) {
      console.error('Failed to capture old values:', error);
    }
    next();
  };
}

// Helper to capture new values after create/update
function captureNewValues() {
  return function(req, res, next) {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      req.auditNewValues = req.body;
    }
    next();
  };
}

module.exports = {
  auditLog,
  captureOldValues,
  captureNewValues
};