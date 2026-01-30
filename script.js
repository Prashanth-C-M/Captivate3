// --- Auth System (SQLite Backend) ---
// Leave empty string for production to use relative paths (same domain)
// For local development with separate frontend/backend, set to 'http://localhost:3000'
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : ''; 
let currentUser = sessionStorage.getItem('currentUser');

window.showAuth = function(viewId) {
    document.querySelectorAll('.auth-box').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`auth-${viewId}`);
    if(target) {
        target.classList.remove('hidden');
    }
};

function isAdmin() {
    return currentUser && currentUser.toLowerCase() === 'captivate_admin@brillio.com';
}

function initAuth() {
    if (currentUser) {
        document.getElementById('auth-overlay').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        
        const adminPanelBtn = document.getElementById('admin-panel-btn');

        if (isAdmin()) {
            if (adminPanelBtn) {
                adminPanelBtn.classList.remove('hidden');
            }
        } else {
            if (adminPanelBtn) {
                adminPanelBtn.classList.add('hidden');
            }
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
                // Initialize data properly on login without reload if possible, but href=/ reloads anyway
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

// Change Password
const changePasswordModal = document.getElementById('change-password-modal');
const changePasswordBtn = document.getElementById('change-password-btn');
const closeChangePasswordBtn = document.querySelector('.close-change-password');
const changePasswordForm = document.getElementById('change-password-form');

if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        changePasswordModal.style.display = 'flex';
    });
}

if (closeChangePasswordBtn) {
    closeChangePasswordBtn.addEventListener('click', () => {
        changePasswordModal.style.display = 'none';
        changePasswordForm.reset();
    });
}

if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPassword = document.getElementById('old-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmNewPassword = document.getElementById('confirm-new-password').value;

        if (newPassword !== confirmNewPassword) {
            alert("New passwords do not match.");
            return;
        }

        if (newPassword.length < 6) {
            alert("Password must be at least 6 characters.");
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: sessionStorage.getItem('currentUser'),
                    oldPassword, 
                    newPassword 
                })
            });
            const data = await res.json();

            if (res.ok) {
                alert("Password changed successfully!");
                changePasswordModal.style.display = 'none';
                changePasswordForm.reset();
            } else {
                alert(data.error || "Failed to change password");
            }
        } catch (error) {
            console.error("Change password error:", error);
            alert("Server connection error.");
        }
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
                alert(`Contact captivate_admin@brillio.com`);
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
let quests = [];

// API Interaction
async function fetchTeams() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/team-members`);
        if (!response.ok) throw new Error('Failed to fetch');
        teams = await response.json();
        renderLeaderboard();
    } catch (error) {
        console.error("Error fetching team members:", error);
    }
}

async function fetchReasons() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/reasons`);
        if (!response.ok) throw new Error('Failed to fetch reasons');
        reasonMappings = await response.json();
        return true;
    } catch (error) {
        console.error("Error fetching reasons:", error);
        return false;
    }
}

