// Tambahkan middleware untuk mengecek role admin
function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    next();
}

// Routes untuk API
app.get('/api/routes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM rute_trip ORDER BY rute_trip_id, rute_sort');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Routes untuk user management
app.get('/api/users', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, full_name, role, last_login FROM users ORDER BY username'
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ... routes lainnya ...