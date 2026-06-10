const express = require('express');
const router = express.Router();
const reimburseController = require('../controllers/reimburseController');
const { checkRole } = require('../middlewares/authMiddleware');

router.get('/api/reimburse', reimburseController.getAllReimburse);
router.get('/api/reimburse/search', reimburseController.searchAndFilter);
router.get('/api/reimburse/export', reimburseController.exportToCSV);

router.put('/api/reimburse/:id', checkRole(['Pegawai']), reimburseController.updateReimburse);
router.delete('/api/reimburse/:id', checkRole(['Pegawai']), reimburseController.deleteReimburse);

router.post('/api/reimburse/:id/approval', checkRole(['Pimpinan']), reimburseController.approveReimburse);

module.exports = router;