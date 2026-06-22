const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { isAuthenticated } = require('../middlewares/auth');

/**
 * GET /api/laporan
 * REST API - Mengembalikan data laporan perjalanan dinas milik pegawai dalam format JSON
 */
router.get('/laporan', isAuthenticated, async (req, res) => {
    try {
        const employeeId = req.session.userId;
        const search = req.query.search || '';
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;
        const searchParam = `%${search}%`;

        const [rows] = await db.query(`
            SELECT
                otm.id,
                otm.summary,
                otm.report_date,
                otm.attachment,
                otm.role,
                ot.request_number,
                ot.purpose,
                ot.destination,
                ot.start_date,
                ot.end_date,
                ot.status AS travel_status
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

        return res.status(200).json({
            success: true,
            message: 'Data laporan perjalanan dinas berhasil diambil.',
            data: rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server.',
            error: err.message
        });
    }
});

/**
 * GET /api/laporan/:id
 * REST API - Mengembalikan detail satu laporan
 */
router.get('/laporan/:id', isAuthenticated, async (req, res) => {
    try {
        const employeeId = req.session.userId;
        const { id } = req.params;

        const [rows] = await db.query(`
            SELECT
                otm.id,
                otm.summary,
                otm.report_date,
                otm.attachment,
                otm.role,
                ot.request_number,
                ot.purpose,
                ot.destination,
                ot.start_date,
                ot.end_date,
                ot.status AS travel_status
            FROM official_travel_members otm
            JOIN official_travel ot ON otm.official_travel_id = ot.id
            WHERE otm.id = ? AND otm.employee_id = ?
        `, [id, employeeId]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Laporan tidak ditemukan.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Detail laporan berhasil diambil.',
            data: rows[0]
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server.',
            error: err.message
        });
    }
});

module.exports = router;