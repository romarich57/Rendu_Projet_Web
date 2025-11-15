const statusEl = document.getElementById("status-message");
const loaderEl = document.getElementById("loader");

async function activateAccount() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (!token) {
    showMessage("Lien invalide : aucun jeton fourni.", "error");
    return;
  }
  try {
    const url = `/api/activation?token=${encodeURIComponent(token)}`;
    const response = await fetch(url, { method: "GET" });
    const text = await response.text();
    if (response.ok) {
      showMessage(text || "Compte activé !", "success");
    } else {
      showMessage(text || "Impossible d'activer votre compte.", "error");
    }
  } catch (err) {
    console.error("Activation error", err);
    showMessage("Erreur réseau, veuillez réessayer plus tard.", "error");
  }
}

function showMessage(message, variant) {
  statusEl.textContent = message;
  statusEl.classList.remove("success", "error");
  if (variant === "success" || variant === "error") {
    statusEl.classList.add(variant);
  }
  loaderEl.classList.add("hidden");
}

activateAccount();
