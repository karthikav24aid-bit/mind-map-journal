// compute API base URL, allow override via query param
const queryParams = new URLSearchParams(window.location.search);
const apiOverride = queryParams.get('api');
const DEFAULT_API = 'http://localhost:5000';
const API_BASE = apiOverride || (
    window.location.origin.includes('localhost') || window.location.protocol === 'file:'
        ? DEFAULT_API
        : ''
);

// State
let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let entries = [];
let currentModule = 'journal';

// Elements
const body = document.body;
const authOverlay = document.getElementById('authOverlay');
const loginCard = document.getElementById('loginCard');
const registerCard = document.getElementById('registerCard');
const currentUserDisplay = document.getElementById('currentUser');
const entryList = document.getElementById('entryList');
const searchInput = document.getElementById('searchInput');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) {
        setupUserSession();
    } else {
        body.classList.add('login-state');
    }
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
});

// --- Auth Management ---
async function login() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const errorEl = document.getElementById('loginError');

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            setupUserSession();
        } else {
            errorEl.textContent = data.error || 'Invalid credentials';
        }
    } catch (err) {
        errorEl.textContent = 'Server connection failed';
    }
}

async function register() {
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const errorEl = document.getElementById('regError');

    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (data.success) {
            alert('Registration successful! Please login.');
            toggleAuthCards();
        } else {
            errorEl.textContent = data.error || 'Registration failed';
        }
    } catch (err) {
        errorEl.textContent = 'Server connection failed';
    }
}

function logout() {
    localStorage.removeItem('user');
    currentUser = null;
    body.classList.add('login-state');
    authOverlay.classList.remove('hidden');
    showModule('journal');
}

function setupUserSession() {
    body.classList.remove('login-state');
    authOverlay.classList.add('hidden');
    document.querySelector('.user-name').textContent = currentUser.username;
    document.querySelector('.user-avatar').textContent = currentUser.username[0].toUpperCase();
    loadEntries();
}

function toggleAuthCards() {
    loginCard.classList.toggle('hidden');
    registerCard.classList.toggle('hidden');
}

// --- Navigation ---
function showModule(name) {
    currentModule = name;
    document.querySelectorAll('.module').forEach(m => m.classList.toggle('active', m.id === `${name}Module`));
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.toggle('active', li.dataset.module === name));

    if (name === 'journal') loadEntries();
    if (name === 'mindmap') renderD3MindMap();
    if (name === 'insights') loadInsights();
}

// --- Journal Operations ---
async function loadEntries() {
    const statusEl = document.getElementById('status');
    statusEl.textContent = '';
    try {
        const res = await fetch(`${API_BASE}/entries`, {
            headers: { 'user-id': currentUser?.id }
        });
        if (!res.ok) {
            const err = await res.text();
            statusEl.textContent = `Load failed: ${err}`;
            return;
        }
        entries = await res.json();
        renderEntries(entries);
    } catch (err) {
        console.error('Failed to load entries', err);
        statusEl.textContent = 'Unable to reach server. Is backend running?';
    }
}

