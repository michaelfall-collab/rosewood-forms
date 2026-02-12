// --- CONFIGURATION ---
// UPDATED URL (The one you confirmed works)
const API_URL = "https://script.google.com/macros/s/AKfycbx551oCMIdzsB1CcmDSCwrSxQ0kgavsOQFJcnkm3LF7Sq3mqaOunwDEPhg7xPC_LKZuig/exec"; 

// --- STATE ---
let USER_DATA = null;
let CURRENT_ADMIN_CLIENT = null;
let ALL_FORMS = [];
let STUDIO_SCHEMA = [];
let CURRENT_STUDIO_FORM = null;

// --- CORE API FUNCTION ---
async function apiCall(action, payload = {}) {
    const loader = document.getElementById('loader'); // Ensure you have this div or remove this line
    
    payload.action = action;
    
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        return data;
    } catch (e) {
        alert("Connection Error: " + e.message);
        return { success: false, message: e.message };
    }
}

async function handleLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    const msg = document.getElementById('login-msg'); // The new text area
    const btn = document.querySelector('.login-card .btn-main');
    
    // Clear previous errors
    msg.innerText = "";
    
    if(!u || !p) {
        msg.innerText = "Please enter username and password.";
        // Shake animation effect (optional but nice)
        document.querySelector('.login-card').style.animation = "shake 0.3s";
        setTimeout(() => document.querySelector('.login-card').style.animation = "", 300);
        return;
    }

    // UI Feedback
    const originalText = btn.innerText;
    btn.innerText = "Verifying...";
    btn.style.opacity = "0.7";
    
    const res = await apiCall('login', { u, p });
    
    if(res.success) {
        USER_DATA = res.user;
        
        // Success! Fade out login, fade in admin
        document.getElementById('view-login').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('view-login').classList.add('hidden');
            
            if(USER_DATA.role === 'admin') {
                initAdmin();
            } else {
                msg.innerText = "Client view under construction.";
                document.getElementById('view-login').style.opacity = '1';
                document.getElementById('view-login').classList.remove('hidden');
            }
        }, 500);

    } else {
        // Failure
        msg.innerText = "Incorrect username or password.";
        btn.innerText = originalText;
        btn.style.opacity = "1";
        
        // Shake animation
        document.querySelector('.login-card').style.animation = "shake 0.3s";
        setTimeout(() => document.querySelector('.login-card').style.animation = "", 300);
    }
}
function toggleLoginPass() {
    const input = document.getElementById('login-pass');
    const icon = document.querySelector('#view-login svg'); // Selects the eye icon
    
    if (input.type === "password") {
        input.type = "text";
        icon.style.opacity = "1"; // Highlight eye when visible
    } else {
        input.type = "password";
        icon.style.opacity = "0.4";
    }
}

/* --- ADMIN DASHBOARD --- */
async function initAdmin() {
    document.getElementById('view-admin').classList.remove('hidden');
    const tbody = document.getElementById('client-table-body');
    
    if(tbody) tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; opacity:0.5; padding:20px;'>Loading Rosewood Database...</td></tr>";

    const data = await apiCall('adminData');
    
    if(!data || !data.clients) {
        if(tbody) tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:red;'>Error loading data.</td></tr>";
        return;
    }
    
    ALL_FORMS = data.forms || [];
    renderAdminDashboard(data.clients);
}

