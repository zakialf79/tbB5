const db = require('../lib/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Setup multer untuk upload lampiran laporan
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../public/uploads/laporan');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `laporan_${Date.now()}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Format file tidak didukung. Gunakan JPG, PNG, PDF, atau DOC.'));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // max 5MB
});

const uploadAttachment = upload.single('attachment');

// =============================================
// FITUR 1 - Form kirim laporan
// =============================================
const createForm = async (req, res, next) => {
    try {
        const employeeId = req.session.userId;

        // Ambil perjalanan dinas yang diikuti pegawai dan belum ada laporannya
        const [travels] = await db.query(`
            SELECT ot.id, ot.request_number, ot.destination, ot.purpose,
                   ot.start_date, ot.end_date
            FROM official_travel ot
            JOIN official_travel_members otm ON ot.id = otm.official_travel_id
            WHERE otm.employee_id = ?
              AND ot.status = 'approved'
              AND (otm.summary IS NULL OR otm.summary = '')
            ORDER BY ot.start_date DESC
        `, [employeeId]);

        res.render('laporan/create', {
            title: 'Kirim Laporan Perjalanan Dinas',
            travels,
            error: null,
            old: {}
        });
    } catch (err) {
        next(err);
    }
};

// =============================================
// FITUR 1 - Simpan laporan baru
// =============================================
const store = (req, res, next) => {
    uploadAttachment(req, res, async (err) => {
        if (err) {
            const employeeId = req.session.userId;
            const [travels] = await db.query(`
                SELECT ot.id, ot.request_number, ot.destination, ot.purpose,
                       ot.start_date, ot.end_date
                FROM official_travel ot
                JOIN official_travel_members otm ON ot.id = otm.official_travel_id
                WHERE otm.employee_id = ? AND ot.status = 'approved'
                  AND (otm.summary IS NULL OR otm.summary = '')
                ORDER BY ot.start_date DESC
            `, [employeeId]);

            return res.status(400).render('laporan/create', {
                title: 'Kirim Laporan Perjalanan Dinas',
                travels,
                error: err.message,
                old: req.body
            });
        }

        try {
            const employeeId = req.session.userId;
            const { official_travel_id, summary, report_date } = req.body;

            // Validasi server side
            const errors = [];
            if (!official_travel_id) errors.push('Perjalanan dinas wajib dipilih.');
            if (!summary || summary.trim() === '') errors.push('Isi laporan wajib diisi.');
            if (!report_date) errors.push('Tanggal laporan wajib diisi.');

            if (errors.length > 0) {
                const [travels] = await db.query(`
                    SELECT ot.id, ot.request_number, ot.destination, ot.purpose,
                           ot.start_date, ot.end_date
                    FROM official_travel ot
                    JOIN official_travel_members otm ON ot.id = otm.official_travel_id
                    WHERE otm.employee_id = ? AND ot.status = 'approved'
                      AND (otm.summary IS NULL OR otm.summary = '')
                    ORDER BY ot.start_date DESC
                `, [employeeId]);

                return res.status(400).render('laporan/create', {
                    title: 'Kirim Laporan Perjalanan Dinas',
                    travels,
                    error: errors.join(' '),
                    old: req.body
                });
            }

            const attachment = req.file ? req.file.filename : null;

            // Update baris di official_travel_members milik pegawai ini
            await db.query(`
                UPDATE official_travel_members
                SET summary = ?, report_date = ?, attachment = ?, updated_at = NOW()
                WHERE official_travel_id = ? AND employee_id = ?
            `, [summary.trim(), report_date, attachment, official_travel_id, employeeId]);

            res.redirect('/laporan');
        } catch (err) {
            next(err);
        }
    });
};

