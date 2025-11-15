// profile.js

// Sélection des éléments
const form         = document.getElementById('profile-form');
const editButtons  = form.querySelectorAll('.cyber-edit-btn');
const inputs       = form.querySelectorAll('.cyber-input');

// Base de l’API
const API_DEFAULT = "/api";
const API_URL = (() => {
  if (typeof window === "undefined") {
    return API_DEFAULT;
  }
  const custom = window.__API_BASE__;
  if (typeof custom === "string" && custom.trim()) {
    const normalized = custom.trim();
    return normalized.endsWith("/")
      ? normalized.slice(0, -1)
      : normalized;
  }
  const { protocol, hostname, port } = window.location;
  const safeProtocol = protocol.startsWith("http") ? protocol : "https:";
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const portMap = {
      "8000": "6000",
      "5173": "6000",
      "4173": "6000",
      "3000": "3000",
      "3001": "3001",
      "": "6000",
    };
    const targetPort = portMap[port] ?? "6000";
    return `${safeProtocol}//${hostname}:${targetPort}/api`;
  }
  return API_DEFAULT;
})();

// Verrouille tous les champs et réinitialise les boutons
function lockAll() {
  inputs.forEach(i => i.readOnly = true);
  editButtons.forEach(btn => {
    btn.disabled    = false;
    btn.textContent = 'Modifier';
  });
}

// Chargement du profil (GET)
async function loadProfile() {
  const token = localStorage.getItem("token");
  if (!token) {
    console.warn("Token absent → redirection login");
    return window.location.href = "../register.html";
  }

  let res;
  try {
    res = await fetch(`${API_URL}/user/profile`, {
      credentials: 'include',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (networkErr) {
    console.error("Erreur réseau :", networkErr);
    alert("Impossible de joindre le serveur. Vérifiez votre connexion.");
    return lockAll();
  }

  if (res.status === 401) {
    alert("Session expirée. Veuillez vous reconnecter.");
    return window.location.href = "../register.html";
  }

  if (!res.ok) {
    console.error(`GET profile → status ${res.status}`);
    alert("Impossible de charger votre profil.");
    return lockAll();
  }

  let data;
  try {
    data = await res.json();
  } catch (parseErr) {
    console.error("Erreur de parsing JSON :", parseErr);
    alert("Réponse serveur invalide.");
    return lockAll();
  }

  // Injection des données dans le formulaire
  form.username.value  = data.username  || '';
  form.email.value     = data.email     || '';
  form.country.value   = data.country   || '';
  form.city.value      = data.city      || '';
  form.languages.value = data.languages || '';
  form.birthdate.value = data.birthdate || '';

  lockAll();
}

// Gestion des boutons Modifier ↔ Réinitialiser
editButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const field = btn.dataset.field;
    const inp   = form.querySelector(`[name="${field}"]`);

    if (btn.textContent === 'Modifier') {
      // On passe en édition
      btn.dataset.orig = inp.value;
      inp.readOnly     = false;
      inp.focus();
      btn.textContent  = 'Réinitialiser';
    } else {
      // On remet la valeur initiale
      inp.value        = btn.dataset.orig;
      inp.readOnly     = true;
      btn.textContent  = 'Modifier';
    }
  });
});

// Enregistrement du profil (PUT)
form.addEventListener('submit', async e => {
  e.preventDefault();

  const token = localStorage.getItem("token");
  if (!token) {
    alert("Session expirée. Veuillez vous reconnecter.");
    return window.location.href = "../register.html";
  }

  // Préparation du payload
  const payload = {
    username:  form.username.value.trim(),
    email:     form.email.value.trim(),
    country:   form.country.value.trim()   || null,
    city:      form.city.value.trim()      || null,
    languages: form.languages.value.trim() || null,
    birthdate: form.birthdate.value        || null
  };

  let res;
  try {
    res = await fetch(`${API_URL}/user/profile`, {
      method:      'PUT',
      credentials: 'include',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  } catch (networkErr) {
    console.error("Erreur réseau PUT :", networkErr);
    alert("Erreur réseau lors de l’enregistrement.");
    return;
  }

  if (res.status === 401) {
    alert("Session expirée. Veuillez vous reconnecter.");
    return window.location.href = "../register.html";
  }

  // Lecture flexible de la réponse
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }

  if (res.ok) {
    alert(data.message || 'Profil mis à jour !');
    lockAll();
  } else {
    alert('Erreur : ' + (data.error || 'Données invalides'));
  }
});

window.addEventListener('DOMContentLoaded', () => {
  loadProfile();

  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '/compteutilisateur/account.html';
  });
});
