const express = require('express');
const router = express.Router();
const laporanController = require('../controllers/laporanController');
const { isAuthenticated } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/acl'); 

// fitur 1: form edit laporan
router.get('/:id/edit', isAuthenticated, checkPermission('laporan.edit'), laporanController.editForm);

// fitur 1: simpan perubahan laporan
router.post('/:id', isAuthenticated, checkPermission('laporan.edit'), laporanController.update);  

module.exports = router;