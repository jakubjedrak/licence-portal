module.exports = (sequelize, DataTypes) => {
  const TicketAttachment = sequelize.define('TicketAttachment', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    ticket_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tickets',
        key: 'id'
      }
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    original_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    file_path: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: false
    }
  }, {
    tableName: 'ticket_attachments'
  });

  TicketAttachment.associate = function(models) {
    TicketAttachment.belongsTo(models.Ticket, {
      foreignKey: 'ticket_id',
      as: 'ticket'
    });
    TicketAttachment.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  // Instance methods
  TicketAttachment.prototype.getFileIcon = function() {
    if (this.mime_type.startsWith('image/')) {
      return 'bi-file-earmark-image';
    } else if (this.mime_type === 'application/pdf') {
      return 'bi-file-earmark-pdf';
    }
    return 'bi-file-earmark';
  };

  TicketAttachment.prototype.formatFileSize = function() {
    const bytes = this.file_size;
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return TicketAttachment;
};