async function fetchQuests() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/quests`);
        if (!response.ok) throw new Error('Failed to fetch quests');
        quests = await response.json();
        renderQuests(quests);
        return true;
    } catch (error) {
        console.error("Error fetching quests:", error);
        return false;
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
    // const targetCap = getTargetCap(currentScore); // Filter removed
    const historyReasons = team ? (team.history || []).map(h => h.reason) : [];

    const filteredReasons = reasonMappings.filter(r => {
        // Cap Type Match - REMOVED
        // const rCap = r.cap_type || 'Orange';
        // if (rCap !== targetCap) return false;
        
        // Unique Check - Keep this if you want reasons to be one-time only per user
        // if (historyReasons.includes(r.reason)) return false;
        
        return true;
    });

    if (filteredReasons.length === 0) {
        const option = document.createElement('option');
        option.textContent = `No available reasons`;
        option.disabled = true;
        reasonSelect.appendChild(option);
    }

    filteredReasons.forEach(mapping => {
        const option = document.createElement('option');
        option.value = mapping.reason; 
        // Add visual indicator for cap type
        const capIndicator = mapping.cap_type ? `[${mapping.cap_type}] ` : '';
        option.textContent = `${capIndicator}${mapping.reason} (+${mapping.points})`;
        option.title = mapping.description;
        option.dataset.points = mapping.points;
        
        // Optional: Style the option if supported by browser/OS (limited support for select options)
        if (mapping.cap_type === 'Orange') option.style.color = '#f97316';
        if (mapping.cap_type === 'Green') option.style.color = '#39ff14';
        if (mapping.cap_type === 'Purple') option.style.color = '#bc13fe';
        if (mapping.cap_type === 'Black') option.style.color = '#ffffff'; // or light grey for visibility on white bg if not dark mode specific
        
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

// Admin Panel Elements
const adminPanelModal = document.getElementById('admin-panel-modal');
const adminPanelBtn = document.getElementById('admin-panel-btn');
const closeAdminPanelBtn = document.querySelector('.close-admin-panel');

if (adminPanelBtn) {
    adminPanelBtn.addEventListener('click', () => {
        if(isAdmin()) {
            adminPanelModal.style.display = 'flex';
        } else {
            alert("Unauthorized access.");
        }
    });
}

if (closeAdminPanelBtn) {
    closeAdminPanelBtn.addEventListener('click', () => {
        adminPanelModal.style.display = 'none';
    });
}

// Inbox Elements
const inboxModal = document.getElementById('inbox-modal');
const inboxBtn = document.getElementById('inbox-btn');
const closeInboxBtn = document.querySelector('.close-inbox');
const inboxList = document.getElementById('inbox-list');

// Reasons Modal Elements
const reasonsModal = document.getElementById('reasons-modal');
const manageReasonsBtn = document.getElementById('manage-reasons-btn');
const closeReasonsBtn = document.querySelector('.close-reasons');
const reasonForm = document.getElementById('reason-form');
const reasonsList = document.getElementById('reasons-list');

// Quests Modal Elements
const questsModal = document.getElementById('quests-modal');
const viewQuestsBtn = document.getElementById('view-quests-btn');
const closeQuestsBtn = document.querySelector('.close-quests');
const questsList = document.getElementById('quests-list');

// Manage Quests Modal Elements
const manageQuestsModal = document.getElementById('manage-quests-modal');
const manageQuestsBtn = document.getElementById('manage-quests-btn');
const closeManageQuestsBtn = document.querySelector('.close-manage-quests');
const manageQuestForm = document.getElementById('manage-quest-form');
const manageQuestsList = document.getElementById('manage-quests-list');

// Claim Modal Elements
const claimModal = document.getElementById('claim-modal');
const closeClaimBtn = document.querySelector('.close-claim');
const claimForm = document.getElementById('claim-form');
const claimTeamSelect = document.getElementById('claim-team-select');

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

function calculateLevel(history) {
    let orangePoints = 0;
    let greenPoints = 0;
    let purplePoints = 0;
    let blackPoints = 0;

    history.forEach(h => {
        // Find reason mapping to determine cap type
        const mapping = reasonMappings.find(r => r.reason === h.reason);
        // Fallback: check quests (assuming title matches reason in history for quests)
        const quest = quests.find(q => q.title === h.reason.replace("Quest Completed: ", ""));
        
        let capType = 'Orange'; // Default
        if (mapping) {
            capType = mapping.cap_type || 'Orange';
        } else if (quest) {
            capType = quest.cap_type || 'Orange';
        } else {
             // Try to infer from text or existing logic if needed, otherwise default Orange
             // Or maybe we stored it? No, history is simple JSON.
        }

        if (capType === 'Orange') orangePoints += h.points;
        if (capType === 'Green') greenPoints += h.points;
        if (capType === 'Purple') purplePoints += h.points;
        if (capType === 'Black') blackPoints += h.points;
    });

    // Progression Logic: Must fill previous bucket to start next
    // Threshold per level is 3000 points of that specific color
    
    // Level 0 -> 1 (Orange Cap)
    if (orangePoints < 3000) {
        return { level: 0, name: "No Cap", min: 0, max: 3000, current: orangePoints, nextColor: 'Orange' };
    }
    
    // Level 1 -> 2 (Green Cap)
    // Requirement: 3000 Orange (Met) + 3000 Green
    if (greenPoints < 3000) {
        return { level: 1, name: "Orange Cap", min: 0, max: 3000, current: greenPoints, nextColor: 'Green' };
    }

    // Level 2 -> 3 (Purple Cap)
    // Requirement: 3000 Orange + 3000 Green (Met) + 3000 Purple
    if (purplePoints < 3000) {
        return { level: 2, name: "Green Cap", min: 0, max: 3000, current: purplePoints, nextColor: 'Purple' };
    }

    // Level 3 -> 4 (Black Cap)
    // Requirement: 3000 Orange + 3000 Green + 3000 Purple (Met) + 3000 Black
    if (blackPoints < 3000) {
        return { level: 3, name: "Purple Cap", min: 0, max: 3000, current: blackPoints, nextColor: 'Black' };
    }

    // Level 4 (Black Cap Master)
    return { level: 4, name: "Black Cap", min: 0, max: 20000, current: blackPoints, nextColor: 'Master' };
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
    // Sort teams by Cap Level descending, then by Total Score, then by Date
    teams.sort((a, b) => {
        const levelA = calculateLevel(a.history || []).level;
        const levelB = calculateLevel(b.history || []).level;

        // 1. Primary: Higher Cap Level wins
        if (levelB !== levelA) {
            return levelB - levelA;
        }

        // 2. Secondary: Higher Total Score wins
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        
        // 3. Tie-breaker: Earlier last update wins
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
                const levelData = calculateLevel(team.history || []);
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

        const levelData = calculateLevel(team.history || []);
        let capsHtml = '';
        
        // Show current cap
        if (levelData.level === 0) {
            capsHtml = '<span style="color:#94a3b8; font-size: 0.9rem; font-style: italic;">No Cap</span>';
        } else {
            // Display accumulation of caps or just the highest? Previous logic showed all achieved caps.
            // New logic: Show achieved caps based on level.
            if (levelData.level >= 1) capsHtml += getCapSvg("#f97316");
            if (levelData.level >= 2) capsHtml += getCapSvg("#39ff14");
            if (levelData.level >= 3) capsHtml += getCapSvg("#bc13fe");
            if (levelData.level >= 4) capsHtml += getCapSvg("#000000");
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
         window.location.href = `${API_BASE_URL}/api/team-members/export?email=${encodeURIComponent(currentUser)}`;
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
                const res = await fetch(`${API_BASE_URL}/api/team-members/import`, {
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
    document.getElementById('modal-title').textContent = "Add New Member";
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

// Inbox Logic
if (inboxBtn) inboxBtn.addEventListener('click', openInbox);
if (closeInboxBtn) closeInboxBtn.addEventListener('click', closeInbox);

async function openInbox() {
    if (!isAdmin()) {
        alert("Unauthorized access.");
        return;
    }
    inboxModal.style.display = 'flex';
    await fetchRequests();
}

function closeInbox() {
    inboxModal.style.display = 'none';
}

async function fetchRequests() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/requests`, {
             headers: { 'x-user-email': currentUser }
        });
        if (!res.ok) throw new Error("Failed to fetch requests");
        const requests = await res.json();
        renderInbox(requests);
    } catch (e) {
        console.error(e);
        inboxList.innerHTML = '<p style="text-align:center; padding:1rem;">Error loading requests.</p>';
    }
}

