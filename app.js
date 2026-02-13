/* --- ROSEWOOD APP.JS (v5.0 - POLISHED) --- */

// --- CONFIGURATION ---
const API_URL = "https://script.google.com/macros/s/AKfycbx551oCMIdzsB1CcmDSCwrSxQ0kgavsOQFJcnkm3LF7Sq3mqaOunwDEPhg7xPC_LKZuig/exec"; 

// --- STATE ---
let USER_DATA = null;
let ALL_FORMS = [];
let STUDIO_SCHEMA = [];
let CURRENT_ADMIN_CLIENT = null;
let CURRENT_FLAGSHIP_SCHEMA = [];

// --- ROSEWOOD UI ---
const RosewoodUI = {
    modal: () => document.getElementById('rw-modal'),
    title: () => document.getElementById('rw-modal-title'),
    msg: () => document.getElementById('rw-modal-msg'),
    actions: () => document.getElementById('rw-modal-actions'),
    backdrop: () => document.getElementById('rw-modal-backdrop'),
    
    close: function() { 
        this.backdrop().classList.remove('active'); 
    },
    
    show: function(title, text, buttons) {
        return new Promise((resolve) => {
            this.title().innerText = title;
            this.msg().innerHTML = text;
            this.actions().innerHTML = "";
            buttons.forEach(btn => {
                const b = document.createElement('button');
                b.className = btn.class || "btn-soft";
                b.innerText = btn.text;
                b.onclick = () => { this.close(); resolve(btn.value); };
                this.actions().appendChild(b);
            });
            this.backdrop().classList.add('active');
        });
    },

    prompt: function(title, text, confirmKeyword) {
        return new Promise((resolve) => {
            this.title().innerText = title;
            this.msg().innerHTML = `
                ${text}
                <div style="margin-top:15px;">
                    <input type="text" id="rw-prompt-input" class="modern-input" placeholder="Type '${confirmKeyword}' to confirm" 
                    style="text-transform:uppercase; border:2px solid #d32f2f;">
                </div>
            `;
            this.actions().innerHTML = "";
            
            const btnCancel = document.createElement('button');
            btnCancel.className = "btn-soft"; btnCancel.innerText = "Cancel";
            btnCancel.onclick = () => { this.close(); resolve(false); };
            
            const btnConfirm = document.createElement('button');
            btnConfirm.className = "btn-main"; btnConfirm.innerText = "Delete Forever";
            btnConfirm.style.background = "#d32f2f"; btnConfirm.style.opacity = "0.5"; btnConfirm.disabled = true;
            btnConfirm.onclick = () => { this.close(); resolve(true); };
            
            this.actions().appendChild(btnCancel);
            this.actions().appendChild(btnConfirm);
            this.backdrop().classList.add('active');

            setTimeout(() => {
                const input = document.getElementById('rw-prompt-input');
                input.focus();
                input.addEventListener('input', (e) => {
                    if(e.target.value.toUpperCase() === confirmKeyword) {
                        btnConfirm.style.opacity = "1"; btnConfirm.disabled = false;
                    } else {
                        btnConfirm.style.opacity = "0.5"; btnConfirm.disabled = true;
                    }
                });
            }, 100);
        });
    }
};

async function rwAlert(text, title="System Notice") { await RosewoodUI.show(title, text, [{ text: "Okay", value: true, class: "btn-main" }]); }
async function rwConfirm(text, title="Confirm") { return await RosewoodUI.show(title, text, [{ text: "Cancel", value: false }, { text: "Yes", value: true, class: "btn-main" }]); }

// --- API ---
async function apiCall(action, payload = {}) {
    payload.action = action;
    try {
        const response = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
        return await response.json();
    } catch (e) {
        rwAlert("Connection Error: " + e.message); return { success: false, message: e.message };
    }
}

