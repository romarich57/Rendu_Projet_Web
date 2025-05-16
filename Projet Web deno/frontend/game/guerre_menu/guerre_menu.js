// guerre_menu.js

function checkToken() {
  // On lit le token dans localStorage (comme stocké au login)
  const token = localStorage.getItem("token");
  if (!token) {
    // Si pas connecté, redirige vers la page de connexion
    window.location.href = "/auth/login/login.html";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  checkToken();

  const playBtn       = document.getElementById("play-btn");
  const leaderboardBtn = document.getElementById("leaderboard-btn");
  const quitBtn       = document.getElementById("quit-btn");
  const logoutBtn     = document.getElementById("logout-btn");

  // Déconnexion : suppression des infos de session puis retour au login
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.href = "/auth/login/login.html";
  });

  // Démarrer le jeu
  playBtn.addEventListener("click", () => {
    window.location.href = "/game/guerre_vaisseaux/guerre_vaisseaux.html";
  });

  // Ouvrir le leaderboard
  leaderboardBtn.addEventListener("click", () => {
    window.location.href = "/game/guerre_menu/leaderboard/leaderboard.html";
  });

  // Quitter vers le sélecteur de jeux
  quitBtn.addEventListener("click", () => {
    window.location.href = "/game/choose/choose_game.html";
  });
});
