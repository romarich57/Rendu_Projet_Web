// home.js

// URL de l’API Snake (ajuste le port si nécessaire pour pointer vers ton backend)
const API_BASE = "/api/snake";

// 1) Boutons de navigation
document.getElementById("playBtn").addEventListener("click", async () => {
  document.getElementById("buttons").classList.add("hidden");
  document.getElementById("levelSelection").classList.remove("hidden");
  await populateLevels();
});
document.getElementById("scoresBtn").addEventListener("click", () => {
  window.location.href = "../scores_page/scores.html";
});
document.getElementById("quitBtn").addEventListener("click", () => {
  window.location.href = "/game/choose/choose_game.html";
});
document.getElementById("backBtn").addEventListener("click", () => {
  document.getElementById("levelSelection").classList.add("hidden");
  document.getElementById("buttons").classList.remove("hidden");
});

// 2) Construire dynamiquement 20 niveaux et activer seulement ceux qui sont débloqués
async function populateLevels() {
  const container = document.getElementById("levels");
  container.innerHTML = "";

  let unlocked = 1;
  const token = localStorage.getItem("token");

  // 2.1) Appel à l’API pour récupérer le niveau max en passant le JWT
  try {
    const res = await fetch(`${API_BASE}/getMaxNiveau`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    if (res.ok) {
      const { maxNiveau } = await res.json();
      unlocked = typeof maxNiveau === "number" ? maxNiveau : 1;
    } else {
      console.error("GET /getMaxNiveau →", res.status, await res.text());
    }
  } catch (err) {
    console.error("Erreur lors du chargement du niveau max :", err);
  }

  // 2.2) Génération des boutons selon 'unlocked'
  for (let i = 1; i <= 20; i++) {
    const btn = document.createElement("button");
    btn.className = "level-btn";

    if (i <= unlocked) {
      btn.textContent = `Niveau ${i}`;
      btn.addEventListener("click", () => {
        window.location.href = `../game_snake/index.html?level=${i}`;
      });
    } else {
      btn.textContent = `Niveau ${i} 🔒`;
      btn.classList.add("locked");
      btn.disabled = true;
    }

    container.appendChild(btn);
  }
}
