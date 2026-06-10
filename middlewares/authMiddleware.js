const authMiddleware = (req, res, next) => {
    next();
};

// Tambahan fungsi bypass untuk mendamaikan rute milik Zaki
const verifikasiToken = (req, res, next) => {
    next();
};

const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        const userRole = req.headers['role'] || 'Pegawai'; 
        const userId = req.headers['user-id'] || 1; 

        req.user = { id: parseInt(userId), role: userRole };

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: `Akses ditolak. Fitur ini hanya untuk role: ${allowedRoles.join(', ')}` 
            });
        }
        next();
    };
};

const cekRole = (roleId) => {
    return (req, res, next) => {
        const userRoleId = req.headers['role-id'] || 1; 

        if (parseInt(userRoleId) !== parseInt(roleId)) {
            return res.status(403).json({ 
                success: false, 
                message: "Akses ditolak. Role ID tidak sesuai." 
            });
        }
        next();
    };
};

// Pastikan verifikasiToken ikut diekspor di sini
module.exports = { authMiddleware, verifikasiToken, checkRole, cekRole };