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
    if (!userEmail || userEmail.toLowerCase() !== 'captivate_admin@brillio.com') {
        return res.status(403).json({ error: "Unauthorized access. Only captivate_admin@brillio.com can perform this action." });
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
            history TEXT,
            archetype TEXT DEFAULT 'Delivery',
            vertical TEXT DEFAULT 'BFSI'
        )`);

        // Migration: Add archetype to team_members if missing
        const tmCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='team_members' AND column_name='archetype'`);
        if (tmCols.rows.length === 0) {
             await pool.query("ALTER TABLE team_members ADD COLUMN archetype TEXT DEFAULT 'Delivery'");
             console.log("Added archetype column to team_members");
        }

        // Migration: Add vertical to team_members if missing
        const tmColsVert = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='team_members' AND column_name='vertical'`);
        if (tmColsVert.rows.length === 0) {
             await pool.query("ALTER TABLE team_members ADD COLUMN vertical TEXT DEFAULT 'BFSI'");
             console.log("Added vertical column to team_members");
        }

        // Create Reasons Mapping Table
        await pool.query(`CREATE TABLE IF NOT EXISTS reason_mappings (
            id SERIAL PRIMARY KEY,
            reason TEXT,
            description TEXT,
            points INTEGER,
            cap_type TEXT DEFAULT 'Orange',
            recurrence TEXT DEFAULT 'Unlimited',
            monthly_limit INTEGER DEFAULT 0
        )`);

        // Create Quests Table
        await pool.query(`CREATE TABLE IF NOT EXISTS quests (
            id SERIAL PRIMARY KEY,
            title TEXT,
            description TEXT,
            points INTEGER,
            category TEXT,
            icon TEXT,
            cap_type TEXT DEFAULT 'Orange'
        )`);
        
        // Migration: Add cap_type to quests if missing
        const questCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='quests' AND column_name='cap_type'`);
        if (questCols.rows.length === 0) {
             await pool.query("ALTER TABLE quests ADD COLUMN cap_type TEXT DEFAULT 'Orange'");
             console.log("Added cap_type column to quests");
        }

        // Seed Quests if empty
        const questCount = await pool.query("SELECT count(*) FROM quests");
        if (parseInt(questCount.rows[0].count) === 0) {
            const seedQuests = [
                { title: 'Cloud Certification', description: 'Complete a recognized cloud certification (AWS/Azure/GCP)', points: 500, category: 'Training', icon: 'fa-cloud', cap_type: 'Green' },
                { title: 'Tech Book Review', description: 'Read a technical book and share key takeaways', points: 150, category: 'Training', icon: 'fa-book', cap_type: 'Orange' },
                { title: 'Reusable Component', description: 'Develop and publish a reusable code component or library', points: 300, category: 'Assets', icon: 'fa-cubes', cap_type: 'Purple' },
                { title: 'Tech Blog Post', description: 'Write and publish a technical blog post', points: 200, category: 'Assets', icon: 'fa-pen-nib', cap_type: 'Orange' },
                { title: 'Junior Mentorship', description: 'Mentor a junior developer for a sprint', points: 400, category: 'Mentorship', icon: 'fa-user-group', cap_type: 'Green' },
                { title: 'Knowledge Session', description: 'Host a knowledge sharing session (KT) for the team', points: 250, category: 'Mentorship', icon: 'fa-chalkboard-user', cap_type: 'Orange' }
            ];
            
            for (const q of seedQuests) {
                await pool.query("INSERT INTO quests (title, description, points, category, icon, cap_type) VALUES ($1, $2, $3, $4, $5, $6)", 
                    [q.title, q.description, q.points, q.category, q.icon, q.cap_type]);
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

        const recurrenceCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='reason_mappings' AND column_name='recurrence'`);
        if (recurrenceCols.rows.length === 0) {
             await pool.query("ALTER TABLE reason_mappings ADD COLUMN recurrence TEXT DEFAULT 'Unlimited'");
             console.log("Added recurrence column to reason_mappings");
        }

        const monthlyLimitCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='reason_mappings' AND column_name='monthly_limit'`);
        if (monthlyLimitCols.rows.length === 0) {
             await pool.query("ALTER TABLE reason_mappings ADD COLUMN monthly_limit INTEGER DEFAULT 0");
             console.log("Added monthly_limit column to reason_mappings");
        }

        // Create Point Requests Table
        await pool.query(`CREATE TABLE IF NOT EXISTS point_requests (
            id SERIAL PRIMARY KEY,
            team_member_id INTEGER,
            points INTEGER,
            reason TEXT,
            requested_by TEXT,
            status TEXT DEFAULT 'Pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            rejection_reason TEXT
        )`);

        // Migration: Add rejection_reason to point_requests if missing
        const prCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='point_requests' AND column_name='rejection_reason'`);
        if (prCols.rows.length === 0) {
             await pool.query("ALTER TABLE point_requests ADD COLUMN rejection_reason TEXT");
             console.log("Added rejection_reason column to point_requests");
        }

    } catch (err) {
        console.error("Error initializing database:", err);
    }
}

// API Routes - Auth
app.post('/api/auth/change-password', async (req, res) => {
    const { email, oldPassword, newPassword } = req.body;
    try {
        // Verify old password
        const result = await pool.query("SELECT * FROM users WHERE email = $1 AND password = $2", [email, oldPassword]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid old password" });
        }
        
        // Update password
        await pool.query("UPDATE users SET password = $1 WHERE email = $2", [newPassword, email]);
        res.json({ message: "Password updated successfully" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
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
    const { title, description, points, category, icon, cap_type } = req.body;
    try {
        const result = await pool.query(
            "INSERT INTO quests (title, description, points, category, icon, cap_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            [title, description, points, category, icon, cap_type || 'Orange']
        );
        res.json({ id: result.rows[0].id, title, description, points, category, icon, cap_type: cap_type || 'Orange' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/quests/:id', checkAdmin, async (req, res) => {
    const { title, description, points, category, icon, cap_type } = req.body;
    try {
        const result = await pool.query(
            "UPDATE quests SET title = $1, description = $2, points = $3, category = $4, icon = $5, cap_type = $6 WHERE id = $7",
            [title, description, points, category, icon, cap_type || 'Orange', req.params.id]
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

app.post('/api/reasons', checkAdmin, async (req, res) => {
    const { reason, description, points, cap_type, recurrence, monthly_limit } = req.body;
    const sql = "INSERT INTO reason_mappings (reason, description, points, cap_type, recurrence, monthly_limit) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id";
    
    try {
        const result = await pool.query(sql, [reason, description, points, cap_type || 'Orange', recurrence || 'Unlimited', monthly_limit || 0]);
        res.json({ id: result.rows[0].id, reason, description, points, cap_type: cap_type || 'Orange', recurrence: recurrence || 'Unlimited', monthly_limit: monthly_limit || 0 });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/reasons/:id', checkAdmin, async (req, res) => {
    const { reason, description, points, cap_type, recurrence, monthly_limit } = req.body;
    const sql = "UPDATE reason_mappings SET reason = $1, description = $2, points = $3, cap_type = $4, recurrence = $5, monthly_limit = $6 WHERE id = $7";
    
    try {
        const result = await pool.query(sql, [reason, description, points, cap_type || 'Orange', recurrence || 'Unlimited', monthly_limit || 0, req.params.id]);
        res.json({ message: "Updated", changes: result.rowCount });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/reasons/:id', checkAdmin, async (req, res) => {
    const sql = "DELETE FROM reason_mappings WHERE id = $1";
    try {
        const result = await pool.query(sql, [req.params.id]);
        res.json({ message: "Deleted", changes: result.rowCount });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// API Routes - Point Requests
app.get('/api/requests', checkAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT pr.*, tm.name as team_member_name 
            FROM point_requests pr
            LEFT JOIN team_members tm ON CAST(pr.team_member_id AS INTEGER) = tm.id
            WHERE pr.status = 'Pending'
            ORDER BY pr.created_at ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/requests', async (req, res) => {
    const { team_member_id, points, reason, requested_by } = req.body;
    try {
        // Check if there is already a pending request for this team member and reason
        const existing = await pool.query(
            "SELECT id FROM point_requests WHERE team_member_id = $1 AND reason = $2 AND status = 'Pending'",
            [team_member_id, reason]
        );

        console.log("Request to add points received:", { team_member_id, points, reason, requested_by });

        if (existing.rows.length > 0) {
            console.log("Duplicate request blocked for member ID:", team_member_id, "reason:", reason);
            return res.status(400).json({ error: `A pending request for '${reason}' already exists for this member.` });
        }

        await pool.query(
            "INSERT INTO point_requests (team_member_id, points, reason, requested_by) VALUES ($1, $2, $3, $4)",
            [team_member_id, points, reason, requested_by]
        );
        console.log("Point request successfully created in database");
        res.json({ message: "Request submitted for approval." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/requests/:id/approve', checkAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Get Request
        const reqResult = await client.query("SELECT * FROM point_requests WHERE id = $1", [req.params.id]);
        if (reqResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Request not found" });
        }
        const request = reqResult.rows[0];

        if (request.status !== 'Pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Request already processed" });
        }

        // Update Team Member
        const teamResult = await client.query("SELECT * FROM team_members WHERE id = $1", [request.team_member_id]);
        const team = teamResult.rows[0];
        
        let newScore = team.score + request.points;
        let history = JSON.parse(team.history || "[]");
        history.push({
            points: request.points,
            reason: request.reason,
            date: new Date().toISOString(),
            status: 'Approved'
        });

        await client.query(
            "UPDATE team_members SET score = $1, history = $2 WHERE id = $3",
            [newScore, JSON.stringify(history), team.id]
        );

        // Update Request Status
        await client.query("UPDATE point_requests SET status = 'Approved' WHERE id = $1", [req.params.id]);

        await client.query('COMMIT');
        res.json({ message: "Request approved and points added." });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.post('/api/requests/:id/reject', checkAdmin, async (req, res) => {
    const { rejectionReason } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Get Request
        const reqResult = await client.query("SELECT * FROM point_requests WHERE id = $1", [req.params.id]);
        if (reqResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Request not found" });
        }
        const request = reqResult.rows[0];

        if (request.status !== 'Pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Request already processed" });
        }

        // Update point_requests
        await client.query("UPDATE point_requests SET status = 'Rejected', rejection_reason = $1 WHERE id = $2", 
            [rejectionReason, req.params.id]);
            
        // Update Team Member History (Append rejected request for visibility)
        const teamResult = await client.query("SELECT * FROM team_members WHERE id = $1", [request.team_member_id]);
        if (teamResult.rows.length > 0) {
            const team = teamResult.rows[0];
            let history = JSON.parse(team.history || "[]");
            history.push({
                points: 0, // No points added
                reason: request.reason,
                date: new Date().toISOString(),
                status: 'Rejected',
                rejection_reason: rejectionReason
            });
            
            await client.query(
                "UPDATE team_members SET history = $1 WHERE id = $2",
                [JSON.stringify(history), team.id]
            );
        }

        await client.query('COMMIT');
        res.json({ message: "Request rejected." });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// API Routes - Team Members
app.get('/api/team-members', async (req, res) => {
    try {
        // Fetch pending requests to include in history dynamically
        const pendingReqs = await pool.query(`SELECT team_member_id, points, reason, created_at FROM point_requests WHERE status = 'Pending'`);
        const pendingByTeam = {};
        pendingReqs.rows.forEach(r => {
            if (!pendingByTeam[r.team_member_id]) pendingByTeam[r.team_member_id] = [];
            pendingByTeam[r.team_member_id].push({
                points: r.points,
                reason: r.reason,
                date: r.created_at,
                status: 'Pending'
            });
        });

        const result = await pool.query("SELECT * FROM team_members ORDER BY id ASC");
        // Parse history JSON
        const members = result.rows.map(row => {
            let history = JSON.parse(row.history || "[]");
            if (pendingByTeam[row.id]) {
                history = history.concat(pendingByTeam[row.id]);
            }
            return {
                ...row,
                history: history
            };
        });
        res.json(members);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/team-members', async (req, res) => {
    const { name, icon, score, history, archetype, vertical } = req.body;
    const sql = "INSERT INTO team_members (name, icon, score, history, archetype, vertical) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id";
    const params = [name, icon, score, JSON.stringify(history || []), archetype || 'Delivery', vertical || 'BFSI'];
    
    try {
        const result = await pool.query(sql, params);
        res.json({
            id: result.rows[0].id,
            name, icon, score, history, archetype, vertical
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/team-members/:id', async (req, res) => {
    const { name, icon, score, history, archetype, vertical } = req.body;
    const sql = "UPDATE team_members SET name = $1, icon = $2, score = $3, history = $4, archetype = $5, vertical = $6 WHERE id = $7";
    const params = [name, icon, score, JSON.stringify(history || []), archetype || 'Delivery', vertical || 'BFSI', req.params.id];
    
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
            const archetype = row.archetype || 'Delivery';
            const vertical = row.vertical || 'BFSI';
            let history = row.history || '[]';
            if (typeof history !== 'string') history = JSON.stringify(history);

            const checkRes = await client.query("SELECT id FROM team_members WHERE name = $1", [name]);
            
            if (checkRes.rows.length > 0) {
                const existingId = checkRes.rows[0].id;
                await client.query(
                    "UPDATE team_members SET icon = $1, score = $2, history = $3, archetype = $4, vertical = $5 WHERE id = $6",
                    [icon, score, history, archetype, vertical, existingId]
                );
            } else {
                await client.query(
                    "INSERT INTO team_members (name, icon, score, history, archetype, vertical) VALUES ($1, $2, $3, $4, $5, $6)",
                    [name, icon, score, history, archetype, vertical]
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
            const recurrence = row.recurrence || 'Unlimited';
            const monthly_limit = row.monthly_limit || 0;

            const checkRes = await client.query("SELECT id FROM reason_mappings WHERE reason = $1", [reason]);
            
            if (checkRes.rows.length > 0) {
                const existingId = checkRes.rows[0].id;
                await client.query(
                    "UPDATE reason_mappings SET description = $1, points = $2, cap_type = $3, recurrence = $4, monthly_limit = $5 WHERE id = $6",
                    [description, points, cap_type, recurrence, monthly_limit, existingId]
                );
            } else {
                await client.query(
                    "INSERT INTO reason_mappings (reason, description, points, cap_type, recurrence, monthly_limit) VALUES ($1, $2, $3, $4, $5, $6)",
                    [reason, description, points, cap_type, recurrence, monthly_limit]
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
