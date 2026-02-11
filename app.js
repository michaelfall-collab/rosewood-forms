// --- CONFIGURATION ---
// PASTE YOUR GOOGLE SCRIPT URL HERE
const API_URL = "https://script.google.com/macros/s/AKfycbyM3lx3DdRNu2ia48nAD2A5Nc7oaDDrC0UqROso0VY7a3Qn9nXfd2SI1pxHhlyfDx3r5A/exec"; 

// --- STATE ---
let USER_DATA = null;
let CURRENT_ADMIN_CLIENT = null;
let ALL_FORMS = [];

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
        ALL_FORMS = data.forms || [];
        
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
                        <button class="btn-text" style="font-size:12px; margin-right:10px;" onclick="openClientEditor({id:'${c.id}', name:'${c.name}', code:'${c.code}', tier:'${c.tier}'})">EDIT</button>
                        <button class="btn-text" style="font-size:12px; font-weight:700;" onclick="openClientView('${c.name}', '${c.id}')">VIEW &rarr;</button>
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
    
    // 2. Populate Form Dropdown (INCLUDES INTERNAL FORMS)
    const sel = document.getElementById('modal-form-select');
    sel.innerHTML = '<option value="">-- Select Form to Edit --</option>';
    
    // Use the dynamic list we fetched in initAdmin()
    if(ALL_FORMS.length > 0) {
        ALL_FORMS.forEach(f => {
            sel.innerHTML += `<option value="${f}">${f}</option>`;
        });
    } else {
        // Fallback if list is empty
        sel.innerHTML += `<option value="Website">Website</option>`;
    }
}

async function loadClientFormView() {
    const formName = document.getElementById('modal-form-select').value;
    const container = document.getElementById('modal-content');
    
    if(!formName) return;
    
    container.innerHTML = "<div style='text-align:center; opacity:0.5;'>Fetching data...</div>";
    
    // Fetch schema & answers
    const schema = await apiCall('getSchema', { formName });
    // Use the latest answers from the client object
    const answers = CURRENT_ADMIN_CLIENT.answers || {};
    
    container.innerHTML = "";
    
    if(!schema || schema.length === 0) {
        container.innerHTML = "<p>Form is empty.</p>";
        return;
    }

    // --- RENDER INPUTS (EDIT MODE) ---
    schema.forEach(field => {
        const div = document.createElement('div');
        div.className = "q-block"; // Re-using your client-side styling
        
        const label = document.createElement('label');
        label.className = "q-label";
        label.innerHTML = `${field.label} <span style="opacity:0.4; font-weight:normal; font-size:10px; margin-left:5px;">(${field.visibility})</span>`;
        div.appendChild(label);
        
        let input;
        
        if (field.type === 'textarea') {
            input = document.createElement('textarea');
            input.rows = 3;
            input.className = "modern-input admin-input-field"; // Added marker class
        } else if (field.type === 'select') {
            input = document.createElement('select');
            input.className = "modern-input admin-input-field";
            // Add options
            if(field.options) {
                field.options.forEach(opt => {
                    const o = document.createElement('option');
                    o.value = opt.trim();
                    o.innerText = opt.trim();
                    input.appendChild(o);
                });
            }
        } else {
            input = document.createElement('input');
            input.type = "text";
            input.className = "modern-input admin-input-field";
        }

        // PRE-FILL DATA
        input.value = answers[field.key] || "";
        
        // METADATA FOR SAVING
        input.setAttribute('data-key', field.key);
        
        div.appendChild(input);
        container.appendChild(div);
    });

    // --- ADD SAVE BUTTON ---
    const btnDiv = document.createElement('div');
    btnDiv.style.marginTop = "30px";
    btnDiv.style.textAlign = "right";
    btnDiv.innerHTML = `
        <button onclick="saveAdminClientForm('${formName}')" class="btn-main" style="background-color:var(--rw-red);">
            Save Changes
        </button>
    `;
    container.appendChild(btnDiv);
}

