const db = require('../lib/db');

// fitur 3: daftar reimburse milik pegawai
const index = async (req, res, next) => {
    try {
        const employeeId = req.session.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit; 
        const search = req.query.search || '';

        // query utama dg JOIN ke tabel terkait
        const query = `
            SELECT
                te.id,
                te.amount,
                te.description,
                te.status,
                te.submitted_at,
                te.receipt_file,
                tcc.name AS komponen,
                ot.request_number,
                ot.destination
            FROM travel_expenses te
            JOIN travel_cost_components tcc ON te.travel_cost_component_id = tcc.id
            JOIN official_travel ot ON te.official_travel_id = ot.id
            WHERE te.employee_id = ?
                AND (tcc.name LIKE ? OR ot.destination LIKE ? OR ot.request_number LIKE ?)
            ORDER BY te.submitted_at DESC
            LIMIT ? OFFSET ?
        `;

        //query hitung total untuk pagination
        const countQuery = `
            SELECT COUNT(*) AS total
            FROM travel_expenses te
            JOIN travel_cost_components tcc ON te.travel_cost_component_id = tcc.id
            JOIN official_travel ot ON te.official_travel_id = ot.id
            WHERE te.employee_id = ?
                AND (tcc.name LIKE ? OR ot.destination LIKE ? OR ot.request_number LIKE ?)
        `;

        const searchParam = `%${search}%`;

        const [rows] = await db.query(query, [employeeId, searchParam, searchParam, searchParam, limit, offset]);
        const [[{ total }]] = await db.query(countQuery, [employeeId, searchParam, searchParam, searchParam]);

        const totalPages = Math.ceil(total / limit);

        res.render('reimburse/index', { 
            title: 'Daftar Reimburse',
            reimburses: rows,
            search,
            currentPage: page,
            totalPages,
            total
        });
    } catch (err) {
        next(err);
    }   
};

// fitur 3: detail reimburse
const detail = async (req, res, next) => {
    try {
        const employeeId = req.session.userId;
        const { id } = req.params;

        const query = `
            SELECT
                te.id,
                te.amount,
                te.description,
                te.status,
                te.submitted_at,
                te.veriied_at,
                te.receipt_file,
                tcc.name AS komponen,
                tcc.code AS komponen_code,
                ot.request_number,
                ot.purpose,
                ot.destination,
                ot.start_date,
                ot.end_date,
            FROM travel_expenses te
            JOIN travel_cost_components tcc ON te.travel_cost_component_id = tcc.id
            JOIN official_travel ot ON te.official_travel_id = ot.id
            WHERE te.id = ? AND te.employee_id = ?
        `;

        const [rows] = await db.query(query, [id, employeeId]);

        //kalau tidak ditemukan atau bukan milik user ini
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

// fitur 2: form ajukan reimburse (placeholder)
const createForm = async (req, res, next) => {
    res.render('reimburse/create', { title: 'Ajukan Reimburse' });
};

const store = async (req, res, next) => {
    res.send('TODO: store');
};

// fitur 4: form edit reimburse (placeholder)
const editForm = async (req, res, next) => {
    res.render('reimburse/edit', { title: 'Edit Reimburse' });
};

const update = async (req, res, next) => {
    res.send('TODO: update');
};

module.exports = {
    index,
    detail,
    createForm,
    store,
    editForm,
    update
};