// --- Auth System (SQLite Backend) ---
const API_BASE_URL = 'http://localhost:3000';
let currentUser = sessionStorage.getItem('currentUser');

window.showAuth = function(viewId) {
    document.querySelectorAll('.auth-box').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`auth-${viewId}`);
    if(target) {
        target.classList.remove('hidden');
    }
};

function initAuth() {
    if (currentUser) {
        document.getElementById('auth-overlay').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        
        if (currentUser === 'Prashanth.C@brillio.com') {
            document.getElementById('manage-reasons-btn').classList.remove('hidden');
            const adminActions = document.getElementById('admin-actions');
            if (adminActions) adminActions.classList.remove('hidden');
        }
    } else {
        document.getElementById('auth-overlay').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        showAuth('login');
    }
}

// Login
const formLogin = document.getElementById('form-login');
if(formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            
            if (res.ok) {
                sessionStorage.setItem('currentUser', email);
                window.location.href = '/';
            } else {
                alert(data.error || "Login failed");
            }
        } catch (error) {
            console.error("Login error:", error);
            alert("Server connection error.");
        }
    });
}

// Register
const formRegister = document.getElementById('form-register');
if(formRegister) {
    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm').value;

        if (!email.endsWith('@brillio.com')) {
            alert("Only @brillio.com email addresses are allowed.");
            return;
        }

        if (password !== confirm) {
            alert("Passwords do not match.");
            return;
        }
        
        if (password.length < 6) {
            alert("Password must be at least 6 characters.");
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (res.ok) {
                alert("Registration Successful! Please login.");
                showAuth('login');
            } else {
                alert(data.error || "Registration failed");
            }
        } catch (error) {
            console.error("Register error:", error);
            alert("Server connection error.");
        }
    });
}

// Email Validation on Blur
const regEmailInput = document.getElementById('reg-email');
if(regEmailInput) {
    regEmailInput.addEventListener('blur', async function() {
        const email = this.value;
        const errorDiv = document.getElementById('reg-email-error');
        
        if (!email) {
             errorDiv.classList.add('hidden');
             return;
        }

        if (!email.endsWith('@brillio.com')) {
            errorDiv.textContent = "Only @brillio.com email addresses are allowed.";
            errorDiv.classList.remove('hidden');
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            
            if (data.exists) {
                errorDiv.textContent = "This email is already registered. Please login.";
                errorDiv.classList.remove('hidden');
            } else {
                errorDiv.classList.add('hidden');
            }
        } catch (e) {
            console.error("Validation error", e);
        }
    });
    
    // Hide error on focus
    regEmailInput.addEventListener('focus', function() {
        document.getElementById('reg-email-error').classList.add('hidden');
    });
}

// Forgot
const formForgot = document.getElementById('form-forgot');
if(formForgot) {
    formForgot.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value;
        
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            
            if (data.exists) {
                alert(`Contact Prashanth.c@brillio.com`);
                showAuth('login');
            } else {
                alert("Email not found.");
            }
        } catch (e) {
            alert("Server error");
        }
    });
}

// --- App Logic ---

// Initial Data (Empty - fetched from API)
let teams = [];

let reasonMappings = [];

// API Interaction
async function fetchTeams() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/teams`);
        if (!response.ok) throw new Error('Failed to fetch');
        teams = await response.json();
        renderLeaderboard();
    } catch (error) {
        console.error("Error fetching teams:", error);
    }
}

async function fetchReasons() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/reasons`);
        if (!response.ok) throw new Error('Failed to fetch reasons');
        reasonMappings = await response.json();
        // Don't populate here, wait for team context
    } catch (error) {
        console.error("Error fetching reasons:", error);
    }
}

function getTargetCap(score) {
    if (score < 3000) return 'Orange';
    if (score < 6000) return 'Green';
    if (score < 9000) return 'Purple';
    return 'Black';
}

function populateReasonDropdown(team = null) {
    const reasonSelect = document.getElementById('points-reason');
    if (!reasonSelect) return;

    // Clear existing options except the placeholder
    while (reasonSelect.options.length > 1) {
        reasonSelect.remove(1);
    }

    const currentScore = team ? team.score : 0;
    const targetCap = getTargetCap(currentScore);
    const historyReasons = team ? (team.history || []).map(h => h.reason) : [];

    const filteredReasons = reasonMappings.filter(r => {
        // Cap Type Match
        const rCap = r.cap_type || 'Orange';
        if (rCap !== targetCap) return false;
        
        // Unique Check
        if (historyReasons.includes(r.reason)) return false;
        
        return true;
    });

    if (filteredReasons.length === 0) {
        const option = document.createElement('option');
        option.textContent = `No available ${targetCap} tasks`;
        option.disabled = true;
        reasonSelect.appendChild(option);
    }

    filteredReasons.forEach(mapping => {
        const option = document.createElement('option');
        option.value = mapping.reason; 
        option.textContent = `${mapping.reason} (+${mapping.points})`;
        option.title = mapping.description;
        option.dataset.points = mapping.points;
        reasonSelect.appendChild(option);
    });
}

