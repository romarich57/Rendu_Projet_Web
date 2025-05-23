// scores.js

// 1) Base de l’API : pointer directement vers "http://localhost:3000/api/snake"
const API_BASE = "https://api.rom-space-game.realdev.cloud/api/snake";

// 2) Charger le top 10 depuis le serveur
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

// 3) Afficher dans le tableau
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
