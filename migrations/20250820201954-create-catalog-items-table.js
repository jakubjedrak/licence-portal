'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('catalog_items', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      type: {
        type: Sequelize.ENUM('account', 'license', 'subscription'),
        allowNull: false
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      vendor: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      unit_cost: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'EUR'
      },
      billing_period: {
        type: Sequelize.ENUM('monthly', 'quarterly', 'yearly', 'one-time'),
        allowNull: false,
        defaultValue: 'yearly'
      },
      owner_team: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      owner_contact: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      deactivation_instructions: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      approval_required: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      tags: {
        type: Sequelize.JSON,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    });

    await queryInterface.addIndex('catalog_items', ['name']);
    await queryInterface.addIndex('catalog_items', ['type']);
    await queryInterface.addIndex('catalog_items', ['category']);
    await queryInterface.addIndex('catalog_items', ['is_active']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('catalog_items');
  }
};
