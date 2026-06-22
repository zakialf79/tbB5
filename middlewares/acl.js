const db = require("../lib/db");

const checkPermission = (requiredPermissions) => {
  return async (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).redirect('/login');
    }

    try {
      const [rows] = await db.query(
        'SELECT role FROM users WHERE id = ?',
        [req.session.userId]
      );

      if (rows.length === 0) {
        return res.status(403).render('error', {
          message: 'Forbidden: User tidak ditemukan.',
          error: { status: 403, stack: '' }
        });
      }

      const userRole = rows[0].role;

      // Pegawai boleh akses semua fitur reimburse & laporan
      // Bisa dikembangkan lebih lanjut sesuai kebutuhan ACL
      if (userRole === 'pegawai' || userRole === 'admin') {
        return next();
      }

      return res.status(403).render('error', {
        message: 'Forbidden: Anda tidak memiliki akses ke halaman ini.',
        error: { status: 403, stack: '' }
      });
    } catch (err) {
      next(err);
    }
  };
};

module.exports = { checkPermission };