function renderEntries(data) {
    [...data].reverse().forEach(entry => {
        const li = document.createElement('li');
        li.className = 'entry-card glass';
        const entryDate = entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'Date Unknown';
        const entryText = entry.text || 'No content';
        const entryTags = Array.isArray(entry.tags) ? entry.tags : [];
        const entryCategory = entry.category || 'General';

        li.innerHTML = `
            <div class="entry-header">
                <span><i class="fas fa-calendar-alt"></i> ${entryDate}</span>
                <span>${getMoodEmoji(entry.mood)}</span>
            </div>
            <p>${entryText}</p>
            <div class="entry-tags">
                ${entryTags.map(t => `<span>#${t}</span>`).join('')}
                <span class="category-tag">📁 ${entryCategory}</span>
            </div>
            <button class="btn-delete" onclick="deleteEntry('${entry.id}')" style="background:none; border:none; color:var(--error); cursor:pointer; margin-top:1rem;"><i class="fas fa-trash"></i> Delete</button>
        `;
        entryList.appendChild(li);
    });
}

async function addEntry() {
    const text = document.getElementById('journalInput').value.trim();
    if (!text) return;
    if (!currentUser) {
        alert('Please sign in before adding an entry');
        return;
    }

    const mood = document.getElementById('moodSelect').value;
    const category = document.getElementById('categorySelect').value;
    const tags = document.getElementById('tagsInput').value.split(',').map(t => t.trim()).filter(Boolean);

    try {
        const res = await fetch(`${API_BASE}/entries`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'user-id': currentUser?.id || 'guest'
            },
            body: JSON.stringify({ text, mood, category, tags })
        });
        if (res.ok) {
            document.getElementById('journalInput').value = '';
            document.getElementById('tagsInput').value = '';
            loadEntries();
        } else {
            const errData = await res.json();
            console.warn('Entry not saved', errData);
        }
    } catch (err) {
        console.error('Failed to add entry', err);
    }
}

async function deleteEntry(id) {
    if (!confirm('Permanently delete this entry?')) return;
    try {
        await fetch(`${API_BASE}/entries/${id}`, {
            method: 'DELETE',
            headers: { 'user-id': currentUser?.id }
        });
        loadEntries();
    } catch (err) {
        console.error('Failed to delete entry', err);
    }
}

function getMoodEmoji(mood) {
    const moods = { happy: '😊', calm: '😌', neutral: '😐', focused: '🧠', anxious: '😰' };
    return moods[mood] || '😐';
}

// --- Mind Map (D3.js) ---
function renderD3MindMap() {
    const svg = d3.select("#mindmapSvg");
    svg.selectAll("*").remove();

    if (entries.length === 0) {
        svg.append('text')
            .attr('x', 20)
            .attr('y', 50)
            .attr('fill', '#888')
            .text('No entries yet – add something and refresh.');
        return;
    }

    const width = document.getElementById('mindmapSvg').clientWidth;
    const height = 600;

    // Build data structure for D3
    const rootNode = { id: "My Mind", type: 'root' };
    const nodes = [rootNode];
    const links = [];

    // Group by category
    const categories = [...new Set(entries.map(e => e.category || 'General'))];
    categories.forEach(cat => {
        const catNode = { id: cat, type: 'category' };
        nodes.push(catNode);
        links.push({ source: rootNode.id, target: catNode.id });

        // Add entries as children
        entries.filter(e => (e.category || 'General') === cat).slice(0, 5).forEach(entry => {
            const entryNode = { id: entry.id, label: (entry.text || '').substring(0, 20) + '...', type: 'entry' };
            nodes.push(entryNode);
            links.push({ source: catNode.id, target: entryNode.id });
        });
    });

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g")
        .selectAll("line")
        .data(links)
        .enter().append("line")
        .attr("class", "link");

    const node = svg.append("g")
        .selectAll(".node")
        .data(nodes)
        .enter().append("g")
        .attr("class", "node")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    node.append("circle")
        .attr("r", d => d.type === 'root' ? 30 : (d.type === 'category' ? 20 : 10))
        .attr("fill", d => d.type === 'root' ? 'var(--accent-primary)' : (d.type === 'category' ? 'var(--accent-secondary)' : '#3f3f46'));

    node.append("text")
        .text(d => d.label || d.id)
        .attr("dy", d => d.type === 'root' ? 45 : 25)
        .attr("text-anchor", "middle");

    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }
    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }
    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }
}

// --- Insights & Export ---
async function loadInsights() {
    const res = await fetch(`${API_BASE}/insights`, { headers: { 'user-id': currentUser.id } });
    const data = await res.json();
    document.getElementById('statTotal').textContent = data.totalEntries;
    document.getElementById('statStreak').textContent = entries.length > 0 ? '3' : '0'; // Mock streak
    renderMoodPulse(data.moodDistribution);
}

function renderMoodPulse(distribution) {
    const chart = document.getElementById('moodChart');
    chart.innerHTML = '';
    const moods = ['happy', 'calm', 'neutral', 'focused', 'anxious'];
    const max = Math.max(...Object.values(distribution), 1);

    moods.forEach(mood => {
        const val = distribution[mood] || 0;
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = `${(val / max) * 100}%`;
        bar.style.background = 'var(--accent-primary)';
        bar.style.width = '30px';
        bar.style.borderRadius = '5px';
        bar.title = `${mood}: ${val}`;
        chart.appendChild(bar);
    });
}


// --- Event Listeners ---
document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('registerBtn').addEventListener('click', register);
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('toRegister').addEventListener('click', toggleAuthCards);
document.getElementById('toLogin').addEventListener('click', toggleAuthCards);
document.querySelectorAll('.nav-links li').forEach(li => li.addEventListener('click', () => showModule(li.dataset.module)));
document.getElementById('addBtn').addEventListener('click', addEntry);
document.getElementById('searchInput').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = entries.filter(ent => ent.text.toLowerCase().includes(term) || ent.tags.some(t => t.toLowerCase().includes(term)));
    renderEntries(filtered);
});

// map controls
const refreshBtn = document.getElementById('refreshMap');
const centerBtn = document.getElementById('centerMap');
if (refreshBtn) refreshBtn.addEventListener('click', renderD3MindMap);
if (centerBtn) centerBtn.addEventListener('click', () => {
    // simple way to recenter: rerun simulation
    renderD3MindMap();
});