function renderInbox(requests) {
    inboxList.innerHTML = '';
    if (requests.length === 0) {
        inboxList.innerHTML = '<p style="text-align:center; padding:1rem; color: var(--text-secondary);">No pending requests.</p>';
        return;
    }

    requests.forEach(req => {
        const div = document.createElement('div');
        div.className = 'rule-item'; // Reuse existing style class
        div.style.flexDirection = 'column';
        div.style.alignItems = 'flex-start';
        
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; width:100%; margin-bottom:0.5rem;">
                <div style="font-weight:bold; color:var(--accent);">${req.team_member_name}</div>
                <div style="color:var(--text-secondary); font-size:0.8rem;">${new Date(req.created_at).toLocaleDateString()}</div>
            </div>
            <div style="margin-bottom:0.5rem;">
                <span style="font-weight:bold; color:#39ff14;">+${req.points} pts</span> 
                <span style="color:var(--text-secondary);"> for </span>
                <span>${req.reason}</span>
            </div>
            <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.8rem;">
                Requested by: ${req.requested_by}
            </div>
            <div style="display:flex; gap:1rem; width:100%;">
                <button class="btn primary" style="flex:1;" onclick="approveRequest(${req.id})">Approve</button>
                <button class="btn danger" style="flex:1;" onclick="rejectRequest(${req.id})">Reject</button>
            </div>
        `;
        inboxList.appendChild(div);
    });
}

window.approveRequest = async function(id) {
    if (!confirm("Approve this request?")) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/requests/${id}/approve`, {
            method: 'POST',
            headers: { 'x-user-email': currentUser }
        });
        if (res.ok) {
            fetchRequests(); // Refresh inbox
            fetchTeams(); // Refresh leaderboard
        } else {
            alert("Failed to approve.");
        }
    } catch (e) {
        console.error(e);
        alert("Error approving request.");
    }
};

