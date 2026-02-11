// --- CONFIGURATION ---
// PASTE YOUR GOOGLE SCRIPT URL HERE
const API_URL = "https://script.google.com/macros/s/AKfycbwOHiy3ASAHxtgH8cdFZQFyYhN7OXkLPSqZmU0Cz8e1PvDftrgJfKLW5LRAZTwWWaqc5w/exec"; 

// --- STATE ---
let USER_DATA = null;
let CURRENT_ADMIN_CLIENT = null;

// --- CORE API FUNCTION ---
async function apiCall(action, payload = {}) {
    // Show global loader if available
    const loader = document.getElementById('loader');
    if(loader) loader.classList.remove('hidden');
    
    payload.action = action;
    
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if(loader) loader.classList.add('hidden');
        return data;
    } catch (e) {
        if(loader) loader.classList.add('hidden');
        alert("Connection Error: " + e.message);
        return { success: false, message: e.message };
    }
}

// --- LOGIN LOGIC ---
async function handleLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    
    const msg = document.getElementById('login-msg');
    msg.innerText = "Verifying credentials...";
    
    const res = await apiCall('login', { u, p });
    
    if (res.success) {
        msg.innerText = ""; // Clear error
        if(res.type === 'admin') {
            initAdmin();
        } else {
            USER_DATA = res;
            initDashboard();
        }
    } else {
        msg.innerText = res.message || "Invalid Credentials";
    }
}

function logout() {
    location.reload();
}

// --- CLIENT PORTAL LOGIC ---
function initDashboard() {
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('view-dashboard').classList.remove('hidden');
    
    // Safety check for user data
    if(!USER_DATA) return;

    // Display User Info
    const welcomeHero = document.getElementById('welcome-hero');
    if(welcomeHero) welcomeHero.innerText = "Hello, " + USER_DATA.clientName;
    
    const tierBadge = document.getElementById('tier-badge');
    if(tierBadge) tierBadge.innerText = (USER_DATA.tier || "Bronze") + " Membership";
    
    // Load Client Forms
    const grid = document.getElementById('form-grid');
    if(grid) {
        grid.innerHTML = "";
        const forms = ['Website', 'CRM', 'Onboarding'];
        
        forms.forEach(f => {
            const card = document.createElement('div');
            card.className = "form-card";
            card.innerHTML = `<h3>${f}</h3><p style="opacity:0.6; font-size:13px;">View & Edit</p>`;
            card.onclick = () => loadForm(f);
            grid.appendChild(card);
        });
    }
}

async function loadForm(formName) {
    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('view-editor').classList.remove('hidden');
    
    const header = document.getElementById('form-name-header');
    if(header) header.innerText = formName;
    
    const container = document.getElementById('form-builder-area');
    container.innerHTML = "Loading...";
    
    const schema = await apiCall('getSchema', { formName });
    const answers = USER_DATA.answers || {};
    
    container.innerHTML = "";
    
    if(!schema || schema.length === 0) {
        container.innerHTML = "No questions found for this form.";
        return;
    }

    schema.forEach(field => {
        const div = document.createElement('div');
        div.className = "q-block";
        
        const label = document.createElement('label');
        label.className = "q-label";
        label.innerText = field.label;
        div.appendChild(label);
        
        let input;
        if(field.type === 'textarea') {
            input = document.createElement('textarea');
            input.rows = 4;
        } else {
            input = document.createElement('input');
        }
        input.className = "q-input";
        input.value = answers[field.key] || "";
        // Lock input for this demo (or add save logic later)
        // input.disabled = true; 
        
        div.appendChild(input);
        container.appendChild(div);
    });
}

function goHome() {
    document.getElementById('view-editor').classList.add('hidden');
    document.getElementById('view-dashboard').classList.remove('hidden');
}


// --- ADMIN PORTAL LOGIC ---

