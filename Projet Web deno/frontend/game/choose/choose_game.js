// choose_game.js
function checkToken() {
  if (!localStorage.getItem("token")) {
    window.location.href = "register.html";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  checkToken();

  // Gestion des boutons
  document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "/auth/login/login.html";
  });

  document.getElementById("user-btn").addEventListener("click", () => {
    window.location.href = "/compteutilisateur/account.html";
  });

  // Gestion des clics sur les boutons Jouer
  const gameRoutes = {
    invaders: "/menu/menu.html",
    guerre: "/game/guerre_menu/guerre_menu.html",
    tetris: "/game/tetris/menu/menutetris.html",
    snake: "/game/snake/home_page/home.html"
  };

  document.querySelectorAll(".game-card").forEach(card => {
    const game = card.dataset.game;
    card.querySelector(".play-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = gameRoutes[game];
    });

    // Clic sur toute la carte
    card.addEventListener("click", () => {
      window.location.href = gameRoutes[game];
    });
  });
});
