const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

const PORT = process.env.PORT || 5000;
const DATA_DIR = __dirname;
const ENTRIES_FILE = path.resolve(DATA_DIR, 'data.json');
const USERS_FILE = path.resolve(DATA_DIR, 'users.json');

app.use(helmet({
    contentSecurityPolicy: false, // For easier local development with D3/etc
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10kb' }));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use(limiter);

// Serve static frontend files
app.use(express.static(path.join(__dirname, process.env.VERCEL ? '.' : '../frontend')));
// If running on Vercel, we might need a different path or just let Vercel handle static files.
// However, to keep it simple, we'll try to serve from the current dir if VERCEL is true.

// --- Storage Logic ---
async function readJson(filePath) {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        if (err.code === 'ENOENT') return [];
        console.error(`Failed to load ${filePath}:`, err);
        throw err;
    }
}

async function writeJson(filePath, data) {
    const tmp = filePath + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp, filePath);
}

function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// --- Auth Middleware (Mock) ---
// Checks for a simple 'user-id' header for demo purposes
app.use((req, res, next) => {
    const userId = req.headers['user-id'] || 'u1';
    req.user = { id: userId };
    next();
});

// --- Routes ---

// Registration
app.post('/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });

        const users = await readJson(USERS_FILE);
        if (users.find(u => u.username === username || u.email === email)) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const newUser = { id: makeId(), username, email, password, createdAt: new Date().toISOString() };
        users.push(newUser);
        await writeJson(USERS_FILE, users);
        res.status(201).json({ success: true, user: { id: newUser.id, username: newUser.username } });
    } catch (err) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const users = await readJson(USERS_FILE);

        // Include default admin for legacy
        if (username === 'admin' && password === 'admin') {
            return res.json({ success: true, user: { id: 'u1', username: 'admin', email: 'admin@mindmap.com' } });
        }

        const user = users.find(u => u.username === username && u.password === password);
        if (user) {
            res.json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Entries
app.get('/entries', async (req, res) => {
    try {
        const entries = await readJson(ENTRIES_FILE);
        const userEntries = entries.filter(e => e.userId === req.user.id);
        res.json(userEntries);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/entries', async (req, res) => {
    try {
        const { text, mood, tags, category } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const entries = await readJson(ENTRIES_FILE);
        const entry = {
            id: makeId(),
            userId: req.user.id,
            text: text.trim(),
            mood: mood || 'neutral',
            category: category || 'General',
            tags: Array.isArray(tags) ? tags : [],
            createdAt: new Date().toISOString(),
        };
        entries.push(entry);
        await writeJson(ENTRIES_FILE, entries);
        res.status(201).json(entry);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/entries/:id', async (req, res) => {
    try {
        let entries = await readJson(ENTRIES_FILE);
        const initialLen = entries.length;
        entries = entries.filter(e => e.id !== req.params.id || e.userId !== req.user.id);
        if (entries.length === initialLen) return res.status(404).json({ error: 'Not found' });
        await writeJson(ENTRIES_FILE, entries);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Insights
app.get('/insights', async (req, res) => {
    try {
        const entries = await readJson(ENTRIES_FILE);
        const userEntries = entries.filter(e => e.userId === req.user.id);
        const moods = userEntries.reduce((acc, e) => {
            acc[e.mood] = (acc[e.mood] || 0) + 1;
            return acc;
        }, {});
        res.json({
            totalEntries: userEntries.length,
            moodDistribution: moods,
            lastActive: userEntries.length ? userEntries[userEntries.length - 1].createdAt : null
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get insights' });
    }
});

// Export
app.get('/export', async (req, res) => {
    try {
        const entries = await readJson(ENTRIES_FILE);
        const userEntries = entries.filter(e => e.userId === req.user.id);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=mindmap_journal_export.json');
        res.send(JSON.stringify(userEntries, null, 2));
    } catch (err) {
        res.status(500).json({ error: 'Export failed' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', now: new Date().toISOString() });
});

const server = app.listen(PORT, () => {
    console.log(`Unique Mind Map Journal server running on http://localhost:${PORT}`);
});

process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());

module.exports = app;

