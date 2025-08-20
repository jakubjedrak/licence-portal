const express = require('express');
const { Op } = require('sequelize');
const { User, Ticket, CatalogItem, AuditLog, EmailQueue, Notification } = require('../models');
const { ensureAdmin, ensureSystemAdmin } = require('../middleware/auth');
const { auditLog, captureOldValues } = require('../middleware/audit');
const router = express.Router();

// Admin dashboard
router.get('/', ensureAdmin, async (req, res) => {
  try {
    // Get system statistics
    const userStats = await User.findAll({
      attributes: [
        'role',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['role'],
      raw: true
    });

    const ticketStats = await Ticket.findAll({
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const totalCatalogItems = await CatalogItem.count();
    const activeCatalogItems = await CatalogItem.count({ where: { is_active: true } });

    // Recent activity
    const recentLogs = await AuditLog.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['first_name', 'last_name'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 10
    });

    res.render('admin/index', {
      title: req.t('admin.administration'),
      userStats,
      ticketStats,
      totalCatalogItems,
      activeCatalogItems,
      recentLogs
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.render('admin/index', {
      title: req.t('admin.administration'),
      userStats: [],
      ticketStats: [],
      totalCatalogItems: 0,
      activeCatalogItems: 0,
      recentLogs: []
    });
  }
});

// User management
router.get('/users', ensureAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { role, active, search } = req.query;

    let whereClause = {};

    if (role && role !== 'all') {
      whereClause.role = role;
    }
    if (active !== undefined && active !== 'all') {
      whereClause.is_active = active === 'true';
    }
    if (search) {
      whereClause[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { department: { [Op.like]: `%${search}%` } }
      ];
    }

    const { rows: users, count } = await User.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['password', 'password_reset_token'] },
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    res.render('admin/users', {
      title: req.t('admin.user_management'),
      users,
      currentPage: page,
      totalPages,
      totalCount: count,
      limit,
      filters: { role, active, search }
    });
  } catch (error) {
    console.error('User management error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.redirect('/admin');
  }
});

// Update user role (system admin only)
router.patch('/users/:id/role', ensureSystemAdmin, captureOldValues(User), auditLog('update_role', 'user'), async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['employee', 'license_admin', 'system_admin'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: req.t('auth.user_not_found') });
    }

    await user.update({ role });

    res.json({ success: true, message: req.t('admin.role_updated') });
  } catch (error) {
    console.error('Role update error:', error);
    res.status(500).json({ success: false, message: req.t('error.generic') });
  }
});

// Toggle user active status (system admin only)
router.patch('/users/:id/status', ensureSystemAdmin, captureOldValues(User), auditLog('update_status', 'user'), async (req, res) => {
  try {
    const { is_active } = req.body;

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: req.t('auth.user_not_found') });
    }

    await user.update({ is_active: is_active === 'true' });

    const message = is_active === 'true' ? req.t('admin.user_activated') : req.t('admin.user_deactivated');
    res.json({ success: true, message });
  } catch (error) {
    console.error('User status update error:', error);
    res.status(500).json({ success: false, message: req.t('error.generic') });
  }
});

// Ticket management
router.get('/tickets', ensureAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { status, priority, assigned_to, search } = req.query;

    let whereClause = {};

    if (status && status !== 'all') {
      whereClause.status = status;
    }
    if (priority && priority !== 'all') {
      whereClause.priority = priority;
    }
    if (assigned_to && assigned_to !== 'all') {
      if (assigned_to === 'unassigned') {
        whereClause.assigned_to = null;
      } else {
        whereClause.assigned_to = assigned_to;
      }
    }
    if (search) {
      whereClause[Op.or] = [
        { ticket_number: { [Op.like]: `%${search}%` } },
        { title: { [Op.like]: `%${search}%` } }
      ];
    }

    const { rows: tickets, count } = await Ticket.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['first_name', 'last_name', 'email']
        },
        {
          model: User,
          as: 'assignee',
          attributes: ['first_name', 'last_name'],
          required: false
        },
        {
          model: CatalogItem,
          as: 'catalog_item',
          attributes: ['name']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    // Get assignees for filter
    const assignees = await User.findAll({
      where: { role: ['license_admin', 'system_admin'], is_active: true },
      attributes: ['id', 'first_name', 'last_name'],
      order: [['first_name', 'ASC']]
    });

    res.render('admin/tickets', {
      title: req.t('admin.ticket_management'),
      tickets,
      assignees,
      currentPage: page,
      totalPages,
      totalCount: count,
      limit,
      filters: { status, priority, assigned_to, search }
    });
  } catch (error) {
    console.error('Ticket management error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.redirect('/admin');
  }
});

