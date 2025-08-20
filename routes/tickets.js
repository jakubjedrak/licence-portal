const express = require('express');
const { Op } = require('sequelize');
const { User, Ticket, CatalogItem, Comment, TicketAttachment } = require('../models');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');
const { validateTicket, validateComment, handleValidationErrors } = require('../utils/validation');
const { notifyTicketStatusChange, notifyNewComment, notifyTicketAssignment } = require('../utils/notifications');
const { auditLog, captureOldValues, captureNewValues } = require('../middleware/audit');
const router = express.Router();

// List tickets
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { status, priority, search, assigned_to } = req.query;

    let whereClause = {};
    
    // Non-admin users can only see their own tickets
    if (!req.user.isAdmin()) {
      whereClause.user_id = req.user.id;
    }

    // Apply filters
    if (status && status !== 'all') {
      whereClause.status = status;
    }
    if (priority && priority !== 'all') {
      whereClause.priority = priority;
    }
    if (assigned_to && assigned_to !== 'all') {
      whereClause.assigned_to = assigned_to;
    }
    if (search) {
      whereClause[Op.or] = [
        { ticket_number: { [Op.like]: `%${search}%` } },
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
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
          attributes: ['first_name', 'last_name', 'email'],
          required: false
        },
        {
          model: CatalogItem,
          as: 'catalog_item',
          attributes: ['name', 'type', 'unit_cost', 'currency']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    // Get assignees for filter (admins only)
    let assignees = [];
    if (req.user.isAdmin()) {
      assignees = await User.findAll({
        where: { role: ['license_admin', 'system_admin'], is_active: true },
        attributes: ['id', 'first_name', 'last_name'],
        order: [['first_name', 'ASC']]
      });
    }

    res.render('tickets/index', {
      title: req.t('tickets.my_tickets'),
      tickets,
      currentPage: page,
      totalPages,
      totalCount: count,
      limit,
      filters: { status, priority, search, assigned_to },
      assignees,
      isAdmin: req.user.isAdmin()
    });
  } catch (error) {
    console.error('Tickets list error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.redirect('/dashboard');
  }
});

// New ticket form
router.get('/new', ensureAuthenticated, async (req, res) => {
  try {
    const catalogItems = await CatalogItem.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']]
    });

    res.render('tickets/new', {
      title: req.t('tickets.new_ticket'),
      catalogItems
    });
  } catch (error) {
    console.error('New ticket form error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.redirect('/tickets');
  }
});

// Create new ticket
router.post('/', ensureAuthenticated, validateTicket, handleValidationErrors, 
  auditLog('create', 'ticket'), async (req, res) => {
  try {
    const { catalog_item_id, title, description, reason, custom_reason, savings_period_months } = req.body;

    // Get catalog item to calculate estimated savings
    const catalogItem = await CatalogItem.findByPk(catalog_item_id);
    if (!catalogItem) {
      req.flash('error_msg', req.t('catalog.not_found'));
      return res.redirect('/tickets/new');
    }

    const estimatedSavings = catalogItem.getAnnualCost() * (parseInt(savings_period_months) || 12) / 12;

    const ticket = await Ticket.create({
      user_id: req.user.id,
      catalog_item_id,
      title,
      description,
      reason,
      custom_reason: reason === 'other' ? custom_reason : null,
      estimated_savings: estimatedSavings,
      savings_period_months: parseInt(savings_period_months) || 12
    });

    // Create initial system comment
    await Comment.create({
      ticket_id: ticket.id,
      user_id: req.user.id,
      content: req.t('tickets.ticket_created_by', { 
        user: req.user.getFullName(),
        date: new Date().toLocaleString()
      }),
      is_system: true
    });

    req.flash('success_msg', req.t('tickets.created_successfully'));
    res.redirect(`/tickets/${ticket.id}`);
  } catch (error) {
    console.error('Ticket creation error:', error);
    req.flash('error_msg', req.t('tickets.creation_error'));
    res.redirect('/tickets/new');
  }
});

