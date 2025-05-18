#!/bin/bash

# Créer les fichiers de log (ou les vider s'ils existent déjà)
: > server_logs.txt
: > front_logs.txt

# Démarrage du backend
echo "Démarrage du backend..."
deno run --allow-sys --allow-read --allow-write --allow-net --allow-env server/server.ts > server_logs.txt 2>&1 &

BACKEND_PID=$!

# Démarrage du frontend
echo "Démarrage du frontend..."
deno run --allow-read --allow-net https://deno.land/std@0.223.0/http/file_server.ts frontend --port 8080 > front_logs.txt 2>&1 &

FRONTEND_PID=$!

# Sauvegarde des PID dans un fichier
echo "$BACKEND_PID" > .pids
echo "$FRONTEND_PID" >> .pids

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

# Optionnel : attend les deux processus
# wait $BACKEND_PID
# wait $FRONTEND_PID
