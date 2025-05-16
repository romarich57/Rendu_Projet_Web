// Vérifie la présence du token au chargement
function checkToken() {
  const token = localStorage.getItem("token");
  if (!token) {
    // Pas connecté, on force la page login
    window.location.href = "login.html";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  // Au chargement de la page, on vérifie le token
  checkToken();

  // Récupération des boutons
  const playBtn = document.getElementById("play-btn");
  const scoreBtn = document.getElementById("score-btn");
  const quitBtn = document.getElementById("quit-btn");

  // -------- NOUVEAU : bouton Déconnexion en haut à gauche --------
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "/auth/login/login.html"; // mise à jour du chemin vers le login
  });
  // --------------------------------------------------------------

  // Au clic sur "Commencer le jeu"
  playBtn.addEventListener("click", () => {
    // Renvoie vers index.html (Space Invaders)
    window.location.href = "/game/invaders/invaders.html";
  });

  // Au clic sur "ScoreBoard"
  scoreBtn.addEventListener("click", () => {
    window.location.href = "/game/scoreboard/scoreboard.html"
  });

  // Au clic sur "Quitter le jeu" => redirige désormais vers choose_game.html
  quitBtn.addEventListener("click", () => {
    // On ne supprime plus le token
    window.location.href = "/game/choose/choose_game.html";
  });
});