window.rejectRequest = async function(id) {
    const reason = prompt("Enter rejection reason:");
    if (reason === null) return; // Cancelled
    if (!reason.trim()) {
        alert("Rejection reason is required.");
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/requests/${id}/reject`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-email': currentUser 
            },
            body: JSON.stringify({ rejectionReason: reason })
        });
        if (res.ok) {
            fetchRequests(); // Refresh inbox
            fetchTeams(); // Refresh leaderboard to show rejection in history
        } else {
            alert("Failed to reject.");
        }
    } catch (e) {
        console.error(e);
        alert("Error rejecting request.");
    }
};

function openReasonsManager() {
    if (!isAdmin()) {
        alert("Unauthorized access.");
        return;
    }
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
        const lvl = calculateLevel(t.history || []).name;
        levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
    });

    chartInstances.levels = new Chart(ctxLevels, {
        type: 'bar',
        data: {
            labels: Object.keys(levelCounts),
            datasets: [{
                label: 'Team Members',
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
if(viewQuestsBtn) viewQuestsBtn.addEventListener('click', openQuests);
if(closeQuestsBtn) closeQuestsBtn.addEventListener('click', closeQuests);
if(closeClaimBtn) closeClaimBtn.addEventListener('click', closeClaim);
if(claimForm) claimForm.addEventListener('submit', handleClaimSubmit);
if(manageQuestsBtn) manageQuestsBtn.addEventListener('click', openManageQuests);
if(closeManageQuestsBtn) closeManageQuestsBtn.addEventListener('click', closeManageQuests);
if(manageQuestForm) manageQuestForm.addEventListener('submit', handleQuestSubmit);

function openRules() {
    rulesModal.style.display = 'flex';
}

function closeRules() {
    rulesModal.style.display = 'none';
}

function openQuests() {
    questsModal.style.display = 'flex';
    fetchQuests(); // Refresh
}

function closeQuests() {
    questsModal.style.display = 'none';
}

function closeClaim() {
    claimModal.style.display = 'none';
}

function openManageQuests() {
    if (!isAdmin()) {
        alert("Unauthorized access.");
        return;
    }
    manageQuestsModal.style.display = 'flex';
    renderManageQuestsList();
}

function closeManageQuests() {
    manageQuestsModal.style.display = 'none';
}

window.filterQuests = function(category) {
    document.querySelectorAll('.quest-tab').forEach(t => t.classList.remove('active'));
    // Find clicked tab (event.target is not passed, so find by text or just add event listener properly)
    // Simplified: Find the button with this onclick text
    const buttons = document.querySelectorAll('.quest-tab');
    buttons.forEach(b => {
        if(b.getAttribute('onclick').includes(category)) b.classList.add('active');
    });

    if (category === 'all') {
        renderQuests(quests);
    } else {
        const filtered = quests.filter(q => q.category === category);
        renderQuests(filtered);
    }
};

function renderQuests(data) {
    questsList.innerHTML = '';
    data.forEach(q => {
        const div = document.createElement('div');
        div.className = 'quest-card';
        div.dataset.category = q.category;
        
        const capColors = { 'Orange': '#f97316', 'Green': '#39ff14', 'Purple': '#bc13fe', 'Black': '#000000' };
        const color = capColors[q.cap_type || 'Orange'];
        const badgeStyle = `background:${color}; color:${q.cap_type==='Black'?'white':'black'}; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold; margin-right:5px; vertical-align: middle;`;

        div.innerHTML = `
            <div class="quest-icon"><i class="fa-solid ${q.icon || 'fa-scroll'}"></i></div>
            <div class="quest-title"><span style="${badgeStyle}">${q.cap_type || 'Orange'}</span> ${q.title}</div>
            <div class="quest-desc">${q.description}</div>
            <div class="quest-footer">
                <div class="quest-points">+${q.points} pts</div>
                <button class="btn secondary" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="claimQuest(${q.id})">Claim</button>
            </div>
        `;
        questsList.appendChild(div);
    });
}

function renderManageQuestsList() {
    manageQuestsList.innerHTML = '';
    quests.forEach(q => {
        const div = document.createElement('div');
        div.className = 'quest-card';
        div.dataset.category = q.category;
        
        const capColors = { 'Orange': '#f97316', 'Green': '#39ff14', 'Purple': '#bc13fe', 'Black': '#000000' };
        const color = capColors[q.cap_type || 'Orange'];
        const badgeStyle = `background:${color}; color:${q.cap_type==='Black'?'white':'black'}; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold; margin-right:5px; vertical-align: middle;`;

        div.innerHTML = `
            <div class="quest-icon"><i class="fa-solid ${q.icon || 'fa-scroll'}"></i></div>
            <div class="quest-title"><span style="${badgeStyle}">${q.cap_type || 'Orange'}</span> ${q.title}</div>
            <div class="quest-desc">${q.description}</div>
            <div class="quest-footer" style="flex-direction: column; gap: 0.5rem; align-items: stretch;">
                <div style="display: flex; justify-content: space-between;">
                    <div class="quest-points">+${q.points} pts</div>
                    <div>${q.category}</div>
                </div>
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem;">
                    <button class="btn edit" onclick="editQuest(${q.id})"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn danger" onclick="deleteQuest(${q.id})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
        manageQuestsList.appendChild(div);
    });
}

