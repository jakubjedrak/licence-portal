const express = require('express');
const { Op } = require('sequelize');
const { User, Ticket, CatalogItem, Notification } = require('../models');
const { ensureAuthenticated } = require('../middleware/auth');
const router = express.Router();

// Dashboard page
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin();

    // Get ticket statistics
    let ticketStats;
    if (isAdmin) {
      // System-wide statistics for admins
      ticketStats = await Ticket.findAll({
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
          [require('sequelize').fn('SUM', require('sequelize').col('estimated_savings')), 'estimated_total'],
          [require('sequelize').fn('SUM', require('sequelize').col('confirmed_savings')), 'confirmed_total']
        ],
        group: ['status'],
        raw: true
      });
    } else {
      // User's personal statistics
      ticketStats = await Ticket.findAll({
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
          [require('sequelize').fn('SUM', require('sequelize').col('estimated_savings')), 'estimated_total'],
          [require('sequelize').fn('SUM', require('sequelize').col('confirmed_savings')), 'confirmed_total']
        ],
        where: { user_id: userId },
        group: ['status'],
        raw: true
      });
    }

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

    // Get recent tickets
    const recentTicketsQuery = {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['first_name', 'last_name']
        },
        {
          model: CatalogItem,
          as: 'catalog_item',
          attributes: ['name', 'type']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 5
    };

    if (!isAdmin) {
      recentTicketsQuery.where = { user_id: userId };
    }

    const recentTickets = await Ticket.findAll(recentTicketsQuery);

    // Get recent notifications
    const recentNotifications = await Notification.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: 5
    });

    // Get monthly trend data (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    let monthlyTrendQuery = {
      attributes: [
        [require('sequelize').fn('DATE_FORMAT', require('sequelize').col('created_at'), '%Y-%m'), 'month'],
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      where: {
        created_at: { [Op.gte]: sixMonthsAgo }
      },
      group: [require('sequelize').fn('DATE_FORMAT', require('sequelize').col('created_at'), '%Y-%m')],
      order: [[require('sequelize').fn('DATE_FORMAT', require('sequelize').col('created_at'), '%Y-%m'), 'ASC']],
      raw: true
    };

    if (!isAdmin) {
      monthlyTrendQuery.where.user_id = userId;
    }

    const monthlyTrend = await Ticket.findAll(monthlyTrendQuery);

    // Additional admin statistics
    let adminStats = {};
    if (isAdmin) {
      const totalUsers = await User.count({ where: { is_active: true } });
      const totalCatalogItems = await CatalogItem.count({ where: { is_active: true } });
      const unreadNotifications = await Notification.count({ 
        where: { user_id: userId, is_read: false } 
      });

      adminStats = {
        totalUsers,
        totalCatalogItems,
        unreadNotifications
      };
    }

    res.render('dashboard/index', {
      title: req.t('general.dashboard'),
      stats,
      recentTickets,
      recentNotifications,
      monthlyTrend,
      adminStats,
      isAdmin
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.render('dashboard/index', {
      title: req.t('general.dashboard'),
      stats: {
        total: 0, new: 0, in_progress: 0, completed: 0, rejected: 0, cancelled: 0,
        pending: 0, estimated_savings: 0, confirmed_savings: 0
      },
      recentTickets: [],
      recentNotifications: [],
      monthlyTrend: [],
      adminStats: {},
      isAdmin: req.user.isAdmin()
    });
  }
});

// API endpoint for dashboard statistics (for AJAX updates)
router.get('/api/stats', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin();

    let ticketStats;
    if (isAdmin) {
      ticketStats = await Ticket.findAll({
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });
    } else {
      ticketStats = await Ticket.findAll({
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        where: { user_id: userId },
        group: ['status'],
        raw: true
      });
    }

    const stats = {
      total: 0,
      new: 0,
      in_progress: 0,
      completed: 0,
      rejected: 0,
      cancelled: 0
    };

    ticketStats.forEach(stat => {
      stats.total += parseInt(stat.count);
      stats[stat.status] = parseInt(stat.count);
    });

    stats.pending = stats.new + stats.in_progress;

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Dashboard API error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
  }
});

module.exports = router;