// Initialize change listener once
document.addEventListener('DOMContentLoaded', () => {
    const reasonSelect = document.getElementById('points-reason');
    if (reasonSelect) {
        reasonSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const points = selectedOption.dataset.points;
            const pointsInput = document.getElementById('points-add');
            if (pointsInput && points) {
                pointsInput.value = points;
            }
        });
    }
});

// DOM Elements
const leaderboardList = document.getElementById('leaderboard-list');
const teamModal = document.getElementById('team-modal');
const rulesModal = document.getElementById('rules-modal');
const addTeamBtn = document.getElementById('add-team-btn');
const viewRulesBtn = document.getElementById('view-rules-btn');
const closeModalBtn = document.querySelector('.close-modal');
const closeRulesBtn = document.querySelector('.close-rules');
const teamForm = document.getElementById('team-form');
const modalTitle = document.getElementById('modal-title');
const editIndexInput = document.getElementById('edit-index');
const podiumDisplay = document.getElementById('podium-display');

// Reasons Modal Elements
const reasonsModal = document.getElementById('reasons-modal');
const manageReasonsBtn = document.getElementById('manage-reasons-btn');
const closeReasonsBtn = document.querySelector('.close-reasons');
const reasonForm = document.getElementById('reason-form');
const reasonsList = document.getElementById('reasons-list');

// Users Modal Elements
const usersModal = document.getElementById('users-modal');
const viewUsersBtn = document.getElementById('view-users-btn');
const closeUsersBtn = document.querySelector('.close-users');
const usersListBody = document.getElementById('users-list-body');

// Report Modal Elements
const reportModal = document.getElementById('report-modal');
const closeReportBtn = document.querySelector('.close-report');
const viewReportBtn = document.getElementById('view-report-btn');
let chartInstances = {};

// View Modal Elements
const viewModal = document.getElementById('view-modal');
const closeViewBtn = document.querySelector('.close-view');
const viewIcon = document.getElementById('view-icon');
const viewName = document.getElementById('view-name');
const viewRank = document.getElementById('view-rank');
const viewScore = document.getElementById('view-score');
const viewLevel = document.getElementById('view-level');
const viewProgressText = document.getElementById('view-progress-text');
const viewProgressBar = document.getElementById('view-progress-bar');

function calculateLevel(score) {
    if (score >= 12000) return { level: 4, name: "Black Cap", min: 12000, max: 20000 };
    if (score >= 9000) return { level: 3, name: "Purple Cap", min: 9000, max: 12000 };
    if (score >= 6000) return { level: 2, name: "Green Cap", min: 6000, max: 9000 };
    if (score >= 3000) return { level: 1, name: "Orange Cap", min: 3000, max: 6000 };
    return { level: 0, name: "No Cap", min: 0, max: 3000 };
}

function getCapColor(levelName) {
    if (levelName.includes("Orange")) return "#f97316";
    if (levelName.includes("Green")) return "#39ff14";
    if (levelName.includes("Purple")) return "#bc13fe";
    if (levelName.includes("Black")) return "#000000";
    return "#64748b"; // Grey for No Cap
}

function getCapSvg(color) {
    const stroke = color === "#000000" ? 'stroke="white" stroke-width="2"' : '';
    return `<svg viewBox="0 0 120 80" width="40" height="25" style="filter: drop-shadow(0 0 3px ${color})">
        <path fill="${color}" ${stroke} d="M20,50 A30,30 0 0,1 80,50 L110,50 L100,60 L20,60 Z M50,20 A10,10 0 0,1 50,20 Z" />
    </svg>`;
}