function renderAdminDashboard(clients) {
    const tbody = document.getElementById('client-table-body');
    if(!tbody) return;
    tbody.innerHTML = ""; 
    
    clients.forEach(client => {
        if(client.id === "ID") return; // Skip header
        
        const tr = document.createElement('tr');
        
        // 1. Name
        const tdName = document.createElement('td');
        tdName.style.fontWeight = "600";
        tdName.innerText = client.name;
        tr.appendChild(tdName);
        
        // 2. Code
        const tdCode = document.createElement('td');
        tdCode.innerHTML = `<span style="font-family:monospace; background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:6px; font-size:12px;">${client.code}</span>`;
        tr.appendChild(tdCode);
        
        // 3. Tier
        const tdTier = document.createElement('td');
        tdTier.innerText = client.tier;
        tr.appendChild(tdTier);
        
        // 4. Status
        const tdStatus = document.createElement('td');
        const isLive = (client.status === "Active");
        tdStatus.innerHTML = `<span style="
            background: ${isLive ? '#E8F5E9' : '#FFEBEE'}; 
            color: ${isLive ? '#2E7D32' : '#C62828'};
            padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;">
            ${client.status || 'Active'}
        </span>`;
        tr.appendChild(tdStatus);
        
        // 5. Actions
        const tdAction = document.createElement('td');
        tdAction.style.display = "flex";
        tdAction.style.gap = "8px"; 
        
        // Profile Btn
        const btnProfile = document.createElement('button');
        btnProfile.className = "btn-soft";
        btnProfile.innerHTML = "Profile";
        btnProfile.onclick = () => openClientEditor(client);
        tdAction.appendChild(btnProfile);
        
        // Forms Btn
        const btnForms = document.createElement('button');
        btnForms.className = "btn-soft";
        btnForms.innerHTML = "Forms";
        btnForms.onclick = () => openFormPicker(client); 
        tdAction.appendChild(btnForms);

        tr.appendChild(tdAction);
        tbody.appendChild(tr);
    });
}

/* --- EDITORS & MODALS --- */

function openClientEditor(client) {
    CURRENT_ADMIN_CLIENT = client;
    const modal = document.getElementById('admin-modal');
    
    // Populate Fields
    document.getElementById('ce-title').innerText = "Edit Client";
    document.getElementById('ce-id').value = client.id;
    document.getElementById('ce-name').value = client.name;
    document.getElementById('ce-code').value = client.code;
    document.getElementById('ce-tier').value = client.tier;
    document.getElementById('ce-status').value = client.status || "Active";
    
    modal.classList.add('active');
}

function closeClientEditor() {
    document.getElementById('admin-modal').classList.remove('active');
}

function openFormPicker(client) {
    CURRENT_ADMIN_CLIENT = client;
    const modal = document.getElementById('form-picker-modal');
    const container = document.getElementById('form-list-container');
    
    container.innerHTML = ""; 
    
    if(ALL_FORMS.length === 0) {
        container.innerHTML = "<p style='text-align:center; opacity:0.5;'>No forms found.</p>";
    }

    ALL_FORMS.forEach(form => {
        const btn = document.createElement('button');
        btn.className = "btn-soft"; 
        btn.style.width = "100%";
        btn.style.marginBottom = "10px";
        btn.style.justifyContent = "space-between";
        btn.innerHTML = `<span>${form}</span> <span style="opacity:0.3;">→</span>`;
        
        btn.onclick = () => {
            modal.classList.remove('active');
            
            // Hack to store form name for the viewer
            const fakeSelect = document.createElement('input');
            fakeSelect.id = 'modal-form-select';
            fakeSelect.value = form;
            document.body.appendChild(fakeSelect);
            
            loadClientFormView(); 
            
            setTimeout(() => fakeSelect.remove(), 500);
        };
        container.appendChild(btn);
    });
    
    modal.classList.add('active');
}

async function loadClientFormView() {
    const el = document.getElementById('modal-form-select');
    if(!el) return;
    const formName = el.value;

    const viewer = document.getElementById('zen-viewer');
    const body = document.getElementById('zen-body');
    const title = document.getElementById('zen-title');
    const subtitle = document.getElementById('zen-subtitle');
    
    viewer.classList.add('active'); 
    
    const displayName = formName.toLowerCase().includes('form') ? formName : formName + " Form";
    
    title.innerText = displayName;
    subtitle.innerText = "EDITING: " + CURRENT_ADMIN_CLIENT.name;
    body.innerHTML = "<div style='text-align:center; padding-top:50px; opacity:0.5;'>Fetching data...</div>";
    
    const schema = await apiCall('getSchema', { formName });
    const answers = CURRENT_ADMIN_CLIENT.answers || {};
    
    body.innerHTML = ""; 
    
    if(!schema || schema.length === 0) {
        body.innerHTML = "<p style='text-align:center; margin-top:50px;'>This form is empty.</p>";
        return;
    }

    schema.forEach(field => {
        const group = document.createElement('div');
        group.className = "notion-group"; // Use the Glass UI class
        
        const label = document.createElement('label');
        label.className = "notion-label";
        label.innerText = field.label; 
        group.appendChild(label);
        
        let input;
        
        if (field.type === 'textarea') {
            input = document.createElement('textarea');
            input.rows = 4;
            input.className = "notion-input zen-field"; 
            input.style.border = "1px solid #eee";
            input.style.borderRadius = "8px";
            input.style.padding = "10px";
        } else if (field.type === 'select') {
            input = document.createElement('select');
            input.className = "notion-select zen-field";
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
            input.className = "notion-input zen-field";
        }

        input.value = answers[field.key] || "";
        input.setAttribute('data-key', field.key); 
        
        group.appendChild(input);
        body.appendChild(group);
    });
}

