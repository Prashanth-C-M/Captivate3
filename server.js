const express = require('express');
const sqlite3 = require('sqlite3').verbose();
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
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static files

// Database Setup
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        initDb();
    }
});

function initDb() {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        icon TEXT,
        score INTEGER,
        history TEXT
    )`, (err) => {
        if (err) {
            console.error("Error creating table:", err);
        }
    });

    // Create Reasons Mapping Table
    db.run(`CREATE TABLE IF NOT EXISTS reason_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reason TEXT,
        description TEXT,
        points INTEGER,
        cap_type TEXT DEFAULT 'Orange'
    )`, (err) => {
        if (err) {
            console.error("Error creating reason_mappings table:", err);
        } else {
            // Check for missing column in existing table
            db.all("PRAGMA table_info(reason_mappings)", (err, rows) => {
                if (!err) {
                    const hasCapType = rows.some(r => r.name === 'cap_type');
                    if (!hasCapType) {
                        db.run("ALTER TABLE reason_mappings ADD COLUMN cap_type TEXT DEFAULT 'Orange'", (err) => {
                            if(err) console.error("Error adding cap_type column:", err);
                            else console.log("Added cap_type column to reason_mappings");
                        });
                    }
                }
            });
        }
    });
}

// API Routes - Auth
app.post('/api/auth/register', (req, res) => {
    const { email, password } = req.body;
    db.run("INSERT INTO users (email, password) VALUES (?, ?)", [email, password], function(err) {
        if (err) {
            return res.status(400).json({ error: "User already exists or error occurred." });
        }
        res.json({ message: "Registered successfully. Please login." });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    console.log('Login attempt:', { email, password }); // Add this line
    db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, user) => {
        if (err) {
            console.error('Login database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            console.log('Login failed for user:', email);
            return res.status(401).json({ error: "Invalid credentials" });
        }
        
        console.log('Login successful for user:', email);
        res.json({ message: "Login successful", user: { id: user.id, email: user.email } });
    });
});

app.post('/api/auth/check', (req, res) => {
    const { email } = req.body;
    db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ exists: !!row });
    });
});

// API Routes - Reasons
app.get('/api/reasons', (req, res) => {
    db.all("SELECT * FROM reason_mappings", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/reasons', (req, res) => {
    const { reason, description, points, cap_type } = req.body;
    const sql = "INSERT INTO reason_mappings (reason, description, points, cap_type) VALUES (?, ?, ?, ?)";
    
    db.run(sql, [reason, description, points, cap_type || 'Orange'], function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, reason, description, points, cap_type: cap_type || 'Orange' });
    });
});

app.put('/api/reasons/:id', (req, res) => {
    const { reason, description, points, cap_type } = req.body;
    const sql = "UPDATE reason_mappings SET reason = ?, description = ?, points = ?, cap_type = ? WHERE id = ?";
    
    db.run(sql, [reason, description, points, cap_type || 'Orange', req.params.id], function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ message: "Updated", changes: this.changes });
    });
});

app.delete('/api/reasons/:id', (req, res) => {
    const sql = "DELETE FROM reason_mappings WHERE id = ?";
    db.run(sql, req.params.id, function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ message: "Deleted", changes: this.changes });
    });
});

// API Routes - Teams
app.get('/api/teams', (req, res) => {
    db.all("SELECT * FROM teams", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // Parse history JSON
        const teams = rows.map(row => ({
            ...row,
            history: JSON.parse(row.history || "[]")
        }));
        res.json(teams);
    });
});

app.post('/api/teams', (req, res) => {
    const { name, icon, score, history } = req.body;
    const sql = "INSERT INTO teams (name, icon, score, history) VALUES (?, ?, ?, ?)";
    const params = [name, icon, score, JSON.stringify(history || [])];
    
    db.run(sql, params, function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({
            id: this.lastID,
            name, icon, score, history
        });
    });
});

app.put('/api/teams/:id', (req, res) => {
    const { name, icon, score, history } = req.body;
    const sql = "UPDATE teams SET name = ?, icon = ?, score = ?, history = ? WHERE id = ?";
    const params = [name, icon, score, JSON.stringify(history || []), req.params.id];
    
    db.run(sql, params, function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ message: "Updated", changes: this.changes });
    });
});

app.delete('/api/teams/:id', (req, res) => {
    const sql = "DELETE FROM teams WHERE id = ?";
    db.run(sql, req.params.id, function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ message: "Deleted", changes: this.changes });
    });
});

// Admin Routes
app.get('/api/users', checkAdmin, (req, res) => {
    db.all("SELECT * FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.delete('/api/users/:id', checkAdmin, (req, res) => {
    db.run("DELETE FROM users WHERE id = ?", req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "User deleted", changes: this.changes });
    });
});

// Import/Export Routes

// Export Teams
app.get('/api/teams/export', checkAdmin, (req, res) => {
    db.all("SELECT * FROM teams", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const worksheet = xlsx.utils.json_to_sheet(rows);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "Teams");
        
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename="teams.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    });
});

// Import Teams
app.post('/api/teams/import', checkAdmin, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);
        
        const stmtCheck = db.prepare("SELECT id FROM teams WHERE name = ?");
        const stmtUpdate = db.prepare("UPDATE teams SET icon = ?, score = ?, history = ? WHERE id = ?");
        const stmtInsert = db.prepare("INSERT INTO teams (name, icon, score, history) VALUES (?, ?, ?, ?)");
        
        const promises = data.map(row => {
            return new Promise((resolve, reject) => {
                const name = row.name;
                const icon = row.icon || 'fa-brain';
                const score = row.score || 0;
                let history = row.history || '[]';
                if (typeof history !== 'string') history = JSON.stringify(history);

                stmtCheck.get(name, (err, existing) => {
                    if (err) return reject(err);
                    if (existing) {
                        stmtUpdate.run(icon, score, history, existing.id, (err) => {
                            if (err) reject(err); else resolve();
                        });
                    } else {
                        stmtInsert.run(name, icon, score, history, (err) => {
                            if (err) reject(err); else resolve();
                        });
                    }
                });
            });
        });

        Promise.all(promises)
            .then(() => {
                stmtCheck.finalize();
                stmtUpdate.finalize();
                stmtInsert.finalize();
                res.json({ message: "Teams imported successfully", count: data.length });
            })
            .catch(error => {
                stmtCheck.finalize();
                stmtUpdate.finalize();
                stmtInsert.finalize();
                res.status(500).json({ error: "Database error during import: " + error.message });
            });

    } catch (error) {
        res.status(500).json({ error: "Failed to process file: " + error.message });
    }
});

// Export Reasons
app.get('/api/reasons/export', checkAdmin, (req, res) => {
    db.all("SELECT * FROM reason_mappings", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const worksheet = xlsx.utils.json_to_sheet(rows);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "Reasons");
        
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename="reasons.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    });
});

// Import Reasons
app.post('/api/reasons/import', checkAdmin, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);
        
        const stmtCheck = db.prepare("SELECT id FROM reason_mappings WHERE reason = ?");
        const stmtUpdate = db.prepare("UPDATE reason_mappings SET description = ?, points = ?, cap_type = ? WHERE id = ?");
        const stmtInsert = db.prepare("INSERT INTO reason_mappings (reason, description, points, cap_type) VALUES (?, ?, ?, ?)");
        
        const promises = data.map(row => {
            return new Promise((resolve, reject) => {
                const reason = row.reason;
                const description = row.description || '';
                const points = row.points || 0;
                const cap_type = row.cap_type || 'Orange';

                stmtCheck.get(reason, (err, existing) => {
                    if (err) return reject(err);
                    if (existing) {
                        stmtUpdate.run(description, points, cap_type, existing.id, (err) => {
                            if (err) reject(err); else resolve();
                        });
                    } else {
                        stmtInsert.run(reason, description, points, cap_type, (err) => {
                            if (err) reject(err); else resolve();
                        });
                    }
                });
            });
        });

        Promise.all(promises)
            .then(() => {
                stmtCheck.finalize();
                stmtUpdate.finalize();
                stmtInsert.finalize();
                res.json({ message: "Reasons imported successfully", count: data.length });
            })
            .catch(error => {
                stmtCheck.finalize();
                stmtUpdate.finalize();
                stmtInsert.finalize();
                res.status(500).json({ error: "Database error during import: " + error.message });
            });

    } catch (error) {
        res.status(500).json({ error: "Failed to process file: " + error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
