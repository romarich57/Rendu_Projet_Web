// menutetris.js
document.addEventListener("DOMContentLoaded", () => {
    const btnPlay    = document.getElementById("btn-jouer");
    const btnScore   = document.getElementById("btn-score");
    const btnQuitter = document.getElementById("btn-quitter");
    const btnPower   = document.getElementById("btn-power");
  
    // Lance la partie
    btnPlay?.addEventListener("click", () => {
      window.location.href = "../jeu/tetris.html";
    });
  
    // Ouvre le scoreboard
    btnScore?.addEventListener("click", () => {
      window.location.href = "../scoreboard/scoreboardtetris.html";
    });
  
    // Retour au choix de jeux
    btnQuitter?.addEventListener("click", () => {
      window.location.href = "/game/choose/choose_game.html";
    });
  
    // Déconnexion totale
    btnPower?.addEventListener("click", () => {
      localStorage.removeItem("token");
      window.location.href = "/auth/login/register.html";
    });
  });
  