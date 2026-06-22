const db = require('../lib/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Setup multer untuk upload bukti pengeluaran
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../public/uploads/receipts');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `receipt_${Date.now()}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Format file tidak didukung. Gunakan JPG, PNG, atau PDF.'));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 } // max 2MB
});

// Export middleware upload untuk dipakai di route
const uploadReceipt = upload.single('receipt_file');

// =============================================
// FITUR 3 - Daftar reimburse milik pegawai
// =============================================
const index = async (req, res, next) => {
    try {
        const employeeId = req.session.userId;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const searchParam = `%${search}%`;

        const [rows] = await db.query(`
            SELECT
                te.id, te.amount, te.description, te.status, te.submitted_at,
                te.receipt_file, tcc.name AS komponen,
                ot.request_number, ot.destination
            FROM travel_expenses te
            JOIN travel_cost_components tcc ON te.travel_cost_component_id = tcc.id
            JOIN official_travel ot ON te.official_travel_id = ot.id
            WHERE te.employee_id = ?
                AND (tcc.name LIKE ? OR ot.destination LIKE ? OR ot.request_number LIKE ?)
            ORDER BY te.submitted_at DESC
            LIMIT ? OFFSET ?
        `, [employeeId, searchParam, searchParam, searchParam, limit, offset]);

        const [[{ total }]] = await db.query(`
            SELECT COUNT(*) AS total
            FROM travel_expenses te
            JOIN travel_cost_components tcc ON te.travel_cost_component_id = tcc.id
            JOIN official_travel ot ON te.official_travel_id = ot.id
            WHERE te.employee_id = ?
                AND (tcc.name LIKE ? OR ot.destination LIKE ? OR ot.request_number LIKE ?)
        `, [employeeId, searchParam, searchParam, searchParam]);

        res.render('reimburse/index', {
            title: 'Daftar Reimburse',
            reimburses: rows,
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
// FITUR 3 - Detail reimburse
// =============================================
const detail = async (req, res, next) => {
    try {
        const employeeId = req.session.userId;
        const { id } = req.params;

        const [rows] = await db.query(`
            SELECT
                te.id, te.amount, te.description, te.status,
                te.submitted_at, te.verified_at, te.receipt_file,
                tcc.name AS komponen, tcc.code AS komponen_code,
                ot.request_number, ot.purpose, ot.destination,
                ot.start_date, ot.end_date
            FROM travel_expenses te
            JOIN travel_cost_components tcc ON te.travel_cost_component_id = tcc.id
            JOIN official_travel ot ON te.official_travel_id = ot.id
            WHERE te.id = ? AND te.employee_id = ?
        `, [id, employeeId]);

        if (rows.length === 0) {
            return res.status(404).render('error', {
                message: 'Data reimburse tidak ditemukan.',
                error: { status: 404, stack: '' }
            });
        }

        res.render('reimburse/detail', {
            title: 'Detail Reimburse',
            reimburse: rows[0]
        });
    } catch (err) {
        next(err);
    }
};

// =============================================
// FITUR 2 - Form ajukan reimburse
// =============================================
const createForm = async (req, res, next) => {
    try {
        const employeeId = req.session.userId;

        // Ambil daftar perjalanan dinas yang diikuti pegawai ini dan sudah approved
        const [travels] = await db.query(`
            SELECT ot.id, ot.request_number, ot.destination, ot.purpose
            FROM official_travel ot
            JOIN official_travel_members otm ON ot.id = otm.official_travel_id
            WHERE otm.employee_id = ? AND ot.status = 'approved'
            ORDER BY ot.start_date DESC
        `, [employeeId]);

        // Ambil daftar komponen biaya
        const [components] = await db.query(`
            SELECT id, name, code FROM travel_cost_components ORDER BY name ASC
        `);

        res.render('reimburse/create', {
            title: 'Ajukan Reimburse',
            travels,
            components,
            error: null,
            old: {}
        });
    } catch (err) {
        next(err);
    }
};

// =============================================
// FITUR 2 - Simpan reimburse baru
// =============================================
const store = (req, res, next) => {
    uploadReceipt(req, res, async (err) => {
        // Handle error upload file
        if (err) {
            const employeeId = req.session.userId;
            const [travels] = await db.query(`
                SELECT ot.id, ot.request_number, ot.destination, ot.purpose
                FROM official_travel ot
                JOIN official_travel_members otm ON ot.id = otm.official_travel_id
                WHERE otm.employee_id = ? AND ot.status = 'approved'
                ORDER BY ot.start_date DESC
            `, [employeeId]);
            const [components] = await db.query(`SELECT id, name, code FROM travel_cost_components ORDER BY name ASC`);

            return res.status(400).render('reimburse/create', {
                title: 'Ajukan Reimburse',
                travels,
                components,
                error: err.message,
                old: req.body
            });
        }

        try {
            const employeeId = req.session.userId;
            const { official_travel_id, travel_cost_component_id, amount, description } = req.body;

            // Validasi server side
            const errors = [];
            if (!official_travel_id) errors.push('Perjalanan dinas wajib dipilih.');
            if (!travel_cost_component_id) errors.push('Komponen biaya wajib dipilih.');
            if (!amount || isNaN(amount) || Number(amount) <= 0) errors.push('Jumlah biaya harus berupa angka positif.');
            if (!req.file) errors.push('Bukti pengeluaran wajib dilampirkan.');

            if (errors.length > 0) {
                const [travels] = await db.query(`
                    SELECT ot.id, ot.request_number, ot.destination, ot.purpose
                    FROM official_travel ot
                    JOIN official_travel_members otm ON ot.id = otm.official_travel_id
                    WHERE otm.employee_id = ? AND ot.status = 'approved'
                    ORDER BY ot.start_date DESC
                `, [employeeId]);
                const [components] = await db.query(`SELECT id, name, code FROM travel_cost_components ORDER BY name ASC`);

                return res.status(400).render('reimburse/create', {
                    title: 'Ajukan Reimburse',
                    travels,
                    components,
                    error: errors.join(' '),
                    old: req.body
                });
            }

            const receiptFile = req.file ? req.file.filename : null;

            await db.query(`
                INSERT INTO travel_expenses
                    (official_travel_id, employee_id, travel_cost_component_id, amount, description, receipt_file, status, submitted_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'submitted', NOW(), NOW(), NOW())
            `, [official_travel_id, employeeId, travel_cost_component_id, amount, description || null, receiptFile]);

            res.redirect('/reimburse');
        } catch (err) {
            next(err);
        }
    });
};

// =============================================
// FITUR 4 - Form edit reimburse (placeholder)
// =============================================
const editForm = async (req, res, next) => {
    res.render('reimburse/edit', { title: 'Edit Reimburse' });
};

const update = async (req, res, next) => {
    res.send('TODO: update');
};

module.exports = { index, detail, createForm, store, editForm, update, uploadReceipt };
const db = require('../config/db');

const convertToCSV = (data) => {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
        Object.values(row).map(val => {
            if (val === null || val === undefined) return '""';
            const cleanVal = String(val).replace(/"/g, '""');
            return `"${cleanVal}"`;
        }).join(',')
    );
    return [headers, ...rows].join('\n');
};

const reimburseController = {
    getAllReimburse: async (req, res) => {
        try {
            const [rows] = await db.execute('SELECT * FROM official_travel_allowances');
            res.status(200).json({ success: true, data: rows });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    searchAndFilter: async (req, res) => {
        try {
            const { status, search } = req.query;
            let query = 'SELECT * FROM official_travel_allowances WHERE 1=1';
            let params = [];

            if (status) {
                query += ' AND status = ?';
                params.push(status);
            }
            if (search) {
                query += ' AND description LIKE ?';
                params.push(`%${search}%`);
            }

            const [rows] = await db.execute(query, params);
            res.status(200).json({ success: true, count: rows.length, data: rows });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    createReimburse: async (req, res) => {
        try {
            const { description, amount } = req.body;
            const receiptFile = req.file ? req.file.filename : null;

            const [result] = await db.execute(
                'INSERT INTO official_travel_allowances (description, amount, receipt_file, status) VALUES (?, ?, ?, "PENDING")',
                [description, amount, receiptFile]
            );

            res.status(201).json({ 
                success: true, 
                message: "Pengajuan klaim reimburse berhasil dibuat", 
                data: { id: result.insertId, description, amount, receiptFile } 
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    updateReimburse: async (req, res) => {
        try {
            const { id } = req.params;
            const { description, amount } = req.body;

            const [check] = await db.execute('SELECT status, receipt_file FROM official_travel_allowances WHERE id = ?', [id]);
            if (check.length === 0) return res.status(404).json({ success: false, message: "Data tidak ditemukan" });
            
            if (check[0].status !== 'PENDING') {
                return res.status(400).json({ success: false, message: "Data sudah diproses pimpinan, tidak bisa diubah!" });
            }

            const receiptFile = req.file ? req.file.filename : check[0].receipt_file;

            await db.execute(
                'UPDATE official_travel_allowances SET description = ?, amount = ?, receipt_file = ? WHERE id = ?',
                [description, amount, receiptFile, id]
            );
            res.status(200).json({ success: true, message: "Pengajuan klaim reimburse berhasil diperbarui" });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    deleteReimburse: async (req, res) => {
        try {
            const { id } = req.params;

            const [check] = await db.execute('SELECT status FROM official_travel_allowances WHERE id = ?', [id]);
            if (check.length === 0) return res.status(404).json({ success: false, message: "Data tidak ditemukan" });
            
            if (check[0].status !== 'PENDING') {
                return res.status(400).json({ success: false, message: "Data sudah diproses, tidak bisa dihapus!" });
            }

            await db.execute('DELETE FROM official_travel_allowances WHERE id = ?', [id]);
            res.status(200).json({ success: true, message: "Pengajuan klaim reimburse berhasil dihapus" });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    approveReimburse: async (req, res) => {
        try {
            const { id } = req.params;
            const { status, note } = req.body;

            if (!['APPROVED', 'REJECTED'].includes(status)) {
                return res.status(400).json({ success: false, message: "Status persetujuan tidak valid. Gunakan APPROVED atau REJECTED" });
            }

            await db.execute(
                'UPDATE official_travel_allowances SET status = ?, approval_note = ? WHERE id = ?',
                [status, note, id]
            );
            res.status(200).json({ success: true, message: `Status klaim reimburse berhasil di-update menjadi ${status}` });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    exportToCSV: async (req, res) => {
        try {
            const [rows] = await db.execute('SELECT * FROM official_travel_allowances');
            const csvContent = convertToCSV(rows);

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=laporan_reimburse_perjalanan_dinas.csv');
            res.status(200).send(csvContent);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

module.exports = reimburseController;
