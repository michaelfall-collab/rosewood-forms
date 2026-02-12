// --- CONFIGURATION ---
const API_URL = "https://script.google.com/macros/s/AKfycbx551oCMIdzsB1CcmDSCwrSxQ0kgavsOQFJcnkm3LF7Sq3mqaOunwDEPhg7xPC_LKZuig/exec"; 

// --- STATE ---
let USER_DATA = null;
let CURRENT_ADMIN_CLIENT = null;
let ALL_FORMS = [];
let STUDIO_SCHEMA = [];
let CURRENT_STUDIO_FORM = null;

// --- ROSEWOOD UI SYSTEM (Custom Alerts) ---
const RosewoodUI = {
    modal: () => document.getElementById('rw-modal'),
    title: () => document.getElementById('rw-modal-title'),
    msg: () => document.getElementById('rw-modal-msg'),
    actions: () => document.getElementById('rw-modal-actions'),
    
    close: function() {
        this.modal().classList.remove('active');
    },
    
    show: function(title, text, buttons) {
        return new Promise((resolve) => {
            this.title().innerText = title;
            this.msg().innerHTML = text; // allow bolding
            this.actions().innerHTML = "";
            
            buttons.forEach(btn => {
                const b = document.createElement('button');
                b.className = btn.class || "btn-soft";
                b.innerText = btn.text;
                b.onclick = () => {
                    this.close();
                    resolve(btn.value);
                };
                this.actions().appendChild(b);
            });
            
            this.modal().classList.add('active');
        });
    }
};

// Global Helpers to replace native calls
async function rwAlert(text, title="System Notice") {
    await RosewoodUI.show(title, text, [{ text: "Okay", value: true, class: "btn-main" }]);
}

async function rwConfirm(text, title="Confirmation Required") {
    return await RosewoodUI.show(title, text, [
        { text: "Cancel", value: false, class: "btn-soft" },
        { text: "Confirm", value: true, class: "btn-main" } // Rosewood Red
    ]);
}

// --- CORE API FUNCTION ---
async function apiCall(action, payload = {}) {
    payload.action = action;
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (e) {
        rwAlert("Connection Error: " + e.message);
        return { success: false, message: e.message };
    }
}

/* --- AUTH & INIT --- */
async function handleLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    const msg = document.getElementById('login-msg');
    const btn = document.querySelector('.login-card .btn-main');
    
    msg.innerText = "";
    if(!u || !p) {
        msg.innerText = "Please enter username and password.";
        shakeLogin();
        return;
    }

    const originalText = btn.innerText;
    btn.innerText = "Verifying...";
    btn.style.opacity = "0.7";
    
    const res = await apiCall('login', { u, p });
    
    if(res.success) {
        USER_DATA = res.user;
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
        msg.innerText = "Incorrect username or password.";
        btn.innerText = originalText;
        btn.style.opacity = "1";
        shakeLogin();
    }
}

function shakeLogin() {
    const card = document.querySelector('.login-card');
    card.style.animation = "shake 0.3s";
    setTimeout(() => card.style.animation = "", 300);
}

