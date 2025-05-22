// reset_password.js
const API_URL = "http://rom-space-game.realdev.cloud:3000"

const errorDiv = document.getElementById('error-message');
const resetBtn = document.getElementById('reset-btn');
const newPassInput = document.getElementById('new-password');
const confirmPassInput = document.getElementById('confirm-password');

// Pour la force du mot de passe
const rocket1 = document.getElementById('rocket1');
const rocket2 = document.getElementById('rocket2');
const rocket3 = document.getElementById('rocket3');

function showError(msg) {
  errorDiv.classList.add("visible");
  errorDiv.textContent = msg;
}
function hideError() {
  errorDiv.classList.remove("visible");
  errorDiv.textContent = "";
}


// Évalue la force du mdp
function evaluatePasswordStrength(pwd) {
  let score = 0;
  if (pwd.length >= 6) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score++;
  // score de 0 à 3
  return score;
}

function updateRockets(score) {
  // Màj des chemins d’images pour correspondre à la nouvelle structure
  rocket1.src = (score >= 1)
    ? "../../assets/images/rocket_filled.png"
    : "/assets/images/rocket_empty.png";
  rocket2.src = (score >= 2)
    ? "../../assets/images/rocket_filled.png"
    : "/assets/images/rocket_empty.png";
  rocket3.src = (score >= 3)
    ? "../../assets/images/rocket_filled.png"
    : "/assets/images/rocket_empty.png";
}

// À chaque saisie du nouveau mdp, on évalue la force
newPassInput.addEventListener('input', () => {
  const pwd = newPassInput.value;
  const s = evaluatePasswordStrength(pwd);
  updateRockets(s);
});

resetBtn.addEventListener('click', async () => {
  hideError();
  const newPassword = newPassInput.value.trim();
  const confirmPassword = confirmPassInput.value.trim();

  if (!newPassword || !confirmPassword) {
    showError("Veuillez remplir tous les champs.");
    return;
  }
  if (newPassword !== confirmPassword) {
    showError("Les mots de passe ne correspondent pas.");
    return;
  }

  // Récupérer le token depuis l'URL
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (!token) {
    showError("Lien invalide (pas de token).");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword })
    });
    const data = await response.json();
    if (!response.ok) {
      showError(data.message || "Erreur lors de la réinitialisation.");
      return;
    }
    // Succès => rediriger vers register.html (ou un message)
    showError(data.message); // ou ...
    setTimeout(() => {
      window.location.href = "/auth/login/login.html";
    }, 1500);
  } catch (err) {
    showError("Impossible de réinitialiser (erreur réseau).");
  }
});