window.editQuest = function(id) {
    const quest = quests.find(q => q.id === id);
    if(quest) {
        document.getElementById('manage-quest-id').value = quest.id;
        document.getElementById('manage-quest-title').value = quest.title;
        document.getElementById('manage-quest-desc').value = quest.description;
        document.getElementById('manage-quest-points').value = quest.points;
        document.getElementById('manage-quest-category').value = quest.category;
        document.getElementById('manage-quest-icon').value = quest.icon;
        const capSelect = document.getElementById('manage-quest-cap');
        if(capSelect) capSelect.value = quest.cap_type || 'Orange';
    }
};

window.deleteQuest = async function(id) {
    if(confirm('Delete this quest?')) {
        try {
            await fetch(`${API_BASE_URL}/api/quests/${id}`, {
                method: 'DELETE',
                headers: { 'x-user-email': currentUser }
            });
            await fetchQuests(); // Refresh data
            renderManageQuestsList(); // Re-render admin list
        } catch (e) {
            console.error(e);
            alert("Error deleting quest");
        }
    }
};

async function handleQuestSubmit(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('manage-quest-id').value);
    const title = document.getElementById('manage-quest-title').value.trim();
    const description = document.getElementById('manage-quest-desc').value;
    const points = parseInt(document.getElementById('manage-quest-points').value);
    const category = document.getElementById('manage-quest-category').value;
    const icon = document.getElementById('manage-quest-icon').value;
    const cap_type = document.getElementById('manage-quest-cap').value;

    const method = id > -1 ? 'PUT' : 'POST';
    const url = id > -1 ? `${API_BASE_URL}/api/quests/${id}` : `${API_BASE_URL}/api/quests`;

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 
                'Content-Type': 'application/json',
                'x-user-email': currentUser
            },
            body: JSON.stringify({ title, description, points, category, icon, cap_type })
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Failed to save");
        }

        // Reset form
        document.getElementById('manage-quest-id').value = -1;
        document.getElementById('manage-quest-form').reset();
        
        await fetchQuests(); // Refresh global data
        renderManageQuestsList();
        
    } catch (e) {
        console.error("Submit error:", e);
        alert('Error saving quest: ' + e.message);
    }
}