function toggleLoginPass() {
    const input = document.getElementById('login-pass');
    if (input.type === "password") input.type = "text";
    else input.type = "password";
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

function getStatusStyle(status) {
    status = (status || 'Active').trim();
    if(status === 'Active') return `background:#E8F5E9; color:#2E7D32;`;
    if(status === 'Graduated') return `background:#FFF8E1; color:#F57F17;`;
    return `background:#f5f5f5; color:#666;`; 
}

function getTierStyle(tier) {
    tier = (tier || 'Bronze').trim();
    let border = "#eee";
    let color = "#666";
    if(tier === 'Gold') { border = "#FFD700"; color = "#B8860B"; }
    if(tier === 'Silver') { border = "#C0C0C0"; color = "#757575"; }
    if(tier === 'Bronze') { border = "#CD7F32"; color = "#8D6E63"; }
    
    return `border:1px solid ${border}; color:${color}; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700; text-transform:uppercase;`;
}

function renderAdminDashboard(clients) {
    const tbody = document.getElementById('client-table-body');
    if(!tbody) return;
    tbody.innerHTML = ""; 
    
    clients.forEach(client => {
        if(client.id === "ID") return; 
        
        const tr = document.createElement('tr');
        tr.innerHTML += `<td style="font-weight:600;">${client.name}</td>`;
        tr.innerHTML += `<td><span style="font-family:monospace; background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:6px; font-size:12px;">${client.code}</span></td>`;
        tr.innerHTML += `<td><span style="${getTierStyle(client.tier)}">${client.tier}</span></td>`;
        tr.innerHTML += `<td><span style="${getStatusStyle(client.status)} padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;">${client.status || 'Active'}</span></td>`;
        
        const tdAction = document.createElement('td');
        tdAction.style.display = "flex";
        tdAction.style.gap = "8px"; 
        
        const btnProfile = document.createElement('button');
        btnProfile.className = "btn-soft";
        btnProfile.innerHTML = "Profile";
        btnProfile.onclick = () => openClientEditor(client);
        
        const btnForms = document.createElement('button');
        btnForms.className = "btn-soft";
        btnForms.innerHTML = "Forms";
        btnForms.onclick = () => openFormPicker(client); 
        
        tdAction.appendChild(btnProfile);
        tdAction.appendChild(btnForms);
        tr.appendChild(tdAction);
        
        tbody.appendChild(tr);
    });
}

/* --- EDITORS & MODALS --- */

function openClientEditor(client) {
    if(!client) {
        client = { id: "", name: "", code: "", tier: "Bronze", status: "Active" };
        document.getElementById('ce-title').innerText = "New Client";
    } else {
        document.getElementById('ce-title').innerText = "Edit Client";
    }
    
    CURRENT_ADMIN_CLIENT = client;
    const modal = document.getElementById('admin-modal');
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

async function saveClientChanges() {
    const id = document.getElementById('ce-id').value;
    const name = document.getElementById('ce-name').value;
    const code = document.getElementById('ce-code').value;
    const tier = document.getElementById('ce-tier').value;
    const status = document.getElementById('ce-status').value;

    const res = await apiCall('saveClient', { id, name, code, tier, status });
    
    if(res.success) {
        closeClientEditor();
        initAdmin(); 
    } else {
        rwAlert("Error: " + res.message);
    }
}

/* --- FORM PICKER & ZEN VIEWER --- */

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
            loadClientFormView(form); 
        };
        container.appendChild(btn);
    });
    
    modal.classList.add('active');
}

