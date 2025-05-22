// forgot_password.js
const API_URL = "http://rom-space-game.realdev.cloud:3000"

const errorDiv = document.getElementById('error-message');
const forgotBtn = document.getElementById('forgot-btn');

function showError(msg) {
  errorDiv.classList.add("visible");
  errorDiv.textContent = msg;
}
function hideError() {
  errorDiv.classList.remove("visible");
  errorDiv.textContent = "";
}


forgotBtn.addEventListener('click', async () => {
  hideError();
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) {
    showError("Veuillez renseigner votre adresse email.");
    return;
  }
  try {
    const response = await fetch(`${API_URL}/api/forgot-password`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    if (!response.ok) {
      showError(data.message || "Erreur lors de l'envoi du lien.");
      return;
    }
    // Succès => on affiche un message
    showError(data.message); // ou rediriger vers register.html
  } catch (err) {
    showError("Impossible d'envoyer le lien (erreur réseau).");
  }
});
