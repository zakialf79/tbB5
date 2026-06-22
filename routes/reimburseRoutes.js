const express = require('express');
const router = express.Router();
const reimburseController = require('../controllers/reimburseController');
const upload = require('../middlewares/uploadMiddleware');
const validateReimburse = require('../middlewares/validationMiddleware');

// Route menampilkan dan menyaring data
router.get('/api/reimburse', reimburseController.getAllReimburse);
router.get('/api/reimburse/search', reimburseController.searchAndFilter);

// Route tambah klaim baru + Validasi + Upload File Nota
router.post('/api/reimburse', upload.single('receipt_file'), validateReimburse, reimburseController.createReimburse);

// Route update klaim + Validasi + Upload File Nota
router.put('/api/reimburse/:id', upload.single('receipt_file'), validateReimburse, reimburseController.updateReimburse);

// Route hapus dan persetujuan pimpinan
router.delete('/api/reimburse/:id', reimburseController.deleteReimburse);
router.post('/api/reimburse/approve/:id', reimburseController.approveReimburse);

// Route Export & Import CSV
router.get('/api/reimburse/export', reimburseController.exportToCSV);
router.post('/api/reimburse/import', upload.single('csv_file'), reimburseController.importFromCSV);

module.exports = router;