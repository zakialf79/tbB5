const express = require('express');
const router = express.Router();
const reimburseController = require('../controllers/reimburseController');
const { isAuthenticated } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/acl');

// Fitur 3 - Daftar reimburse
router.get('/', isAuthenticated, checkPermission('reimburse.view'), reimburseController.index);

// Fitur 2 - Form ajukan reimburse (harus sebelum /:id !)
router.get('/create', isAuthenticated, checkPermission('reimburse.create'), reimburseController.createForm);

// Fitur 2 - Simpan reimburse baru
router.post('/', isAuthenticated, checkPermission('reimburse.create'), reimburseController.store);

// Fitur 4 - Form edit reimburse (harus sebelum /:id !)
router.get('/:id/edit', isAuthenticated, checkPermission('reimburse.edit'), reimburseController.editForm);

// Fitur 4 - Simpan perubahan
router.post('/:id', isAuthenticated, checkPermission('reimburse.edit'), reimburseController.update);

// Fitur 3 - Detail reimburse (harus paling bawah!)
router.get('/:id', isAuthenticated, checkPermission('reimburse.view'), reimburseController.detail);

module.exports = router;