// Render Leaderboard
function renderLeaderboard() {
    // Sort teams by score descending, then by earliest achievement date
    teams.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        
        // Tie-breaker: Earlier last update wins
        const getLastUpdate = (team) => {
            if (team.history && team.history.length > 0) {
                // Return timestamp of last history item
                return new Date(team.history[team.history.length - 1].date).getTime();
            }
            return 0; // Teams with no history (initial seed) treated as "oldest"
        };

        return getLastUpdate(a) - getLastUpdate(b);
    });

    leaderboardList.innerHTML = ''; // Clear existing content
    podiumDisplay.innerHTML = ''; // Clear podium

    // Render Podium (Top 3)
    if (teams.length > 0) {
        const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd position visually (indices)
        
        podiumOrder.forEach(idx => {
            if (teams[idx]) {
                const team = teams[idx];
                const rank = idx + 1;
                const levelData = calculateLevel(team.score);
                let capHtml = '';
                if (levelData.level > 0) {
                    const capColor = getCapColor(levelData.name);
                    capHtml = `<div class="podium-cap" title="${levelData.name}">${getCapSvg(capColor)}</div>`;
                }

                const div = document.createElement('div');
                div.className = `podium-item podium-${rank}`;
                div.innerHTML = `
                    <div class="podium-content">
                        <div class="podium-icon-wrapper">
                            ${capHtml}
                            <div class="podium-icon"><i class="fa-solid ${team.icon}"></i></div>
                        </div>
                        <div class="podium-name">${team.name}</div>
                        <div class="podium-score">${team.score.toLocaleString()} pts</div>
                    </div>
                    <div class="podium-rank">${rank}</div>
                `;
                podiumDisplay.appendChild(div);
            }
        });
    }

    teams.forEach((team, index) => {
        const rank = index + 1;
        const row = document.createElement('div');
        row.className = `leaderboard-row rank-${rank}`;

        const levelData = calculateLevel(team.score);
        let capsHtml = '';
        if (team.score < 3000) {
            capsHtml = '<span style="color:#94a3b8; font-size: 0.9rem; font-style: italic;">No Cap</span>';
        } else {
            if (team.score >= 3000) capsHtml += getCapSvg("#f97316");
            if (team.score >= 6000) capsHtml += getCapSvg("#39ff14");
            if (team.score >= 9000) capsHtml += getCapSvg("#bc13fe");
            if (team.score >= 12000) capsHtml += getCapSvg("#000000");
        }

        row.innerHTML = `
            <div class="col rank">#${rank}</div>
            <div class="col team">
                <div class="team-icon">
                    <i class="fa-solid ${team.icon}"></i>
                </div>
                <span>${team.name}</span>
            </div>
            <div class="col score">${team.score.toLocaleString()}</div>
            <div class="col cap-level" title="${levelData.name}" style="gap: 5px;">${capsHtml}</div>
            <div class="col actions">
                <button class="btn view-btn" onclick="viewTeam(${index})" title="View Dashboard"><i class="fa-solid fa-eye"></i></button>
                <button class="btn edit" onclick="editTeam(${index})" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="btn danger" onclick="deleteTeam(${index})" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        leaderboardList.appendChild(row);
    });
}

// Event Listeners

// Export/Import Handlers
const exportTeamsBtn = document.getElementById('export-teams-btn');
if(exportTeamsBtn) {
    exportTeamsBtn.addEventListener('click', () => {
         window.location.href = `${API_BASE_URL}/api/teams/export?email=${encodeURIComponent(currentUser)}`;
    });
}

const importTeamsBtn = document.getElementById('import-teams-btn');
const importTeamsFile = document.getElementById('import-teams-file');
if(importTeamsBtn && importTeamsFile) {
    importTeamsBtn.addEventListener('click', () => importTeamsFile.click());
    importTeamsFile.addEventListener('change', async (e) => {
        if(e.target.files.length > 0) {
            const formData = new FormData();
            formData.append('file', e.target.files[0]);
            
            try {
                const res = await fetch(`${API_BASE_URL}/api/teams/import`, {
                    method: 'POST',
                    headers: { 'x-user-email': currentUser },
                    body: formData
                });
                const data = await res.json();
                alert(data.message || (data.error ? "Error: " + data.error : "Import failed"));
                if(res.ok) fetchTeams();
            } catch(err) {
                alert("Import failed: " + err.message);
            }
            e.target.value = ''; // Reset
        }
    });
}

const exportReasonsBtn = document.getElementById('export-reasons-btn');
if(exportReasonsBtn) {
    exportReasonsBtn.addEventListener('click', () => {
         window.location.href = `${API_BASE_URL}/api/reasons/export?email=${encodeURIComponent(currentUser)}`;
    });
}

const importReasonsBtn = document.getElementById('import-reasons-btn');
const importReasonsFile = document.getElementById('import-reasons-file');
if(importReasonsBtn && importReasonsFile) {
    importReasonsBtn.addEventListener('click', () => importReasonsFile.click());
    importReasonsFile.addEventListener('change', async (e) => {
        if(e.target.files.length > 0) {
            const formData = new FormData();
            formData.append('file', e.target.files[0]);
            
            try {
                const res = await fetch(`${API_BASE_URL}/api/reasons/import`, {
                    method: 'POST',
                    headers: { 'x-user-email': currentUser },
                    body: formData
                });
                const data = await res.json();
                alert(data.message || (data.error ? "Error: " + data.error : "Import failed"));
                if(res.ok) fetchReasons();
            } catch(err) {
                alert("Import failed: " + err.message);
            }
            e.target.value = ''; // Reset
        }
    });
}

addTeamBtn.addEventListener('click', () => {
    // Reset Form for Add
    document.getElementById('team-form').reset();
    document.getElementById('edit-index').value = -1;
    document.getElementById('modal-title').textContent = "Add New Team";
    document.getElementById('current-score-display').textContent = "0";
    
    populateReasonDropdown(null); // Load initial reasons (Orange)

    // Default Icon
    const defaultIcon = document.querySelector('input[name="team-icon"][value="fa-brain"]');
    if(defaultIcon) defaultIcon.checked = true;

    openModal(false);
});
viewReportBtn.addEventListener('click', renderReports);
if(manageReasonsBtn) manageReasonsBtn.addEventListener('click', openReasonsManager);
if(closeReasonsBtn) closeReasonsBtn.addEventListener('click', closeReasons);
if(reasonForm) reasonForm.addEventListener('submit', handleReasonSubmit);

function openReasonsManager() {
    reasonsModal.style.display = 'flex';
    renderReasonsList();
}

function closeReasons() {
    reasonsModal.style.display = 'none';
}

function renderReasonsList() {
    reasonsList.innerHTML = '';
    reasonMappings.forEach(r => {
        const div = document.createElement('div');
        div.className = 'rule-item';
        div.style.justifyContent = 'space-between';
        
        const capColors = { 'Orange': '#f97316', 'Green': '#39ff14', 'Purple': '#bc13fe', 'Black': '#000000' };
        const color = capColors[r.cap_type || 'Orange'];
        const badgeStyle = `background:${color}; color:${r.cap_type==='Black'?'white':'black'}; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold; margin-right:5px; vertical-align: middle;`;

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:1.5rem; flex:1;">
                <div class="rule-points">+${r.points} pts</div>
                <div style="flex:1;">
                    <div style="color:var(--text-primary); font-weight:bold; margin-bottom:0.2rem;">
                        <span style="${badgeStyle}">${r.cap_type || 'Orange'}</span> ${r.reason}
                    </div>
                    <div class="rule-desc" style="font-size:0.9rem;">${r.description}</div>
                </div>
            </div>
            <div class="actions">
                <button class="btn edit" onclick="editReason(${r.id})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn danger" onclick="deleteReason(${r.id})"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        reasonsList.appendChild(div);
    });
}

window.editReason = function(id) {
    const reason = reasonMappings.find(r => r.id === id);
    if(reason) {
        document.getElementById('reason-id').value = reason.id;
        document.getElementById('reason-text').value = reason.reason;
        document.getElementById('reason-desc').value = reason.description;
        document.getElementById('reason-points').value = reason.points;
        const capSelect = document.getElementById('reason-cap');
        if(capSelect) capSelect.value = reason.cap_type || 'Orange';
    }
};

window.deleteReason = async function(id) {
    if(confirm('Delete this reason?')) {
        try {
            await fetch(`${API_BASE_URL}/api/reasons/${id}`, { method: 'DELETE' });
            await fetchReasons(); // Refresh data
            renderReasonsList();
        } catch (e) {
            console.error(e);
        }
    }
};

async function handleReasonSubmit(e) {
    e.preventDefault();
    console.log("Submitting reason form...");
    const id = parseInt(document.getElementById('reason-id').value);
    const reason = document.getElementById('reason-text').value.trim();
    
    // Duplicate Check
    const exists = reasonMappings.some(r => r.reason.toLowerCase() === reason.toLowerCase() && r.id !== id);
    if (exists) {
        alert("A reason with this name already exists.");
        return;
    }

    const description = document.getElementById('reason-desc').value;
    const points = parseInt(document.getElementById('reason-points').value);
    const cap_type = document.getElementById('reason-cap').value;

    const method = id > -1 ? 'PUT' : 'POST';
    const url = id > -1 ? `${API_BASE_URL}/api/reasons/${id}` : `${API_BASE_URL}/api/reasons`;

    console.log(`Method: ${method}, URL: ${url}, Data:`, { reason, description, points, cap_type });

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason, description, points, cap_type })
        });

        if (!res.ok) {
            const errData = await res.json();
            console.error("API Error:", errData);
            throw new Error(errData.error || "Failed to save");
        }
        
        console.log("Save successful");

        // Reset form
        document.getElementById('reason-id').value = -1;
        document.getElementById('reason-form').reset();
        
        await fetchReasons(); // Refresh global data
        renderReasonsList();
    } catch (e) {
        console.error("Submit error:", e);
        alert('Error saving reason: ' + e.message);
    }
}

function renderReports() {
    reportModal.style.display = 'flex';
    
    // 0. Cleanup old charts
    if (Object.keys(chartInstances).length > 0) {
        Object.values(chartInstances).forEach(chart => chart.destroy());
    }

    // 1. Simple Stats (Keep existing logic)
    const totalPoints = teams.reduce((sum, team) => sum + team.score, 0);
    document.getElementById('total-points-display').textContent = totalPoints.toLocaleString();
    
    const topTeam = teams.length > 0 ? teams.reduce((prev, current) => (prev.score > current.score) ? prev : current) : null;
    document.getElementById('top-team-display').textContent = topTeam ? topTeam.name : '-';
    
    const dateCounts = {};
    teams.forEach(t => {
        (t.history || []).forEach(h => {
            if(h.date) {
                const dateOnly = h.date.split('T')[0];
                dateCounts[dateOnly] = (dateCounts[dateOnly] || 0) + 1;
            }
        });
    });
    
    let mostActiveDate = '-';
    let maxCount = 0;
    for(const [date, count] of Object.entries(dateCounts)) {
        if(count > maxCount) {
            maxCount = count;
            mostActiveDate = date;
        }
    }
    document.getElementById('active-day-display').textContent = mostActiveDate;

    // --- CHART 1: Top Squads (Horizontal Bar) ---
    const ctxTop = document.getElementById('topSquadsChart').getContext('2d');
    const top5 = [...teams].sort((a, b) => b.score - a.score).slice(0, 5);
    
    chartInstances.top = new Chart(ctxTop, {
        type: 'bar',
        data: {
            labels: top5.map(t => t.name),
            datasets: [{
                label: 'Score',
                data: top5.map(t => t.score),
                backgroundColor: ['#ffd700', '#c0c0c0', '#cd7f32', '#00f3ff', '#bc13fe'],
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } },
                y: { grid: { display: false }, ticks: { color: '#e2e8f0' } }
            },
            plugins: { legend: { display: false } }
        }
    });

    // --- CHART 2: Activity Momentum (Line) ---
    const ctxMom = document.getElementById('momentumChart').getContext('2d');
    
    chartInstances.momentum = new Chart(ctxMom, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Daily Points',
                data: [],
                borderColor: '#39ff14',
                backgroundColor: 'rgba(57, 255, 20, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            },
            plugins: { legend: { display: false } }
        }
    });
    
    // Initialize with Weekly view
    updateMomentum('weekly');

    // --- CHART 3: Impact Breakdown (Doughnut) ---
    const ctxBreak = document.getElementById('breakdownChart').getContext('2d');
    const reasonCounts = {};
    teams.forEach(t => {
        (t.history || []).forEach(h => {
             if(h.reason) reasonCounts[h.reason] = (reasonCounts[h.reason] || 0) + 1;
        });
    });

    chartInstances.breakdown = new Chart(ctxBreak, {
        type: 'doughnut',
        data: {
            labels: Object.keys(reasonCounts),
            datasets: [{
                data: Object.values(reasonCounts),
                backgroundColor: ['#00f3ff', '#bc13fe', '#39ff14', '#f97316', '#ffd700', '#ff003c'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: 10
            },
            plugins: {
                legend: { position: 'bottom', labels: { color: '#e2e8f0', boxWidth: 10, font: { size: 10 } } }
            }
        }
    });

    // --- CHART 4: Mastery Levels (Bar) ---
    const ctxLevels = document.getElementById('levelsChart').getContext('2d');
    const levelCounts = { 'No Cap': 0, 'Orange Cap': 0, 'Green Cap': 0, 'Purple Cap': 0, 'Black Cap': 0 };
    teams.forEach(t => {
        const lvl = calculateLevel(t.score).name;
        levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
    });

    chartInstances.levels = new Chart(ctxLevels, {
        type: 'bar',
        data: {
            labels: Object.keys(levelCounts),
            datasets: [{
                label: 'Teams',
                data: Object.values(levelCounts),
                backgroundColor: ['#64748b', '#f97316', '#39ff14', '#bc13fe', '#ffffff'],
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                x: { grid: { display: false }, ticks: { color: '#e2e8f0' } }
            },
            plugins: { legend: { display: false } }
        }
    });
    
    // 4. Recent Activities (Keep existing logic)
    const allHistory = [];
    teams.forEach(t => {
        (t.history || []).forEach(h => {
            allHistory.push({ ...h, teamName: t.name, teamIcon: t.icon });
        });
    });
    
    // Sort by date desc
    allHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const activityList = document.getElementById('recent-activities-list');
    activityList.innerHTML = '';
    
    allHistory.slice(0, 10).forEach(item => { // Show top 10
        const div = document.createElement('div');
        div.className = 'activity-item';
        const dateDisplay = item.date ? item.date.split('T')[0] : 'Today';
        div.innerHTML = `
            <div class="activity-icon"><i class="fa-solid ${item.teamIcon}"></i></div>
            <div class="activity-details">
                <div class="activity-title">${item.teamName}</div>
                <div class="activity-meta">${item.reason} • ${dateDisplay}</div>
            </div>
            <div class="activity-points">+${item.points}</div>
        `;
        activityList.appendChild(div);
    });
}
viewRulesBtn.addEventListener('click', openRules);
closeModalBtn.addEventListener('click', closeModal);
closeRulesBtn.addEventListener('click', closeRules);
closeViewBtn.addEventListener('click', closeView);
closeReportBtn.addEventListener('click', closeReport);
if(viewUsersBtn) viewUsersBtn.addEventListener('click', openUsersModal);
if(closeUsersBtn) closeUsersBtn.addEventListener('click', closeUsersModal);

function openRules() {
    rulesModal.style.display = 'flex';
}

function closeRules() {
    rulesModal.style.display = 'none';
}

function openModal(isEdit) {
    teamModal.style.display = 'flex';
}

function closeModal() {
    teamModal.style.display = 'none';
}

function closeReport() {
    reportModal.style.display = 'none';
}

function closeView() {
    viewModal.style.display = 'none';
}

async function openUsersModal() {
    usersModal.style.display = 'flex';
    try {
        const res = await fetch(`${API_BASE_URL}/api/users`, {
            headers: { 'x-user-email': currentUser }
        });
        if (!res.ok) throw new Error("Failed to fetch users");
        const users = await res.json();
        renderUsersList(users);
    } catch (e) {
        console.error(e);
        usersListBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:1rem; color:red;">Error loading users</td></tr>';
    }
}

function closeUsersModal() {
    usersModal.style.display = 'none';
}

function renderUsersList(users) {
    window.currentUsersList = users;
    usersListBody.innerHTML = '';
    users.forEach((u, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05);">${u.id}</td>
            <td style="padding: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05);">${u.email}</td>
            <td id="pass-${index}" style="padding: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-family: monospace;">
                <span class="pass-text">********</span>
                <button onclick="togglePassword(${index})" title="Reveal Password" style="margin-left:10px; cursor:pointer; background:none; border:none; color:var(--accent);">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button onclick="deleteUser(${index})" title="Delete User" style="margin-left:5px; cursor:pointer; background:none; border:none; color:#ff4d4d;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        usersListBody.appendChild(tr);
    });
}

window.togglePassword = function(index) {
    const user = window.currentUsersList[index];
    const admin = window.currentUsersList.find(u => u.email.toLowerCase() === 'prashanth.c@brillio.com');
    
    if (!admin) {
        alert("Admin user verification failed.");
        return;
    }

    const td = document.getElementById(`pass-${index}`);
    const span = td.querySelector('.pass-text');
    const icon = td.querySelector('i');
    
    if (span.textContent === '********') {
        const input = prompt("Enter Admin Password to view:");
        if (input === admin.password) {
            span.textContent = user.password;
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            if (input !== null) alert("Incorrect password");
        }
    } else {
        span.textContent = '********';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
};

window.deleteUser = async function(index) {
    const user = window.currentUsersList[index];
    if (confirm(`Are you sure you want to delete user ${user.email}? This action cannot be undone.`)) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/users/${user.id}`, {
                method: 'DELETE',
                headers: { 'x-user-email': currentUser }
            });
            const data = await res.json();
            if (res.ok) {
                alert("User deleted successfully.");
                openUsersModal(); // Refresh list
            } else {
                alert(data.error || "Delete failed");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting user: " + e.message);
        }
    }
};

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem('currentUser');
    location.reload();
});

