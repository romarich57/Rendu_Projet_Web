// guerre_menu.js

function checkToken() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/auth/login/login.html";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  checkToken();

  const playBtn        = document.getElementById("play-btn");
  const leaderboardBtn = document.getElementById("leaderboard-btn");
  const quitBtn        = document.getElementById("quit-btn");
  const logoutBtn      = document.getElementById("logout-btn");

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.href = "/auth/login/login.html";
  });

  playBtn.addEventListener("click", () => {
    window.location.href = "/game/guerre_vaisseaux/guerre_vaisseaux.html";
  });

  leaderboardBtn.addEventListener("click", () => {
    window.location.href = "/game/guerre_menu/leaderboard/leaderboard.html";
  });

  quitBtn.addEventListener("click", () => {
    window.location.href = "/game/choose/choose_game.html";
  });
});
