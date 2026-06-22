const validateReimburse = (req, res, next) => {
    const { description, amount } = req.body;

    if (!description || description.trim() === '') {
        return res.status(400).json({ success: false, message: 'Deskripsi pengajuan tidak boleh kosong!' });
    }

    if (amount === undefined || isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({ success: false, message: 'Nominal klaim (amount) harus berupa angka positif yang valid!' });
    }

    next();
};

module.exports = validateReimburse;