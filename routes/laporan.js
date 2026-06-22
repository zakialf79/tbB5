const express = require('express');
const router = express.Router();
const laporanController = require('../controllers/laporanController');
const { isAuthenticated } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/acl');

// ==========================================
// 1. ROUTE STATIS (Taruh di Paling Atas)
// ==========================================

// Fitur 2 - Daftar laporan (Halaman Utama)
router.get('/', isAuthenticated, checkPermission('laporan.view'), laporanController.index);

// Fitur 5 - Ekspor laporan ke excel
router.get('/export', isAuthenticated, checkPermission('laporan.view'), laporanController.exportExcel);

// Fitur 1 - Form kirim laporan baru manual
router.get('/create', isAuthenticated, checkPermission('laporan.create'), laporanController.createForm);

// Fitur 5 - Form Impor Laporan Excel
router.get('/import', isAuthenticated, checkPermission('laporan.create'), laporanController.importForm);

// Fitur 5 - Proses impor laporan dari Excel
router.post('/import', isAuthenticated, checkPermission('laporan.create'), laporanController.importExcel);

// Fitur 1 - Simpan laporan baru manual
router.post('/', isAuthenticated, checkPermission('laporan.create'), laporanController.store);


// ==========================================
// 2. ROUTE DINAMIS (Taruh di Paling Bawah)
// ==========================================

// Fitur 2 - Form edit laporan
router.get('/:id/edit', isAuthenticated, checkPermission('laporan.edit'), laporanController.editForm);

// Fitur 2 - Simpan perubahan laporan
router.post('/:id', isAuthenticated, checkPermission('laporan.edit'), laporanController.update);

module.exports = router;