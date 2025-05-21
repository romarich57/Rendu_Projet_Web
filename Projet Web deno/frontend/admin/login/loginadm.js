// loginadm.js
document.addEventListener('DOMContentLoaded', () => {
  const form      = document.getElementById('admin-login-form');
  const logoutBtn = document.getElementById('logout-btn');

  // Retour vers compte utilisateur
  logoutBtn.addEventListener('click', () => {
    window.location.href = '/compteutilisateur/account.html';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;

    try {
      // On pointe explicitement vers le back (port 3000)
      const res = await fetch('/api/admin/login', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ username, password })
      });

      if (res.ok) {
        // Connecté, on redirige vers le portail admin
        window.location.href = '/admin/interface/admin.html';
        return;
      }

      // En cas d'erreur 4xx/5xx, on essaie de parser le JSON,
      // sinon on récupère le texte brut.
      let errMsg = 'Identifiants invalides';
      try {
        const data = await res.json();
        errMsg = data.error || errMsg;
      } catch {
        errMsg = await res.text();
      }
      alert(errMsg);

    } catch (networkErr) {
      console.error('Erreur réseau :', networkErr);
      alert('Problème de connexion au serveur');
    }
  });
});
