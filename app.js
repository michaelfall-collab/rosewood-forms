// --- CONFIGURATION ---
const SUPABASE_URL = "https://epytlgfjtucnewxlaldd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVweXRsZ2ZqdHVjbmV3eGxhbGRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTQwNjEsImV4cCI6MjA4NjgzMDA2MX0.6cjCGri0WnwXx22jaoFod1ToIIxd2VJEHWLaMY1qmVE";

// FIX: We name this 'sb' instead of 'supabase' to avoid conflict with the library
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- STATE ---
let USER_DATA = null;
let ALL_FORMS = [];
let STUDIO_SCHEMA = [];
let CURRENT_STUDIO_FORM = null;
let CURRENT_ADMIN_CLIENT = null;
let CURRENT_FLAGSHIP_SCHEMA = [];
let CURRENT_FLAGSHIP_NAME = "";
let CURRENT_REQUEST_ID = null;

// --- ROSEWOOD UI SYSTEM ---
const RosewoodUI = {
    modal: () => document.getElementById('rw-modal'),
    title: () => document.getElementById('rw-modal-title'),
    msg: () => document.getElementById('rw-modal-msg'),
    actions: () => document.getElementById('rw-modal-actions'),
    
    close: function() { this.modal().classList.remove('active'); },
    
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
            this.modal().classList.add('active');
        });
    },

    // NEW: Prompt for Delete Safety
    prompt: function(title, text, confirmKeyword) {
        return new Promise((resolve) => {
            this.title().innerText = title;
            this.msg().innerHTML = `
                ${text}
                <div style="margin-top:15px;">
                    <input type="text" id="rw-prompt-input" placeholder="Type '${confirmKeyword}' to confirm" 
                    style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; text-transform:uppercase;">
                </div>
            `;
            this.actions().innerHTML = "";
            
            const btnCancel = document.createElement('button');
            btnCancel.className = "btn-soft";
            btnCancel.innerText = "Cancel";
            btnCancel.onclick = () => { this.close(); resolve(false); };
            
            const btnConfirm = document.createElement('button');
            btnConfirm.className = "btn-main";
            btnConfirm.innerText = "Confirm Delete";
            btnConfirm.style.background = "#d32f2f";
            btnConfirm.style.opacity = "0.5";
            btnConfirm.disabled = true;
            btnConfirm.onclick = () => { this.close(); resolve(true); };
            
            this.actions().appendChild(btnCancel);
            this.actions().appendChild(btnConfirm);
            
            this.modal().classList.add('active');

            // Input Listener
            setTimeout(() => {
                const input = document.getElementById('rw-prompt-input');
                input.focus();
                input.addEventListener('input', (e) => {
                    if(e.target.value.toUpperCase() === confirmKeyword) {
                        btnConfirm.style.opacity = "1";
                        btnConfirm.disabled = false;
                    } else {
                        btnConfirm.style.opacity = "0.5";
                        btnConfirm.disabled = true;
                    }
                });
            }, 100);
        });
    }
};

