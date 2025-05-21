#!/bin/bash

# Vérifie si le fichier .pids existe
if [ ! -f .pids ]; then
  echo "Aucun fichier .pids trouvé. Les processus ne peuvent pas être arrêtés."
  exit 1
fi

# Lire les PID
read -r BACKEND_PID < .pids
read -r FRONTEND_PID < <(tail -n +2 .pids)

echo "Arrêt du backend (PID: $BACKEND_PID)..."
kill "$BACKEND_PID" 2>/dev/null && echo "Backend arrêté." || echo "Échec ou déjà arrêté."

echo "Arrêt du frontend (PID: $FRONTEND_PID)..."
kill "$FRONTEND_PID" 2>/dev/null && echo "Frontend arrêté." || echo "Échec ou déjà arrêté."

# Supprimer le fichier .pids
rm .pids