// =============================================
// FITUR 2 - Daftar laporan milik pegawai
// =============================================
const index = async (req, res, next) => {
    try {
        const employeeId = req.session.userId;
        const search = req.query.search || '';
        const page = parseInt(req.query.page, 10) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const searchParam = `%${search}%`;

        const [rows] = await db.query(`
            SELECT otm.id, otm.summary, otm.report_date, otm.attachment,
                   ot.request_number, ot.destination, ot.purpose,
                   ot.start_date, ot.end_date, ot.status AS travel_status
            FROM official_travel_members otm
            JOIN official_travel ot ON otm.official_travel_id = ot.id
            WHERE otm.employee_id = ?
              AND otm.summary IS NOT NULL AND otm.summary != ''
              AND (ot.destination LIKE ? OR ot.request_number LIKE ? OR otm.summary LIKE ?)
            ORDER BY otm.report_date DESC
            LIMIT ? OFFSET ?
        `, [employeeId, searchParam, searchParam, searchParam, limit, offset]);

        const [[{ total }]] = await db.query(`
            SELECT COUNT(*) AS total
            FROM official_travel_members otm
            JOIN official_travel ot ON otm.official_travel_id = ot.id
            WHERE otm.employee_id = ?
              AND otm.summary IS NOT NULL AND otm.summary != ''
              AND (ot.destination LIKE ? OR ot.request_number LIKE ? OR otm.summary LIKE ?)
        `, [employeeId, searchParam, searchParam, searchParam]);

        res.render('laporan/index', {
            title: 'Daftar Laporan Perjalanan Dinas',
            laporans: rows,
            search,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (err) {
        next(err);
    }
};

// =============================================
// FITUR 2 - Form edit laporan
// =============================================
const editForm = async (req, res, next) => {
    try {
        const employeeId = req.session.userId;
        const { id } = req.params;

        const [rows] = await db.query(`
            SELECT otm.id, otm.summary, otm.report_date, otm.attachment,
                   ot.id AS travel_id, ot.request_number, ot.destination,
                   ot.purpose, ot.start_date, ot.end_date
            FROM official_travel_members otm
            JOIN official_travel ot ON otm.official_travel_id = ot.id
            WHERE otm.id = ? AND otm.employee_id = ?
        `, [id, employeeId]);

        if (rows.length === 0) {
            return res.status(404).render('error', {
                message: 'Laporan tidak ditemukan.',
                error: { status: 404, stack: '' }
            });
        }

        // Cek batas waktu — hanya bisa edit jika end_date belum lewat 7 hari
        const laporan = rows[0];
        const endDate = new Date(laporan.end_date);
        const deadline = new Date(endDate);
        deadline.setDate(deadline.getDate() + 7);
        const now = new Date();

        if (now > deadline) {
            return res.status(403).render('error', {
                message: 'Batas waktu edit laporan sudah lewat (7 hari setelah perjalanan selesai).',
                error: { status: 403, stack: '' }
            });
        }

        res.render('laporan/edit', {
            title: 'Edit Laporan Perjalanan Dinas',
            laporan,
            deadline,
            error: null
        });
    } catch (err) {
        next(err);
    }
};

// =============================================
// FITUR 2 - Simpan perubahan laporan
// =============================================
const update = (req, res, next) => {
    uploadAttachment(req, res, async (err) => {
        if (err) {
            return res.status(400).redirect('back');
        }

        try {
            const employeeId = req.session.userId;
            const { id } = req.params;
            const { summary, report_date } = req.body;

            // Ambil data laporan dulu untuk cek kepemilikan & deadline
            const [rows] = await db.query(`
                SELECT otm.id, otm.attachment, ot.end_date
                FROM official_travel_members otm
                JOIN official_travel ot ON otm.official_travel_id = ot.id
                WHERE otm.id = ? AND otm.employee_id = ?
            `, [id, employeeId]);

            if (rows.length === 0) {
                return res.status(404).render('error', {
                    message: 'Laporan tidak ditemukan.',
                    error: { status: 404, stack: '' }
                });
            }

            const laporan = rows[0];
            const endDate = new Date(laporan.end_date);
            const deadline = new Date(endDate);
            deadline.setDate(deadline.getDate() + 7);

            if (new Date() > deadline) {
                return res.status(403).render('error', {
                    message: 'Batas waktu edit laporan sudah lewat.',
                    error: { status: 403, stack: '' }
                });
            }

            // Validasi
            const errors = [];
            if (!summary || summary.trim() === '') errors.push('Isi laporan wajib diisi.');
            if (!report_date) errors.push('Tanggal laporan wajib diisi.');

            if (errors.length > 0) {
                return res.status(400).redirect('back');
            }

            // Jika ada file baru, hapus file lama
            let attachment = laporan.attachment;
            if (req.file) {
                if (attachment) {
                    const oldPath = path.join(__dirname, '../public/uploads/laporan', attachment);
                    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
                }
                attachment = req.file.filename;
            }

            await db.query(`
                UPDATE official_travel_members
                SET summary = ?, report_date = ?, attachment = ?, updated_at = NOW()
                WHERE id = ? AND employee_id = ?
            `, [summary.trim(), report_date, attachment, id, employeeId]);

            res.redirect('/laporan');
        } catch (err) {
            next(err);
        }
    });
};

module.exports = { index, createForm, store, editForm, update, uploadAttachment };