// Close modal if clicking outside
window.addEventListener('click', (e) => {
    if (e.target === teamModal) closeModal();
    if (e.target === rulesModal) closeRules();
    if (e.target === viewModal) closeView();
    if (e.target === reportModal) closeReport();
    if (e.target === usersModal) closeUsersModal();
});

// Form Submission (Add / Edit)
teamForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('team-name').value;
    const icon = document.querySelector('input[name="team-icon"]:checked').value;
    const index = parseInt(editIndexInput.value);
    
    const pointsAddInput = document.getElementById('points-add');
    const reasonInput = document.getElementById('points-reason');
    
    let pointsToAdd = parseInt(pointsAddInput.value);
    const reason = reasonInput.value.trim();

    try {
        if (index > -1) {
            // Update Existing Team
            const team = teams[index];
            let newScore = team.score;
            let newHistory = team.history || [];

            if (!isNaN(pointsToAdd) && pointsToAdd !== 0) {
                if (!reason) {
                    alert("Please provide a reason for adding/subtracting points.");
                    return;
                }
                newScore += pointsToAdd;
                const date = new Date().toISOString(); // Use full timestamp
                newHistory.push({ points: pointsToAdd, reason: reason, date: date });
            }

            const updatedTeam = { ...team, name, icon, score: newScore, history: newHistory };
            
            await fetch(`${API_BASE_URL}/api/teams/${team.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTeam)
            });

        } else {
            // Add New Team
            let initialScore = isNaN(pointsToAdd) ? 0 : pointsToAdd;
            let history = [];
            if (initialScore !== 0) {
                 history.push({ points: initialScore, reason: reason || "Initial Score", date: new Date().toISOString() });
            }

            const newTeamData = {
                name,
                icon,
                score: initialScore,
                history: history
            };

            await fetch(`${API_BASE_URL}/api/teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTeamData)
            });
        }
        
        await fetchTeams(); // Refresh data from server
        closeModal();

    } catch (error) {
        console.error("Error saving team:", error);
        alert("Failed to save changes. Check server connection.");
    }
});

