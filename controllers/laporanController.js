const db = require('../lib/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

// Setup multer untuk upload lampiran laporan manual (Fitur 1 & 2)
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

            const errors = [];
            if (!summary || summary.trim() === '') errors.push('Isi laporan wajib diisi.');
            if (!report_date) errors.push('Tanggal laporan wajib diisi.');

            if (errors.length > 0) {
                return res.status(400).redirect('back');
            }

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

// =============================================
// FITUR 5 - Export laporan ke Excel
// =============================================
const exportExcel = async (req, res, next) => {
    try {
        const employeeId = req.session.userId;
        const [rows] = await db.query(` 
            SELECT
                otm.id, otm.summary, otm.report_date, otm.attachment, otm.role,
                ot.request_number, ot.destination, ot.purpose,
                ot.start_date, ot.end_date, ot.status AS travel_status
            FROM official_travel_members otm
            JOIN official_travel ot ON otm.official_travel_id = ot.id
            WHERE otm.employee_id = ?
                AND otm.summary IS NOT NULL AND otm.summary != ''
            ORDER BY otm.report_date DESC
        `, [employeeId]);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'FacultyWare';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Laporan Perjalanan Dinas');

        worksheet.columns = [
            { header: 'No', key: 'no', width: 5 },
            { header: 'No. Surat', key: 'request_number', width: 20 },
            { header: 'Tujuan', key: 'destination', width: 20 },
            { header: 'Keperluan', key: 'purpose', width: 25 },
            { header: 'Tanggal Mulai', key: 'start_date', width: 15 },
            { header: 'Tanggal Selesai', key: 'end_date', width: 15 },
            { header: 'Tanggal Laporan', key: 'report_date', width: 15 },
            { header: 'Role', key: 'role', width: 15 },
            { header: 'Isi Laporan', key: 'summary', width: 40 },
            { header: 'Status Perjalanan', key: 'travel_status', width: 18 }
        ];

        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF2563EB' }
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        rows.forEach((r, i) => {
            worksheet.addRow({
                no: i + 1,
                request_number: r.request_number,
                destination: r.destination,
                purpose: r.purpose,
                start_date: r.start_date ? new Date(r.start_date).toLocaleDateString('id-ID') : '-',
                end_date: r.end_date ? new Date(r.end_date).toLocaleDateString('id-ID') : '-',
                report_date: r.report_date ? new Date(r.report_date).toLocaleDateString('id-ID') : '-',
                role: r.role || '-',
                summary: r.summary,
                travel_status: r.travel_status,
            });
        });

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    cell.alignment = { wrapText: true, vertical: 'middle' };
                });
            }
        });

        const filename = `laporan_perjalanan_${Date.now()}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        next(err);
    }   
};

// =============================================
// FITUR 5 - Form import laporan (Tampilan)
// =============================================
const importForm = async (req, res, next) => {
    try {
        res.render('laporan/import', {
            title: 'Import Laporan Perjalanan Dinas',
            error: null,
            success: null
        });
    } catch (err) {
        next(err);
    }
};

// =============================================
// FITUR 5 - Proses import laporan dari Excel
// =============================================
const multerImport = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.xlsx') {
            cb(null, true);
        } else {
            cb(new Error('Format file tidak didukung. Gunakan file Excel (.xlsx).'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // max 5MB
}).single('import_file');

const importExcel = (req, res, next) => {
    multerImport(req, res, async (err) => {
        if (err) {
            return res.render('laporan/import', {
                title: 'Import Laporan Perjalanan Dinas',
                error: err.message,
                success: null
            });
        }

        if (!req.file) {
            return res.render('laporan/import', {
                title: 'Import Laporan Perjalanan Dinas',
                error: 'File wajib diupload.',
                success: null
            });
        }

        try {
            const employeeId = req.session.userId;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(req.file.buffer);

            const sheet = workbook.getWorksheet(1);
            const errors = [];
            let successCount = 0;

            for (let i = 2; i <= sheet.rowCount; i++) {
                const row = sheet.getRow(i);
                
                const raw_request_number = row.getCell(1).value;
                const report_date = row.getCell(2).value;
                const raw_summary = row.getCell(3).value;

                // Normalisasi pembacaan teks sel excel
                const request_number = raw_request_number && typeof raw_request_number === 'object' ? raw_request_number.text : raw_request_number?.toString().trim();
                const summary = raw_summary?.toString().trim();

                if (!request_number && !summary) continue;

                if (!request_number) {
                    errors.push(`Baris ${i}: No. Surat wajib diisi.`);
                    continue;
                }
                if (!summary) {
                    errors.push(`Baris ${i}: Isi laporan wajib diisi.`);
                    continue;
                }
                if (!report_date) {
                    errors.push(`Baris ${i}: Tanggal laporan wajib diisi.`);
                    continue;
                }

                const [travels] = await db.query(`
                    SELECT ot.id 
                    FROM official_travel ot
                    JOIN official_travel_members otm ON ot.id = otm.official_travel_id
                    WHERE ot.request_number = ? AND otm.employee_id = ? 
                `, [request_number, employeeId]);

                if (travels.length === 0) {
                    errors.push(`Baris ${i}: No. Surat "${request_number}" tidak ditemukan atau bukan milik Anda.`);
                    continue;
                }

                const travelId = travels[0].id;
                const reportDateFormatted = new Date(report_date).toISOString().split('T')[0];

                await db.query(`
                    UPDATE official_travel_members
                    SET summary = ?, report_date = ?, updated_at = NOW()
                    WHERE official_travel_id = ? AND employee_id = ?
                `, [summary, reportDateFormatted, travelId, employeeId]);

                successCount++;
            }

            return res.render('laporan/import', {
                title: 'Import Laporan Perjalanan Dinas',
                error: errors.length > 0 ? errors.join('<br>') : null,
                success: successCount > 0 ? `${successCount} laporan berhasil diimport.` : null
            });
        } catch (err) {
            next(err);
        }
    });
};

module.exports = { index, createForm, store, editForm, update, uploadAttachment, exportExcel, importForm, importExcel };