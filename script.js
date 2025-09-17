/* -------------------------
   Config & State
------------------------- */
const API_URL = 'https://msb-finance.onrender.com/api';
let currentUser = null;
let userToken = localStorage.getItem('userToken') || null;
const MIN_LOAN = 300;
const MAX_LOAN = 4000;

/* -------------------------
   Helper functions
------------------------- */
function token() { return userToken; }
function setToken(t) { userToken = t; localStorage.setItem('userToken', t); }
function setCurrentUser(user) { currentUser = user; localStorage.setItem('currentUser', JSON.stringify(user)); }

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
    if (currentUser && token()) {
        nav.innerHTML = `<span style="color:white">Welcome, ${currentUser.name}</span>
                         <button class="btn-secondary" onclick="logout()">Logout</button>`;
    } else {
        nav.innerHTML = `<button class="btn-secondary" onclick="showScreen('login')">Login</button>
                         <button class="btn-primary" onclick="showScreen('register')">Get Started</button>`;
    }
}

// ---------------------
// API UTILS
// ---------------------

// Helper to get token from localStorage
function token() {
    return localStorage.getItem('token');
}

// ---------------------
// AUTH
// ---------------------

async function apiRegister(data) {
    const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Error registering: ${text}`);
    }

    return await res.json();
}

async function apiLogin(data) {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Error logging in: ${text}`);
    }

    return await res.json();
}

// ---------------------
// LOANS
// ---------------------

// Submit a new loan
async function apiSubmitLoan(data) {
    const res = await fetch(`${API_URL}/loans`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token()}`
        },
        body: JSON.stringify(data)
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Error submitting loan: ${text}`);
    }

    return await res.json();
}

// Get logged-in user's loans
async function apiGetLoans() {
    const res = await fetch(`${API_URL}/loans/me`, {  // <-- correct URL
        headers: { 'Authorization': `Bearer ${token()}` }
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Error fetching loans: ${text}`);
    }

    return await res.json();
}

// ---------------------
// DOCUMENTS
// ---------------------

// Upload files
async function apiUploadFiles(files) {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    const res = await fetch(`${API_URL}/docs/upload`, {  // correct URL
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}` },
        body: formData
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Error uploading files: ${text}`);
    }

    return await res.json();
}

// Get logged-in user's documents
async function apiGetDocuments() {
    const res = await fetch(`${API_URL}/docs/me`, {  // <-- correct URL
        headers: { 'Authorization': `Bearer ${token()}` }
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Error fetching documents: ${text}`);
    }

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
            if (res.token) { setToken(res.token); setCurrentUser(res.user); toggleNavForAuth(); showDashboard(); }
            else showError('regError', res.message || 'Registration failed');
        } catch (err) { showError('regError', err.message || JSON.stringify(err)); }
    });

    // Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', async e => {
        e.preventDefault();
        showError('loginError', '');
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        try {
            const res = await apiLogin({ email, password });
            if (res.token) { setToken(res.token); setCurrentUser(res.user); toggleNavForAuth(); showDashboard(res.user); }
            else showError('loginError', res.message || 'Login failed');
        } catch (err) { showError('loginError', err.message || JSON.stringify(err)); }
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
        const data = await apiGetDocuments();
        const container = document.getElementById('doc-list');
        container.innerHTML = ''; // clear existing content

        if (!data.docs || data.docs.length === 0) {
            container.innerHTML = '<p>No documents uploaded yet.</p>';
            return;
        }

        data.docs.forEach(doc => {
            const div = document.createElement('div');
            div.classList.add('doc-item');
            div.innerHTML = `<a href="${doc.url}" target="_blank">${doc.filename}</a>`;
            container.appendChild(div);
        });
    } catch (err) {
        console.error(err);
        alert('Failed to load documents.');
    }
}
/* -------------------------
   Dashboard
------------------------- */
async function loadLoanApplications() {
    try {
        const data = await apiGetLoans();
        const container = document.getElementById('loan-list');
        container.innerHTML = ''; // clear existing content

        if (!data.loans || data.loans.length === 0) {
            container.innerHTML = '<p>No loans applied yet.</p>';
            return;
        }

        data.loans.forEach(loan => {
            const div = document.createElement('div');
            div.classList.add('loan-item');
            div.innerHTML = `
                <p>Amount: R${loan.amount}</p>
                <p>Term: ${loan.termMonths} months</p>
                <p>Purpose: ${loan.purpose}</p>
            `;
            container.appendChild(div);
        });
    } catch (err) {
        console.error(err);
        alert('Failed to load loans.');
    }
}

function showDashboard(user) {
    if (!currentUser) {
        const saved = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (saved) currentUser = saved;
    }
    if (!currentUser || !token()) { setCurrentUser(null); setToken(null); toggleNavForAuth(); return showScreen('hero'); }

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
    setCurrentUser(null); setToken(null); toggleNavForAuth();
    showScreen('hero');
}

/* -------------------------
   Init
------------------------- */
document.addEventListener('DOMContentLoaded', setupEventListeners);