async function saveAdminClientForm(formName) {
    // 1. Collect Data
    const inputs = document.querySelectorAll('.admin-input-field');
    const payload = {};
    
    inputs.forEach(input => {
        const key = input.getAttribute('data-key');
        if(key) {
            payload[key] = input.value;
        }
    });
    
    const btn = document.querySelector('#modal-content .btn-main');
    const originalText = btn.innerText;
    btn.innerText = "Saving to Database...";

    // 2. Send to Google (Re-using the 'saveData' action)
    // Note: We pass the CLIENT'S Name as 'u' so the backend knows who to update.
    const res = await apiCall('saveData', { 
        u: CURRENT_ADMIN_CLIENT.name, 
        data: payload 
    });

    if(res.success) {
        alert("Success! " + formName + " updated for " + CURRENT_ADMIN_CLIENT.name);
        
        // Refresh the local data object so if we switch forms, we don't lose these changes
        if(!CURRENT_ADMIN_CLIENT.answers) CURRENT_ADMIN_CLIENT.answers = {};
        Object.assign(CURRENT_ADMIN_CLIENT.answers, payload);
        
        btn.innerText = "Changes Saved";
        setTimeout(() => btn.innerText = originalText, 2000);
    } else {
        alert("Error: " + res.message);
        btn.innerText = originalText;
    }
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
    const e = document.getElementById('set-email').value; // NEW
    
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
        document.getElementById('ce-status').value = client.status || "Active";
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
    const status = document.getElementById('ce-status').value;
    
    if(!name || !code) { alert("Name and Code required."); return; }
    
    const btn = document.querySelector('#client-editor-modal .btn-main');
    btn.innerText = "Saving...";
    
    // Calls API (Make sure 'saveClient' is in code.gs!)
    const res = await apiCall('saveClient', { id, name, code, tier, status });
    
    if(res.success) {
        document.getElementById('client-editor-modal').classList.add('hidden');
        initAdmin(); // Refresh list
        btn.innerText = "Save Client";
    } else {
        alert("Error: " + res.message);
        btn.innerText = "Save Client";
    }
}
/* --- NEW DELETE FUNCTION --- */
async function deleteClient() {
    const id = document.getElementById('ce-id').value;
    if(!id) return; // Can't delete a new client
    
    if(confirm("Are you sure you want to PERMANENTLY delete this client?")) {
        const res = await apiCall('deleteClient', { clientId: id });
        if(res.success) {
            document.getElementById('client-editor-modal').classList.add('hidden');
            initAdmin(); // Refresh table
        } else {
            alert(res.message);
        }
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

/* --- LOGIN EXTRAS --- */
function toggleLoginPass() {
    const x = document.getElementById("login-pass");
    x.type = (x.type === "password") ? "text" : "password";
}

function openSignUpModal() {
    document.getElementById('signup-modal').classList.remove('hidden');
}

async function submitSignUp() {
    const name = document.getElementById('su-name').value;
    const user = document.getElementById('su-user').value;
    const pass = document.getElementById('su-pass').value;
    
    if(!name || !user || !pass) { alert("All fields required."); return; }
    
    const btn = document.querySelector('#signup-modal .btn-main');
    btn.innerText = "Creating...";
    
    // Calls new API action
    const res = await apiCall('signUp', { name, user, pass });
    
    if(res.success) {
        alert("Account created! Please log in.");
        location.reload();
    } else {
        alert("Error: " + res.message);
        btn.innerText = "Create Account";
    }
}

/* --- FORM TEMPLATES TAB LOGIC --- */

async function loadFormBuilderList() {
    const container = document.getElementById('panel-forms');
    container.innerHTML = "<div style='text-align:center; padding:40px;'>Loading templates...</div>";
    
    // Reuse adminData to get forms, or call specific
    const data = await apiCall('adminData');
    const forms = data.forms || [];
    
    container.innerHTML = "";
    
    // Add "New Template" Card
    const newCard = document.createElement('div');
    newCard.className = "form-card";
    newCard.style.borderStyle = "dashed";
    newCard.style.textAlign = "center";
    newCard.innerHTML = "<h3 style='color:var(--rw-red);'>+ New Template</h3>";
    newCard.onclick = () => alert("Builder coming in next update!");
    container.appendChild(newCard);
    
    // List Existing Templates
    forms.forEach(f => {
        const card = document.createElement('div');
        card.className = "form-card";
        card.innerHTML = `
            <h3>${f}</h3>
            <p style="font-size:12px; opacity:0.6;">Active Questionnaire</p>
            <div style="margin-top:15px;">
                <button class="btn-small" onclick="loadFormBuilder('${f}')">Edit Questions</button>
            </div>
        `;
        // We reuse the existing loadForm function, but we might need to tweak it 
        // to know we are in "Admin Edit Mode" vs "Client Entry Mode".
        // For now, this lets you SEE the questions.
        container.appendChild(card);
    });
    
    // Apply Grid Styling
    container.className = "card-grid";
}

/* --- ROSEWOOD STUDIO LOGIC --- */

let CURRENT_STUDIO_FORM = "";

async function loadFormBuilder(formName) {
    // 1. Switch to Studio View
    document.getElementById('view-admin').classList.add('hidden');
    document.getElementById('view-studio').classList.remove('hidden');
    document.getElementById('studio-form-title').innerText = "Editing: " + formName;
    CURRENT_STUDIO_FORM = formName;
    
    const list = document.getElementById('studio-list');
    list.innerHTML = "<div class='spinner'></div>";
    
    // 2. Fetch Schema
    const schema = await apiCall('getSchema', { formName });
    list.innerHTML = "";
    
    if(schema.length === 0) {
        list.innerHTML = "<div style='opacity:0.5; margin-top:50px;'>Canvas Empty. Add a question from the toolbar.</div>";
    }

    // 3. Render with Staggered Animation
    schema.forEach((field, index) => {
        setTimeout(() => {
            renderStudioCard(field);
        }, index * 100); // 100ms delay per card for "Cascade" effect
    });
}

function renderStudioCard(field) {
    const list = document.getElementById('studio-list');
    const card = document.createElement('div');
    card.className = "studio-card";
    
    // Modern Layout
    card.innerHTML = `
        <div class="studio-card-meta">
            <span>${field.section}</span>
            <span class="type-badge ${field.type}">${field.type}</span>
        </div>
        <div style="font-family:'Libre Baskerville'; font-size:16px; margin-bottom:5px;">${field.label}</div>
        <div style="font-size:11px; opacity:0.5; font-family:monospace;">ID: ${field.key}</div>
    `;
    
    // Click to Edit (Placeholder for now)
    card.onclick = () => {
        // Highlighting logic could go here
        alert("Edit properties for: " + field.label);
    };
    
    list.appendChild(card);
}

function closeStudio() {
    document.getElementById('view-studio').classList.add('hidden');
    document.getElementById('view-admin').classList.remove('hidden');
}

function addStudioQuestion() {
    // For now, visual only
    renderStudioCard({
        section: "New Section",
        label: "New Question (Click to Edit)",
        type: "text",
        key: "new_question"
    });
    // Scroll to bottom
    window.scrollTo(0, document.body.scrollHeight);
}

function saveStudioChanges() {
    alert("Layout saved to cloud! (Simulation)");
}

/* --- QUALITY OF LIFE --- */

// Trigger Login on Enter Key
document.getElementById('login-pass').addEventListener("keypress", function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    handleLogin();
  }
});

document.getElementById('login-user').addEventListener("keypress", function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    document.getElementById('login-pass').focus(); // Move to password field
  }
});