async function rwAlert(text, title="System Notice") {
    await RosewoodUI.show(title, text, [{ text: "Okay", value: true, class: "btn-main" }]);
}
async function rwConfirm(text, title="Confirmation Required") {
    return await RosewoodUI.show(title, text, [
        { text: "Cancel", value: false, class: "btn-soft" },
        { text: "Confirm", value: true, class: "btn-main" }
    ]);
}
// --- API (Supabase Version) ---
async function apiCall(action, payload = {}) {
    console.log(`📡 API Calling: ${action}`, payload);
    
    try {
        /* --- 1. LOGIN --- */
        if (action === 'login') {
            if (payload.u.toLowerCase() === 'admin' && payload.p === 'rosewood2026') {
                return { success: true, user: { role: 'admin', name: 'Administrator', tier: 'Gold' } };
            }

            // Use 'sb' here
            const { data, error } = await sb
                .from('clients')
                .select('*')
                .eq('name', payload.u)
                .eq('access_code', payload.p)
                .single();

            if (error || !data) return { success: false, message: "Invalid credentials" };
            return { success: true, user: { ...data, role: 'client' } };
        }

        /* --- 2. CLIENT DASHBOARD --- */
        if (action === 'clientData') {
            const { data, error } = await sb
                .from('requests')
                .select(`
                    id, 
                    status, 
                    created_at,
                    forms ( title, slug ) 
                `)
                .eq('client_id', payload.id);
            
            if (error) throw error;

            const formattedForms = data.map(r => ({
                reqId: r.id,
                status: r.status,
                date: r.created_at,
                formName: r.forms.title 
            }));

            return { success: true, forms: formattedForms };
        }

        /* --- 3. GET FORM SCHEMA --- */
        if (action === 'getSchema') {
            const { data: formData, error: formError } = await sb
                .from('forms')
                .select('id, description')
                .eq('title', payload.formName)
                .single();
            
            if (formError || !formData) throw new Error("Form not found");

            const { data: questions, error: qError } = await sb
                .from('questions')
                .select('*')
                .eq('form_id', formData.id)
                .order('sort_order', { ascending: true });

            if (qError) throw qError;

            if (formData.description) {
                questions.unshift({ key: 'meta_description', type: 'hidden', label: formData.description });
            }

            return { success: true, schema: questions };
        }

        /* --- 4. SAVE ANSWERS --- */
        if (action === 'saveData') {
            const { data: client } = await sb
                .from('clients')
                .select('project_data')
                .eq('id', payload.u)
                .single();

            const updatedData = { ...client.project_data, ...payload.data };

            const { error } = await sb
                .from('clients')
                .update({ project_data: updatedData })
                .eq('id', payload.u);

            if (error) throw error;
            return { success: true };
        }

        /* --- 5. ADMIN DASHBOARD --- */
        if (action === 'adminData') {
            const { data: clients } = await sb.from('clients').select('*').order('id');
            const { data: forms } = await sb.from('forms').select('title');
            
            return { 
                success: true, 
                clients: clients, 
                forms: forms.map(f => f.title) 
            };
        }
        
        return { success: false, message: "Unknown Action" };

    } catch (e) {
        console.error("Supabase Error:", e);
        return { success: false, message: e.message };
    }
}

/* --- LOGIN & ROUTING --- */
async function handleLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    const btn = document.querySelector('.login-card .btn-main');
    
    if(!u || !p) { shakeLogin(); return; }

    const originalText = btn.innerText;
    btn.innerText = "Verifying...";
    
    const res = await apiCall('login', { u, p });
    
    if(res.success) {
        USER_DATA = res.user;
        
        document.getElementById('view-login').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('view-login').classList.add('hidden');
            if(USER_DATA.role === 'admin') {
                initAdmin();
            } else {
                initClientDashboard();
            }
        }, 500);
    } else {
        btn.innerText = originalText;
        shakeLogin();
        rwAlert("Incorrect credentials. Please try again.");
    }
}

function changeTheme(themeName) {
    const root = document.documentElement;
    const body = document.body;
    
    if (themeName === 'Obsidian') {
        body.classList.add('theme-obsidian');
        // Obsidian accent is set via CSS class now
    } else {
        body.classList.remove('theme-obsidian');
        root.style.setProperty('--accent', '#A92F3D');
    }
}

function logout() { location.reload(); }
function shakeLogin() {
    const card = document.querySelector('.login-card');
    card.style.animation = "shake 0.3s";
    setTimeout(() => card.style.animation = "", 300);
}

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

/* --- CLIENT PORTAL LOGIC --- */

