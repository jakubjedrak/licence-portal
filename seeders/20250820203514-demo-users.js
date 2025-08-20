'use strict';

const bcrypt = require('bcrypt');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('Password123!', saltRounds);

    await queryInterface.bulkInsert('users', [
      {
        email: 'admin@zf-lifetec.com',
        password: hashedPassword,
        first_name: 'System',
        last_name: 'Administrator',
        department: 'IT',
        position: 'System Administrator',
        role: 'system_admin',
        language: 'en',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'license.admin@zf-lifetec.com',
        password: hashedPassword,
        first_name: 'License',
        last_name: 'Manager',
        department: 'IT',
        position: 'License Administrator',
        role: 'license_admin',
        language: 'en',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'john.doe@zf-lifetec.com',
        password: hashedPassword,
        first_name: 'John',
        last_name: 'Doe',
        department: 'Engineering',
        position: 'Software Developer',
        role: 'employee',
        language: 'en',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'jane.smith@zf-lifetec.com',
        password: hashedPassword,
        first_name: 'Jane',
        last_name: 'Smith',
        department: 'Marketing',
        position: 'Marketing Manager',
        role: 'employee',
        language: 'en',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'bob.wilson@zf-lifetec.com',
        password: hashedPassword,
        first_name: 'Bob',
        last_name: 'Wilson',
        department: 'Sales',
        position: 'Sales Representative',
        role: 'employee',
        language: 'en',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', null, {});
  }
};
