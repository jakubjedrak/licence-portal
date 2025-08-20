const express = require('express');
const { Op } = require('sequelize');
const { User, Ticket, CatalogItem, Notification } = require('../models');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');
const router = express.Router();

// Get user notifications
router.get('/notifications', ensureAuthenticated, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const unread_only = req.query.unread_only === 'true';

    let whereClause = { user_id: req.user.id };
    if (unread_only) {
      whereClause.is_read = false;
    }

    const { rows: notifications, count } = await Notification.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const unreadCount = await Notification.count({
      where: { user_id: req.user.id, is_read: false }
    });

    res.json({
      success: true,
      notifications,
      count,
      unreadCount,
      hasMore: offset + limit < count
    });
  } catch (error) {
    console.error('Notifications API error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.patch('/notifications/:id/read', ensureAuthenticated, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.id, user_id: req.user.id }
    });

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    await notification.update({ is_read: true });

    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/notifications/read-all', ensureAuthenticated, async (req, res) => {
  try {
    await Notification.update(
      { is_read: true },
      { where: { user_id: req.user.id, is_read: false } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark notifications as read' });
  }
});

// Search tickets
router.get('/tickets/search', ensureAuthenticated, async (req, res) => {
  try {
    const { q, status, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, tickets: [] });
    }

    let whereClause = {
      [Op.or]: [
        { ticket_number: { [Op.like]: `%${q}%` } },
        { title: { [Op.like]: `%${q}%` } }
      ]
    };

    // Non-admin users can only see their own tickets
    if (!req.user.isAdmin()) {
      whereClause.user_id = req.user.id;
    }

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    const tickets = await Ticket.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['first_name', 'last_name']
        },
        {
          model: CatalogItem,
          as: 'catalog_item',
          attributes: ['name']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      tickets: tickets.map(ticket => ({
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        user_name: `${ticket.user.first_name} ${ticket.user.last_name}`,
        catalog_item_name: ticket.catalog_item.name,
        created_at: ticket.created_at,
        url: `/tickets/${ticket.id}`
      }))
    });
  } catch (error) {
    console.error('Ticket search error:', error);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

// Search users (admin only)
router.get('/users/search', ensureAdmin, async (req, res) => {
  try {
    const { q, role, active, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, users: [] });
    }

    let whereClause = {
      [Op.or]: [
        { first_name: { [Op.like]: `%${q}%` } },
        { last_name: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } }
      ]
    };

    if (role && role !== 'all') {
      whereClause.role = role;
    }

    if (active !== undefined && active !== 'all') {
      whereClause.is_active = active === 'true';
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'is_active'],
      order: [['first_name', 'ASC']],
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      users: users.map(user => ({
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: user.role,
        is_active: user.is_active
      }))
    });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

// Get catalog item details
router.get('/catalog/:id', ensureAuthenticated, async (req, res) => {
  try {
    const catalogItem = await CatalogItem.findByPk(req.params.id);

    if (!catalogItem) {
      return res.status(404).json({ success: false, error: 'Catalog item not found' });
    }

    res.json({
      success: true,
      item: {
        id: catalogItem.id,
        name: catalogItem.name,
        description: catalogItem.description,
        type: catalogItem.type,
        unit_cost: catalogItem.unit_cost,
        currency: catalogItem.currency,
        billing_period: catalogItem.billing_period,
        annual_cost: catalogItem.getAnnualCost(),
        formatted_cost: catalogItem.formatCost()
      }
    });
  } catch (error) {
    console.error('Catalog item API error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch catalog item' });
  }
});

// Dashboard statistics (real-time updates)
router.get('/dashboard/stats', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin();

    // Get ticket statistics
    let whereClause = {};
    if (!isAdmin) {
      whereClause.user_id = userId;
    }

    const ticketStats = await Ticket.findAll({
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
        [require('sequelize').fn('SUM', require('sequelize').col('estimated_savings')), 'estimated_total'],
        [require('sequelize').fn('SUM', require('sequelize').col('confirmed_savings')), 'confirmed_total']
      ],
      where: whereClause,
      group: ['status'],
      raw: true
    });

    // Process statistics
    const stats = {
      total: 0,
      new: 0,
      in_progress: 0,
      completed: 0,
      rejected: 0,
      cancelled: 0,
      estimated_savings: 0,
      confirmed_savings: 0
    };

    ticketStats.forEach(stat => {
      stats.total += parseInt(stat.count);
      stats[stat.status] = parseInt(stat.count);
      stats.estimated_savings += parseFloat(stat.estimated_total) || 0;
      stats.confirmed_savings += parseFloat(stat.confirmed_total) || 0;
    });

    stats.pending = stats.new + stats.in_progress;

    // Get unread notifications count
    const unreadNotifications = await Notification.count({
      where: { user_id: userId, is_read: false }
    });

    res.json({
      success: true,
      stats,
      unreadNotifications
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
  }
});

// System health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Get application version info
router.get('/version', (req, res) => {
  const packageJson = require('../package.json');
  res.json({
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    node_version: process.version,
    timestamp: new Date().toISOString()
  });
});

// Error testing endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  router.get('/test-error', (req, res, next) => {
    const error = new Error('Test error for development');
    error.status = 500;
    next(error);
  });
}

module.exports = router;