// home.js

// URL de l’API Snake 
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

/**
 * Role : Récupère le niveau maximal débloqué de l’utilisateur via une requête API puis génère dynamiquement 20 boutons de niveaux, en activant les niveaux débloqués et en verrouillant les autres.
 * Préconditions : 
 *   - La constante `API_BASE` est définie et accessible.
 *   - `localStorage` contient éventuellement un token JWT sous la clé `"token"`.
 *   - L’élément DOM d’ID `"levels"` existe sur la page.
 *   - L’API CORS permet les requêtes vers `${API_BASE}/getMaxNiveau`.
 * Postconditions : 
 *   - L’élément `#levels` contient exactement 20 `<button>` avec la classe `"level-btn"`.
 *   - Pour chaque niveau `i` de 1 à `maxNiveau` récupéré, le bouton est activé, étiqueté `Niveau i` et redirige vers le jeu Snake au clic.
 *   - Les niveaux supérieurs à `maxNiveau` sont étiquetés `Niveau i 🔒`, reçoivent la classe `"locked"` et sont désactivés (`disabled = true`).
 */


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
