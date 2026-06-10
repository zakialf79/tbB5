const authMiddleware = (req, res, next) => {
    const userId = req.headers['user-id'] || 1;
    const userRole = req.headers['role'] || 'Pegawai';
    const userRoleId = req.headers['role-id'] || 1;

    req.user = {
        id: parseInt(userId),
        role: userRole,
        roleId: parseInt(userRoleId)
    };

    next();
};

const verifikasiToken = (req, res, next) => {
    authMiddleware(req, res, next);
};

const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            const userRole = req.headers['role'] || 'Pegawai';
            const userId = req.headers['user-id'] || 1;
            req.user = { id: parseInt(userId), role: userRole };
        }

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
        const userRoleId = req.user ? req.user.roleId : (req.headers['role-id'] || 1);

        if (parseInt(userRoleId) !== parseInt(roleId)) {
            return res.status(403).json({ 
                success: false, 
                message: "Akses ditolak. Role ID tidak sesuai." 
            });
        }
        next();
    };
};

module.exports = { authMiddleware, verifikasiToken, checkRole, cekRole };