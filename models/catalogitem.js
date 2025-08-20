module.exports = (sequelize, DataTypes) => {
  const CatalogItem = sequelize.define('CatalogItem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [1, 255]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('account', 'license', 'subscription'),
      allowNull: false
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    vendor: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    unit_cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'EUR'
    },
    billing_period: {
      type: DataTypes.ENUM('monthly', 'quarterly', 'yearly', 'one-time'),
      allowNull: false,
      defaultValue: 'yearly'
    },
    owner_team: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    owner_contact: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    deactivation_instructions: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    approval_required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    tableName: 'catalog_items'
  });

  CatalogItem.associate = function(models) {
    CatalogItem.hasMany(models.Ticket, {
      foreignKey: 'catalog_item_id',
      as: 'tickets'
    });
  };

  // Instance methods
  CatalogItem.prototype.getAnnualCost = function() {
    let multiplier = 1;
    switch (this.billing_period) {
      case 'monthly':
        multiplier = 12;
        break;
      case 'quarterly':
        multiplier = 4;
        break;
      case 'yearly':
        multiplier = 1;
        break;
      case 'one-time':
        multiplier = 1;
        break;
    }
    return parseFloat(this.unit_cost) * multiplier;
  };

  CatalogItem.prototype.formatCost = function() {
    const cost = parseFloat(this.unit_cost);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency
    }).format(cost);
  };

  return CatalogItem;
};