async function loadClientFormView(formName) {
    const viewer = document.getElementById('zen-viewer');
    const body = document.getElementById('zen-body');
    
    viewer.classList.add('active'); 
    document.getElementById('zen-title').innerText = formName;
    document.getElementById('zen-subtitle').innerText = "EDITING: " + CURRENT_ADMIN_CLIENT.name;
    body.innerHTML = "<div style='text-align:center; padding-top:50px; opacity:0.5;'>Fetching data...</div>";
    
    const schemaRes = await apiCall('getSchema', { formName });
    const schema = schemaRes.schema || [];
    const answers = CURRENT_ADMIN_CLIENT.answers || {};
    
    body.innerHTML = ""; 
    
    if(schema.length === 0) {
        body.innerHTML = "<p style='text-align:center; margin-top:50px;'>This form is empty.</p>";
        return;
    }

    schema.forEach(field => {
        if(field.type === 'hidden' || field.key === 'meta_description') return;

        const group = document.createElement('div');
        group.className = "notion-group"; 
        
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
        u: CURRENT_ADMIN_CLIENT.id, 
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
        rwAlert("Error: " + res.message);
        btn.innerText = originalText;
    }
}

/* --- STUDIO & TEMPLATES --- */

function switchAdminTab(tab) {
    const btnClients = document.getElementById('nav-clients');
    const btnForms = document.getElementById('nav-forms');
    const container = document.querySelector('.glass-table-container');
    
    if (tab === 'clients') {
        btnClients.style.background = "#fff"; btnClients.style.opacity = "1";
        btnForms.style.background = "transparent"; btnForms.style.opacity = "0.6";
        container.style.background = "rgba(255,255,255,0.5)";
        container.innerHTML = `<table><thead><tr><th>Client Name</th><th>Access Code</th><th>Tier</th><th>Status</th><th>Actions</th></tr></thead><tbody id="client-table-body"></tbody></table>`;
        initAdmin(); 
    } 
    else if (tab === 'forms') {
        btnForms.style.background = "#fff"; btnForms.style.opacity = "1";
        btnClients.style.background = "transparent"; btnClients.style.opacity = "0.6";
        container.style.background = "transparent"; 
        container.style.boxShadow = "none";
        container.style.border = "none";
        renderFormTemplatesGrid();
    }
}

function renderFormTemplatesGrid() {
    const container = document.querySelector('.glass-table-container');
    
    let html = `<div class="template-grid">`;
    
    html += `
        <div class="template-card new-form" onclick="openStudio('New Form')" 
             style="display:flex; flex-direction:column; justify-content:center; align-items:center;">
            <div class="plus-icon" style="font-size:32px; color:var(--accent); margin-bottom:10px;">+</div>
            <div class="card-label">Create New Form</div>
        </div>`;
    
    ALL_FORMS.forEach(form => {
        const safeName = form.replace(/'/g, "\\'");
        
        html += `
        <div class="template-card" onclick="openStudio('${safeName}')" style="display:flex; flex-direction:column; justify-content:space-between;">
            
            <div style="display:flex; justify-content:flex-end; width:100%; margin-bottom:10px;">
                <div title="Delete Form" 
                     onclick="event.stopPropagation(); deleteForm('${safeName}')"
                     style="color:#b91c1c; background:#fee2e2; width:28px; height:28px; border-radius:6px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:bold;">
                     &times;
                </div>
            </div>

            <div style="text-align:center;">
                <div class="form-icon" style="font-size:32px; margin-bottom:10px; opacity:0.8;">📄</div>
                <div class="card-label" style="font-weight:600; font-size:14px;">${form}</div>
            </div>
            
            <div style="text-align:center; font-size:10px; color:#999; margin-top:15px; border-top:1px solid rgba(0,0,0,0.05); padding-top:8px;">
                Click to Edit
            </div>
        </div>`;
    });
    
    html += `</div>`;
    container.innerHTML = html;
}

async function openStudio(formName) {
    document.getElementById('view-admin').classList.add('hidden');
    document.getElementById('view-studio').classList.remove('hidden');
    
    CURRENT_STUDIO_FORM = (formName === 'New Form') ? null : formName;
    
    const titleInput = document.getElementById('studio-form-title-display');
    const descInput = document.getElementById('studio-form-description-display');
    
    titleInput.value = (formName === 'New Form') ? "" : formName;
    if(descInput) descInput.value = ""; 
    
    titleInput.oninput = () => markUnsaved();
    if(descInput) descInput.oninput = () => markUnsaved();

    STUDIO_SCHEMA = [];

    if(formName !== 'New Form') {
        const res = await apiCall('getSchema', { formName });
        if(res.success && res.schema) {
            STUDIO_SCHEMA = res.schema;
            const meta = STUDIO_SCHEMA.find(f => f.key === 'meta_description');
            if(meta && descInput) {
                descInput.value = meta.label; 
            }
        }
    }
    renderStudioCanvas();
}

async function closeStudio() {
    // REPLACED NATIVE CONFIRM WITH ROSEWOOD UI
    if(await rwConfirm("Exit Studio? Any unsaved changes will be lost.")) {
        document.getElementById('view-studio').classList.add('hidden');
        document.getElementById('view-admin').classList.remove('hidden');
        initAdmin(); 
    }
}

function renderStudioCanvas() {
    const list = document.getElementById('studio-questions-list');
    if(!list) return;
    list.innerHTML = "";
    
    STUDIO_SCHEMA.forEach((field, index) => {
        if (field.key === 'init_marker' || field.key === 'meta_description') return;

        const block = document.createElement('div');
        block.className = "studio-question-block";
        
        let inputHtml = "";

        if (field.type === 'select') {
            const options = field.options || [];
            inputHtml = `
                <div class="choice-pill-container">
                    ${options.map((opt, i) => `
                        <div class="choice-pill">
                            ${opt} <button onclick="removeOption(${index}, ${i})">&times;</button>
                        </div>
                    `).join('')}
                    <div style="display:flex; gap:10px; margin-top:10px;">
                        <input type="text" id="opt-input-${index}" class="studio-option-input" placeholder="+ New Option">
                        <button class="btn-main small" onclick="addOptionManual(${index})">Add</button>
                    </div>
                </div>`;
        } else {
            inputHtml = `<div style="height:30px; border-bottom:1px dashed #eee; width:60%; opacity:0.3; margin-top:10px;"></div>`;
        }

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

function addStudioQuestion() {
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
    window.scrollTo(0, document.body.scrollHeight);
}

async function deleteStudioField(index) {
    markUnsaved();
    // REPLACED NATIVE CONFIRM WITH ROSEWOOD UI
    if(await rwConfirm("Delete this question?")) {
        STUDIO_SCHEMA.splice(index, 1);
        renderStudioCanvas();
    }
}

function updateStudioField(index, prop, val) {
    STUDIO_SCHEMA[index][prop] = val;
    markUnsaved();
    if(prop === 'type') renderStudioCanvas();
}

function addOptionManual(index) {
    markUnsaved();
    const input = document.getElementById(`opt-input-${index}`);
    if(!input) return;
    const val = input.value.trim();
    if(val) {
        if(!STUDIO_SCHEMA[index].options) STUDIO_SCHEMA[index].options = [];
        STUDIO_SCHEMA[index].options.push(val);
        renderStudioCanvas(); 
    }
}

function removeOption(fieldIndex, optIndex) {
    markUnsaved();
    STUDIO_SCHEMA[fieldIndex].options.splice(optIndex, 1);
    renderStudioCanvas();
}

function markUnsaved() {
    const btn = document.getElementById('btn-save-studio');
    if(btn && (btn.innerText === "Saved!" || btn.innerText === "Syncing...")) {
        btn.innerText = "Save Cloud Template";
        btn.style.background = "var(--rw-red)";
    }
}

async function deleteForm(formName) {
    // REPLACED NATIVE CONFIRM WITH ROSEWOOD UI
    if(!await rwConfirm(`Are you sure you want to PERMANENTLY delete "${formName}"?`, "Critical Action")) return;
    
    ALL_FORMS = ALL_FORMS.filter(f => f !== formName);
    renderFormTemplatesGrid();
    
    const res = await apiCall('deleteForm', { formName });
    if(!res.success) {
        rwAlert("Server Error: " + res.message);
        initAdmin(); 
    }
}

async function saveStudioChanges() {
    if (document.activeElement) { document.activeElement.blur(); }

    const titleEl = document.getElementById('studio-form-title-display');
    const descEl = document.getElementById('studio-form-description-display');
    const newName = titleEl ? titleEl.value.trim() : "";
    const description = descEl ? descEl.value.trim() : "";
    const btn = document.getElementById('btn-save-studio');

    if(!newName) {
        rwAlert("Please enter a Template Name.");
        if(titleEl) titleEl.focus();
        return;
    }

    const originalText = btn.innerText;
    btn.innerText = "Syncing...";
    
    STUDIO_SCHEMA = STUDIO_SCHEMA.filter(f => f.key !== 'meta_description');
    
    if(description) {
        STUDIO_SCHEMA.unshift({
            key: 'meta_description',
            type: 'hidden',
            label: description 
        });
    }
    
    const isRenaming = (CURRENT_STUDIO_FORM && CURRENT_STUDIO_FORM !== newName);

    try {
        const res = await apiCall('saveFormSchema', { 
            formName: newName, 
            schema: STUDIO_SCHEMA 
        });

        if(res.success) {
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
            rwAlert("Server Error: " + res.message);
            btn.innerText = "Retry";
        }
    } catch(e) {
        rwAlert("Error: " + e.message);
        btn.innerText = originalText;
    }
}

// LISTENERS
window.addEventListener('DOMContentLoaded', () => {
    const passInput = document.getElementById('login-pass');
    if(passInput) {
        passInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") { e.preventDefault(); handleLogin(); }
        });
    }
});

function openSignUpModal() {
    rwAlert("Rosewood Forms is currently Invite Only.<br><br>Please contact your administrator to receive your access code.", "Private Access");
}
