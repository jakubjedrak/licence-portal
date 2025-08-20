module.exports = (sequelize, DataTypes) => {
  const Ticket = sequelize.define('Ticket', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    ticket_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    catalog_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'catalog_items',
        key: 'id'
      }
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [1, 255]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    reason: {
      type: DataTypes.ENUM('no_longer_used', 'duplicate_license', 'employee_left', 'project_ended', 'cost_optimization', 'other'),
      allowNull: false
    },
    custom_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('new', 'in_progress', 'completed', 'rejected', 'cancelled'),
      allowNull: false,
      defaultValue: 'new'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium'
    },
    estimated_savings: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    confirmed_savings: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    savings_period_months: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 12,
      validate: {
        min: 1,
        max: 60
      }
    },
    assigned_to: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    due_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    completed_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    additional_info: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    tableName: 'tickets',
    hooks: {
      beforeCreate: async (ticket) => {
        if (!ticket.ticket_number) {
          const year = new Date().getFullYear();
          const count = await Ticket.count({
            where: sequelize.where(
              sequelize.fn('YEAR', sequelize.col('created_at')),
              year
            )
          });
          const nextNumber = (count + 1).toString().padStart(6, '0');
          ticket.ticket_number = `LIC-${year}-${nextNumber}`;
        }
      }
    }
  });

  Ticket.associate = function(models) {
    Ticket.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
    Ticket.belongsTo(models.User, {
      foreignKey: 'assigned_to',
      as: 'assignee'
    });
    Ticket.belongsTo(models.CatalogItem, {
      foreignKey: 'catalog_item_id',
      as: 'catalog_item'
    });
    Ticket.hasMany(models.Comment, {
      foreignKey: 'ticket_id',
      as: 'comments'
    });
    Ticket.hasMany(models.TicketAttachment, {
      foreignKey: 'ticket_id',
      as: 'attachments'
    });
  };

  // Instance methods
  Ticket.prototype.canBeEditedBy = function(user) {
    if (!user) return false;
    
    // System admin can edit all tickets
    if (user.role === 'system_admin') return true;
    
    // License admin can edit all tickets
    if (user.role === 'license_admin') return true;
    
    // Users can only edit their own tickets in 'new' status
    return this.user_id === user.id && this.status === 'new';
  };

  Ticket.prototype.canBeCancelledBy = function(user) {
    if (!user) return false;
    
    // System admin can cancel all tickets
    if (user.role === 'system_admin') return true;
    
    // License admin can cancel all tickets
    if (user.role === 'license_admin') return true;
    
    // Users can only cancel their own tickets in 'new' status
    return this.user_id === user.id && this.status === 'new';
  };

  Ticket.prototype.getStatusBadgeClass = function() {
    const statusClasses = {
      'new': 'bg-primary',
      'in_progress': 'bg-warning',
      'completed': 'bg-success',
      'rejected': 'bg-danger',
      'cancelled': 'bg-secondary'
    };
    return statusClasses[this.status] || 'bg-secondary';
  };

  Ticket.prototype.getPriorityBadgeClass = function() {
    const priorityClasses = {
      'low': 'bg-secondary',
      'medium': 'bg-info',
      'high': 'bg-warning',
      'urgent': 'bg-danger'
    };
    return priorityClasses[this.priority] || 'bg-secondary';
  };

  return Ticket;
};