function closeZenViewer() {
    document.getElementById('zen-viewer').classList.remove('active');
}

async function saveZenForm() {
    const inputs = document.querySelectorAll('.zen-field');
    const payload = {};
    
    inputs.forEach(input => {
        const key = input.getAttribute('data-key');
        if(key) payload[key] = input.value;
    });
    
    const btn = document.querySelector('#zen-viewer .btn-main');
    const originalText = btn.innerText;
    btn.innerText = "Saving...";

    const res = await apiCall('saveData', { 
        u: CURRENT_ADMIN_CLIENT.name, 
        data: payload 
    });

    if(res.success) {
        if(!CURRENT_ADMIN_CLIENT.answers) CURRENT_ADMIN_CLIENT.answers = {};
        Object.assign(CURRENT_ADMIN_CLIENT.answers, payload);
        
        btn.innerText = "Saved";
        setTimeout(() => { 
            btn.innerText = originalText;
            closeZenViewer(); 
        }, 1000);
    } else {
        alert("Error: " + res.message);
        btn.innerText = originalText;
    }
}

async function saveClientChanges() {
    const id = document.getElementById('ce-id').value;
    const name = document.getElementById('ce-name').value;
    const code = document.getElementById('ce-code').value;
    const tier = document.getElementById('ce-tier').value;
    const status = document.getElementById('ce-status').value;

    const res = await apiCall('saveClient', { id, name, code, tier, status });
    
    if(res.success) {
        alert("Saved!");
        closeClientEditor();
        initAdmin(); // Refresh table
    } else {
        alert("Error: " + res.message);
    }
}

// --- GLOBAL LISTENERS (Run on Load) ---
window.addEventListener('DOMContentLoaded', () => {
    
    // ENTER KEY FOR PASSWORD
    const passInput = document.getElementById('login-pass');
    if(passInput) {
        passInput.addEventListener("keypress", function(event) {
            if (event.key === "Enter") {
                event.preventDefault();
                handleLogin();
            }
        });
    }

    // ENTER KEY FOR USERNAME (Optional but nice)
    const userInput = document.getElementById('login-user');
    if(userInput) {
        userInput.addEventListener("keypress", function(event) {
            if (event.key === "Enter") {
                event.preventDefault();
                document.getElementById('login-pass').focus(); // Move to password
            }
        });
    }
});
/* --- ADMIN NAVIGATION --- */

function switchAdminTab(tab) {
    const btnClients = document.getElementById('nav-clients');
    const btnForms = document.getElementById('nav-forms');
    // We reuse the 'glass-table-container' div but clear it for Grid Mode
    const container = document.querySelector('.glass-table-container');
    
    if (tab === 'clients') {
        // ... (Styling logic remains the same) ...
        btnClients.style.background = "#fff"; btnClients.style.opacity = "1";
        btnForms.style.background = "transparent"; btnForms.style.opacity = "0.6";
        
        // Restore Table Layout
        container.style.background = "rgba(255,255,255,0.5)";
        container.innerHTML = `<table><thead><tr><th>Client Name</th><th>Access Code</th><th>Tier</th><th>Status</th><th>Actions</th></tr></thead><tbody id="client-table-body"></tbody></table>`;
        initAdmin(); 
    } 
    else if (tab === 'forms') {
        // ... (Styling logic) ...
        btnForms.style.background = "#fff"; btnForms.style.opacity = "1";
        btnClients.style.background = "transparent"; btnClients.style.opacity = "0.6";
        
        // RENDER CARD GRID
        container.style.background = "transparent"; // Remove glass bg for grid
        container.style.boxShadow = "none";
        container.style.border = "none";
        
        let html = `<div class="template-grid">`;
        
        // Add "New Form" Card
        html += `
            <div class="template-card" onclick="openStudio('New Form')">
                <div class="template-icon" style="color:var(--accent);">+</div>
                <div class="template-title">Create New Form</div>
            </div>`;
        
        // Add Existing Forms
        ALL_FORMS.forEach(f => {
            html += `
            <div class="template-card" onclick="openStudio('${f}')">
                <div class="template-icon">📄</div>
                <div class="template-title">${f}</div>
                <div style="font-size:10px; color:#999; margin-top:5px;">Click to Edit</div>
            </div>`;
        });
        
        html += `</div>`;
        container.innerHTML = html;
    }
}

