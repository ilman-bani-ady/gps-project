require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');

const app = express();

// Database configuration from environment variables
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Middleware to check authentication
function checkAuth(req, res, next) {
    // Allow access to login page and its assets
    if (req.path === '/login.html' || 
        req.path === '/login.css' || 
        req.path.startsWith('/assets/') ||
        req.path.startsWith('/api/login')) {
        return next();
    }

    // Check if user is logged in
    if (!req.session.user) {
        return res.redirect('/login.html');
    }

    // Check if user is admin for users.html
    if (req.path === '/users.html' && req.session.user.role !== 'admin') {
        return res.redirect('/index.html');
    }

    next();
}

// Apply authentication middleware
app.use(checkAuth);

// Root route
app.get('/', (req, res) => {
    if (!req.session.user) {
        res.redirect('/login.html');
    } else {
        res.redirect('/index.html');
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt for username:', username);

    try {
        // Query sesuai dengan struktur tabel yang ada
        const result = await pool.query(
            `SELECT id, username, password, full_name, role, created_at, last_login 
             FROM users 
             WHERE username = $1`,
            [username]
        );
        console.log('Query result:', result.rows);

        if (result.rows.length === 0) {
            console.log('User not found');
            return res.status(401).json({ message: 'Username atau password salah' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);
        console.log('Password valid:', validPassword);

        if (!validPassword) {
            console.log('Invalid password');
            return res.status(401).json({ message: 'Username atau password salah' });
        }

        // Update last_login
        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        // Set session dengan data lengkap
        req.session.user = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            created_at: user.created_at,
            last_login: user.last_login
        };

        // Kirim response dengan data yang diperlukan client
        const responseData = {
            message: 'Login berhasil',
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
                created_at: user.created_at,
                last_login: user.last_login
            }
        };
        console.log('Sending response:', responseData);
        res.json(responseData);
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logout berhasil' });
});

// Protected API routes
app.get('/api/routes', checkAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM rute_trip ORDER BY rute_trip_id, rute_sort'
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// User Management Routes
app.get('/api/users', checkAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, full_name, role, created_at, last_login FROM users ORDER BY id'
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/users', checkAuth, async (req, res) => {
    const { username, password, full_name, role } = req.body;
    
    // Validasi input
    if (!username || !password || !full_name || !role) {
        return res.status(400).json({ message: 'Semua field harus diisi' });
    }

    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert user baru sesuai struktur tabel
        const result = await pool.query(
            `INSERT INTO users (username, password, full_name, role, created_at) 
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) 
             RETURNING id, username, full_name, role, created_at`,
            [username, hashedPassword, full_name, role]
        );
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error creating user:', err);
        if (err.code === '23505') { // unique_violation
            res.status(400).json({ message: 'Username sudah digunakan' });
        } else {
            res.status(500).json({ message: 'Server error' });
        }
    }
});

app.put('/api/users/:id', checkAuth, async (req, res) => {
    const { id } = req.params;
    const { full_name, role, password } = req.body;
    try {
        let query, params;
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query = 'UPDATE users SET full_name = $1, role = $2, password = $3 WHERE id = $4 RETURNING id, username, full_name, role';
            params = [full_name, role, hashedPassword, id];
        } else {
            query = 'UPDATE users SET full_name = $1, role = $2 WHERE id = $3 RETURNING id, username, full_name, role';
            params = [full_name, role, id];
        }
        const result = await pool.query(query, params);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User tidak ditemukan' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/users/:id', checkAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User tidak ditemukan' });
        }
        res.json({ message: 'User berhasil dihapus' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 