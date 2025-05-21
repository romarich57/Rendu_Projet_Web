const API_URL = "";

function checkToken() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/auth/login/register.html";
  }
}

function switchActive(selected, other) {
  selected.classList.add("active");
  other.classList.remove("active");
}

// Chargement des en-têtes et des lignes
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

async function loadTopScores() {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/api/scores/top`, {
    headers: { "Authorization": "Bearer " + token }
  });
  if (!res.ok) throw new Error("Erreur récupération Top Scores");
  const data = await res.json();
  renderScoresTable(data);
}

async function loadTopXp() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/api/scores/top-xp`, {
    headers: { "Authorization": "Bearer " + token }
  });

  if (!res.ok) throw new Error("Erreur récupération Top XP");
  const data = await res.json();
  renderXpTable(data);
}

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
