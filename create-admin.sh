#!/bin/bash

echo "🔐 Creando administrador..."
echo ""
echo "Ingresa los datos del administrador:"
echo ""

read -p "Email: " email
read -sp "Contraseña: " password
echo ""
read -p "Nombre completo: " fullname

echo ""
echo "Creando administrador..."

curl -X POST http://localhost:3000/api/admin/create \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$email\",
    \"password\": \"$password\",
    \"fullname\": \"$fullname\"
  }"

echo ""
echo ""
echo "✅ Comando enviado!"

