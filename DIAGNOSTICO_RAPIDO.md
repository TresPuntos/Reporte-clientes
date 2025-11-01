# 🔍 Diagnóstico Rápido

## Verificar Estado de la Base de Datos

He creado un endpoint de diagnóstico. Úsalo así:

**Visita en tu navegador:**
```
https://reporte-clientes.vercel.app/api/diagnose
```

O desde terminal:
```bash
curl https://reporte-clientes.vercel.app/api/diagnose
```

## 📊 Qué te Dirá el Diagnóstico

El endpoint te mostrará:
- ✅ **Variables de entorno:** Si `POSTGRES_URL` está configurada
- ✅ **Conexión:** Si puede conectar a la BD
- ✅ **Tablas:** Si las tablas `reports` y `api_keys` existen
- ✅ **Datos:** Cuántos reportes y API keys hay guardados

## 🔧 Soluciones Según el Diagnóstico

### Si dice "No hay variable POSTGRES_URL configurada"

**Solución:** Necesitas conectar Neon (o Supabase):
1. Ve a Vercel → Tu proyecto → Storage
2. Create Database → Neon
3. Conecta al proyecto

### Si dice "Error de conexión"

**Solución:** La variable existe pero la conexión falla:
1. Ve a Vercel → Settings → Environment Variables
2. Verifica que `POSTGRES_URL` tenga el formato correcto
3. Debe empezar con `postgres://`

### Si dice "Tablas no existen"

**Solución:** Normal, se crearán automáticamente:
1. Simplemente usa la aplicación
2. Intenta añadir una API key
3. Las tablas se crearán solas

---

**Visita el endpoint y comparte conmigo qué dice para poder ayudarte mejor.**