/* --- LOGIN & THEME --- */
async function handleLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    const btn = document.querySelector('.login-card .btn-main');
    
    if(!u || !p) return;
    btn.innerText = "Verifying...";
    
    const res = await apiCall('login', { u, p });
    
    if(res.success) {
        USER_DATA = res.user;
        document.getElementById('view-login').classList.add('hidden');
        if(USER_DATA.role === 'admin') initAdmin();
        else initClientDashboard();
    } else {
        btn.innerText = "Log In";
        rwAlert("Incorrect credentials.");
    }
}

function togglePassword() {
    const input = document.getElementById('login-pass');
    const btn = document.getElementById('toggle-pass-btn');
    if (input.type === "password") { input.type = "text"; btn.style.opacity = "1"; }
    else { input.type = "password"; btn.style.opacity = "0.5"; }
}

function changeTheme(themeName) {
    if (themeName === 'Obsidian') document.body.classList.add('theme-obsidian');
    else document.body.classList.remove('theme-obsidian');
}

/* --- ADMIN DASHBOARD --- */
async function initAdmin() {
    document.getElementById('view-admin').classList.remove('hidden');
    
    // 1. INJECT BANNER & SWITCHER
    const headerBar = document.querySelector('.glass-header-bar');
    headerBar.innerHTML = `
        <div class="admin-banner">
            <h1>Welcome, Admin</h1>
            <p>Overview of Rosewood Client Database</p>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="segment-control">
                <button class="segment-btn active">Clients</button>
                <button class="segment-btn" onclick="rwAlert('Template view coming next update')">Templates</button>
            </div>
            <button class="btn-main" onclick="openClientEditor()">+ New Client</button>
        </div>
    `;

    // 2. SHOW SKELETON LOADING
    const tbody = document.getElementById('client-table-body');
    tbody.innerHTML = Array(5).fill(`
        <tr>
            <td><div class="skeleton skeleton-text" style="width:120px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width:80px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width:60px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width:60px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width:100px;"></div></td>
        </tr>
    `).join('');

    const data = await apiCall('adminData');
    if(data.success) {
        ALL_FORMS = data.forms || [];
        renderAdminDashboard(data.clients);
    }
}