window.claimQuest = function(id) {
    const quest = quests.find(q => q.id === id);
    if(!quest) return;

    document.getElementById('claim-quest-title').textContent = `Claim: ${quest.title}`;
    document.getElementById('claim-quest-points').value = quest.points;
    document.getElementById('claim-quest-name').value = quest.title;
    
    // Populate team select
    claimTeamSelect.innerHTML = '<option value="" disabled selected>Select member...</option>';
    teams.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        claimTeamSelect.appendChild(opt);
    });

    claimModal.style.display = 'flex';
};

async function handleClaimSubmit(e) {
    e.preventDefault();
    const teamId = claimTeamSelect.value;
    const points = parseInt(document.getElementById('claim-quest-points').value);
    const questTitle = document.getElementById('claim-quest-name').value;

    if (!teamId) {
        alert("Please select a team member.");
        return;
    }

    const team = teams.find(t => t.id == teamId);
    if (!team) return;

    if (!isAdmin()) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    team_member_id: team.id,
                    points: points,
                    reason: `Quest Completed: ${questTitle}`,
                    requested_by: currentUser
                })
            });

            if (res.ok) {
                alert("Quest claim submitted for approval.");
                closeClaim();
                closeQuests();
            } else {
                alert("Failed to submit claim request.");
            }
        } catch (err) {
            console.error(err);
            alert("Server error submitting request.");
        }
        return;
    }

    // Update team score
    const newScore = team.score + points;
    const newHistory = team.history || [];
    newHistory.push({ 
        points: points, 
        reason: `Quest Completed: ${questTitle}`, 
        date: new Date().toISOString() 
    });

    try {
        const updatedTeam = { ...team, score: newScore, history: newHistory };
        const res = await fetch(`${API_BASE_URL}/api/team-members/${team.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedTeam)
        });

        if (res.ok) {
            alert(`Congratulations! ${points} points added to ${team.name}.`);
            closeClaim();
            closeQuests(); // Close quest modal too
            await fetchTeams(); // Refresh leaderboard
            launchFireworks(); // Celebration!
        } else {
            alert("Failed to claim quest.");
        }
    } catch (err) {
        console.error(err);
        alert("Server error.");
    }
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
    if (!isAdmin()) {
        alert("Unauthorized access.");
        return;
    }
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
    const admin = window.currentUsersList.find(u => u.email.toLowerCase() === 'captivate_admin@brillio.com');
    
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
    if (e.target === questsModal) closeQuests();
    if (e.target === claimModal) closeClaim();
    if (e.target === manageQuestsModal) closeManageQuests();
    if (e.target === changePasswordModal) changePasswordModal.style.display = 'none';
    if (e.target === inboxModal) closeInbox();
    if (e.target === adminPanelModal) adminPanelModal.style.display = 'none';
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
            
            if (!isAdmin() && pointsToAdd !== 0) {
                // Request Workflow for Non-Admins
                if (!reason) {
                    alert("Please provide a reason for requesting points.");
                    return;
                }
                
                await fetch(`${API_BASE_URL}/api/requests`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        team_member_id: team.id,
                        points: pointsToAdd,
                        reason: reason,
                        requested_by: currentUser
                    })
                });
                alert("Point request submitted for approval.");
                closeModal();
                return;
            }

            // Direct Update for Admins
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
            
            await fetch(`${API_BASE_URL}/api/team-members/${team.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTeam)
            });

        } else {
            // Add New Member
            let initialScore = isNaN(pointsToAdd) ? 0 : pointsToAdd;
            
            // If user is not admin, create with 0 points first, then request points
            let createScore = isAdmin() ? initialScore : 0;
            let history = [];
            
            if (createScore !== 0) {
                 history.push({ points: createScore, reason: reason || "Initial Score", date: new Date().toISOString() });
            }

            const newTeamData = {
                name,
                icon,
                score: createScore,
                history: history
            };

            const res = await fetch(`${API_BASE_URL}/api/team-members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTeamData)
            });
            
            const newMember = await res.json();
            
            // If non-admin had points, submit request now
            if (!isAdmin() && initialScore !== 0) {
                 await fetch(`${API_BASE_URL}/api/requests`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        team_member_id: newMember.id,
                        points: initialScore,
                        reason: reason || "Initial Score",
                        requested_by: currentUser
                    })
                });
                alert("Member added. Initial points request submitted for approval.");
            } else {
                alert("Member added successfully.");
            }
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
    const levelData = calculateLevel(team.history || []);
    
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
        // levelData now returns { min: 0, max: 3000, current: <points_in_next_color> }
        const range = levelData.max;
        const current = levelData.current;
        progress = Math.min(100, Math.max(0, (current / range) * 100));
        viewProgressText.textContent = `${current.toLocaleString()} / ${range.toLocaleString()} ${levelData.nextColor} pts`;
        
        // Color the progress bar based on next target
        const colorMap = { 'Orange': '#f97316', 'Green': '#39ff14', 'Purple': '#bc13fe', 'Black': '#000000' };
        viewProgressBar.style.background = colorMap[levelData.nextColor] || 'var(--accent)';
    } else {
        progress = 100;
        viewProgressText.textContent = "Max Level Reached!";
        viewProgressBar.style.background = '#ffffff';
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
                
                let pointsHtml = '';
                let extraInfo = '';
                let statusHtml = '';

                if (item.status === 'Rejected') {
                    pointsHtml = `<div class="history-points" style="color:#ff4d4d; font-size:0.7rem; width:40px; text-align:center;">REJECTED</div>`;
                    if (item.rejection_reason) {
                        extraInfo = `<div style="font-size:0.75rem; color:#ff4d4d; margin-top:0.2rem; font-style:italic;">Reason: ${item.rejection_reason}</div>`;
                    }
                } else {
                    const sign = item.points >= 0 ? '+' : '';
                    const pClass = item.points >= 0 ? 'positive' : 'negative';
                    pointsHtml = `<div class="history-points ${pClass}">${sign}${item.points}</div>`;
                    
                    if (item.status === 'Approved') {
                        statusHtml = '<span style="font-size:0.6rem; background:#39ff14; color:black; padding:1px 4px; border-radius:3px; margin-left:5px; vertical-align:middle;">Approved</span>';
                    }
                }

                const dateDisplay = item.date ? item.date.split('T')[0] : 'Today';
                div.innerHTML = `
                    ${pointsHtml}
                    <div class="history-reason" title="${item.reason}">
                        ${item.reason} ${statusHtml}
                        ${extraInfo}
                    </div>
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
    if (!isAdmin()) {
        alert("Only Admins can delete team members. Please contact captivate_admin@brillio.com");
        return;
    }

    const team = teams[index];
    if(confirm(`Are you sure you want to delete ${team.name}?`)) {
        try {
            await fetch(`${API_BASE_URL}/api/team-members/${team.id}`, { method: 'DELETE' });
            await fetchTeams();
        } catch (error) {
            console.error("Error deleting team member:", error);
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
document.addEventListener('DOMContentLoaded', async () => {
    initAuth(); // Check auth first
    
    if (sessionStorage.getItem('currentUser')) {
        // Fetch dependencies first
        await Promise.all([fetchReasons(), fetchQuests()]);
        // Then fetch teams to ensure level calculation has data
        fetchTeams();
        
        // Celebration
        launchFireworks();
        launchComets();
    }
});