/* --- ROSEWOOD STUDIO LOGIC --- */

async function openStudio(formName) {
    // 1. Switch View
    document.getElementById('view-admin').classList.add('hidden');
    document.getElementById('view-studio').classList.remove('hidden');
    
    // 2. Track Original Name
    CURRENT_STUDIO_FORM = (formName === 'New Form') ? null : formName;
    
    // 3. Setup Title & Description
    const titleInput = document.getElementById('studio-form-title-display');
    const descInput = document.getElementById('studio-form-description-display');
    
    titleInput.value = (formName === 'New Form') ? "" : formName;
    if(descInput) descInput.value = ""; // Reset description
    
    // Add "Dirty State" listeners
    titleInput.oninput = () => markUnsaved();
    if(descInput) descInput.oninput = () => markUnsaved();

    // 4. Reset & Load
    STUDIO_SCHEMA = [];
    const list = document.getElementById('studio-questions-list');
    list.innerHTML = "<div style='text-align:center; padding:50px; opacity:0.3;'>Accessing Rosewood Cloud...</div>";
    
    if(formName !== 'New Form') {
        const res = await apiCall('getSchema', { formName });
        if(res.success && res.schema) {
            STUDIO_SCHEMA = res.schema;
            // Load description if the server sends it back
            if(res.description && descInput) descInput.value = res.description;
        }
    }
    
    renderStudioCanvas();
}
    