// CRUD Operations exposed to window for inline onclicks
window.editTeam = function(index) {
    const team = teams[index];
    document.getElementById('team-name').value = team.name;
    
    // Update Score UI
    document.getElementById('current-score-display').textContent = team.score.toLocaleString();
    document.getElementById('points-add').value = '';
    document.getElementById('points-reason').value = '';
    
    // Select the correct icon
    const iconRadio = document.querySelector(`input[name="team-icon"][value="${team.icon}"]`);
    if (iconRadio) iconRadio.checked = true;

    populateReasonDropdown(team); // Load relevant reasons

    editIndexInput.value = index;
    modalTitle.textContent = "Update Points / Edit Team";
    
    openModal(true);
};

window.viewTeam = function(index) {
    const team = teams[index];
    const rank = index + 1;
    const levelData = calculateLevel(team.score);
    
    // Populate Modal
    viewIcon.innerHTML = `<i class="fa-solid ${team.icon}"></i>`;
    viewName.textContent = team.name;
    viewRank.textContent = rank;
    viewScore.textContent = team.score.toLocaleString();
    
    // Show Cap Icon instead of Text
    let levelContent = '';
    if (levelData.level === 0) {
        levelContent = '<span style="font-size: 1.5rem; color: #94a3b8;">No Cap</span>';
        viewLevel.style.color = '#94a3b8';
    } else {
        const levelColor = getCapColor(levelData.name);
        levelContent = `<svg viewBox="0 0 120 80" width="80" height="50" style="filter: drop-shadow(0 0 5px ${levelColor})">
            <path fill="${levelColor}" ${levelColor === "#000000" ? 'stroke="white" stroke-width="2"' : ''} d="M20,50 A30,30 0 0,1 80,50 L110,50 L100,60 L20,60 Z M50,20 A10,10 0 0,1 50,20 Z" />
        </svg>`;
        viewLevel.style.color = ''; // Reset
    }
    
    viewLevel.innerHTML = levelContent;
    viewLevel.title = levelData.name;

    // Progress Calculation
    let progress = 0;
    if (levelData.level < 4) {
        const range = levelData.max - levelData.min;
        const current = team.score - levelData.min;
        progress = Math.min(100, Math.max(0, (current / range) * 100));
        viewProgressText.textContent = `${team.score.toLocaleString()} / ${levelData.max.toLocaleString()} pts`;
    } else {
        progress = 100;
        viewProgressText.textContent = "Max Level Reached!";
    }
    viewProgressBar.style.width = `${progress}%`;

    // History
    const viewHistory = document.getElementById('view-history');
    if (viewHistory) {
        viewHistory.innerHTML = '';
        if (team.history && team.history.length > 0) {
            const sortedHistory = [...team.history].reverse();
            sortedHistory.forEach(item => {
                const div = document.createElement('div');
                div.className = 'history-item';
                const sign = item.points >= 0 ? '+' : '';
                const pClass = item.points >= 0 ? 'positive' : 'negative';
                const dateDisplay = item.date ? item.date.split('T')[0] : 'Today';
                div.innerHTML = `
                    <div class="history-points ${pClass}">${sign}${item.points}</div>
                    <div class="history-reason" title="${item.reason}">${item.reason}</div>
                    <div class="history-date">${dateDisplay}</div>
                `;
                viewHistory.appendChild(div);
            });
        } else {
            viewHistory.innerHTML = '<p style="color:var(--text-secondary); padding:1rem; text-align:center;">No history available.</p>';
        }
    }

    viewModal.style.display = 'flex';
};

