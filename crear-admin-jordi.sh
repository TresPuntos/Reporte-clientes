#!/bin/bash

# Probable dominio de Vercel
DOMAINS=(
  "https://reporte-clientes.vercel.app"
  "https://reporte-clientes-git-main-trespuntos.vercel.app"
  "https://trespuntos-reporte-clientes.vercel.app"
)

echo "🔍 Buscando el dominio de Vercel..."
echo ""

# Probar cada dominio
for domain in "${DOMAINS[@]}"; do
  echo "Probando: $domain"
  response=$(curl -s -o /dev/null -w "%{http_code}" "$domain/api/diagnose" 2>/dev/null)
  
  if [ "$response" = "200" ] || [ "$response" = "500" ]; then
    echo "✅ ¡Dominio encontrado: $domain"
    echo ""
    echo "🔐 Creando administrador..."
    echo ""
    
    curl -X POST "$domain/api/admin/create" \
      -H "Content-Type: application/json" \
      -d '{
        "email": "jordi@trespuntoscomunicacion.es",
        "password": "1234",
        "fullname": "Jordi"
      }'
    
    echo ""
    echo ""
    echo "✅ Listo! Ahora puedes:"
    echo "1. Ir a: $domain"
    echo "2. Iniciar sesión con:"
    echo "   Email: jordi@trespuntoscomunicacion.es"
    echo "   Contraseña: 1234"
    echo ""
    exit 0
  fi
done

echo ""
echo "⚠️  No se encontró el dominio automáticamente."
echo ""
echo "Por favor, ejecuta manualmente:"
echo ""
echo 'curl -X POST "https://TU-DOMINIO/api/admin/create" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d "{\"email\":\"jordi@trespuntoscomunicacion.es\",\"password\":\"1234\",\"fullname\":\"Jordi\"}"'
echo ""
echo "Reemplaza TU-DOMINIO con tu dominio de Vercel"
