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

/**
 * Role : Vérifie la présence d’un token d’authentification dans le stockage local et redirige vers la page de login si aucun token n’est présent.
 */
function checkToken() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/auth/login/login.html";
  }
}

/**
 * Role : Bascule visuellement l’état “actif” entre deux éléments en ajoutant la classe `active` au premier et en la retirant du second.
 */
function switchActive(selected, other) {
  selected.classList.add("active");
  other.classList.remove("active");
}

// Role : Remplit le tableau des meilleurs scores (Rank, Player, Score, XP, Level, Wave) à partir d’un tableau de données.
function renderScoresTable(data) {
  const headers = document.getElementById("table-headers");
  headers.innerHTML =
    `<th>Rank</th>
     <th>Player</th>
     <th>Score</th>
     <th>XP</th>
     <th>Level</th>
     <th>Wave</th>`;

  const body = document.getElementById("table-body");
  body.innerHTML = "";
  data.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${row.player}</td>
      <td>${row.score}</td>
      <td>${row.xp}</td>
      <td>${row.level}</td>
      <td>${row.wave}</td>`;
    body.appendChild(tr);
  });
}
//Remplit le tableau des meilleurs gains d’XP (Rank, Player, XP) à partir d’un tableau de données.
function renderXpTable(data) {
  const headers = document.getElementById("table-headers");
  headers.innerHTML =
    `<th>Rank</th>
     <th>Player</th>
     <th>XP</th>`;

  const body = document.getElementById("table-body");
  body.innerHTML = "";
  data.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${row.player}</td>
      <td>${row.xp}</td>`;
    body.appendChild(tr);
  });
}

/**
 * Role : Charge depuis l’API les meilleurs scores et les affiche via renderScoresTable().
 */
async function loadTopScores() {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/api/scores/top`, {
    headers: { "Authorization": "Bearer " + token }
  });
  if (!res.ok) throw new Error("Erreur récupération Top Scores");
  const data = await res.json();
  renderScoresTable(data);
}

/**
 * Role : Charge depuis l’API le classement des meilleurs gains d’XP et les affiche via renderXpTable().
 */

async function loadTopXp() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/api/scores/top-xp`, {
    headers: { "Authorization": "Bearer " + token }
  });

  if (!res.ok) throw new Error("Erreur récupération Top XP");
  const data = await res.json();
  renderXpTable(data);
}

/**
 * Role : Initialise la page au chargement du DOM : vérification du token, configuration des onglets Scores/XP et affichage initial des scores.
 */

document.addEventListener("DOMContentLoaded", () => {
  checkToken();

  const tabScores = document.getElementById("top-scores-tab");
  const tabXp     = document.getElementById("top-xp-tab");

  tabScores.addEventListener("click", () => {
    switchActive(tabScores, tabXp);
    loadTopScores();
  });

  tabXp.addEventListener("click", () => {
    switchActive(tabXp, tabScores);
    loadTopXp();
  });

  // Affichage initial
  loadTopScores();

    /* ─── Déconnexion ────────────────────────────────────────────── */
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.addEventListener("click", () => {
  window.location.href = "/menu/menu.html";
  });
});
