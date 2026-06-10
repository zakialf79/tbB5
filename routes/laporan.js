const express = require('express');
const router = express.Router();
const laporanController = require('../controllers/laporanController');
const { isAuthenticated } = require('../middlewares/auth');
const { checkPermissions } = require('../middlewares/acl'); 

// fitur 1: form edit laporan
router.get('/:id/edit', isAuthenticated, checkPermissions('laporan.edit'), laporanController.editForm);

// fitur 1: simpan perubahan laporan
router.post('/:id', isAuthenticated, checkPermissions('laporan.edit'), laporanController.update);  

module.exports = router;