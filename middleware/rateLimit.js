function createRateLimit({ windowMs, max, message }) {
    const clients = new Map();

    return (req, res, next) => {
        const key = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const current = clients.get(key);

        if (!current || now - current.start >= windowMs) {
            clients.set(key, { start: now, count: 1 });
            return next();
        }

        current.count += 1;

        if (current.count > max) {
            return res.status(429).json({ message });
        }

        next();
    };
}

module.exports = createRateLimit;