function closeStudio() {
    if(confirm("Exit Studio? Any unsaved changes will be lost.")) {
        document.getElementById('view-studio').classList.add('hidden');
        document.getElementById('view-admin').classList.remove('hidden');
        initAdmin(); 
    }
}
function renderStudioCanvas() {
    const list = document.getElementById('studio-questions-list');
    if(!list) return;
    list.innerHTML = "";
    
    // FIX: Loop through REAL SCHEMA (skipping marker)
    STUDIO_SCHEMA.forEach((field, index) => {
        if (field.key === 'init_marker') return;

        const block = document.createElement('div');
        block.className = "studio-question-block";
        
        let inputHtml = "";

        if (field.type === 'select') {
            const options = field.options || [];
            inputHtml = `
                <div class="choice-pill-container">
                    ${options.map((opt, i) => `
                        <div class="choice-pill">
                            ${opt}
                            <button onclick="removeOption(${index}, ${i})">&times;</button>
                        </div>
                    `).join('')}
                    <div style="display:flex; gap:10px; margin-top:10px;">
                        <input type="text" id="opt-input-${index}" class="studio-option-input" 
                            placeholder="+ New Option">
                        <button class="btn-main small" onclick="addOptionManual(${index})">Add</button>
                    </div>
                </div>
            `;
        } else {
            inputHtml = `<div style="height: 30px; border-bottom: 1px dashed #eee; width: 60%; opacity: 0.3; margin-top:10px;"></div>`;
        }

        // ADDED: Delete Button (&times;) next to the dropdown
        block.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <input class="studio-pdf-label" value="${field.label}" 
                    onchange="updateStudioField(${index}, 'label', this.value)" 
                    placeholder="Enter your question here...">
                
                <div style="display:flex; align-items:center; gap: 10px;">
                    <select class="studio-type-selector" onchange="updateStudioField(${index}, 'type', this.value)">
                        <option value="text" ${field.type==='text'?'selected':''}>Short Answer</option>
                        <option value="textarea" ${field.type==='textarea'?'selected':''}>Long Answer</option>
                        <option value="select" ${field.type==='select'?'selected':''}>Multiple Choice</option>
                    </select>
                    <button class="btn-delete-q" onclick="deleteStudioField(${index})" title="Delete Question">&times;</button>
                </div>
            </div>
            ${inputHtml}
        `;
        list.appendChild(block);
    });
}
// Logic to add options without needing "Enter"
function addOptionManual(index) {
    markUnsaved();
    const input = document.getElementById(`opt-input-${index}`);
    if(!input) return;
    
    const val = input.value.trim();
    if(val) {
        // Ensure the options array exists
        if(!STUDIO_SCHEMA[index].options) STUDIO_SCHEMA[index].options = [];
        
        STUDIO_SCHEMA[index].options.push(val);
        input.value = "";
        
        // RE-RENDER immediately so the new pill appears
        renderStudioCanvas(); 
        
        // Refocus the input for rapid entry
        const newInput = document.getElementById(`opt-input-${index}`);
        if(newInput) newInput.focus();
    }
}

function removeOption(fieldIndex, optIndex) {
    markUnsaved();
    STUDIO_SCHEMA[fieldIndex].options.splice(optIndex, 1);
    renderStudioCanvas();
}

function addStudioQuestion() {
    // Add default text field
    markUnsaved();
    STUDIO_SCHEMA.push({
        section: "General",
        label: "New Question",
        key: "question_" + Date.now(),
        type: "text",
        options: [],
        visibility: "Public"
    });
    renderStudioCanvas();
    // Scroll to bottom
    window.scrollTo(0, document.body.scrollHeight);
}

function deleteStudioField(index) {
    markUnsaved();
    if(confirm("Delete this question?")) {
        STUDIO_SCHEMA.splice(index, 1);
        renderStudioCanvas();
    }
}

function updateStudioField(index, prop, val) {
    STUDIO_SCHEMA[index][prop] = val;
    markUnsaved(); // Reset "Saved" button
    
    // ONLY re-render if we changed the TYPE (to show/hide options)
    // If we changed the label, do NOT re-render (or we lose focus/cursor position)
    if(prop === 'type') {
        renderStudioCanvas();
    }
}

function cycleType(index) {
    const types = ['text', 'textarea', 'select', 'header'];
    const current = STUDIO_SCHEMA[index].type;
    let next = types[(types.indexOf(current) + 1) % types.length];
    
    STUDIO_SCHEMA[index].type = next;
    
    // If select, ask for options (Simple prompt for now)
    if(next === 'select') {
        const opts = prompt("Enter options separated by comma:", "Yes,No,Maybe");
        if(opts) STUDIO_SCHEMA[index].options = opts.split(',');
    }
    
    renderStudioCanvas();
}

function renderFormTemplatesGrid() {
    const container = document.querySelector('.glass-table-container');
    container.innerHTML = `
        <div style="padding: 20px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px;">
            <div class="template-card new-form" onclick="openStudio('New Form')">
                <div class="plus-icon" style="font-size:32px; color:var(--accent); margin-bottom:10px;">+</div>
                <div class="card-label">Create New Form</div>
            </div>
            ${ALL_FORMS.map(form => `
                <div class="template-card" onclick="openStudio('${form.replace(/'/g, "\\'")}')">
                    <div class="btn-delete-card" 
                         title="Delete Form"
                         data-name="${form}" 
                         onclick="deleteForm(this.getAttribute('data-name'), event)">
                         &times;
                    </div>
                    
                    <div class="form-icon" style="font-size:32px; margin-bottom:15px; opacity:0.8;">📄</div>
                    <div class="card-label" style="font-weight:600; font-size:14px;">${form}</div>
                    <div style="font-size:10px; color:#999; margin-top:5px;">Click to Edit</div>
                </div>
            `).join('')}
        </div>
    `;
}
function markUnsaved() {
    const btn = document.getElementById('btn-save-studio');
    // Only reset if it currently says "Saved!" or "Syncing..."
    if(btn && (btn.innerText === "Saved!" || btn.innerText === "Syncing...")) {
        btn.innerText = "Save Cloud Template";
        btn.style.background = "var(--rw-red)";
        btn.style.opacity = "1";
    }
}
async function saveStudioChanges() {
    // 1. Force blur to capture last keystroke
    if (document.activeElement) { document.activeElement.blur(); }

    const titleEl = document.getElementById('studio-form-title-display');
    const descEl = document.getElementById('studio-form-description-display');
    
    const newName = titleEl ? titleEl.value.trim() : "";
    const description = descEl ? descEl.value.trim() : ""; // Capture description
    const btn = document.getElementById('btn-save-studio');

    if(!newName) {
        alert("Please enter a Template Name.");
        if(titleEl) titleEl.focus();
        return;
    }

    const originalText = btn.innerText;
    btn.innerText = "Syncing...";
    
    // 2. CHECK FOR RENAME
    const isRenaming = (CURRENT_STUDIO_FORM && CURRENT_STUDIO_FORM !== newName);

    try {
        // Save NEW file (Send description in payload)
        const res = await apiCall('saveFormSchema', { 
            formName: newName, 
            description: description, 
            schema: STUDIO_SCHEMA 
        });

        if(res.success) {
            // Rename Logic
            if(isRenaming) {
                await apiCall('deleteForm', { formName: CURRENT_STUDIO_FORM });
                ALL_FORMS = ALL_FORMS.filter(f => f !== CURRENT_STUDIO_FORM);
            }
            
            CURRENT_STUDIO_FORM = newName;
            if(!ALL_FORMS.includes(newName)) ALL_FORMS.push(newName);
            
            btn.innerText = "Saved!";
            btn.style.background = "#2E7D32"; 
            
            setTimeout(() => {
                btn.innerText = "Save Cloud Template";
                btn.style.background = "var(--rw-red)";
            }, 2000);
        } else {
            alert("Server Error: " + res.message);
            btn.innerText = "Retry";
        }
    } catch(e) {
        alert("Error: " + e.message);
        btn.innerText = originalText;
    }
}

async function deleteForm(formName, event) {
    if(event) event.stopPropagation(); // Stop the card from opening
    
    if(!confirm(`Are you sure you want to PERMANENTLY delete "${formName}"?`)) return;
    
    // Optimistic UI Update (Remove immediately)
    ALL_FORMS = ALL_FORMS.filter(f => f !== formName);
    renderFormTemplatesGrid();
    
    const res = await apiCall('deleteForm', { formName });
    
    if(!res.success) {
        alert("Could not delete from server: " + res.message);
        initAdmin(); // Re-fetch truth
    }
}

async function saveStudioChanges() {
    // 1. Force blur to capture last keystroke
    if (document.activeElement) { document.activeElement.blur(); }

    const titleEl = document.getElementById('studio-form-title-display');
    const newName = titleEl ? titleEl.value.trim() : "";
    const btn = document.getElementById('btn-save-studio');

    if(!newName) {
        alert("Please enter a Template Name.");
        if(titleEl) titleEl.focus();
        return;
    }

    const originalText = btn.innerText;
    btn.innerText = "Syncing...";
    
    // 2. CHECK FOR RENAME (The Overwrite Logic)
    // If we have an original name, and it's different from the new name, we must delete the old one.
    const isRenaming = (CURRENT_STUDIO_FORM && CURRENT_STUDIO_FORM !== newName);

    try {
        // Save the NEW file first
        const res = await apiCall('saveFormSchema', { 
            formName: newName, 
            schema: STUDIO_SCHEMA 
        });

        if(res.success) {
            // If renaming, delete the old file
            if(isRenaming) {
                console.log(`Renaming: Deleting old form "${CURRENT_STUDIO_FORM}"`);
                await apiCall('deleteForm', { formName: CURRENT_STUDIO_FORM });
                
                // Update local list: Remove old, add new
                ALL_FORMS = ALL_FORMS.filter(f => f !== CURRENT_STUDIO_FORM);
            }
            
            // Update Current Tracking
            CURRENT_STUDIO_FORM = newName;

            if(!ALL_FORMS.includes(newName)) ALL_FORMS.push(newName);
            
            btn.innerText = "Saved!";
            btn.style.background = "#2E7D32"; 
            
            setTimeout(() => {
                btn.innerText = "Save Cloud Template";
                btn.style.background = "var(--rw-red)";
            }, 2000);
        } else {
            alert("Server Error: " + res.message);
            btn.innerText = "Retry";
        }
    } catch(e) {
        alert("Error: " + e.message);
        btn.innerText = originalText;
    }
}

function openSignUpModal() {
    alert("Rosewood Forms is currently Invite Only.\n\nPlease contact your administrator to receive your access code.");
}