async function initClientDashboard() {
    document.body.className = `tier-${USER_DATA.tier.toLowerCase()}`;
    const dash = document.getElementById('view-client-dashboard');
    dash.classList.remove('hidden');
    
    // Polish: Update Header Icons
    const headerHtml = `
        <div class="glass-header" style="justify-content: space-between; margin-bottom: 30px;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <img src="favicon.png" style="height: 40px; opacity: 0.9;">
                <div>
                    <div style="font-size: 14px; opacity: 0.5; text-transform: uppercase; letter-spacing: 1px;">Welcome Back</div>
                    <div id="client-dash-name" style="font-size: 24px; font-weight: 700;">${USER_DATA.name}</div>
                </div>
            </div>
            <div style="display:flex; gap:10px;">
                 <button class="btn-soft" onclick="document.getElementById('settings-modal').classList.add('active')">
                    <span style="opacity:0.5;">⚙️</span> Settings
                </button>
                <button class="btn-soft" onclick="logout()" style="color:#d32f2f;">
                    <span style="opacity:0.5;">↪</span> Log Out
                </button>
            </div>
        </div>
        <div id="client-tier-badge" style="margin-bottom: 20px; display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
            ${USER_DATA.tier} Member
        </div>
        <h2 style="font-size: 18px; margin-bottom: 15px; opacity: 0.7;">Your Action Items</h2>
        <div id="client-forms-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;"></div>
    `;
    dash.innerHTML = headerHtml;

    const grid = document.getElementById('client-forms-grid');
    grid.innerHTML = "<div style='opacity:0.5;'>Loading your forms...</div>";
    
    const res = await apiCall('clientData', { id: USER_DATA.id });
    grid.innerHTML = ""; 
    
    if(!res.forms || res.forms.length === 0) {
        grid.innerHTML = `
            <div class="glass-card" style="grid-column: 1 / -1; text-align:center; padding:40px;">
                <div style="font-size:40px; margin-bottom:10px;">☕</div>
                <div style="font-weight:600;">All caught up!</div>
                <div style="opacity:0.6; font-size:14px;">No forms are currently assigned to you.</div>
            </div>`;
        return;
    }

    res.forms.forEach(form => {
        const isCompleted = (form.status === 'Completed');
        const card = document.createElement('div');
        card.className = "glass-card";
        card.style.cursor = "pointer";
        card.style.transition = "transform 0.2s";
        card.onclick = () => openFlagshipForm(form.formName, form.status, form.reqId);

        card.innerHTML = `
            <div class="glass-header" style="border:none; padding-bottom:0;">
                <div style="font-size:12px; font-weight:700; color:var(--accent); text-transform:uppercase;">${form.status}</div>
                ${isCompleted ? '✅' : '📝'}
            </div>
            <div class="glass-content" style="padding-top:10px;">
                <div style="font-size:18px; font-weight:700; margin-bottom:5px;">${form.formName}</div>
                <div style="font-size:12px; opacity:0.6;">Assigned: ${new Date(form.date).toLocaleDateString()}</div>
            </div>
            <div class="glass-footer" style="background:transparent; border:none; padding-top:0;">
                <span style="font-size:12px; font-weight:600; color:var(--text-main); opacity:0.8;">
                    ${isCompleted ? 'View Submission' : 'Start Now &rarr;'}
                </span>
            </div>
        `;
        grid.appendChild(card);
    });
}

/* --- FLAGSHIP FORM RENDERER (Unified) --- */

/* --- UPDATED VIEWER (Debug + Data Loss Fix) --- */
async function openFlagshipForm(formName, status, reqId = null) {
    const view = document.getElementById('view-flagship-form');
    const canvas = document.getElementById('flagship-canvas');
    const title = document.getElementById('flagship-form-title');
    const descEl = document.getElementById('flagship-form-desc');
    const printTitle = document.getElementById('print-title');
    
    CURRENT_REQUEST_ID = reqId;

    view.classList.remove('hidden');
    document.getElementById('view-client-dashboard').classList.add('hidden');
    document.getElementById('view-admin').classList.add('hidden');
    window.scrollTo(0,0);
    
    const cleanName = formName.trim();
    const displayName = cleanName.match(/form$/i) ? cleanName : cleanName + " Form";
    title.innerText = displayName;
    printTitle.innerText = displayName;
    
    descEl.style.display = 'none'; 
    canvas.innerHTML = "<div style='text-align:center; padding:50px; opacity:0.5;'>Loading Form...</div>";
    
    CURRENT_FLAGSHIP_NAME = formName;

    // This call now works because getFormSchema exists in code.gs
    const schemaRes = await apiCall('getSchema', { formName });
    
    if(!schemaRes.success) {
        canvas.innerHTML = `
            <div style='color:#b91c1c; text-align:center; padding: 20px;'>
                <h3>Error Loading Form</h3>
                <p>Server says: ${schemaRes.message}</p>
            </div>`;
        return;
    }
    
    CURRENT_FLAGSHIP_SCHEMA = schemaRes.schema;

    let targetId = null;
    if (USER_DATA.role === 'admin' && CURRENT_ADMIN_CLIENT) {
        targetId = CURRENT_ADMIN_CLIENT.id;
    } else {
        targetId = USER_DATA.id;
    }

    const answerRes = await apiCall('getAnswers', { id: targetId });
    const freshAnswers = answerRes.success ? answerRes.answers : {};

    if (USER_DATA.role === 'admin' && CURRENT_ADMIN_CLIENT) {
        CURRENT_ADMIN_CLIENT.answers = freshAnswers; 
    }

    const isLocked = (USER_DATA.role !== 'admin' && status === 'Completed');
    renderFlagshipCanvas(canvas, descEl, freshAnswers, isLocked);

    // Meta Description Handling
    const meta = CURRENT_FLAGSHIP_SCHEMA.find(f => f.key === 'meta_description');
    if(meta && meta.label) {
        if (USER_DATA.role === 'admin') {
            descEl.innerHTML = `${meta.label} <br><span style="color:var(--accent); font-weight:600; font-size:11px; text-transform:uppercase;">Editing: ${CURRENT_ADMIN_CLIENT.name}</span>`;
        } else {
            descEl.innerText = meta.label;
        }
        descEl.style.display = "block";
        document.getElementById('print-desc').innerText = meta.label; 
    }
    updateProgress(); 
}

