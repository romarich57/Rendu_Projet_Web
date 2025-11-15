// loginadm.js
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

document.addEventListener('DOMContentLoaded', () => {
  const form      = document.getElementById('admin-login-form');
  const logoutBtn = document.getElementById('logout-btn');

  // Retour vers compte utilisateur
  logoutBtn.addEventListener('click', () => {
    window.location.href = '/compteutilisateur/account.html';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;

    try {
      // On pointe explicitement vers le back (port 3000)
      const res = await fetch(`${API_URL}/admin/login`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ username, password })
      });

      if (res.ok) {
        // Connecté, on redirige vers le portail admin
        window.location.href = '/admin/interface/admin.html';
        return;
      }

      
      let errMsg = 'Identifiants invalides';
      try {
        const data = await res.json();
        errMsg = data.error || errMsg;
      } catch {
        errMsg = await res.text();
      }
      alert(errMsg);

    } catch (networkErr) {
      console.error('Erreur réseau :', networkErr);
      alert('Problème de connexion au serveur');
    }
  });
});
