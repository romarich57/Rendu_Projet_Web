// securite.js

// Déconnexion (retour arrière)
document.getElementById('logout-btn').addEventListener('click', () => {
  window.history.back();
});

// Redirection vers la page de reset
document.querySelector('.security-card').addEventListener('click', () => {
  window.location.href = '/auth/forgot/forgot_password.html';
});
