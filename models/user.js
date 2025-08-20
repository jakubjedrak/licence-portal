const bcrypt = require('bcrypt');
const config = require('../config/config');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        isValidDomain(value) {
          if (!value.toLowerCase().endsWith(`@${config.email.allowedDomain}`)) {
            throw new Error(`Email must be from ${config.email.allowedDomain} domain`);
          }
        }
      }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [8, 255]
      }
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [1, 100]
      }
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [1, 100]
      }
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    position: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    role: {
      type: DataTypes.ENUM('employee', 'license_admin', 'system_admin'),
      allowNull: false,
      defaultValue: 'employee'
    },
    language: {
      type: DataTypes.STRING(2),
      allowNull: false,
      defaultValue: config.i18n.defaultLanguage,
      validate: {
        isIn: [config.i18n.supportedLanguages]
      }
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true
    },
    password_reset_token: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    password_reset_expires: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'users',
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, config.bcrypt.saltRounds);
        }
        user.email = user.email.toLowerCase();
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, config.bcrypt.saltRounds);
        }
        if (user.changed('email')) {
          user.email = user.email.toLowerCase();
        }
      }
    }
  });

  User.associate = function(models) {
    User.hasMany(models.Ticket, {
      foreignKey: 'user_id',
      as: 'tickets'
    });
    User.hasMany(models.Comment, {
      foreignKey: 'user_id',
      as: 'comments'
    });
    User.hasMany(models.Notification, {
      foreignKey: 'user_id',
      as: 'notifications'
    });
    User.hasMany(models.AuditLog, {
      foreignKey: 'user_id',
      as: 'audit_logs'
    });
  };

  // Instance methods
  User.prototype.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
  };

  User.prototype.getFullName = function() {
    return `${this.first_name} ${this.last_name}`;
  };

  User.prototype.isAdmin = function() {
    return ['license_admin', 'system_admin'].includes(this.role);
  };

  User.prototype.isSystemAdmin = function() {
    return this.role === 'system_admin';
  };

  User.prototype.toSafeJSON = function() {
    const user = this.toJSON();
    delete user.password;
    delete user.password_reset_token;
    delete user.password_reset_expires;
    return user;
  };

  return User;
};