function renderAdminDashboard(clients) {
    const tbody = document.getElementById('client-table-body');
    tbody.innerHTML = "";
    clients.forEach(client => {
        if(client.id === "ID") return;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600;">${client.name}</td>
            <td><span style="font-family:monospace; opacity:0.6;">${client.code}</span></td>
            <td>${client.tier}</td>
            <td><span style="padding:4px 8px; border-radius:12px; background:rgba(0,0,0,0.05); font-size:11px; font-weight:700;">${client.status}</span></td>
            <td style="display:flex; gap:8px;">
                <button class="btn-soft" onclick='openPushModal(${JSON.stringify(client)})'>+ Assign</button>
                <button class="btn-soft" onclick='openClientEditor(${JSON.stringify(client)})'>Edit</button>
                <button class="btn-text" style="color:#d32f2f;" onclick='promptDeleteClient(${JSON.stringify(client)})'>&times;</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function promptDeleteClient(client) {
    if(await RosewoodUI.prompt("Delete Client?", `Type DELETE to remove <b>${client.name}</b> forever.`, "DELETE")) {
        const res = await apiCall('deleteClient', { id: client.id });
        if(res.success) { rwAlert("Client deleted."); initAdmin(); }
    }
}

/* --- CLIENT DASHBOARD --- */
async function initClientDashboard() {
    document.body.className = `tier-${USER_DATA.tier.toLowerCase()}`;
    // 1. INJECT AMBIENT ANIMATION BAR
    if(!document.querySelector('.tier-ambient-bar')) {
        const bar = document.createElement('div');
        bar.className = 'tier-ambient-bar';
        document.body.prepend(bar);
    }

    const dash = document.getElementById('view-client-dashboard');
    dash.classList.remove('hidden');
    
    const grid = document.getElementById('client-forms-grid');
    // 2. SHOW SKELETON LOADING
    grid.innerHTML = Array(3).fill('<div class="glass-card skeleton-card"></div>').join('');
    
    // Update Header
    document.getElementById('client-dash-name').innerText = USER_DATA.name;
    document.getElementById('client-tier-badge').innerHTML = `<span class="tier-badge" style="padding:4px 10px; border-radius:12px; font-size:11px; font-weight:700; text-transform:uppercase;">${USER_DATA.tier} Member</span>`;

    const res = await apiCall('clientData', { id: USER_DATA.id });
    renderClientGrid(res.forms);
}

function renderClientGrid(forms) {
    const grid = document.getElementById('client-forms-grid');
    grid.innerHTML = "";
    if(!forms || forms.length === 0) {
        grid.innerHTML = "<div style='opacity:0.5; padding:20px;'>No active forms.</div>";
        return;
    }
    forms.forEach(form => {
        const card = document.createElement('div');
        card.className = "glass-card";
        card.style.cursor = "pointer";
        card.onclick = () => openFlagshipForm(form.formName, form.status, form.reqId);
        card.innerHTML = `
            <div class="glass-header">
                <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--accent);">${form.status}</span>
                <span>${form.status === 'Completed' ? '✅' : '📝'}</span>
            </div>
            <div class="glass-content">
                <h3 style="font-size:18px; margin-bottom:5px;">${form.formName}</h3>
                <div style="font-size:12px; opacity:0.6;">${new Date(form.date).toLocaleDateString()}</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- SHARED FORM VIEWER (FLAGSHIP) ---
async function openFlagshipForm(formName, status, reqId) {
    // Hide Dashboards
    document.getElementById('view-client-dashboard').classList.add('hidden');
    document.getElementById('view-admin').classList.add('hidden');
    
    const view = document.getElementById('view-flagship-form');
    view.classList.remove('hidden');
    window.scrollTo(0,0);
    
    document.getElementById('flagship-form-title').innerText = formName;
    const canvas = document.getElementById('flagship-canvas');
    canvas.innerHTML = '<div class="skeleton skeleton-text" style="height:40px; width:50%;"></div>' + 
                       Array(4).fill('<div class="skeleton skeleton-card" style="margin-bottom:20px;"></div>').join('');

    const schemaRes = await apiCall('getSchema', { formName });
    const answersRes = await apiCall('getAnswers', { id: USER_DATA.id }); // Simplified for demo
    
    renderFlagshipCanvas(canvas, schemaRes.schema, answersRes.answers || {}, status === 'Completed');
}

// Simplified Renderer for brevity (Uses existing logic patterns)
function renderFlagshipCanvas(container, schema, answers, isLocked) {
    container.innerHTML = "";
    if(!schema) { container.innerHTML = "Error loading form."; return; }
    
    schema.forEach(field => {
        if(field.type === 'header') {
            container.innerHTML += `<h3 style="margin:30px 0 15px 0; border-bottom:1px solid #eee; padding-bottom:10px;">${field.label}</h3>`;
            return;
        }
        if(field.type === 'hidden') return;

        const val = answers[field.key] || "";
        const div = document.createElement('div');
        div.className = "flagship-field-group";
        div.innerHTML = `<label class="flagship-label">${field.label}</label>`;
        
        let input;
        if(field.type === 'textarea') {
            input = document.createElement('textarea');
            input.rows = 4;
        } else if (field.type === 'select') {
            input = document.createElement('select');
            (field.options || []).forEach(opt => {
                const o = document.createElement('option');
                o.value = opt; o.innerText = opt;
                if(opt === val) o.selected = true;
                input.appendChild(o);
            });
        } else {
            input = document.createElement('input');
            input.type = "text";
        }
        
        input.className = "flagship-input";
        if(field.type !== 'select') input.value = val;
        if(isLocked) input.disabled = true;
        
        div.appendChild(input);
        container.appendChild(div);
    });
}
