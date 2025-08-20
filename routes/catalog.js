const express = require('express');
const { Op } = require('sequelize');
const { CatalogItem, Ticket } = require('../models');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');
const { validateCatalogItem, handleValidationErrors } = require('../utils/validation');
const { auditLog, captureOldValues, captureNewValues } = require('../middleware/audit');
const router = express.Router();

// List catalog items
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { type, category, search, active } = req.query;

    let whereClause = {};

    // Apply filters
    if (type && type !== 'all') {
      whereClause.type = type;
    }
    if (category && category !== 'all') {
      whereClause.category = category;
    }
    if (active !== undefined && active !== 'all') {
      whereClause.is_active = active === 'true';
    }
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { vendor: { [Op.like]: `%${search}%` } }
      ];
    }

    const { rows: catalogItems, count } = await CatalogItem.findAndCountAll({
      where: whereClause,
      order: [['name', 'ASC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    // Get unique categories for filter
    const categories = await CatalogItem.findAll({
      attributes: ['category'],
      where: { category: { [Op.ne]: null } },
      group: ['category'],
      order: [['category', 'ASC']],
      raw: true
    });

    res.render('catalog/index', {
      title: req.t('catalog.catalog'),
      catalogItems,
      currentPage: page,
      totalPages,
      totalCount: count,
      limit,
      filters: { type, category, search, active },
      categories: categories.map(c => c.category),
      isAdmin: req.user.isAdmin()
    });
  } catch (error) {
    console.error('Catalog list error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.render('catalog/index', {
      title: req.t('catalog.catalog'),
      catalogItems: [],
      currentPage: 1,
      totalPages: 1,
      totalCount: 0,
      limit: 20,
      filters: {},
      categories: [],
      isAdmin: req.user.isAdmin()
    });
  }
});

// View catalog item details
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const catalogItem = await CatalogItem.findByPk(req.params.id);

    if (!catalogItem) {
      req.flash('error_msg', req.t('catalog.not_found'));
      return res.redirect('/catalog');
    }

    // Get related tickets count
    const ticketCount = await Ticket.count({
      where: { catalog_item_id: catalogItem.id }
    });

    res.render('catalog/show', {
      title: catalogItem.name,
      catalogItem,
      ticketCount,
      isAdmin: req.user.isAdmin()
    });
  } catch (error) {
    console.error('Catalog item view error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.redirect('/catalog');
  }
});

// New catalog item form (admin only)
router.get('/new', ensureAdmin, (req, res) => {
  res.render('catalog/new', {
    title: req.t('catalog.add_item')
  });
});

// Create new catalog item (admin only)
router.post('/', ensureAdmin, validateCatalogItem, handleValidationErrors,
  auditLog('create', 'catalog_item'), async (req, res) => {
  try {
    const {
      name, description, type, category, vendor, unit_cost, currency,
      billing_period, owner_team, owner_contact, deactivation_instructions,
      approval_required, tags
    } = req.body;

    const catalogItem = await CatalogItem.create({
      name,
      description: description || null,
      type,
      category: category || null,
      vendor: vendor || null,
      unit_cost: parseFloat(unit_cost),
      currency: currency || 'EUR',
      billing_period,
      owner_team: owner_team || null,
      owner_contact: owner_contact || null,
      deactivation_instructions: deactivation_instructions || null,
      approval_required: approval_required === 'true',
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : null
    });

    req.flash('success_msg', req.t('catalog.created_successfully'));
    res.redirect(`/catalog/${catalogItem.id}`);
  } catch (error) {
    console.error('Catalog item creation error:', error);
    req.flash('error_msg', req.t('catalog.creation_error'));
    res.redirect('/catalog/new');
  }
});

