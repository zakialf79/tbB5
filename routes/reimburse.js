const express = require('express');
const router = express.Router();
const reimburseController = require('../controllers/reimburseController');
const { isAuthenticated } = require('../middlewares/auth');
const { checkPermissions } = require('../middlewares/acl');

// fitur 3: daftar reimburse
router.get('/', isAuthenticated, checkPermissions('reimburse.view'), reimburseController.index);

//fitur 3: detail reimburse
router.get('/:id', isAuthenticated, checkPermissions('reimburse.view'), reimburseController.detail);

// fitur 2: form ajukan reimburse
router.get('/create', isAuthenticated, checkPermissions('reimburse.create'), reimburseController.createForm);

// fitur 2: simpan reimburse baru
router.post('/', isAuthenticated, checkPermissions('reimburse.create'), reimburseController.store);

// fitur 4: form edit reimburse
router.get('/:id/edit', isAuthenticated, checkPermissions('reimburse.edit'), reimburseController.editForm);

// fitur 4: simpan perubahan
router.post('/:id', isAuthenticated, checkPermissions('reimburse.edit'), reimburseController.update);

module.exports = router;