// Bulk ticket actions
router.post('/tickets/bulk', ensureAdmin, auditLog('bulk_action', 'ticket'), async (req, res) => {
  try {
    const { action, ticket_ids, assigned_to, status } = req.body;

    if (!ticket_ids || !Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      req.flash('error_msg', req.t('admin.no_tickets_selected'));
      return res.redirect('/admin/tickets');
    }

    const tickets = await Ticket.findAll({
      where: { id: ticket_ids }
    });

    if (tickets.length === 0) {
      req.flash('error_msg', req.t('tickets.not_found'));
      return res.redirect('/admin/tickets');
    }

    let updateData = {};
    let successMessage = '';

    switch (action) {
      case 'assign':
        if (assigned_to) {
          updateData.assigned_to = assigned_to === 'null' ? null : parseInt(assigned_to);
          successMessage = req.t('admin.tickets_assigned');
        }
        break;
      case 'status':
        if (status) {
          updateData.status = status;
          if (status === 'completed') {
            updateData.completed_date = new Date();
          }
          successMessage = req.t('admin.tickets_status_updated');
        }
        break;
      default:
        req.flash('error_msg', req.t('admin.invalid_action'));
        return res.redirect('/admin/tickets');
    }

    if (Object.keys(updateData).length > 0) {
      await Ticket.update(updateData, {
        where: { id: ticket_ids }
      });

      req.flash('success_msg', successMessage);
    }

    res.redirect('/admin/tickets');
  } catch (error) {
    console.error('Bulk ticket action error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.redirect('/admin/tickets');
  }
});

// Audit logs
router.get('/audit', ensureSystemAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const { action, resource_type, user_id, date_from, date_to } = req.query;

    let whereClause = {};

    if (action && action !== 'all') {
      whereClause.action = action;
    }
    if (resource_type && resource_type !== 'all') {
      whereClause.resource_type = resource_type;
    }
    if (user_id && user_id !== 'all') {
      whereClause.user_id = user_id;
    }
    if (date_from) {
      whereClause.created_at = { [Op.gte]: new Date(date_from) };
    }
    if (date_to) {
      if (whereClause.created_at) {
        whereClause.created_at[Op.lte] = new Date(date_to);
      } else {
        whereClause.created_at = { [Op.lte]: new Date(date_to) };
      }
    }

    const { rows: auditLogs, count } = await AuditLog.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['first_name', 'last_name', 'email'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    // Get users for filter
    const users = await User.findAll({
      attributes: ['id', 'first_name', 'last_name'],
      order: [['first_name', 'ASC']]
    });

    res.render('admin/audit', {
      title: req.t('admin.audit_logs'),
      auditLogs,
      users,
      currentPage: page,
      totalPages,
      totalCount: count,
      limit,
      filters: { action, resource_type, user_id, date_from, date_to }
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.redirect('/admin');
  }
});

// Email queue monitoring
router.get('/email-queue', ensureSystemAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { status } = req.query;

    let whereClause = {};
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    const { rows: emails, count } = await EmailQueue.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    res.render('admin/email-queue', {
      title: req.t('admin.email_queue'),
      emails,
      currentPage: page,
      totalPages,
      totalCount: count,
      limit,
      filters: { status }
    });
  } catch (error) {
    console.error('Email queue error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.redirect('/admin');
  }
});

// System settings
router.get('/settings', ensureSystemAdmin, (req, res) => {
  const config = require('../config/config');
  
  res.render('admin/settings', {
    title: req.t('admin.system_settings'),
    config: {
      defaultLanguage: config.i18n.defaultLanguage,
      supportedLanguages: config.i18n.supportedLanguages,
      maxFileSize: config.upload.maxFileSize,
      allowedDomain: config.email.allowedDomain
    }
  });
});

// Generate reports
router.get('/reports', ensureAdmin, async (req, res) => {
  try {
    const { type, date_from, date_to, format } = req.query;

    if (!type || !date_from || !date_to) {
      return res.render('admin/reports', {
        title: req.t('admin.reports'),
        data: null,
        filters: { type, date_from, date_to, format }
      });
    }

    const dateRange = {
      created_at: {
        [Op.gte]: new Date(date_from),
        [Op.lte]: new Date(date_to)
      }
    };

    let data = [];
    let headers = [];

    switch (type) {
      case 'tickets':
        data = await Ticket.findAll({
          where: dateRange,
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['first_name', 'last_name', 'email']
            },
            {
              model: CatalogItem,
              as: 'catalog_item',
              attributes: ['name', 'type']
            }
          ],
          order: [['created_at', 'DESC']]
        });
        headers = ['Ticket Number', 'Title', 'Status', 'Priority', 'User', 'Software/Service', 'Created', 'Estimated Savings'];
        break;

      case 'savings':
        data = await Ticket.findAll({
          where: {
            ...dateRange,
            status: 'completed',
            confirmed_savings: { [Op.gt]: 0 }
          },
          include: [
            {
              model: CatalogItem,
              as: 'catalog_item',
              attributes: ['name']
            }
          ],
          order: [['completed_date', 'DESC']]
        });
        headers = ['Ticket Number', 'Software/Service', 'Estimated Savings', 'Confirmed Savings', 'Completed Date'];
        break;

      case 'users':
        data = await User.findAll({
          where: dateRange,
          attributes: { exclude: ['password', 'password_reset_token'] },
          order: [['created_at', 'DESC']]
        });
        headers = ['Name', 'Email', 'Role', 'Department', 'Status', 'Created'];
        break;

      default:
        req.flash('error_msg', 'Invalid report type');
        return res.redirect('/admin/reports');
    }

    if (format === 'csv') {
      let csvContent = headers.join(',') + '\n';
      
      data.forEach(item => {
        let row = [];
        switch (type) {
          case 'tickets':
            row = [
              item.ticket_number,
              `"${item.title}"`,
              item.status,
              item.priority,
              `"${item.user.first_name} ${item.user.last_name}"`,
              `"${item.catalog_item.name}"`,
              item.created_at.toISOString().split('T')[0],
              item.estimated_savings || 0
            ];
            break;
          case 'savings':
            row = [
              item.ticket_number,
              `"${item.catalog_item.name}"`,
              item.estimated_savings || 0,
              item.confirmed_savings || 0,
              item.completed_date ? item.completed_date.toISOString().split('T')[0] : ''
            ];
            break;
          case 'users':
            row = [
              `"${item.first_name} ${item.last_name}"`,
              item.email,
              item.role,
              `"${item.department || ''}"`,
              item.is_active ? 'Active' : 'Inactive',
              item.created_at.toISOString().split('T')[0]
            ];
            break;
        }
        csvContent += row.join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${type}-report-${date_from}-${date_to}.csv`);
      return res.send(csvContent);
    }

    res.render('admin/reports', {
      title: req.t('admin.reports'),
      data,
      headers,
      filters: { type, date_from, date_to, format }
    });
  } catch (error) {
    console.error('Reports error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.redirect('/admin');
  }
});

module.exports = router;