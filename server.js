require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Admin Middleware
const checkAdmin = (req, res, next) => {
    const userEmail = req.headers['x-user-email'] || req.query.email;
    if (!userEmail || userEmail.toLowerCase() !== 'prashanth.c@brillio.com') {
        return res.status(403).json({ error: "Unauthorized access. Only prashanth.c@brillio.com can perform this action." });
    }
    next();
};
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static files

// Database Setup
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('Error acquiring client', err.stack);
    } else {
        console.log('Connected to PostgreSQL database.');
        initDb();
        release();
    }
});

async function initDb() {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE,
            password TEXT
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS teams (
            id SERIAL PRIMARY KEY,
            name TEXT,
            icon TEXT,
            score INTEGER,
            history TEXT
        )`);

        // Create Reasons Mapping Table
        await pool.query(`CREATE TABLE IF NOT EXISTS reason_mappings (
            id SERIAL PRIMARY KEY,
            reason TEXT,
            description TEXT,
            points INTEGER,
            cap_type TEXT DEFAULT 'Orange'
        )`);
        
        // Check for missing column in existing table (cap_type)
        // In Postgres, we can check information_schema or just try to add it and ignore error, 
        // or check if it exists.
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='reason_mappings' AND column_name='cap_type'
        `);
        
        if (res.rows.length === 0) {
             await pool.query("ALTER TABLE reason_mappings ADD COLUMN cap_type TEXT DEFAULT 'Orange'");
             console.log("Added cap_type column to reason_mappings");
        }

    } catch (err) {
        console.error("Error initializing database:", err);
    }
}

// API Routes - Auth
app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        await pool.query("INSERT INTO users (email, password) VALUES ($1, $2)", [email, password]);
        res.json({ message: "Registered successfully. Please login." });
    } catch (err) {
        return res.status(400).json({ error: "User already exists or error occurred." });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('Login attempt:', { email, password });
    try {
        const result = await pool.query("SELECT * FROM users WHERE email = $1 AND password = $2", [email, password]);
        const user = result.rows[0];

        if (!user) {
            console.log('Login failed for user:', email);
            return res.status(401).json({ error: "Invalid credentials" });
        }
        
        console.log('Login successful for user:', email);
        res.json({ message: "Login successful", user: { id: user.id, email: user.email } });
    } catch (err) {
        console.error('Login database error:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/check', async (req, res) => {
    const { email } = req.body;
    try {
        const result = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        res.json({ exists: !!result.rows[0] });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// API Routes - Reasons
app.get('/api/reasons', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM reason_mappings ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/reasons', async (req, res) => {
    const { reason, description, points, cap_type } = req.body;
    const sql = "INSERT INTO reason_mappings (reason, description, points, cap_type) VALUES ($1, $2, $3, $4) RETURNING id";
    
    try {
        const result = await pool.query(sql, [reason, description, points, cap_type || 'Orange']);
        res.json({ id: result.rows[0].id, reason, description, points, cap_type: cap_type || 'Orange' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/reasons/:id', async (req, res) => {
    const { reason, description, points, cap_type } = req.body;
    const sql = "UPDATE reason_mappings SET reason = $1, description = $2, points = $3, cap_type = $4 WHERE id = $5";
    
    try {
        const result = await pool.query(sql, [reason, description, points, cap_type || 'Orange', req.params.id]);
        res.json({ message: "Updated", changes: result.rowCount });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/reasons/:id', async (req, res) => {
    const sql = "DELETE FROM reason_mappings WHERE id = $1";
    try {
        const result = await pool.query(sql, [req.params.id]);
        res.json({ message: "Deleted", changes: result.rowCount });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// API Routes - Teams
app.get('/api/teams', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM teams ORDER BY id ASC");
        // Parse history JSON
        const teams = result.rows.map(row => ({
            ...row,
            history: JSON.parse(row.history || "[]")
        }));
        res.json(teams);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/teams', async (req, res) => {
    const { name, icon, score, history } = req.body;
    const sql = "INSERT INTO teams (name, icon, score, history) VALUES ($1, $2, $3, $4) RETURNING id";
    const params = [name, icon, score, JSON.stringify(history || [])];
    
    try {
        const result = await pool.query(sql, params);
        res.json({
            id: result.rows[0].id,
            name, icon, score, history
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/teams/:id', async (req, res) => {
    const { name, icon, score, history } = req.body;
    const sql = "UPDATE teams SET name = $1, icon = $2, score = $3, history = $4 WHERE id = $5";
    const params = [name, icon, score, JSON.stringify(history || []), req.params.id];
    
    try {
        const result = await pool.query(sql, params);
        res.json({ message: "Updated", changes: result.rowCount });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/teams/:id', async (req, res) => {
    const sql = "DELETE FROM teams WHERE id = $1";
    try {
        const result = await pool.query(sql, [req.params.id]);
        res.json({ message: "Deleted", changes: result.rowCount });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Admin Routes
app.get('/api/users', checkAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', checkAdmin, async (req, res) => {
    try {
        const result = await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
        res.json({ message: "User deleted", changes: result.rowCount });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Import/Export Routes

// Export Teams
app.get('/api/teams/export', checkAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM teams ORDER BY id ASC");
        
        const worksheet = xlsx.utils.json_to_sheet(result.rows);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "Teams");
        
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename="teams.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Import Teams
app.post('/api/teams/import', checkAdmin, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    const client = await pool.connect();
    
    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);
        
        await client.query('BEGIN');

        for (const row of data) {
            const name = row.name;
            const icon = row.icon || 'fa-brain';
            const score = row.score || 0;
            let history = row.history || '[]';
            if (typeof history !== 'string') history = JSON.stringify(history);

            const checkRes = await client.query("SELECT id FROM teams WHERE name = $1", [name]);
            
            if (checkRes.rows.length > 0) {
                const existingId = checkRes.rows[0].id;
                await client.query(
                    "UPDATE teams SET icon = $1, score = $2, history = $3 WHERE id = $4",
                    [icon, score, history, existingId]
                );
            } else {
                await client.query(
                    "INSERT INTO teams (name, icon, score, history) VALUES ($1, $2, $3, $4)",
                    [name, icon, score, history]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ message: "Teams imported successfully", count: data.length });

    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: "Failed to process file: " + error.message });
    } finally {
        client.release();
    }
});

// Export Reasons
app.get('/api/reasons/export', checkAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM reason_mappings ORDER BY id ASC");
        
        const worksheet = xlsx.utils.json_to_sheet(result.rows);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "Reasons");
        
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename="reasons.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Import Reasons
app.post('/api/reasons/import', checkAdmin, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    const client = await pool.connect();

    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);
        
        await client.query('BEGIN');

        for (const row of data) {
            const reason = row.reason;
            const description = row.description || '';
            const points = row.points || 0;
            const cap_type = row.cap_type || 'Orange';

            const checkRes = await client.query("SELECT id FROM reason_mappings WHERE reason = $1", [reason]);
            
            if (checkRes.rows.length > 0) {
                const existingId = checkRes.rows[0].id;
                await client.query(
                    "UPDATE reason_mappings SET description = $1, points = $2, cap_type = $3 WHERE id = $4",
                    [description, points, cap_type, existingId]
                );
            } else {
                await client.query(
                    "INSERT INTO reason_mappings (reason, description, points, cap_type) VALUES ($1, $2, $3, $4)",
                    [reason, description, points, cap_type]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ message: "Reasons imported successfully", count: data.length });

    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: "Failed to process file: " + error.message });
    } finally {
        client.release();
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
