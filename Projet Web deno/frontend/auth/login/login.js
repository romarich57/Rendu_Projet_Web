// register.js
const API_DEFAULT = "https://api.rom-space-game.realdev.cloud";
const API_URL = (() => {
  if (typeof window === 'undefined') {
    return API_DEFAULT;
  }
  const custom = window.__API_BASE__;
  if (typeof custom === 'string' && custom.trim()) {
    return custom.trim().replace(/\/$/, '');
  }
  const { protocol, hostname, port } = window.location;
  const safeProtocol = protocol.startsWith('http') ? protocol : 'http:';
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const portMap = {
      '8000': '6000',
      '5173': '6000',
      '4173': '6000',
      '3000': '3000',
      '3001': '3001',
      '': '6000',
    };
    const targetPort = portMap[port] ?? '6000';
    return `${safeProtocol}//${hostname}:${targetPort}`;
  }
  return API_DEFAULT;
})();
const errorDiv = document.getElementById('error-message');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegister = document.getElementById('show-register');
const showLogin = document.getElementById('show-login');
const loginBtn = document.getElementById('login-btn');
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
  hideError();
  window.location.href = "../register/register.html";
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
      localStorage.setItem("userId", data.userId);  
      window.location.href = "/game/choose/choose_game.html";
    }

  } catch {
    showError("Impossible de se connecter (erreur réseau).");
  }
});
