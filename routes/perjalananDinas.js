const express = require('express');
const router = express.Router();
const pimpinanController = require('../controllers/pimpinanController');

// PENGAMAN MANDIRI: Jika session_cookie_name gak ada / belum login, tendang ke halaman login
const cekLoginPimpinan = (req, res, next) => {
    // Memeriksa apakah session ada (mengikuti config express-session di app.js lo)
    if (req.session && req.session.userId) { 
        return next();
    }
    // Jika proyek kelompok lo pake req.isAuthenticated() bawaan passport
    if (typeof req.isAuthenticated === 'function' && req.isAuthenticated()) {
        return next();
    }
    // SEMENTARA: Jika pas demo ternyata gagal mulu, arahkan ke login atau loloskan jika di lingkungan lokal
    // Biar aman pas demo depan Pak Husnil, lo bisa arahkan ke halaman login utama kelompok lo:
    res.redirect('/login'); 
};

// Fitur 7: Pimpinan melihat daftar permohonan dinas dari semua pegawai
router.get('/pimpinan/perjalanan-dinas', cekLoginPimpinan, pimpinanController.ambilDaftarDinas);

// Fitur 8: Pimpinan melihat detail permohonan dinas tertentu
router.get('/pimpinan/perjalanan-dinas/detail/:id', cekLoginPimpinan, pimpinanController.ambilDetailDinas);

// Fitur 9 & 10: Pimpinan menyetujui atau menolak permohonan
router.post('/pimpinan/perjalanan-dinas/aksi/:id', cekLoginPimpinan, pimpinanController.prosesKeputusanDinas);

// Fitur 11: Ekspor & Impor data permohonan dinas (Pimpinan)
router.get('/pimpinan/perjalanan-dinas/ekspor', cekLoginPimpinan, pimpinanController.eksporDataDinas);
router.post('/pimpinan/perjalanan-dinas/impor', cekLoginPimpinan, pimpinanController.imporDataDinas);

// Fitur 12: API JSON data permohonan seluruh pegawai
router.get('/api/v1/pimpinan/perjalanan-dinas', cekLoginPimpinan, pimpinanController.ambilApiSemuaDinas);

module.exports = router;