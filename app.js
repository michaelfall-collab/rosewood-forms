// --- CONFIGURATION ---
// UPDATED URL (The one you confirmed works)
const API_URL = "https://script.google.com/macros/s/AKfycbx551oCMIdzsB1CcmDSCwrSxQ0kgavsOQFJcnkm3LF7Sq3mqaOunwDEPhg7xPC_LKZuig/exec"; 

// --- STATE ---
let USER_DATA = null;
let CURRENT_ADMIN_CLIENT = null;
let ALL_FORMS = [];

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
    const tableBody = document.getElementById('client-table-body');
    
    if (tab === 'clients') {
        // STYLE: Highlight Clients
        btnClients.style.background = "#fff";
        btnClients.style.boxShadow = "0 2px 5px rgba(0,0,0,0.05)";
        btnClients.style.opacity = "1";
        
        btnForms.style.background = "transparent";
        btnForms.style.boxShadow = "none";
        btnForms.style.opacity = "0.6";
        
        // ACTION: Reload Client Table
        initAdmin(); 
    } 
    else if (tab === 'forms') {
        // STYLE: Highlight Forms
        btnForms.style.background = "#fff";
        btnForms.style.boxShadow = "0 2px 5px rgba(0,0,0,0.05)";
        btnForms.style.opacity = "1";
        
        btnClients.style.background = "transparent";
        btnClients.style.boxShadow = "none";
        btnClients.style.opacity = "0.6";
        
        // ACTION: Show Forms List (Simple view for now)
        tableBody.innerHTML = "";
        if(ALL_FORMS.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; opacity:0.5;">No forms found.</td></tr>`;
        } else {
            ALL_FORMS.forEach(f => {
                tableBody.innerHTML += `
                <tr>
                    <td colspan="4" style="font-weight:600;">${f}</td>
                    <td style="text-align:right;">
                        <button class="btn-soft" onclick="openFormPicker({name:'Template Viewer', answers:{}}, '${f}')">Edit Template</button>
                    </td>
                </tr>`;
            });
        }
    }
}
