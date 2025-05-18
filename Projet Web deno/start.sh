#!/bin/bash

# Créer les fichiers de log (ou les vider s'ils existent déjà)
: > server_logs.txt
: > front_logs.txt

# Démarrage du backend
echo "Démarrage du backend..."
deno run --allow-sys --allow-read --allow-write --allow-net --allow-env server/server.ts > server_logs.txt 2>&1 &

# Enregistre le PID du backend
BACKEND_PID=$!

# Démarrage du frontend
echo "Démarrage du frontend..."
deno run --allow-read --allow-net https://deno.land/std@0.223.0/http/file_server.ts frontend --port 8080 > front_logs.txt 2>&1 &

# Enregistre le PID du frontend
FRONTEND_PID=$!

# Affiche les PID pour référence
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

# Attendre que les deux processus se terminent
wait $BACKEND_PID
wait $FRONTEND_PID