function renderFlagshipCanvas(canvas, descEl, preloadedAnswers = {}, isLocked = false) {
    canvas.innerHTML = "";
    
    CURRENT_FLAGSHIP_SCHEMA.forEach(field => {
        if(field.key === 'meta_description' || field.type === 'hidden' || field.key === 'init_marker') return;

        const group = document.createElement('div');
        group.className = "flagship-field-group";

        const label = document.createElement('label');
        label.className = "flagship-label";
        label.innerText = field.label;
        group.appendChild(label);

        let input;
        let val = preloadedAnswers[field.key] || "";

        const disabledAttr = isLocked ? 'disabled' : '';
        const lockedStyle = isLocked ? 'cursor: not-allowed; opacity: 0.7; background: #f5f5f5;' : '';

        if (field.type === 'textarea') {
            input = document.createElement('textarea');
            input.className = "flagship-input";
            input.rows = 4;
            input.value = val;
            if(isLocked) { input.disabled = true; input.style.cssText += lockedStyle; }
            else {
                input.oninput = function() {
                    this.style.height = "auto";
                    this.style.height = (this.scrollHeight) + "px";
                    updateProgress();
                };
            }
            setTimeout(() => input.dispatchEvent(new Event('input')), 100); 
        } else if (field.type === 'select') {
            input = document.createElement('div');
            if(field.options) {
                field.options.forEach(opt => {
                    const row = document.createElement('label');
                    row.className = "flagship-radio-row";
                    
                    const radio = document.createElement('input');
                    radio.type = "radio";
                    radio.name = field.key;
                    radio.value = opt.trim();
                    if(val === opt.trim()) radio.checked = true;
                    
                    if(isLocked) radio.disabled = true;
                    else radio.onchange = updateProgress;
                    
                    row.appendChild(radio);
                    row.appendChild(document.createTextNode(opt.trim()));
                    input.appendChild(row);
                });
            }
        } else {
            input = document.createElement('input');
            input.type = "text";
            input.className = "flagship-input";
            input.value = val;
            if(isLocked) { input.disabled = true; input.style.cssText += lockedStyle; }
            else input.oninput = updateProgress;
        }

        if(field.type !== 'select') input.setAttribute('data-key', field.key);
        else input.setAttribute('data-group-key', field.key);

        group.appendChild(input);
        canvas.appendChild(group);
    });
}

