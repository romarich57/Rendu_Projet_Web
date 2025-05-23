// register.js
const API_URL = "https://api.rom-space-game.realdev.cloud"
const errorDiv = document.getElementById('error-message');
const registerForm = document.getElementById('register-form');
const showLogin = document.getElementById('show-login');
const registerBtn = document.getElementById('register-btn');

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

// Basculer vers le formulaire de connexion
showLogin.addEventListener('click', () => {
  hideError();
  window.location.href = '../login/login.html';
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
      window.location.href = "../email_sent.html";
    } else {
      showError(data.message || "Inscription échouée");
    }
  } catch {
    showError("Impossible de créer un compte (erreur réseau).");
  }
});
