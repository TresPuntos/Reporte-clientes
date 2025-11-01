#!/bin/bash

echo ""
echo "========================================="
echo "🚀 Configuración de Vercel - Autenticación"
echo "========================================="
echo ""

# Verificar si vercel CLI está instalado
if ! command -v vercel &> /dev/null; then
    echo "⚠️  Vercel CLI no está instalado."
    echo ""
    echo "Instálalo con:"
    echo "  npm i -g vercel"
    echo ""
    echo "O configura manualmente desde:"
    echo "  https://vercel.com/dashboard"
    echo ""
    exit 1
fi

echo "✅ Vercel CLI detectado"
echo ""

# Verificar si ya está vinculado
if [ -f ".vercel/project.json" ]; then
    echo "✅ Proyecto ya vinculado a Vercel"
    PROJECT_URL=$(cat .vercel/project.json | grep -o '"url":"[^"]*' | cut -d'"' -f4)
    if [ -n "$PROJECT_URL" ]; then
        echo "   URL: $PROJECT_URL"
    fi
else
    echo "⚠️  Proyecto no vinculado. Vinculando..."
    vercel link
fi

echo ""
echo "📋 Configurando variables de entorno..."
echo ""

# JWT_SECRET
read -p "¿Agregar JWT_SECRET a Vercel? (s/n): " add_jwt
if [ "$add_jwt" = "s" ] || [ "$add_jwt" = "S" ]; then
    vercel env add JWT_SECRET
    echo "✅ JWT_SECRET configurado"
fi

echo ""
read -p "¿Agregar ENCRYPTION_KEY? (s/n): " add_enc
if [ "$add_enc" = "s" ] || [ "$add_enc" = "S" ]; then
    vercel env add ENCRYPTION_KEY
    echo "✅ ENCRYPTION_KEY configurado"
fi

echo ""
read -p "¿Agregar POSTGRES_URL? (s/n): " add_db
if [ "$add_db" = "s" ] || [ "$add_db" = "S" ]; then
    vercel env add POSTGRES_URL
    echo "✅ POSTGRES_URL configurado"
fi

echo ""
echo "🚀 Haciendo deploy..."
vercel --prod

echo ""
echo "========================================="
echo "✅ Configuración completada"
echo "========================================="
echo ""
echo "Próximos pasos:"
echo ""
echo "1. Crea tu administrador:"
echo "   curl -X POST https://TU-DOMINIO.vercel.app/api/admin/create \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"tu@email.com\",\"password\":\"TuPass123\",\"fullname\":\"Tu Nombre\"}'"
echo ""
echo "2. Abre tu dominio en el navegador"
echo "3. Inicia sesión con tus credenciales"
echo ""
echo "📖 Lee VERCEL_SETUP_COMPLETO.md para más detalles"
echo ""