async function saveFlagshipData(isDraft) {
    const payload = {};
    document.querySelectorAll('#flagship-canvas [data-key]').forEach(input => payload[input.getAttribute('data-key')] = input.value);
    document.querySelectorAll('#flagship-canvas [data-group-key]').forEach(group => {
        const key = group.getAttribute('data-group-key');
        const checked = group.querySelector(`input[name="${key}"]:checked`);
        if(checked) payload[key] = checked.value;
    });

    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "Saving...";

    const targetId = (USER_DATA.role === 'admin') ? CURRENT_ADMIN_CLIENT.id : USER_DATA.id;

    const res = await apiCall('saveData', { u: targetId, data: payload });

    if(res.success) {
        if (USER_DATA.role === 'admin') {
            if(!CURRENT_ADMIN_CLIENT.answers) CURRENT_ADMIN_CLIENT.answers = {};
            Object.assign(CURRENT_ADMIN_CLIENT.answers, payload);
        } else {
            if(!USER_DATA.answers) USER_DATA.answers = {};
            Object.assign(USER_DATA.answers, payload);
        }

        if (!isDraft && CURRENT_REQUEST_ID) {
            await apiCall('completeRequest', { reqId: CURRENT_REQUEST_ID });
        }

        if(isDraft) {
            btn.innerText = "Draft Saved";
            setTimeout(() => btn.innerText = originalText, 1500);
        } else {
            await rwAlert("Thank you! Your form has been submitted.");
            closeFlagshipForm();
        }
    } else {
        rwAlert("Error saving: " + res.message);
        btn.innerText = originalText;
    }
}

function updateProgress() {
    const textInputs = document.querySelectorAll('#flagship-canvas [data-key]');
    const radioGroups = document.querySelectorAll('#flagship-canvas [data-group-key]');
    const total = textInputs.length + radioGroups.length;
    
    if(total === 0) return;

    let filled = 0;
    textInputs.forEach(input => { if(input.value.trim() !== "") filled++; });
    radioGroups.forEach(group => {
        const key = group.getAttribute('data-group-key');
        if(document.querySelector(`input[name="${key}"]:checked`)) filled++;
    });

    const pct = Math.round((filled / total) * 100);
    const badge = document.getElementById('flagship-form-progress');
    if(badge) {
        badge.innerText = `${pct}% Completed`;
        if(pct === 100) badge.innerText = "🎉 100% Ready";
    }
}

function closeFlagshipForm() {
    document.getElementById('view-flagship-form').classList.add('hidden');
    document.body.scrollTop = 0; 
    document.documentElement.scrollTop = 0;

    if (USER_DATA.role === 'admin') {
        document.getElementById('view-admin').classList.remove('hidden');
        initAdmin(); 
    } else {
        document.getElementById('view-client-dashboard').classList.remove('hidden');
        initClientDashboard(); 
    }
}

/* --- ADMIN DASHBOARD & STUDIO --- */



function renderAdminDashboard(clients) {
    const tbody = document.getElementById('client-table-body');
    if(!tbody) return;
    tbody.innerHTML = ""; 
    
    clients.forEach(client => {
        if(client.id === "ID") return; // Header skip
        
        const tr = document.createElement('tr');
        tr.innerHTML += `<td style="font-weight:600;">${client.name}</td>`;
        tr.innerHTML += `<td><span style="font-family:monospace; background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:6px; font-size:12px;">${client.code}</span></td>`;
        tr.innerHTML += `<td><span style="${getTierStyle(client.tier)}">${client.tier}</span></td>`;
        tr.innerHTML += `<td><span style="${getStatusStyle(client.status)} padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;">${client.status || 'Active'}</span></td>`;
        
        const tdAction = document.createElement('td');
        tdAction.style.display = "flex";
        tdAction.style.gap = "8px"; 
        tdAction.style.alignItems = "center";
        
        const btnProfile = document.createElement('button');
        btnProfile.className = "btn-soft";
        btnProfile.innerHTML = "Profile";
        btnProfile.onclick = () => openClientEditor(client);
        
        const btnForms = document.createElement('button');
        btnForms.className = "btn-soft";
        btnForms.innerHTML = "View Data";
        btnForms.onclick = () => openFormPicker(client); 

        const btnPush = document.createElement('button');
        btnPush.className = "btn-main small"; 
        btnPush.style.padding = "6px 12px";
        btnPush.innerHTML = "+ Assign";
        btnPush.onclick = () => openPushModal(client);

        // FEATURE: Delete Button
        const btnDelete = document.createElement('button');
        btnDelete.className = "btn-text";
        btnDelete.innerHTML = "&times;";
        btnDelete.style.color = "#d32f2f";
        btnDelete.title = "Delete Client";
        btnDelete.onclick = () => promptDeleteClient(client);
        
        tdAction.appendChild(btnPush);
        tdAction.appendChild(btnProfile);
        tdAction.appendChild(btnForms);
        tdAction.appendChild(btnDelete); // Added delete
        tr.appendChild(tdAction);
        
        tbody.appendChild(tr);
    });
}
async function promptDeleteClient(client) {
    const confirmed = await RosewoodUI.prompt(
        "Delete Client?", 
        `Are you sure you want to delete <strong>${client.name}</strong>?<br>This will permanently erase their data and form history.`, 
        "DELETE"
    );

    if (confirmed) {
        const res = await apiCall('deleteClient', { id: client.id });
        if (res.success) {
            rwAlert("Client deleted successfully.");
            initAdmin();
        } else {
            rwAlert("Error: " + res.message);
        }
    }
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
            openFlagshipForm(form); 
        };
        container.appendChild(btn);
    });
    modal.classList.add('active');
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
            if(meta && descInput) { descInput.value = meta.label; }
        }
    }
    renderStudioCanvas();
}