window.deleteTeam = async function(index) {
    const team = teams[index];
    if(confirm(`Are you sure you want to delete ${team.name}?`)) {
        try {
            await fetch(`${API_BASE_URL}/api/teams/${team.id}`, { method: 'DELETE' });
            await fetchTeams();
        } catch (error) {
            console.error("Error deleting team:", error);
        }
    }
};

window.updateMomentum = function(viewType) {
    if (!chartInstances.momentum) return;

    // 1. UI Update
    document.querySelectorAll('.chart-btn').forEach(btn => btn.classList.remove('active'));
    const btnMap = { 'weekly': '1W', 'monthly': '1M', 'yearly': '1Y' };
    const buttons = Array.from(document.querySelectorAll('.chart-btn'));
    const activeBtn = buttons.find(b => b.textContent === btnMap[viewType]);
    if(activeBtn) activeBtn.classList.add('active');

    // 2. Data Filtering
    const now = new Date();
    // Set to end of day to include today's points fully if needed, or just compare dates
    now.setHours(23, 59, 59, 999);
    
    let startDate = new Date();
    
    if (viewType === 'weekly') startDate.setDate(now.getDate() - 7);
    if (viewType === 'monthly') startDate.setDate(now.getDate() - 30);
    if (viewType === 'yearly') startDate.setDate(now.getDate() - 365);
    
    // Reset time for start date to beginning of day
    startDate.setHours(0, 0, 0, 0);

    const pointsPerDate = {};
    teams.forEach(t => {
        (t.history || []).forEach(h => {
             if(h.date) {
                 const d = new Date(h.date);
                 // Check if date is within range
                 if (d >= startDate && d <= now) {
                     const dateOnly = h.date.split('T')[0];
                     pointsPerDate[dateOnly] = (pointsPerDate[dateOnly] || 0) + h.points;
                 }
             }
        });
    });

    const sortedDates = Object.keys(pointsPerDate).sort();
    const dataPoints = sortedDates.map(d => pointsPerDate[d]);

    // 3. Chart Update
    chartInstances.momentum.data.labels = sortedDates;
    chartInstances.momentum.data.datasets[0].data = dataPoints;
    chartInstances.momentum.update();
};

