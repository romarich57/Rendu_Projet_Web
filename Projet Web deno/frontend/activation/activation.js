const statusEl = document.getElementById("status-message");
const loaderEl = document.getElementById("loader");

async function activateAccount() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (!token) {
    console.warn("[activation-page] Aucun token trouvé dans l'URL.");
    showMessage("Lien invalide : aucun jeton fourni.", "error");
    return;
  }
  console.log("[activation-page] Token extrait:", token);
  try {
    const url = `/api/activation?token=${encodeURIComponent(token)}`;
    console.log("[activation-page] Requête envoyée vers:", url);
    const response = await fetch(url, { method: "GET" });
    const text = await response.text();
    console.log("[activation-page] Réponse reçue:", response.status, text);
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
