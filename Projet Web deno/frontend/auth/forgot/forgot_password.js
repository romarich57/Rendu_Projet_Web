// forgot_password.js
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
const forgotBtn = document.getElementById('forgot-btn');

function showError(msg) {
  errorDiv.classList.add("visible");
  errorDiv.textContent = msg;
}
function hideError() {
  errorDiv.classList.remove("visible");
  errorDiv.textContent = "";
}


forgotBtn.addEventListener('click', async () => {
  hideError();
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) {
    showError("Veuillez renseigner votre adresse email.");
    return;
  }
  try {
    const response = await fetch(`${API_URL}/api/forgot-password`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    if (!response.ok) {
      showError(data.message || "Erreur lors de l'envoi du lien.");
      return;
    }
    // Succès => on affiche un message
    showError(data.message); // ou rediriger vers register.html
  } catch (err) {
    showError("Impossible d'envoyer le lien (erreur réseau).");
  }
});
