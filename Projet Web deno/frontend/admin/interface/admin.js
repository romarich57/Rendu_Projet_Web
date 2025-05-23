// admin.js

const API_BASE = 'https://api.rom-space-game.realdev.cloud/api';

async function fetchUsers() {
  const res = await fetch(`${API_BASE}/admin/users`, { credentials: 'include' });
  return res.ok ? res.json() : [];
}

async function fetchScores(userId) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/scores`, { credentials: 'include' });
  return res.ok ? res.json() : [];
}

function renderUsers(users) {
  const tbody = document.querySelector('#users-table tbody');
  tbody.innerHTML = '';
  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.username}</td>
      <td>${u.email}</td>
      <td>${u.verified ? '✅' : '❌'}</td>
      <td>
        <button class="action-btn activate-btn" data-id="${u.id}" ${u.verified ? 'disabled' : ''}>
          Activer
        </button>
        <button class="action-btn view-scores-btn" data-id="${u.id}">
          Voir scores
        </button>
        <button class="action-btn delete-btn" data-id="${u.id}">
          Supprimer
        </button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function renderScores(scores) {
  const tbody = document.querySelector('#scores-table tbody');
  tbody.innerHTML = '';
  scores.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.username}</td>
      <td>${s.game}</td>
      <td>${s.score}</td>`;
    tbody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // logout
  document.getElementById('logout-btn')
    .addEventListener('click', e => {
      e.preventDefault();
      window.location.href = '/compteutilisateur/account.html';
    });
    // bouton Retour dans le panel des scores
document.getElementById('back-btn').addEventListener('click', e => {
  e.preventDefault();
  // masquer Scores, réafficher Utilisateurs
  document.getElementById('scores-panel').classList.remove('active');
  document.getElementById('users-panel').classList.add('active');
});


  // chargement initial
  const users = await fetchUsers();
  renderUsers(users);

  // délégation d’événements sur le tableau
  document.querySelector('#users-table').addEventListener('click', async e => {
    const id = e.target.dataset.id;
    if (e.target.classList.contains('activate-btn')) {
      await fetch(`${API_BASE}/admin/users/${id}/activate`, {
        method: 'PUT', credentials: 'include'
      });
      // recharger la liste
      const re = await fetchUsers();
      renderUsers(re);
    }
    if (e.target.classList.contains('delete-btn')) {
      if (confirm('Supprimer ce compte définitivement ?')) {
        await fetch(`${API_BASE}/admin/users/${id}`, {
          method: 'DELETE', credentials: 'include'
        });
        const re = await fetchUsers();
        renderUsers(re);
      }
    }
    if (e.target.classList.contains('view-scores-btn')) {
      // bascule les panels
      document.querySelector('#users-panel').classList.remove('active');
      document.querySelector('#scores-panel').classList.add('active');
      const scores = await fetchScores(id);
      renderScores(scores);
    }
  });
});