function launchFireworks() {
    const duration = 3000;
    const endTime = Date.now() + duration;
    const colors = ['#00f3ff', '#bc13fe', '#39ff14', '#ffd700', '#ff003c', '#ffffff'];

    const interval = setInterval(() => {
        if (Date.now() > endTime) {
            clearInterval(interval);
            return;
        }
        
        // Launch a firework rocket (trail)
        const startX = Math.random() * 80 + 10;
        const endX = startX + (Math.random() * 20 - 10);
        const endY = Math.random() * 40 + 10; // Top 10-50%
        
        const trail = document.createElement('div');
        trail.className = 'firework-trail';
        trail.style.left = startX + 'vw';
        trail.style.top = '100vh';
        trail.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        
        document.body.appendChild(trail);
        
        // Animate
        const animation = trail.animate([
            { top: '100vh', left: startX + 'vw', opacity: 1, transform: 'scale(1)' },
            { top: endY + 'vh', left: endX + 'vw', opacity: 0, transform: 'scale(0.5)' }
        ], {
            duration: 800 + Math.random() * 400,
            easing: 'ease-out'
        });
        
        animation.onfinish = () => {
            createExplosion(endX, endY, trail.style.backgroundColor);
            trail.remove();
        };
        
    }, 300);
}

function createExplosion(x, y, color) {
    const particleCount = 60;
    for (let i = 0; i < particleCount; i++) {
        const p = document.createElement('div');
        p.className = 'firework-particle';
        p.style.left = x + 'vw';
        p.style.top = y + 'vh';
        p.style.backgroundColor = color;
        
        document.body.appendChild(p);
        
        // Physics-based Keyframes for Arc
        const keyframes = [];
        const frames = 30;
        const angle = Math.random() * Math.PI * 2;
        const force = Math.random() * 8 + 4; // Initial speed
        const gravity = 0.4; // Gravity acceleration
        
        const vx = Math.cos(angle) * force;
        const vy = Math.sin(angle) * force;
        
        let posX = 0;
        let posY = 0;
        let currentVy = vy;

        for (let f = 0; f <= frames; f++) {
            posX += vx;
            posY += currentVy;
            currentVy += gravity; // Apply gravity
            
            const opacity = 1 - (f / frames);
            const scale = 1 - (f / frames) * 0.5;
            
            keyframes.push({
                transform: `translate(${posX * 2}px, ${posY * 2}px) scale(${scale})`, // Scale movement for visibility
                opacity: opacity
            });
        }

        const animation = p.animate(keyframes, {
            duration: 1500 + Math.random() * 1000,
            easing: 'linear' // Path is defined by keyframes
        });
        
        animation.onfinish = () => p.remove();
    }
}