async function initAdmin() {
    // 1. Switch Views
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('view-admin').classList.remove('hidden');
    
    const tbody = document.getElementById('client-table-body');
    if(tbody) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px;">Loading database...</td></tr>';
        
        // 2. Fetch Data from Google
        const data = await apiCall('adminData');
        
        tbody.innerHTML = ""; // Clear loading message
        
        // 3. Build the Table
        if(data.clients && data.clients.length > 0) {
            data.clients.forEach(c => {
                const tr = document.createElement('tr');
                
                // Tier Styling Logic
                let tierClass = "tier-bronze";
                if(c.tier === "Gold") tierClass = "tier-gold";
                if(c.tier === "Silver") tierClass = "tier-silver";
                
                tr.innerHTML = `
                    <td style="font-weight:600;">${c.name}</td>
                    <td style="font-family:monospace; color:#666;">${c.code}</td>
                    <td><span class="status-pill ${tierClass}">${c.tier}</span></td>
                    <td><span class="status-pill" style="background:#e6fffa; color:#047857;">Active</span></td>
                    <td>
                        <button class="btn-text" style="font-size:12px; font-weight:700;" onclick="openClientView('${c.name}', '${c.id}')">VIEW DETAILS &rarr;</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No clients found.</td></tr>';
        }
    }
}

// --- ADMIN CLIENT DETAIL MODAL ---

async function openClientView(name, id) {
    const modal = document.getElementById('admin-modal');
    modal.classList.remove('hidden');
    
    document.getElementById('modal-title').innerText = name;
    document.getElementById('modal-content').innerHTML = "<div style='text-align:center; opacity:0.5;'>Loading client profile...</div>";
    
    // 1. Fetch Detailed Client Profile
    const profile = await apiCall('getClientProfile', { clientId: id });
    CURRENT_ADMIN_CLIENT = profile; 
    
    // 2. Populate Form Dropdown
    const forms = ['Website', 'CRM', 'Onboarding']; 
    const sel = document.getElementById('modal-form-select');
    sel.innerHTML = '<option value="">-- Select Form to View --</option>';
    forms.forEach(f => {
        sel.innerHTML += `<option value="${f}">${f}</option>`;
    });
}

async function loadClientFormView() {
    const formName = document.getElementById('modal-form-select').value;
    const container = document.getElementById('modal-content');
    
    if(!formName) return;
    
    container.innerHTML = "<div style='text-align:center; opacity:0.5;'>Fetching answers...</div>";
    
    // Fetch schema & answers
    const schema = await apiCall('getSchema', { formName });
    const answers = CURRENT_ADMIN_CLIENT.answers || {};
    
    container.innerHTML = "";
    
    // Render Read-Only View
    if(!schema || schema.length === 0) {
        container.innerHTML = "<p>Form is empty.</p>";
        return;
    }

    schema.forEach(field => {
        const div = document.createElement('div');
        div.style.marginBottom = "25px";
        
        const label = document.createElement('div');
        label.style.fontFamily = "'Open Sans', sans-serif";
        label.style.fontWeight = "700";
        label.style.fontSize = "11px";
        label.style.letterSpacing = "0.5px";
        label.style.color = "#A92F3D"; // Rosewood Red
        label.style.textTransform = "uppercase";
        label.style.marginBottom = "8px";
        label.innerText = field.label;
        div.appendChild(label);
        
        const val = document.createElement('div');
        val.style.padding = "15px";
        val.style.background = "#fff";
        val.style.border = "1px solid #E5E0D8";
        val.style.borderRadius = "4px";
        val.style.fontSize = "14px";
        val.style.lineHeight = "1.5";
        val.style.color = "#493832";
        
        // Check if answer exists
        const userAns = answers[field.key];
        val.innerText = userAns || "—";
        
        // Highlight filled answers
        if(userAns) {
            val.style.borderLeft = "4px solid #493832"; 
            val.style.background = "#FAFAF9";
        } else {
            val.style.opacity = "0.5";
            val.style.fontStyle = "italic";
        }
        
        div.appendChild(val);
        container.appendChild(div);
    });
}

// --- ADMIN SETTINGS (PASSWORD CHANGE) ---

function openSettings() {
    document.getElementById('settings-modal').classList.remove('hidden');
    // Pre-fill current (optional, or leave blank for security)
    document.getElementById('set-user').value = ""; 
    document.getElementById('set-pass').value = "";
}

async function saveAdminCreds() {
    const u = document.getElementById('set-user').value;
    const p = document.getElementById('set-pass').value;
    
    if(!u || !p) { alert("Please enter both fields."); return; }
    
    const btn = document.querySelector('#settings-modal .btn-main');
    const originalText = btn.innerText;
    btn.innerText = "Updating...";
    
    // We send 'updateCreds' action. 
    // MAKE SURE your code.gs doPost() handles 'updateCreds'!
    const res = await apiCall('updateCreds', { u, p });
    
    if(res.success) {
        alert("Credentials updated! Please log in again.");
        location.reload();
    } else {
        alert("Error: " + res.message);
        btn.innerText = originalText;
    }
}
/* --- CLIENT EDITOR LOGIC --- */

function openClientEditor(client = null) {
    const modal = document.getElementById('client-editor-modal');
    modal.classList.remove('hidden');
    
    if(client) {
        // EDIT MODE
        document.getElementById('ce-title').innerText = "Edit Client";
        document.getElementById('ce-id').value = client.id;
        document.getElementById('ce-name').value = client.name;
        document.getElementById('ce-code').value = client.code;
        document.getElementById('ce-tier').value = client.tier;
        // document.getElementById('ce-status').value = client.status; // Add status to DB later if needed
    } else {
        // NEW MODE
        document.getElementById('ce-title').innerText = "New Client";
        document.getElementById('ce-id').value = ""; // Empty ID = New
        document.getElementById('ce-name').value = "";
        document.getElementById('ce-code').value = "rose2026"; // Default
    }
}

async function saveClientChanges() {
    const id = document.getElementById('ce-id').value;
    const name = document.getElementById('ce-name').value;
    const code = document.getElementById('ce-code').value;
    const tier = document.getElementById('ce-tier').value;
    
    if(!name || !code) { alert("Name and Code required."); return; }
    
    const btn = document.querySelector('#client-editor-modal .btn-main');
    btn.innerText = "Saving...";
    
    // Calls API (Make sure 'saveClient' is in code.gs!)
    const res = await apiCall('saveClient', { id, name, code, tier });
    
    if(res.success) {
        document.getElementById('client-editor-modal').classList.add('hidden');
        initAdmin(); // Refresh list
        btn.innerText = "Save Client";
    } else {
        alert("Error: " + res.message);
        btn.innerText = "Save Client";
    }
}
function switchAdminTab(tab) {
    // 1. UI Toggles
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-'+tab).classList.add('active');
    
    // 2. View Toggles
    document.getElementById('panel-clients').classList.add('hidden');
    document.getElementById('panel-forms').classList.add('hidden');
    document.getElementById('panel-'+tab).classList.remove('hidden');
    
    // 3. Load Data if needed
    if(tab === 'forms') loadFormBuilderList(); // We will build this next!
}
