/* -------------------------
   Config & State
------------------------- */
const API_URL = 'https://msb-finance.onrender.com/api';
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
const MIN_LOAN = 300;
const MAX_LOAN = 4000;

/* -------------------------
   Token & Role helpers
------------------------- */
function getToken() { return localStorage.getItem('token'); }
function setToken(token) { if (token) localStorage.setItem('token', token); else localStorage.removeItem('token'); }

function getCurrentUser() {
    const u = localStorage.getItem('currentUser');
    return u ? JSON.parse(u) : null;
}
function setCurrentUser(user) {
    if (user) localStorage.setItem('currentUser', JSON.stringify(user));
    else localStorage.removeItem('currentUser');
}

function getRole() { return localStorage.getItem('role'); }
function setRole(role) { if (role) localStorage.setItem('role', role); else localStorage.removeItem('role'); }

/* -------------------------
   Screen & UI helpers
------------------------- */
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const hero = document.getElementById('hero');
    if (hero) hero.style.display = (id === 'hero') ? 'block' : 'none';
    const screen = document.getElementById(id);
    if (screen) screen.classList.add('active');
}

function showError(elementId, msg) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = msg;
}
function showSuccess(elementId, msg) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = msg;
}

function toggleNavForAuth() {
    const nav = document.getElementById('navButtons');
    if (!nav) return;
    currentUser = getCurrentUser();
    if (currentUser && getToken()) {
        nav.innerHTML = `<span style="color:white">Welcome, ${currentUser.name}</span>
                         <button class="btn-secondary" onclick="logout()">Logout</button>`;
    } else {
        nav.innerHTML = `<button class="btn-secondary" onclick="showScreen('login')">Login</button>
                         <button class="btn-primary" onclick="showScreen('register')">Get Started</button>`;
    }
}

/* -------------------------
   API Calls
------------------------- */
async function apiRegister(data) {
    const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    return await res.json();
}

async function apiLogin(data) {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    return await res.json();
}