// View ticket details
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const ticketId = req.params.id;

    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: User,
          as: 'assignee',
          attributes: ['id', 'first_name', 'last_name', 'email'],
          required: false
        },
        {
          model: CatalogItem,
          as: 'catalog_item'
        },
        {
          model: Comment,
          as: 'comments',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['first_name', 'last_name']
            }
          ],
          order: [['created_at', 'ASC']]
        },
        {
          model: TicketAttachment,
          as: 'attachments',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['first_name', 'last_name']
            }
          ]
        }
      ]
    });

    if (!ticket) {
      req.flash('error_msg', req.t('tickets.not_found'));
      return res.redirect('/tickets');
    }

    // Check access permissions
    if (!req.user.isAdmin() && ticket.user_id !== req.user.id) {
      req.flash('error_msg', req.t('tickets.access_denied'));
      return res.redirect('/tickets');
    }

    // Get potential assignees (admins only)
    let assignees = [];
    if (req.user.isAdmin()) {
      assignees = await User.findAll({
        where: { role: ['license_admin', 'system_admin'], is_active: true },
        attributes: ['id', 'first_name', 'last_name'],
        order: [['first_name', 'ASC']]
      });
    }

    res.render('tickets/show', {
      title: req.t('tickets.ticket_details'),
      ticket,
      assignees,
      canEdit: ticket.canBeEditedBy(req.user),
      canCancel: ticket.canBeCancelledBy(req.user),
      isAdmin: req.user.isAdmin()
    });
  } catch (error) {
    console.error('Ticket view error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.redirect('/tickets');
  }
});

// Edit ticket form
router.get('/:id/edit', ensureAuthenticated, async (req, res) => {
  try {
    const ticketId = req.params.id;

    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        {
          model: CatalogItem,
          as: 'catalog_item'
        }
      ]
    });

    if (!ticket) {
      req.flash('error_msg', req.t('tickets.not_found'));
      return res.redirect('/tickets');
    }

    if (!ticket.canBeEditedBy(req.user)) {
      req.flash('error_msg', req.t('tickets.cannot_edit'));
      return res.redirect(`/tickets/${ticketId}`);
    }

    const catalogItems = await CatalogItem.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']]
    });

    res.render('tickets/edit', {
      title: req.t('tickets.edit_ticket'),
      ticket,
      catalogItems
    });
  } catch (error) {
    console.error('Ticket edit form error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.redirect('/tickets');
  }
});

// Update ticket
router.put('/:id', ensureAuthenticated, validateTicket, handleValidationErrors,
  captureOldValues(Ticket), captureNewValues(), auditLog('update', 'ticket'), async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { catalog_item_id, title, description, reason, custom_reason, savings_period_months } = req.body;

    const ticket = await Ticket.findByPk(ticketId);

    if (!ticket) {
      req.flash('error_msg', req.t('tickets.not_found'));
      return res.redirect('/tickets');
    }

    if (!ticket.canBeEditedBy(req.user)) {
      req.flash('error_msg', req.t('tickets.cannot_edit'));
      return res.redirect(`/tickets/${ticketId}`);
    }

    // Get catalog item to recalculate estimated savings
    const catalogItem = await CatalogItem.findByPk(catalog_item_id);
    if (!catalogItem) {
      req.flash('error_msg', req.t('catalog.not_found'));
      return res.redirect(`/tickets/${ticketId}/edit`);
    }

    const estimatedSavings = catalogItem.getAnnualCost() * (parseInt(savings_period_months) || 12) / 12;

    await ticket.update({
      catalog_item_id,
      title,
      description,
      reason,
      custom_reason: reason === 'other' ? custom_reason : null,
      estimated_savings: estimatedSavings,
      savings_period_months: parseInt(savings_period_months) || 12
    });

    req.flash('success_msg', req.t('tickets.updated_successfully'));
    res.redirect(`/tickets/${ticketId}`);
  } catch (error) {
    console.error('Ticket update error:', error);
    req.flash('error_msg', req.t('tickets.update_error'));
    res.redirect(`/tickets/${req.params.id}/edit`);
  }
});

// Add comment to ticket
router.post('/:id/comments', ensureAuthenticated, validateComment, handleValidationErrors,
  auditLog('create', 'comment'), async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { content, is_internal } = req.body;

    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        {
          model: User,
          as: 'user'
        }
      ]
    });

    if (!ticket) {
      req.flash('error_msg', req.t('tickets.not_found'));
      return res.redirect('/tickets');
    }

    // Check access permissions
    if (!req.user.isAdmin() && ticket.user_id !== req.user.id) {
      req.flash('error_msg', req.t('tickets.access_denied'));
      return res.redirect('/tickets');
    }

    const comment = await Comment.create({
      ticket_id: ticketId,
      user_id: req.user.id,
      content,
      is_internal: req.user.isAdmin() && is_internal === 'true'
    });

    // Load comment with user data for notifications
    const commentWithUser = await Comment.findByPk(comment.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['first_name', 'last_name']
        }
      ]
    });

    // Send notifications
    await notifyNewComment(ticket, commentWithUser, req.user.id);

    req.flash('success_msg', req.t('tickets.comment_added'));
    res.redirect(`/tickets/${ticketId}#comment-${comment.id}`);
  } catch (error) {
    console.error('Comment creation error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.redirect(`/tickets/${req.params.id}`);
  }
});

