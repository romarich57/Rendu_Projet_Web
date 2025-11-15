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
    try {
        const resp = await fetch(`${API_URL}/api/leaderboard`);
        if (!resp.ok) throw new Error("Erreur réseau");
        const top10 = await resp.json();
        const tbody = document.getElementById("leaderboard-list");
        tbody.innerHTML = "";

        top10.forEach(({ username, elo }, index) => {
            const tr = document.createElement("tr");
            
            const tdRank = document.createElement("td");
            tdRank.className = "rank-column";
            tdRank.textContent = index + 1;
            
            const tdUsername = document.createElement("td");
            tdUsername.className = "username-column";
            tdUsername.textContent = username;
            
            const tdElo = document.createElement("td");
            tdElo.className = "elo-column";
            tdElo.textContent = elo;

            tr.append(tdRank, tdUsername, tdElo);
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Impossible de charger le leaderboard :", e);
        // Ajouter une notification visuelle
        const container = document.querySelector(".leaderboard-container");
        container.innerHTML = `<p class="error-message">🚨 Échec du chargement du leaderboard</p>`;
    }

    document.getElementById("logout-btn").addEventListener("click", () => {
        window.location.href = "/game/guerre_menu/guerre_menu.html";
    });
});
