// login.js
const API_URL = "http://localhost:3000";
const errorDiv = document.getElementById('error-message');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegister = document.getElementById('show-register');
const showLogin = document.getElementById('show-login');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const togglePassword = document.getElementById('toggle-password');
togglePassword.addEventListener('click', () => {
const pwd = document.getElementById('login-password');
const isPwd = pwd.getAttribute('type') === 'password';
pwd.setAttribute('type', isPwd ? 'text' : 'password');
  // Change l’icône
togglePassword.src = isPwd
    ? '/shared/visible.png'
    : '/shared/nonvisible.png';
});

// Regex côté client
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Affiche / cache le message d'erreur en jouant sur les classes CSS
function showError(msg) {
  errorDiv.textContent = msg;
  errorDiv.classList.add('visible');
}
function hideError() {
  errorDiv.textContent = '';
  errorDiv.classList.remove('visible');
}

// Basculer vers le formulaire d'inscription
showRegister.addEventListener('click', () => {
  loginForm.classList.add('hidden');
  registerForm.classList.remove('hidden');
  hideError();
});

// Basculer vers le formulaire de connexion
showLogin.addEventListener('click', () => {
  registerForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
  hideError();
});

// Connexion
loginBtn.addEventListener('click', async () => {
  hideError();
  const identifier = document.getElementById('login-identifier').value.trim();
  const password   = document.getElementById('login-password').value.trim();
  if (!identifier || !password) {
    showError("Veuillez remplir tous les champs.");
    return;
  }
  try {
    const res = await fetch(`${API_URL}/api/login`, {
      method: "POST",
      credentials: "include",
      headers:  { "Content-Type": "application/json" },
      body:     JSON.stringify({ identifier, password })
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.message || "Erreur de connexion");
      return;
    }
    if (data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", identifier);
      localStorage.setItem("userId", data.userId);  // ✅ ajout ici
      window.location.href = "/game/choose/choose_game.html";
    }
    
  } catch {
    showError("Impossible de se connecter (erreur réseau).");
  }
});

// Inscription
registerBtn.addEventListener('click', async () => {
  hideError();
  const nom       = document.getElementById('nom').value.trim();
  const prenom    = document.getElementById('prenom').value.trim();
  const username  = document.getElementById('reg-username').value.trim();
  const email     = document.getElementById('reg-email').value.trim();
  const password  = document.getElementById('reg-password').value.trim();
  const city      = document.getElementById('reg-city').value.trim();
  const country   = document.getElementById('reg-country').value.trim();
  const languages = document.getElementById('reg-languages').value.trim();
  const birthdate = document.getElementById('reg-birthdate').value; // "YYYY-MM-DD"

  if (!nom || !prenom || !username || !email || !password) {
    showError("Veuillez remplir tous les champs de base.");
    return;
  }
  if (!city || !country || !languages || !birthdate) {
    showError("Veuillez remplir tous les champs (ville, pays, langues, date).");
    return;
  }
  if (!emailRegex.test(email)) {
    showError("Adresse email invalide.");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/register`, {
      credentials: "include",
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({
        nom, prenom, username, email, password,
        city, country, languages, birthdate
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.message || "Erreur d'inscription");
      return;
    }
    if (data.success) {
      window.location.href = "/auth/email_sent.html";
    } else {
      showError(data.message || "Inscription échouée");
    }
  } catch {
    showError("Impossible de créer un compte (erreur réseau).");
  }
});
