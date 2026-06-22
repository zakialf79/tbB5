const db = require('../lib/db');
const ExcelJS = require('exceljs');

function getPegawaiId(req) {
  // Pada project ini session login menyimpan userId. Untuk demo lokal,
  // userId juga dipakai sebagai id pegawai agar fitur bisa berjalan.
  return req.session && req.session.userId ? req.session.userId : 1;
}

function generateNomorPermohonan() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `SPD-${y}${m}${d}-${rand}`;
}

const pegawaiController = {
  // Fitur 1: Pegawai menambahkan permohonan perjalanan dinas
  tampilFormTambah: async (req, res) => {
    res.render('pegawai/form_dinas', {
      title: 'Tambah Permohonan Perjalanan Dinas',
      mode: 'tambah',
      dinas: {},
      error: null
    });
  },

  simpanPermohonan: async (req, res) => {
    const pegawaiId = getPegawaiId(req);
    const { purpose, destination, start_date, end_date } = req.body;

    if (!purpose || !destination || !start_date || !end_date) {
      return res.render('pegawai/form_dinas', {
        title: 'Tambah Permohonan Perjalanan Dinas',
        mode: 'tambah',
        dinas: req.body,
        error: 'Semua field wajib diisi.'
      });
    }

    if (new Date(start_date) > new Date(end_date)) {
      return res.render('pegawai/form_dinas', {
        title: 'Tambah Permohonan Perjalanan Dinas',
        mode: 'tambah',
        dinas: req.body,
        error: 'Tanggal kembali tidak boleh lebih awal dari tanggal berangkat.'
      });
    }

    try {
      await db.query(`
        INSERT INTO official_travel
        (request_number, submitted_by, purpose, destination, start_date, end_date, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
      `, [generateNomorPermohonan(), pegawaiId, purpose, destination, start_date, end_date]);

      res.redirect('/pegawai/perjalanan-dinas');
    } catch (error) {
      res.status(500).send('Gagal menyimpan permohonan: ' + error.message);
    }
  },

  // Fitur 2: Pegawai melihat daftar permohonan miliknya
  ambilDaftarSaya: async (req, res) => {
    const pegawaiId = getPegawaiId(req);
    try {
      const [rows] = await db.query(`
        SELECT * FROM official_travel
        WHERE submitted_by = ?
        ORDER BY created_at DESC
      `, [pegawaiId]);

      res.render('pegawai/daftar_dinas', {
        title: 'Daftar Permohonan Saya',
        dataDinas: rows
      });
    } catch (error) {
      res.status(500).send('Gagal mengambil data permohonan: ' + error.message);
    }
  },

  // Fitur 3: Pegawai mengubah permohonan yang belum disetujui/diproses
  tampilFormEdit: async (req, res) => {
    const pegawaiId = getPegawaiId(req);
    const { id } = req.params;

    try {
      const [rows] = await db.query(`
        SELECT * FROM official_travel
        WHERE id = ? AND submitted_by = ?
      `, [id, pegawaiId]);

      if (rows.length === 0) return res.status(404).send('Permohonan tidak ditemukan.');
      if (rows[0].status !== 'pending') return res.status(403).send('Permohonan yang sudah diproses tidak dapat diubah.');

      res.render('pegawai/form_dinas', {
        title: 'Edit Permohonan Perjalanan Dinas',
        mode: 'edit',
        dinas: rows[0],
        error: null
      });
    } catch (error) {
      res.status(500).send('Gagal membuka form edit: ' + error.message);
    }
  },

  updatePermohonan: async (req, res) => {
    const pegawaiId = getPegawaiId(req);
    const { id } = req.params;
    const { purpose, destination, start_date, end_date } = req.body;

    if (!purpose || !destination || !start_date || !end_date) {
      return res.status(400).send('Semua field wajib diisi.');
    }

    if (new Date(start_date) > new Date(end_date)) {
      return res.status(400).send('Tanggal kembali tidak boleh lebih awal dari tanggal berangkat.');
    }

    try {
      const [result] = await db.query(`
        UPDATE official_travel
        SET purpose = ?, destination = ?, start_date = ?, end_date = ?, updated_at = NOW()
        WHERE id = ? AND submitted_by = ? AND status = 'pending'
      `, [purpose, destination, start_date, end_date, id, pegawaiId]);

      if (result.affectedRows === 0) return res.status(403).send('Permohonan tidak dapat diubah karena sudah diproses atau bukan milik kamu.');
      res.redirect('/pegawai/perjalanan-dinas');
    } catch (error) {
      res.status(500).send('Gagal memperbarui permohonan: ' + error.message);
    }
  },

  // Fitur 4: Pegawai menghapus permohonan yang belum diproses
  hapusPermohonan: async (req, res) => {
    const pegawaiId = getPegawaiId(req);
    const { id } = req.params;

    try {
      const [result] = await db.query(`
        DELETE FROM official_travel
        WHERE id = ? AND submitted_by = ? AND status = 'pending'
      `, [id, pegawaiId]);

      if (result.affectedRows === 0) return res.status(403).send('Permohonan tidak dapat dihapus karena sudah diproses atau bukan milik kamu.');
      res.redirect('/pegawai/perjalanan-dinas');
    } catch (error) {
      res.status(500).send('Gagal menghapus permohonan: ' + error.message);
    }
  },

  // Fitur 5: Pegawai mengekspor data permohonan miliknya ke Excel
  eksporDataSaya: async (req, res) => {
    const pegawaiId = getPegawaiId(req);

    try {
      const [rows] = await db.query(`
        SELECT request_number, purpose, destination, start_date, end_date, status, created_at
        FROM official_travel
        WHERE submitted_by = ?
        ORDER BY created_at DESC
      `, [pegawaiId]);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Permohonan Saya');
      worksheet.columns = [
        { header: 'No. Permohonan', key: 'request_number', width: 24 },
        { header: 'Maksud Perjalanan', key: 'purpose', width: 35 },
        { header: 'Kota Tujuan', key: 'destination', width: 20 },
        { header: 'Tanggal Berangkat', key: 'start_date', width: 20 },
        { header: 'Tanggal Kembali', key: 'end_date', width: 20 },
        { header: 'Status', key: 'status', width: 15 }
      ];
      worksheet.getRow(1).font = { bold: true };

      rows.forEach((row) => worksheet.addRow({
        request_number: row.request_number,
        purpose: row.purpose,
        destination: row.destination,
        start_date: row.start_date ? new Date(row.start_date).toLocaleDateString('id-ID') : '',
        end_date: row.end_date ? new Date(row.end_date).toLocaleDateString('id-ID') : '',
        status: row.status
      }));

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=Permohonan_Perjalanan_Dinas_Saya.xlsx');
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      res.status(500).send('Gagal mengekspor data: ' + error.message);
    }
  },

  // Fitur 5: Import sederhana melalui textarea CSV agar tidak perlu library upload tambahan
  tampilFormImpor: (req, res) => {
    res.render('pegawai/impor_dinas', { title: 'Impor Permohonan', error: null, sukses: null });
  },

  imporDataSaya: async (req, res) => {
    const pegawaiId = getPegawaiId(req);
    const { data_csv } = req.body;

    if (!data_csv || !data_csv.trim()) {
      return res.render('pegawai/impor_dinas', { title: 'Impor Permohonan', error: 'Data impor belum diisi.', sukses: null });
    }

    const lines = data_csv.trim().split(/\r?\n/).filter(Boolean);
    let berhasil = 0;

    try {
      for (const line of lines) {
        const [purpose, destination, start_date, end_date] = line.split(',').map((item) => item && item.trim());
        if (!purpose || !destination || !start_date || !end_date) continue;

        await db.query(`
          INSERT INTO official_travel
          (request_number, submitted_by, purpose, destination, start_date, end_date, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
        `, [generateNomorPermohonan(), pegawaiId, purpose, destination, start_date, end_date]);
        berhasil += 1;
      }

      res.render('pegawai/impor_dinas', {
        title: 'Impor Permohonan',
        error: null,
        sukses: `${berhasil} data berhasil diimpor.`
      });
    } catch (error) {
      res.render('pegawai/impor_dinas', { title: 'Impor Permohonan', error: 'Gagal impor: ' + error.message, sukses: null });
    }
  },

  // Fitur 6: API JSON permohonan perjalanan dinas milik pegawai
  ambilApiDataSaya: async (req, res) => {
    const pegawaiId = getPegawaiId(req);

    try {
      const [rows] = await db.query(`
        SELECT * FROM official_travel
        WHERE submitted_by = ?
        ORDER BY created_at DESC
      `, [pegawaiId]);

      res.json({
        status: 'success',
        owner: pegawaiId,
        total: rows.length,
        data: rows
      });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
};

module.exports = pegawaiController;
