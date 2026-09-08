const express = require('express');

const PasswordResetController =
    require('../controllers/passwordResetController');

const router = express.Router();

const passwordResetController =
    new PasswordResetController();

router.post(
    '/forgot-password',
    passwordResetController.requestReset
);

router.post(
    '/reset-password',
    passwordResetController.resetPassword
);

module.exports = router;