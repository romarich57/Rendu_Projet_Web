// scoreboardtetris.js

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

window.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("scoreboard-list");

  try {
    // 1) Appel de l'API Top 10 Tetris
    const resp = await fetch(`${API_URL}/api/leaderboard/tetris`, {
      credentials: "include"
    });
    if (!resp.ok) throw new Error(`Erreur ${resp.status}`);
    const topScores = await resp.json();

    // 2) Affichage des lignes
    topScores.forEach((entry, index) => {
      const row = document.createElement("div");
      row.classList.add("row");
      row.innerHTML = `
        <span class="rank">${index + 1}</span>
        <span class="username">${entry.username}</span>
        <span class="score">${entry.best_score.toLocaleString()}</span>
      `;
      container.appendChild(row);
    });
  } catch (err) {
    console.error("Impossible de charger le leaderboard :", err);
    const errorMsg = document.createElement("div");
    errorMsg.textContent = "Échec de chargement du leaderboard.";
    errorMsg.style.color = "red";
    container.appendChild(errorMsg);
  }

  // Déconnexion
  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      localStorage.removeItem("token");
      window.location.href = "/auth/login/login.html";
    };
  }

  // Quitter
  const quitBtn = document.getElementById("btn-quit");
  if (quitBtn) {
    quitBtn.onclick = () => {
      window.location.href = "../menu/menutetris.html";
    };
  }
});
