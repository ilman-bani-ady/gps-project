const express = require('express');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = 3000;

// Serve static files
app.use(express.static('public'));

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// API endpoint untuk mengambil data GPS
app.get('/api/locations', async (req, res) => {
  try {
    const result = await pool.query('SELECT latitude, longitude FROM temp_data_lama');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// API endpoint untuk mengambil data rute
app.get('/api/routes', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT rute_trip_id, halte_name, latitude, longitude, rute_sort FROM rute_trip_copy1 ORDER BY rute_trip_id, rute_sort'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 