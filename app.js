// --- CONFIGURATION ---
// PASTE YOUR GOOGLE SCRIPT URL HERE
const API_URL = "https://script.google.com/macros/s/AKfycbwOHiy3ASAHxtgH8cdFZQFyYhN7OXkLPSqZmU0Cz8e1PvDftrgJfKLW5LRAZTwWWaqc5w/exec"; 

// --- STATE ---
let USER_DATA = null;

// --- FUNCTIONS ---

async function apiCall(action, payload = {}) {
    document.getElementById('loader').classList.remove('hidden');
    payload.action = action;
    
    // We use the "Beacon" pattern to talk to Google
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        document.getElementById('loader').classList.add('hidden');
        return data;
    } catch (e) {
        document.getElementById('loader').classList.add('hidden');
        alert("Connection Error: " + e.message);
        return { success: false };
    }
}

async function handleLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    
    const res = await apiCall('login', { u, p });
    
    if (res.success) {
        USER_DATA = res;
        initDashboard();
    } else {
        document.getElementById('login-msg').innerText = "Invalid Credentials";
    }
}

function initDashboard() {
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('view-dashboard').classList.remove('hidden');
    
    document.getElementById('welcome-hero').innerText = "Hello, " + USER_DATA.clientName;
    document.getElementById('tier-badge').innerText = USER_DATA.tier + " Membership";
    
    const grid = document.getElementById('form-grid');
    grid.innerHTML = "";
    
    // We hardcode the standard forms for now, or fetch them if you prefer
    const forms = ['Website', 'CRM', 'Onboarding'];
    
    forms.forEach(f => {
        const card = document.createElement('div');
        card.className = "form-card";
        card.innerHTML = `<h3>${f}</h3><p style="opacity:0.6; font-size:13px;">View & Edit</p>`;
        card.onclick = () => loadForm(f);
        grid.appendChild(card);
    });
}

async function loadForm(formName) {
    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('view-editor').classList.remove('hidden');
    document.getElementById('form-name-header').innerText = formName;
    
    const container = document.getElementById('form-builder-area');
    container.innerHTML = "Loading...";
    
    const schema = await apiCall('getSchema', { formName });
    const answers = USER_DATA.answers || {};
    
    container.innerHTML = "";
    
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
        
        div.appendChild(input);
        container.appendChild(div);
    });
}

function goHome() {
    document.getElementById('view-editor').classList.add('hidden');
    document.getElementById('view-dashboard').classList.remove('hidden');
}

function logout() {
    location.reload();
}
// --- ADMIN MODAL LOGIC ---
let CURRENT_ADMIN_CLIENT = null;

async function openClientView(name, id) {
    document.getElementById('admin-modal').classList.remove('hidden');
    document.getElementById('modal-title').innerText = name;
    document.getElementById('modal-content').innerHTML = "Loading client data...";
    
    // 1. Fetch Client Data
    const profile = await apiCall('getClientProfile', { clientId: id });
    CURRENT_ADMIN_CLIENT = profile; // Save for later
    
    // 2. Populate Form Dropdown
    const forms = ['Website', 'CRM', 'Onboarding']; // Or fetch from server
    const sel = document.getElementById('modal-form-select');
    sel.innerHTML = '<option value="">-- Select Form --</option>';
    forms.forEach(f => {
        sel.innerHTML += `<option value="${f}">${f}</option>`;
    });
}

async function loadClientFormView() {
    const formName = document.getElementById('modal-form-select').value;
    const container = document.getElementById('modal-content');
    
    if(!formName) return;
    
    container.innerHTML = "Loading answers...";
    
    // Fetch empty form schema
    const schema = await apiCall('getSchema', { formName });
    const answers = CURRENT_ADMIN_CLIENT.answers || {};
    
    container.innerHTML = "";
    
    // Render (Read-Only)
    schema.forEach(field => {
        const div = document.createElement('div');
        div.style.marginBottom = "20px";
        
        const label = document.createElement('div');
        label.style.fontWeight = "bold";
        label.style.fontSize = "12px";
        label.style.color = "#666";
        label.style.marginBottom = "5px";
        label.innerText = field.label;
        div.appendChild(label);
        
        const val = document.createElement('div');
        val.style.padding = "10px";
        val.style.background = "#f9f9f9";
        val.style.border = "1px solid #eee";
        val.style.borderRadius = "4px";
        val.innerText = answers[field.key] || "(No Answer)";
        
        // Highlight if answered
        if(answers[field.key]) {
            val.style.borderLeft = "3px solid #A92F3D";
            val.style.background = "#fff";
        }
        
        div.appendChild(val);
        container.appendChild(div);
    });
}

function closeModal() {
    document.getElementById('admin-modal').classList.add('hidden');
}
