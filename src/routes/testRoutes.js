const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get(
    '/protected',
    authMiddleware,
    (req, res) => {

        res.json({
            message: 'Acceso autorizado',
            user: req.user
        });

    }
);

router.get(
    '/admin-only',
    authMiddleware,
    requireRole('admin'),
    (req, res) => {

        res.json({
            message: 'Acceso autorizado para administrador',
            user: req.user
        });

    }
);

module.exports = router;