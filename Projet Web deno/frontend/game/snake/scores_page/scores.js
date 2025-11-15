// scores.js

// 1) Base de l’API : pointer directement vers "http://localhost:3000/api/snake"
const API_DEFAULT = "https://api.rom-space-game.realdev.cloud";
const API_ORIGIN = (() => {
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
const API_BASE = `${API_ORIGIN}/api/snake`;

/**
 * Role : Récupère depuis le serveur la liste des 10 meilleurs joueurs pour le jeu Snake.
 * Préconditions : 
 *   - La constante `API_BASE` est définie et pointe vers l’URL de l’API.
 *   - `localStorage` contient éventuellement un token JWT sous la clé `"token"`.
 *   - Le serveur expose une route GET `${API_BASE}/leaderboard` retournant un JSON de type tableau.
 * Postconditions : 
 *   - Si la requête réussit (`res.ok`), la fonction retourne la réponse JSON (tableau d’entrées).
 *   - En cas d’erreur réseau ou de réponse non OK, un message d’erreur est loggué et un tableau vide est retourné.
 */

async function loadLeaderboard() {
  const token = localStorage.getItem("token");
  try {
    // appel à /api/snake/leaderboard
    const res = await fetch(`${API_BASE}/leaderboard`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      credentials: "include"
    });
    if (!res.ok) {
      console.error("GET /snake/leaderboard →", res.status, await res.text());
      return [];
    }
    return await res.json();
  } catch (err) {
    console.error("Erreur fetch leaderboard :", err);
    return [];
  }
}

/**
 * Role : Affiche dans le tableau HTML les entrées du classement fournies.
 * Préconditions : 
 *   - L’élément DOM `<table id="leaderboard"><tbody>…</tbody></table>` existe dans la page.
 *   - L’argument `entries` est un tableau d’objets contenant au moins les propriétés `username`, `max_niveau` et `score`.
 * Postconditions : 
 *   - Le `<tbody>` de `#leaderboard` est vidé et rempli d’une ligne par entrée, affichant le rang, le nom d’utilisateur, le niveau max et le score.
 */

function displayLeaderboard(entries) {
  const tbody = document.querySelector("#leaderboard tbody");
  tbody.innerHTML = "";
  entries.forEach((e, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${e.username}</td>
      <td>${e.max_niveau}</td>
      <td>${e.score}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 4) Bouton Retour
document.getElementById("backHomeBtn").addEventListener("click", () => {
  window.location.href = "../home_page/home.html";
});

// 5) Chargement au démarrage
(async () => {
  const entries = await loadLeaderboard();
  displayLeaderboard(entries);
})();
