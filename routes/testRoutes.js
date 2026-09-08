const express = require('express');
const requireRole = require('../middleware/roleMiddleware');

function createTestRoutes(authMiddleware) {
    const router = express.Router();
    router.get('/protected', authMiddleware, (req, res) => res.json({ message: 'Acceso autorizado', user: req.user }));
    router.get('/admin-only', authMiddleware, requireRole('admin'), (req, res) => res.json({ message: 'Acceso autorizado para administrador', user: req.user }));
    return router;
}
module.exports = createTestRoutes;