async function apiSubmitLoan(data) {
    const res = await fetch(`${API_URL}/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

async function apiGetLoans() {
    const res = await fetch(`${API_URL}/loans/me`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

async function apiUploadFiles(files) {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    const res = await fetch(`${API_URL}/docs/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

async function apiGetDocuments() {
    const res = await fetch(`${API_URL}/docs/me`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

/* -------------------------
   Event handlers
------------------------- */
function setupEventListeners() {
    // Registration
    const regForm = document.getElementById('registerForm');
    if (regForm) regForm.addEventListener('submit', async e => {
        e.preventDefault();
        showError('regError', '');
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regConfirmPassword').value;
        if (password !== confirm) return showError('regError', 'Passwords do not match');
        if (password.length < 6) return showError('regError', 'Password must be at least 6 characters');

        try {
            const res = await apiRegister({ name, email, phone, password });
            if (res.token) {
                setToken(res.token);
                setCurrentUser(res.user);
                setRole(res.role || 'user');
                toggleNavForAuth();
                showDashboard();
            } else showError('regError', res.message || 'Registration failed');
        } catch (err) { showError('regError', err.message || JSON.stringify(err)); }
    });

    // Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', async e => {
        e.preventDefault();
        showError('loginError', '');

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        if (!email || !password) return showError('loginError', 'Please enter both email and password.');

        try {
            const res = await apiLogin({ email, password });
            if (!res.token) return showError('loginError', res.message || 'Login failed');

            setToken(res.token);
            setCurrentUser(res.user);
            setRole(res.role || 'user');

            if (res.role === 'admin') {
                window.location.href = '/admin/admin.html';
            } else {
                toggleNavForAuth();
                showDashboard();
            }
        } catch (err) { showError('loginError', err.message || 'Unexpected error during login.'); console.error(err); }
    });

    // Loan form
    const loanForm = document.getElementById('loanForm');
    if (loanForm) loanForm.addEventListener('submit', async e => {
        e.preventDefault(); showError('loanError', ''); showSuccess('loanSuccess', '');
        const amount = Number(document.getElementById('loanAmount').value);
        const term = parseInt(document.getElementById('loanTerm').value) || 1;
        const income = Number(document.getElementById('income').value);
        const employment = document.getElementById('employment').value;
        const purpose = document.getElementById('purpose').value;

        if (isNaN(amount) || amount < MIN_LOAN || amount > MAX_LOAN)
            return showError('loanError', `Loan amount must be between R${MIN_LOAN} and R${MAX_LOAN}`);
        if (isNaN(income) || income <= 0) return showError('loanError', 'Please provide valid income');
        if (amount > income * 10) return showError('loanError', 'Loan exceeds income multiple');

        try {
            const res = await apiSubmitLoan({ amount, termMonths: term, income, employment, purpose });
            if (res.loan) { showSuccess('loanSuccess', 'Loan application submitted successfully'); setTimeout(loadLoanApplications, 800); setTimeout(() => showScreen('dashboard'), 1200); }
            else showError('loanError', res.message || 'Application failed');
        } catch (err) { showError('loanError', err.message || JSON.stringify(err)); }
    });

    // File upload
    const fileUpload = document.getElementById('fileUpload');
    const fileInput = document.getElementById('fileInput');
    if (fileUpload && fileInput) {
        fileUpload.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async e => { await handleFilesUpload(e.target.files); fileInput.value = ''; });
        fileUpload.addEventListener('dragover', e => { e.preventDefault(); fileUpload.classList.add('drag-over'); });
        fileUpload.addEventListener('dragleave', () => fileUpload.classList.remove('drag-over'));
        fileUpload.addEventListener('drop', async e => { e.preventDefault(); fileUpload.classList.remove('drag-over'); if (e.dataTransfer?.files) await handleFilesUpload(e.dataTransfer.files); });
    }

    document.addEventListener('click', e => { if (e.target?.dataset?.action === 'to-dashboard') showDashboard(); });
}

/* -------------------------
   File uploads
------------------------- */
async function handleFilesUpload(filesList) {
    showError('docError', ''); showSuccess('docSuccess', '');
    if (!currentUser || !token()) return showError('docError', 'You must be logged in to upload files.');
    const files = Array.from(filesList);
    if (!files.length) return;

    try {
        const res = await apiUploadFiles(files);
        if (res.uploaded) { showSuccess('docSuccess', 'Files uploaded successfully'); setTimeout(loadUserDocuments, 700); }
        else showError('docError', res.message || 'Upload failed');
    } catch (err) { showError('docError', err.message || JSON.stringify(err)); }
}

async function loadUserDocuments() {
    try {
        const res = await apiGetDocuments();
        const docs = (res.docs || []).filter(d => d.user._id === currentUser.id);
        const container = document.getElementById('uploadedFiles');
        if (!docs.length) { container.innerHTML = ''; return; }
        container.innerHTML = `
            <h4 style="margin:1rem 0;">Uploaded Documents</h4>
            ${docs.map(d => `<div class="file-item"><div><strong>${d.filename}</strong><br><small>${new Date(d.uploadedAt).toLocaleDateString()}</small></div></div>`).join('')}
        `;
    } catch (err) { console.error(err); }
}

/* -------------------------
   Dashboard helpers
------------------------- */
async function loadLoanApplications() {
    try {
        const data = await apiGetLoans();
        const container = document.getElementById('loan-list');
        container.innerHTML = '';
        (data.loans || []).forEach(loan => {
            const li = document.createElement('li');
            li.textContent = `R${loan.amount} - ${loan.termMonths} months`;
            container.appendChild(li);
        });
    } catch (err) { console.error("Error loading loans:", err); }
}

async function loadUserDocuments() {
    try {
        const res = await apiGetDocuments();
        const docs = (res.docs || []).filter(d => d.user._id === currentUser.id);
        const container = document.getElementById('uploadedFiles');
        container.innerHTML = docs.length ? `
            <h4 style="margin:1rem 0;">Uploaded Documents</h4>
            ${docs.map(d => `<div class="file-item"><div><strong>${d.filename}</strong><br><small>${new Date(d.uploadedAt).toLocaleDateString()}</small></div></div>`).join('')}
        ` : '';
    } catch (err) { console.error(err); }
}

function showDashboard() {
    currentUser = getCurrentUser();
    if (!currentUser || !getToken()) { setCurrentUser(null); setToken(null); setRole(null); toggleNavForAuth(); return showScreen('hero'); }
    document.getElementById('userName') && (document.getElementById('userName').textContent = currentUser.name);
    document.getElementById('userEmail') && (document.getElementById('userEmail').textContent = currentUser.email);
    toggleNavForAuth();
    loadLoanApplications();
    loadUserDocuments();
    showScreen('dashboard');
}

/* -------------------------
   Logout
------------------------- */
function logout() {
    setToken(null);
    setCurrentUser(null);
    setRole(null);
    showScreen('login');
}

/* -------------------------
   Init
------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();

    // Auto-redirect based on role
    const role = getRole();
    if (role === 'admin') {
        window.location.href = '/admin/admin.html';
    } else if (role === 'user') {
        toggleNavForAuth();
        showDashboard();
    } else {
        showScreen('hero');
    }
});