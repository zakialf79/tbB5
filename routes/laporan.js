const express = require('express');
const router = express.Router();
const laporanController = require('../controllers/laporanController');
const { isAuthenticated } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/acl');

// Fitur 2 - Daftar laporan
router.get('/', isAuthenticated, checkPermission('laporan.view'), laporanController.index);

// Fitur 1 - Form kirim laporan baru
router.get('/create', isAuthenticated, checkPermission('laporan.create'), laporanController.createForm);

// Fitur 1 - Simpan laporan baru
router.post('/', isAuthenticated, checkPermission('laporan.create'), laporanController.store);

// Fitur 2 - Form edit laporan
router.get('/:id/edit', isAuthenticated, checkPermission('laporan.edit'), laporanController.editForm);

// Fitur 2 - Simpan perubahan laporan
router.post('/:id', isAuthenticated, checkPermission('laporan.edit'), laporanController.update);

module.exports = router;
