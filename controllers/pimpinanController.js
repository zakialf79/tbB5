const db = require('../lib/db');

const pimpinanController = {
    // Fitur 7: Mengambil semua data permohonan dinas pegawai
    ambilDaftarDinas: async (req, res) => {
        try {
            const [rows] = await db.query(`
                SELECT ot.*, e.name AS nama_pegawai 
                FROM official_travel ot
                JOIN employees e ON ot.submitted_by = e.id
                ORDER BY ot.created_at DESC
            `);
            
            res.render('pimpinan/daftar_dinas', { dataDinas: rows, user: req.user || { id: 1, name: 'Pimpinan Mock' } });
        } catch (error) {
            res.status(500).send("Gagal mengambil daftar dinas: " + error.message);
        }
    },

    // Fitur 8: Mengambil 1 data dinas spesifik + JOIN nama pegawai biar gak undefined di EJS
    ambilDetailDinas: async (req, res) => {
        const { id } = req.params;
        try {
            const [rows] = await db.query(`
                SELECT ot.*, e.name AS nama_pegawai 
                FROM official_travel ot
                JOIN employees e ON ot.submitted_by = e.id
                WHERE ot.id = ?
            `, [id]);

            if (rows.length === 0) return res.status(404).send('Data dinas tidak ditemukan');
            
            res.render('pimpinan/detail_dinas', { dinas: rows[0], user: req.user || { id: 1, name: 'Pimpinan Mock' } });
        } catch (error) {
            res.status(500).send("Gagal mengambil detail dinas: " + error.message);
        }
    },

    // Fitur 9 & 10: Memproses tombol Setuju ('approved') atau Tolak ('rejected')
    prosesKeputusanDinas: async (req, res) => {
        const { id } = req.params;
        const { status, catatan } = req.body; 
        
        const approverId = req.user ? req.user.id : 1;

        try {
            // 1. Update status permohonan dinas utama
            await db.query(`
                UPDATE official_travel 
                SET status = ?, approved_by_id = ?, approved_at = NOW() 
                WHERE id = ?
            `, [status, approverId, id]);
            
            // 2. Catat riwayat log ke tabel persetujuan
            await db.query(`
                INSERT INTO official_travel_approvals (official_travel_id, approver_id, status, notes, action_date, employee_id) 
                VALUES (?, ?, ?, ?, NOW(), ?)
            `, [id, approverId, status, catatan, approverId]);

            res.redirect('/pimpinan/perjalanan-dinas');
        } catch (error) {
            res.status(500).send("Gagal memproses keputusan pimpinan: " + error.message);
        }
    },

    // Fitur 12: Mengembalikan data mentah berformat JSON untuk API
    ambilApiSemuaDinas: async (req, res) => {
        try {
            const [rows] = await db.query('SELECT * FROM official_travel');
            res.json({ status: 'success', data: rows });
        } catch (error) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    },

    // Fitur 11 (DONE): Ekspor data perjalanan dinas ke format Excel (.xlsx)
    eksporDataDinas: async (req, res) => {
        try {
            const ExcelJS = require('exceljs');
            
            // 1. Ambil data dari database
            const [rows] = await db.query(`
                SELECT ot.*, e.name AS nama_pegawai 
                FROM official_travel ot
                JOIN employees e ON ot.submitted_by = e.id
                ORDER BY ot.created_at DESC
            `);

            // 2. Setup Workbook & Worksheet
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Laporan Perjalanan Dinas');

            // 3. Mapping Kolom Excel
            worksheet.columns = [
                { header: 'No. Permohonan', key: 'request_number', width: 25 },
                { header: 'Nama Pegawai', key: 'nama_pegawai', width: 25 },
                { header: 'Kota Tujuan', key: 'destination', width: 20 },
                { header: 'Maksud Perjalanan', key: 'purpose', width: 35 },
                { header: 'Tanggal Berangkat', key: 'start_date', width: 20 },
                { header: 'Tanggal Kembali', key: 'end_date', width: 20 },
                { header: 'Status', key: 'status', width: 15 }
            ];

            // Bikin header baris pertama jadi tebal (bold)
            worksheet.getRow(1).font = { bold: true };

            // 4. Inject data rows ke Excel
            rows.forEach((dinas) => {
                worksheet.addRow({
                    request_number: dinas.request_number,
                    nama_pegawai: dinas.nama_pegawai,
                    destination: dinas.destination,
                    purpose: dinas.purpose,
                    start_date: new Date(dinas.start_date).toLocaleDateString('id-ID'),
                    end_date: new Date(dinas.end_date).toLocaleDateString('id-ID'),
                    status: dinas.status.toUpperCase()
                });
            });

            // 5. Set header download browser
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader(
                'Content-Disposition',
                'attachment; filename=Laporan_Perjalanan_Dinas_' + Date.now() + '.xlsx'
            );

            // 6. Jalankan proses write stream ke response browser
            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            res.status(500).send("Gagal mengeksport data ke Excel: " + error.message);
        }
    },

    // Kerangka Fitur 11: Impor Data (Bisa dicicil nanti kalau dosen minta input massal)
    imporDataDinas: async (req, res) => { res.send('Fitur impor dalam pengembangan'); }
};

module.exports = pimpinanController;