// Upload attachment
router.post('/:id/attachments', ensureAuthenticated, upload.single('attachment'), handleUploadError,
  auditLog('create', 'attachment'), async (req, res) => {
  try {
    const ticketId = req.params.id;

    if (!req.file) {
      req.flash('error_msg', req.t('upload.no_file_selected'));
      return res.redirect(`/tickets/${ticketId}`);
    }

    const ticket = await Ticket.findByPk(ticketId);

    if (!ticket) {
      req.flash('error_msg', req.t('tickets.not_found'));
      return res.redirect('/tickets');
    }

    // Check access permissions
    if (!req.user.isAdmin() && ticket.user_id !== req.user.id) {
      req.flash('error_msg', req.t('tickets.access_denied'));
      return res.redirect('/tickets');
    }

    await TicketAttachment.create({
      ticket_id: ticketId,
      user_id: req.user.id,
      original_name: req.file.originalname,
      file_name: req.file.filename,
      file_path: req.file.path,
      file_size: req.file.size,
      mime_type: req.file.mimetype
    });

    req.flash('success_msg', req.t('tickets.file_uploaded'));
    res.redirect(`/tickets/${ticketId}`);
  } catch (error) {
    console.error('Attachment upload error:', error);
    req.flash('error_msg', req.t('upload.upload_error'));
    res.redirect(`/tickets/${req.params.id}`);
  }
});

// Admin: Update ticket status
router.patch('/:id/status', ensureAdmin, captureOldValues(Ticket), auditLog('update_status', 'ticket'), async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { status, rejection_reason, confirmed_savings, assigned_to } = req.body;

    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        {
          model: User,
          as: 'user'
        }
      ]
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: req.t('tickets.not_found') });
    }

    const oldStatus = ticket.status;
    const updateData = { status };

    if (status === 'rejected' && rejection_reason) {
      updateData.rejection_reason = rejection_reason;
    }

    if (status === 'completed') {
      updateData.completed_date = new Date();
      if (confirmed_savings) {
        updateData.confirmed_savings = parseFloat(confirmed_savings);
      }
    }

    if (assigned_to && assigned_to !== 'null') {
      updateData.assigned_to = parseInt(assigned_to);
    } else if (assigned_to === 'null') {
      updateData.assigned_to = null;
    }

    await ticket.update(updateData);

    // Send notifications
    await notifyTicketStatusChange(ticket, req.user, status, oldStatus);

    // Notify about assignment if changed
    if (assigned_to && assigned_to !== 'null' && parseInt(assigned_to) !== ticket.assigned_to) {
      const assignee = await User.findByPk(assigned_to);
      if (assignee) {
        await notifyTicketAssignment(ticket, assignee);
      }
    }

    res.json({ success: true, message: req.t('tickets.updated_successfully') });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ success: false, message: req.t('tickets.update_error') });
  }
});

// Cancel ticket (user can cancel their own tickets in 'new' status)
router.patch('/:id/cancel', ensureAuthenticated, captureOldValues(Ticket), auditLog('cancel', 'ticket'), async (req, res) => {
  try {
    const ticketId = req.params.id;

    const ticket = await Ticket.findByPk(ticketId);

    if (!ticket) {
      req.flash('error_msg', req.t('tickets.not_found'));
      return res.redirect('/tickets');
    }

    if (!ticket.canBeCancelledBy(req.user)) {
      req.flash('error_msg', req.t('tickets.cannot_cancel'));
      return res.redirect(`/tickets/${ticketId}`);
    }

    await ticket.update({ status: 'cancelled' });

    req.flash('success_msg', req.t('tickets.cancelled_successfully'));
    res.redirect(`/tickets/${ticketId}`);
  } catch (error) {
    console.error('Ticket cancellation error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.redirect(`/tickets/${req.params.id}`);
  }
});

module.exports = router;