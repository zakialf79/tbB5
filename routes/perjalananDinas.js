const express = require('express');
const router = express.Router();
const pimpinanController = require('../controllers/pimpinanController');
const pegawaiController = require('../controllers/pegawaiController');

// Pengaman login sederhana sesuai session project ini
const cekLogin = (req, res, next) => {
  if (req.session && req.session.userId) return next();
  if (typeof req.isAuthenticated === 'function' && req.isAuthenticated()) return next();
  res.redirect('/login');
};

// =========================
// MODUL PEGAWAI - VANESA
// Fitur 1 sampai 6
// =========================
router.get('/pegawai/perjalanan-dinas', cekLogin, pegawaiController.ambilDaftarSaya);
router.get('/pegawai/perjalanan-dinas/tambah', cekLogin, pegawaiController.tampilFormTambah);
router.post('/pegawai/perjalanan-dinas/tambah', cekLogin, pegawaiController.simpanPermohonan);
router.get('/pegawai/perjalanan-dinas/edit/:id', cekLogin, pegawaiController.tampilFormEdit);
router.post('/pegawai/perjalanan-dinas/edit/:id', cekLogin, pegawaiController.updatePermohonan);
router.post('/pegawai/perjalanan-dinas/hapus/:id', cekLogin, pegawaiController.hapusPermohonan);
router.get('/pegawai/perjalanan-dinas/ekspor', cekLogin, pegawaiController.eksporDataSaya);
router.get('/pegawai/perjalanan-dinas/impor', cekLogin, pegawaiController.tampilFormImpor);
router.post('/pegawai/perjalanan-dinas/impor', cekLogin, pegawaiController.imporDataSaya);
router.get('/api/v1/pegawai/perjalanan-dinas', cekLogin, pegawaiController.ambilApiDataSaya);

// =========================
// MODUL PIMPINAN - ZAKI
// Fitur 7 sampai 12
// =========================
router.get('/pimpinan/perjalanan-dinas', cekLogin, pimpinanController.ambilDaftarDinas);
router.get('/pimpinan/perjalanan-dinas/detail/:id', cekLogin, pimpinanController.ambilDetailDinas);
router.post('/pimpinan/perjalanan-dinas/aksi/:id', cekLogin, pimpinanController.prosesKeputusanDinas);
router.get('/pimpinan/perjalanan-dinas/ekspor', cekLogin, pimpinanController.eksporDataDinas);
router.post('/pimpinan/perjalanan-dinas/impor', cekLogin, pimpinanController.imporDataDinas);
router.get('/api/v1/pimpinan/perjalanan-dinas', cekLogin, pimpinanController.ambilApiSemuaDinas);

module.exports = router;
