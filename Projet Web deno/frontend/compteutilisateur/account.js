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

// account.js
document.addEventListener('DOMContentLoaded', () => {
  // --- Chargement du nom utilisateur ---
  async function loadUserData() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/user/profile`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const userData = await res.json();
      const nameEl = document.getElementById('cyber-username');
      if (nameEl) {
        nameEl.textContent = userData.username.toUpperCase();
      }
    } catch (err) {
      console.error('loadUserData error:', err);
      const nameEl = document.getElementById('cyber-username');
      if (nameEl) {
        nameEl.textContent = 'VISITEUR SPATIAL';
      }
    }
  }

  // --- Navigation entre pages ---
  const navMap = [
    { id: 'nav-profile',    url: 'profil/profile.html' },
    { id: 'nav-security',   url: 'sécurité/securite.html' },
    { id: 'nav-tutorials',  url: 'tuto/tutoriels.html' },
    { id: 'nav-admin',      url: '../admin/login/loginadm.html' }
  ];

  navMap.forEach(({ id, url }) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', () => {
        window.location.href = url;
      });
    }
  });

  // --- Déconnexion ---
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      window.location.href = '/game/choose/choose_game.html';
    });
  }

  // --- Initialisation ---
  loadUserData();
});