async function closeStudio() {
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

function openPushModal(client) {
    CURRENT_ADMIN_CLIENT = client;
    const modal = document.getElementById('push-modal');
    const container = document.getElementById('push-list-container');
    const title = document.getElementById('push-client-name');
    title.innerText = client.name;
    container.innerHTML = ""; 

    if(ALL_FORMS.length === 0) {
        container.innerHTML = "<p style='opacity:0.5;'>No templates available.</p>";
    }

    ALL_FORMS.forEach(form => {
        const btn = document.createElement('button');
        btn.className = "btn-soft"; 
        btn.style.width = "100%";
        btn.style.marginBottom = "8px";
        btn.style.justifyContent = "space-between";
        btn.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:16px;">📄</span>
                <span style="font-weight:600;">${form}</span>
            </div>
            <span style="font-size:11px; background:var(--accent); color:#fff; padding:2px 6px; border-radius:4px;">PUSH</span>
        `;
        btn.onclick = () => pushFormToClient(form);
        container.appendChild(btn);
    });
    modal.classList.add('active');
}

async function pushFormToClient(formName) {
    if(!await rwConfirm(`Assign "<strong>${formName}</strong>" to ${CURRENT_ADMIN_CLIENT.name}?`)) return;
    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;
    btn.innerHTML = "Sending...";
    btn.style.opacity = "0.7";
    const res = await apiCall('assignForm', { 
        id: CURRENT_ADMIN_CLIENT.id, 
        formName: formName 
    });
    if(res.success) {
        btn.innerHTML = "✅ Sent!";
        btn.style.background = "#E8F5E9";
        btn.style.color = "#2E7D32";
        setTimeout(() => {
            document.getElementById('push-modal').classList.remove('active');
            rwAlert(`Form sent to ${CURRENT_ADMIN_CLIENT.name}. They can now see it on their dashboard.`);
        }, 1000);
    } else {
        rwAlert("Error: " + res.message);
        btn.innerHTML = originalContent;
        btn.style.opacity = "1";
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
function changeTheme(themeName) {
    const root = document.documentElement;
    if (themeName === 'Obsidian') {
        root.style.setProperty('--accent', '#1d1d1f'); 
    } else {
        root.style.setProperty('--accent', '#A92F3D');
    }
}
// --- FIX: Add Request Deletion for Admins ---
async function deleteRequest(reqId) {
    if(!await rwConfirm("Are you sure you want to delete this assignment?", "Revoke Form")) return;
    
    // We can reuse the 'deleteClient' logic pattern in the backend or add a specific action
    // For now, let's add a backend handler for 'deleteRequest'
    const res = await apiCall('deleteRequest', { reqId });
    if(res.success) {
        rwAlert("Request deleted.");
        // Refresh the view
        if(CURRENT_ADMIN_CLIENT) openPushModal(CURRENT_ADMIN_CLIENT);
    } else {
        rwAlert("Error: " + res.message);
    }
}
function togglePassword() {
    const input = document.getElementById('login-pass');
    const btn = document.getElementById('toggle-pass-btn'); // Ensure your HTML button has this ID
    
    if (input.type === "password") {
        input.type = "text";
        btn.style.opacity = "1"; // Visual feedback
    } else {
        input.type = "password";
        btn.style.opacity = "0.5";
    }
}
