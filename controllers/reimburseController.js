const db = require('../config/db');
const fs = require('fs'); // Tambahan modul wajib untuk membaca file CSV saat import

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
    },

    // --- TAMBAHAN: Fitur Import Data CSV ---
    importFromCSV: async (req, res) => {
        try {
            // Memastikan Multer berhasil menangkap file
            if (!req.file) {
                return res.status(400).json({ success: false, message: "File CSV tidak ditemukan! Pastikan upload via form-data" });
            }

            // Membaca isi file CSV
            const csvData = fs.readFileSync(req.file.path, 'utf8');
            const rows = csvData.split('\n');

            if (rows.length < 2) {
                return res.status(400).json({ success: false, message: "Format CSV kosong atau tidak memiliki isi data" });
            }

            let importedCount = 0;

            // Loop dimulai dari index 1 untuk melewati baris header
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i].trim();
                if (!row) continue; // Lewati baris kosong di akhir file

                // Pecah kolom berdasarkan koma
                const columns = row.split(',');

                // Asumsi indeks CSV hasil export kita:
                // id(0), description(1), amount(2), receipt_file(3)
                const description = columns[1] ? columns[1].replace(/"/g, '').trim() : 'Data Hasil Import';
                const amount = columns[2] ? parseFloat(columns[2].replace(/"/g, '')) : 0;

                // Masukkan sebagai data baru dengan status PENDING
                await db.execute(
                    'INSERT INTO official_travel_allowances (description, amount, receipt_file, status) VALUES (?, ?, ?, "PENDING")',
                    [description, amount, 'imported_data.csv']
                );
                importedCount++;
            }

            // (Opsional) Menghapus file CSV sementara dari server setelah sukses diimpor
            fs.unlinkSync(req.file.path);

            res.status(200).json({ success: true, message: `Berhasil mengimpor ${importedCount} data pengajuan reimburse` });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

module.exports = reimburseController;