// Edit catalog item form (admin only)
router.get('/:id/edit', ensureAdmin, async (req, res) => {
  try {
    const catalogItem = await CatalogItem.findByPk(req.params.id);

    if (!catalogItem) {
      req.flash('error_msg', req.t('catalog.not_found'));
      return res.redirect('/catalog');
    }

    res.render('catalog/edit', {
      title: req.t('catalog.edit_item'),
      catalogItem
    });
  } catch (error) {
    console.error('Catalog item edit form error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.redirect('/catalog');
  }
});

// Update catalog item (admin only)
router.put('/:id', ensureAdmin, validateCatalogItem, handleValidationErrors,
  captureOldValues(CatalogItem), captureNewValues(), auditLog('update', 'catalog_item'), async (req, res) => {
  try {
    const catalogItem = await CatalogItem.findByPk(req.params.id);

    if (!catalogItem) {
      req.flash('error_msg', req.t('catalog.not_found'));
      return res.redirect('/catalog');
    }

    const {
      name, description, type, category, vendor, unit_cost, currency,
      billing_period, owner_team, owner_contact, deactivation_instructions,
      approval_required, is_active, tags
    } = req.body;

    await catalogItem.update({
      name,
      description: description || null,
      type,
      category: category || null,
      vendor: vendor || null,
      unit_cost: parseFloat(unit_cost),
      currency: currency || 'EUR',
      billing_period,
      owner_team: owner_team || null,
      owner_contact: owner_contact || null,
      deactivation_instructions: deactivation_instructions || null,
      approval_required: approval_required === 'true',
      is_active: is_active === 'true',
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : null
    });

    req.flash('success_msg', req.t('catalog.updated_successfully'));
    res.redirect(`/catalog/${catalogItem.id}`);
  } catch (error) {
    console.error('Catalog item update error:', error);
    req.flash('error_msg', req.t('catalog.update_error'));
    res.redirect(`/catalog/${req.params.id}/edit`);
  }
});

// Delete catalog item (admin only)
router.delete('/:id', ensureAdmin, captureOldValues(CatalogItem), auditLog('delete', 'catalog_item'), async (req, res) => {
  try {
    const catalogItem = await CatalogItem.findByPk(req.params.id);

    if (!catalogItem) {
      return res.status(404).json({ success: false, message: req.t('catalog.not_found') });
    }

    // Check if there are related tickets
    const ticketCount = await Ticket.count({
      where: { catalog_item_id: catalogItem.id }
    });

    if (ticketCount > 0) {
      return res.status(400).json({ success: false, message: req.t('catalog.cannot_delete') });
    }

    await catalogItem.destroy();

    res.json({ success: true, message: req.t('catalog.deleted_successfully') });
  } catch (error) {
    console.error('Catalog item deletion error:', error);
    res.status(500).json({ success: false, message: req.t('catalog.delete_error') });
  }
});

// API endpoint to get catalog items (for AJAX)
router.get('/api/items', ensureAuthenticated, async (req, res) => {
  try {
    const { search, type, active } = req.query;
    let whereClause = {};

    if (active !== 'false') {
      whereClause.is_active = true;
    }

    if (type && type !== 'all') {
      whereClause.type = type;
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { vendor: { [Op.like]: `%${search}%` } }
      ];
    }

    const catalogItems = await CatalogItem.findAll({
      where: whereClause,
      attributes: ['id', 'name', 'type', 'unit_cost', 'currency', 'billing_period'],
      order: [['name', 'ASC']],
      limit: 50
    });

    res.json({
      success: true,
      items: catalogItems.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        unit_cost: item.unit_cost,
        currency: item.currency,
        billing_period: item.billing_period,
        annual_cost: item.getAnnualCost(),
        formatted_cost: item.formatCost()
      }))
    });
  } catch (error) {
    console.error('Catalog API error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch catalog items' });
  }
});

// Bulk import/export functionality (admin only)
router.get('/admin/export', ensureAdmin, async (req, res) => {
  try {
    const catalogItems = await CatalogItem.findAll({
      order: [['name', 'ASC']]
    });

    const csvData = [
      ['Name', 'Description', 'Type', 'Category', 'Vendor', 'Unit Cost', 'Currency', 'Billing Period', 'Owner Team', 'Owner Contact', 'Active'].join(',')
    ];

    catalogItems.forEach(item => {
      csvData.push([
        `"${item.name}"`,
        `"${item.description || ''}"`,
        item.type,
        `"${item.category || ''}"`,
        `"${item.vendor || ''}"`,
        item.unit_cost,
        item.currency,
        item.billing_period,
        `"${item.owner_team || ''}"`,
        `"${item.owner_contact || ''}"`,
        item.is_active
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=catalog-export.csv');
    res.send(csvData.join('\n'));
  } catch (error) {
    console.error('Catalog export error:', error);
    req.flash('error_msg', req.t('error.generic'));
    res.redirect('/catalog');
  }
});

module.exports = router;