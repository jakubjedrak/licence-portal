const { Notification, EmailQueue } = require('../models');
const config = require('../config/config');

// Create notification for user
async function createNotification(data) {
  try {
    await Notification.create({
      user_id: data.user_id,
      title: data.title,
      message: data.message,
      type: data.type || 'info',
      related_type: data.related_type || null,
      related_id: data.related_id || null,
      action_url: data.action_url || null
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

// Send email notification (mock - queue for sending)
async function sendEmail(data) {
  try {
    await EmailQueue.queueEmail({
      to_email: data.to_email,
      from_email: config.email.from,
      subject: data.subject,
      body: data.body,
      template: data.template || null,
      template_data: data.template_data || null
    });
  } catch (error) {
    console.error('Failed to queue email:', error);
  }
}

// Notify ticket status change
async function notifyTicketStatusChange(ticket, user, newStatus, oldStatus) {
  const messages = {
    'in_progress': 'Your ticket has been taken into processing',
    'completed': 'Your ticket has been completed',
    'rejected': 'Your ticket has been rejected',
    'cancelled': 'Your ticket has been cancelled'
  };

  if (messages[newStatus]) {
    await createNotification({
      user_id: ticket.user_id,
      title: `Ticket ${ticket.ticket_number} - Status Updated`,
      message: messages[newStatus],
      type: newStatus === 'completed' ? 'success' : newStatus === 'rejected' ? 'error' : 'info',
      related_type: 'ticket',
      related_id: ticket.id,
      action_url: `/tickets/${ticket.id}`
    });

    // Send email notification
    await sendEmail({
      to_email: ticket.user.email,
      subject: `Ticket ${ticket.ticket_number} - Status Updated`,
      body: `Hello ${ticket.user.first_name},\n\nYour ticket "${ticket.title}" status has been changed from "${oldStatus}" to "${newStatus}".\n\nYou can view the details at: ${process.env.BASE_URL || 'http://localhost:3000'}/tickets/${ticket.id}\n\nBest regards,\nLicense Portal Team`
    });
  }
}

// Notify new comment on ticket
async function notifyNewComment(ticket, comment, excludeUserId = null) {
  // Notify ticket owner if comment is not from them
  if (ticket.user_id !== excludeUserId) {
    await createNotification({
      user_id: ticket.user_id,
      title: `New comment on ticket ${ticket.ticket_number}`,
      message: `${comment.user.first_name} ${comment.user.last_name} added a comment`,
      type: 'info',
      related_type: 'ticket',
      related_id: ticket.id,
      action_url: `/tickets/${ticket.id}#comment-${comment.id}`
    });
  }

  // Notify assignee if different from comment author and ticket owner
  if (ticket.assigned_to && ticket.assigned_to !== excludeUserId && ticket.assigned_to !== ticket.user_id) {
    await createNotification({
      user_id: ticket.assigned_to,
      title: `New comment on assigned ticket ${ticket.ticket_number}`,
      message: `${comment.user.first_name} ${comment.user.last_name} added a comment`,
      type: 'info',
      related_type: 'ticket',
      related_id: ticket.id,
      action_url: `/tickets/${ticket.id}#comment-${comment.id}`
    });
  }
}

// Notify new ticket assignment
async function notifyTicketAssignment(ticket, assignee) {
  await createNotification({
    user_id: assignee.id,
    title: `New ticket assigned: ${ticket.ticket_number}`,
    message: `You have been assigned to ticket "${ticket.title}"`,
    type: 'info',
    related_type: 'ticket',
    related_id: ticket.id,
    action_url: `/tickets/${ticket.id}`
  });

  // Send email notification
  await sendEmail({
    to_email: assignee.email,
    subject: `New Ticket Assignment: ${ticket.ticket_number}`,
    body: `Hello ${assignee.first_name},\n\nYou have been assigned to ticket "${ticket.title}" (${ticket.ticket_number}).\n\nPlease review the details at: ${process.env.BASE_URL || 'http://localhost:3000'}/tickets/${ticket.id}\n\nBest regards,\nLicense Portal Team`
  });
}

module.exports = {
  createNotification,
  sendEmail,
  notifyTicketStatusChange,
  notifyNewComment,
  notifyTicketAssignment
};