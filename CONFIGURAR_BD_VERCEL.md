# 🗄️ Configurar Base de Datos en Vercel

## El Problema Actual

Tu aplicación funciona pero:
- ❌ Las API keys no se guardan (desaparecen al recargar)
- ❌ Los reportes no persisten
- ✅ La aplicación compila y funciona

**Razón:** La base de datos Vercel Postgres no está conectada todavía.

---

## ✅ SOLUCIÓN: Pasos para Conectar la BD

### PASO 1: Crear Base de Datos Postgres en Vercel

1. **Ve a tu proyecto en Vercel:**
   - https://vercel.com/dashboard
   - Click en tu proyecto **"Reporte-clientes"**

2. **Navega a Storage:**
   - Click en la pestaña **"Storage"** (en el menú lateral)
   - O ve directamente: Click en **"Create"** → **"Database"**

3. **Crear Postgres:**
   - Selecciona **"Postgres"**
   - Nombre: `reporte-clientes-db` (o el que prefieras)
   - Región: **Europe West** (o la más cercana a ti)
   - Click en **"Create"**

4. **Espera a que se cree** (1-2 minutos)

---

### PASO 2: Conectar la BD a tu Proyecto

**Opción A: Desde el Dashboard de Storage**

1. En la página de la base de datos que acabas de crear
2. Verás un botón **"Connect to Project"** o similar
3. Selecciona tu proyecto **"Reporte-clientes"**
4. Click en **"Connect"**

**Opción B: Manualmente en Settings**

1. En tu proyecto Vercel → **"Settings"**
2. Ve a **"Environment Variables"**
3. Verifica que existan estas variables (Vercel las añade automáticamente):
   - `POSTGRES_URL`
   - `POSTGRES_PRISMA_URL`
   - `POSTGRES_URL_NON_POOLING`

4. Si no están, ve a tu BD en Storage → **"Settings"** → Copia las variables y añádelas manualmente

---

### PASO 3: Redeploy para Activar la BD

Después de conectar la BD, necesitas hacer un nuevo deploy:

1. **En Vercel** → Tu proyecto → **"Deployments"**
2. Click en los **3 puntos (...)** del último deployment
3. Click en **"Redeploy"**
4. **Marca "Use existing Build Cache"** (opcional, pero más rápido)
5. Click en **"Redeploy"**

O simplemente haz un pequeño cambio y push (Vercel desplegará automáticamente)

---

### PASO 4: Verificar que Funciona

1. **Ve a tu aplicación:** https://reporte-clientes.vercel.app
2. **Añade una API key** de Toggl
3. **Recarga la página**
4. ✅ **La API key debería seguir ahí** (se guardó en la BD)

---

## 🔍 Verificar que la BD Está Conectada

### Revisar Logs de Vercel:

1. En Vercel → Tu proyecto → **"Deployments"**
2. Click en el último deployment
3. Ve a **"Functions"** → Busca `/api/api-keys` o `/api/reports`
4. Click para ver los logs
5. **Si ves errores de conexión a BD**, significa que falta configurar las variables

### Verificar Variables de Entorno:

1. En Vercel → Tu proyecto → **"Settings"** → **"Environment Variables"**
2. Deberías ver:
   ```
   POSTGRES_URL=postgres://...
   POSTGRES_PRISMA_URL=postgres://...
   POSTGRES_URL_NON_POOLING=postgres://...
   ```
3. Si no están, añádelas desde la configuración de tu BD

---

## 🗃️ Migrar Datos Antiguos (Si tenías reportes)

Si tenías reportes guardados localmente en `data/client-reports.json`:

1. **Sube ese archivo a algún lugar temporal** (GitHub Gist, Google Drive, etc.)
2. **Después de conectar la BD**, visita:
   ```
   https://reporte-clientes.vercel.app/api/migrate
   ```
3. O ejecuta:
   ```bash
   curl -X POST https://reporte-clientes.vercel.app/api/migrate
   ```

**Nota:** Esta ruta de migración solo funciona si el archivo JSON está en el repositorio. Si lo moviste, tendrás que recrear los reportes.

---

## ⚠️ Problemas Comunes

### Error: "Failed to initialize database"

**Causa:** Variables de entorno no configuradas
**Solución:** Verifica que `POSTGRES_URL` esté en Environment Variables

### Error: "Connection timeout"

**Causa:** BD no está creada o no está conectada al proyecto
**Solución:** Asegúrate de que la BD esté creada y conectada

### Las API keys siguen desapareciendo

**Causa:** La BD no está inicializada o hay errores de conexión
**Solución:** 
1. Revisa los logs en Vercel → Functions
2. Verifica que las tablas se crearon: En Storage → Tu BD → "Data" → Deberías ver tablas `reports` y `api_keys`

---

## 📝 Checklist Final

- [ ] BD Postgres creada en Vercel
- [ ] BD conectada al proyecto
- [ ] Variables de entorno configuradas (`POSTGRES_URL`, etc.)
- [ ] Nuevo deploy realizado
- [ ] Probado añadir API key y recargar página
- [ ] API key persiste después de recargar

---

**Una vez completes estos pasos, todo debería funcionar correctamente y los datos persistirán en la base de datos.**

