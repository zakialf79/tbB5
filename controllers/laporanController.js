const db = require('../lib/db');

// fitur 1: form edit laporan perjalanan dinas
const editForm = async (req, res, next) => {
    res.render('laporan/edit', { title: 'Edit Laporan Perjalanan Dinas' });
};

// fitur 1: simpan perubahan laporan
const update = async (req, res, next) => {
    res.send('TODO: update laporan');
};

module.exports = {
    editForm,
    update
};