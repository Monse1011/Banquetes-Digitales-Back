const express = require('express');

function createPasswordResetRoutes(controller) {
    const router = express.Router();
    router.post('/forgot-password', controller.requestReset);
    router.post('/reset-password', controller.resetPassword);
    return router;
}
module.exports = createPasswordResetRoutes;
