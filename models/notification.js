module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('info', 'success', 'warning', 'error'),
      allowNull: false,
      defaultValue: 'info'
    },
    related_type: {
      type: DataTypes.ENUM('ticket', 'comment', 'user', 'catalog_item'),
      allowNull: true
    },
    related_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    action_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    }
  }, {
    tableName: 'notifications'
  });

  Notification.associate = function(models) {
    Notification.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  // Instance methods
  Notification.prototype.getTypeIcon = function() {
    const typeIcons = {
      'info': 'bi-info-circle',
      'success': 'bi-check-circle',
      'warning': 'bi-exclamation-triangle',
      'error': 'bi-x-circle'
    };
    return typeIcons[this.type] || 'bi-bell';
  };

  Notification.prototype.getTypeBadgeClass = function() {
    const typeClasses = {
      'info': 'bg-info',
      'success': 'bg-success',
      'warning': 'bg-warning',
      'error': 'bg-danger'
    };
    return typeClasses[this.type] || 'bg-secondary';
  };

  return Notification;
};