function launchComets() {
    const duration = 3000;
    const endTime = Date.now() + duration;
    
    const interval = setInterval(() => {
        if (Date.now() > endTime) {
            clearInterval(interval);
            return;
        }
        
        const comet = document.createElement('div');
        comet.className = 'comet';
        
        // Random start side (mostly left or right)
        const startLeft = Math.random() > 0.5;
        const startX = startLeft ? -10 : 110;
        const startY = Math.random() * 60;
        const endX = startLeft ? 110 : -10;
        const endY = startY + (Math.random() * 40 - 20); // Slight vertical variance
        
        // Calculate Angle
        const dy = endY - startY;
        const dx = endX - startX;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI); // Degrees
        
        comet.style.left = startX + 'vw';
        comet.style.top = startY + 'vh';
        
        document.body.appendChild(comet);
        
        const anim = comet.animate([
            { transform: `translate(0, 0) rotate(${angle}deg)`, opacity: 0 },
            { transform: `translate(${dx*0.1}vw, ${dy*0.1}vh) rotate(${angle}deg)`, opacity: 1, offset: 0.1 },
            { transform: `translate(${dx}vw, ${dy}vh) rotate(${angle}deg)`, opacity: 0 }
        ], {
            duration: 1500 + Math.random() * 1000,
            easing: 'linear'
        });
        
        anim.onfinish = () => comet.remove();
        
    }, 800); // Every 800ms
}

// Initial Render
document.addEventListener('DOMContentLoaded', () => {
    initAuth(); // Check auth first
    
    if (sessionStorage.getItem('currentUser')) {
        fetchTeams();
        fetchReasons();
        // Celebration
        launchFireworks();
        launchComets();
    }
});
