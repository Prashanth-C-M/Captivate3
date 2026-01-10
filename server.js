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
const PORT = process.env.PORT || 5000;

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

        await pool.query(`CREATE TABLE IF NOT EXISTS team_members (
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

        // Create Quests Table
        await pool.query(`CREATE TABLE IF NOT EXISTS quests (
            id SERIAL PRIMARY KEY,
            title TEXT,
            description TEXT,
            points INTEGER,
            category TEXT,
            icon TEXT
        )`);

        // Seed Quests if empty
        const questCount = await pool.query("SELECT count(*) FROM quests");
        if (parseInt(questCount.rows[0].count) === 0) {
            const seedQuests = [
                { title: 'Cloud Certification', description: 'Complete a recognized cloud certification (AWS/Azure/GCP)', points: 500, category: 'Training', icon: 'fa-cloud' },
                { title: 'Tech Book Review', description: 'Read a technical book and share key takeaways', points: 150, category: 'Training', icon: 'fa-book' },
                { title: 'Reusable Component', description: 'Develop and publish a reusable code component or library', points: 300, category: 'Assets', icon: 'fa-cubes' },
                { title: 'Tech Blog Post', description: 'Write and publish a technical blog post', points: 200, category: 'Assets', icon: 'fa-pen-nib' },
                { title: 'Junior Mentorship', description: 'Mentor a junior developer for a sprint', points: 400, category: 'Mentorship', icon: 'fa-user-group' },
                { title: 'Knowledge Session', description: 'Host a knowledge sharing session (KT) for the team', points: 250, category: 'Mentorship', icon: 'fa-chalkboard-user' }
            ];
            
            for (const q of seedQuests) {
                await pool.query("INSERT INTO quests (title, description, points, category, icon) VALUES ($1, $2, $3, $4, $5)", 
                    [q.title, q.description, q.points, q.category, q.icon]);
            }
            console.log("Seeded initial quests");
        }
        
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

// API Routes - Quests
app.get('/api/quests', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM quests ORDER BY category, title");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/quests', checkAdmin, async (req, res) => {
    const { title, description, points, category, icon } = req.body;
    try {
        const result = await pool.query(
            "INSERT INTO quests (title, description, points, category, icon) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            [title, description, points, category, icon]
        );
        res.json({ id: result.rows[0].id, title, description, points, category, icon });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/quests/:id', checkAdmin, async (req, res) => {
    const { title, description, points, category, icon } = req.body;
    try {
        const result = await pool.query(
            "UPDATE quests SET title = $1, description = $2, points = $3, category = $4, icon = $5 WHERE id = $6",
            [title, description, points, category, icon, req.params.id]
        );
        res.json({ message: "Updated", changes: result.rowCount });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/quests/:id', checkAdmin, async (req, res) => {
    try {
        const result = await pool.query("DELETE FROM quests WHERE id = $1", [req.params.id]);
        res.json({ message: "Deleted", changes: result.rowCount });
    } catch (err) {
        res.status(400).json({ error: err.message });
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

// API Routes - Team Members
app.get('/api/team-members', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM team_members ORDER BY id ASC");
        // Parse history JSON
        const members = result.rows.map(row => ({
            ...row,
            history: JSON.parse(row.history || "[]")
        }));
        res.json(members);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/team-members', async (req, res) => {
    const { name, icon, score, history } = req.body;
    const sql = "INSERT INTO team_members (name, icon, score, history) VALUES ($1, $2, $3, $4) RETURNING id";
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

app.put('/api/team-members/:id', async (req, res) => {
    const { name, icon, score, history } = req.body;
    const sql = "UPDATE team_members SET name = $1, icon = $2, score = $3, history = $4 WHERE id = $5";
    const params = [name, icon, score, JSON.stringify(history || []), req.params.id];
    
    try {
        const result = await pool.query(sql, params);
        res.json({ message: "Updated", changes: result.rowCount });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/team-members/:id', async (req, res) => {
    const sql = "DELETE FROM team_members WHERE id = $1";
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

// Export Team Members
app.get('/api/team-members/export', checkAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM team_members ORDER BY id ASC");
        
        const worksheet = xlsx.utils.json_to_sheet(result.rows);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "TeamMembers");
        
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename="team_members.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Import Team Members
app.post('/api/team-members/import', checkAdmin, upload.single('file'), async (req, res) => {
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

            const checkRes = await client.query("SELECT id FROM team_members WHERE name = $1", [name]);
            
            if (checkRes.rows.length > 0) {
                const existingId = checkRes.rows[0].id;
                await client.query(
                    "UPDATE team_members SET icon = $1, score = $2, history = $3 WHERE id = $4",
                    [icon, score, history, existingId]
                );
            } else {
                await client.query(
                    "INSERT INTO team_members (name, icon, score, history) VALUES ($1, $2, $3, $4)",
                    [name, icon, score, history]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ message: "Team Members imported successfully", count: data.length });

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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
});

module.exports = app;
