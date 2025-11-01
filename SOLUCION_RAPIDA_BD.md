# 🚀 Solución Rápida: Conectar Base de Datos (5 minutos)

## Diagnóstico Rápido

Si las API keys no se guardan, es porque la BD no está conectada. Sigue estos pasos:

---

## 📋 PASO A PASO SIMPLIFICADO

### 1️⃣ Ir a Storage en Vercel

1. Ve a: https://vercel.com/dashboard
2. Click en tu proyecto **"reporte-clientes"** (o como se llame)
3. En el menú lateral izquierdo, click en **"Storage"**

### 2️⃣ Crear Base de Datos Neon

1. En Storage, click en **"Create Database"**
2. En el modal que aparece, ve a la sección **"Marketplace Database Providers"**
3. Click en **"Neon"** (el que dice "Serverless Postgres" con logo verde)
4. Click en la **flecha →** o directamente en el card de Neon

### 3️⃣ Configurar Neon

1. Si te pide crear cuenta en Neon:
   - Click en "Sign up" o "Create account"
   - Usa tu email (puede ser el mismo de Vercel)
   - Verifica tu email si te lo piden

2. Cuando estés en Neon:
   - Te pedirá crear un proyecto
   - Nombre: `reporte-clientes-db` (o el que quieras)
   - Región: Elige la más cercana (p ej: `EU West` para Europa)
   - Click en "Create Project"

3. **IMPORTANTE:** Cuando Neon te pregunte "Connect to Vercel Project":
   - Selecciona **"reporte-clientes"** de la lista
   - Click en "Connect" o "Link"

### 4️⃣ Verificar Variables

1. **Vuelve a Vercel** → Tu proyecto → **"Settings"**
2. Click en **"Environment Variables"**
3. Deberías ver:
   ```
   POSTGRES_URL=postgres://...
   ```
   (o puede llamarse `DATABASE_URL`)

4. **Si NO ves la variable:**
   - Ve al dashboard de Neon (neon.tech)
   - Ve a tu proyecto
   - En "Connection Details" copia la connection string
   - Vuelve a Vercel → Settings → Environment Variables
   - Click en "Add New"
   - Name: `POSTGRES_URL`
   - Value: Pega la connection string
   - Click en "Save"

### 5️⃣ Redeploy

1. En Vercel → Tu proyecto → **"Deployments"**
2. Click en los **3 puntos (...)** del último deployment
3. Click en **"Redeploy"**
4. Espera a que termine (1-2 minutos)

### 6️⃣ Probar

1. Ve a: https://reporte-clientes.vercel.app
2. Añade una API key de Toggl
3. Recarga la página (F5)
4. ✅ La API key debería seguir ahí

---

## 🔍 Si Sigue Sin Funcionar

### Verificar Logs:

1. En Vercel → Tu proyecto → **"Deployments"**
2. Click en el último deployment
3. Click en **"Functions"**
4. Busca `/api/api-keys` o `/api/reports`
5. Click para ver los logs
6. **Si ves errores de conexión:**
   - La variable `POSTGRES_URL` no está configurada correctamente
   - O Neon no está conectado al proyecto

### Verificar Variables Manualmente:

```bash
# Estas son las variables que NECESITAS en Vercel:
POSTGRES_URL=postgres://usuario:password@host:5432/database
```

**Cómo obtenerla de Neon:**
1. Ve a neon.tech → Tu proyecto
2. Click en "Connection Details"
3. Copia la "Connection String"
4. Pégala en Vercel como `POSTGRES_URL`

---

## ⚠️ Problema Común: Variable con Nombre Diferente

Si Neon creó la variable como `DATABASE_URL` en lugar de `POSTGRES_URL`:

**Opción A: Añadir POSTGRES_URL**
1. En Vercel → Environment Variables
2. Copia el valor de `DATABASE_URL`
3. Crea una nueva variable llamada `POSTGRES_URL` con el mismo valor

**Opción B: Cambiar el código** (más complejo, no recomendado)

---

## ✅ Checklist Final

- [ ] Neon creado y proyecto configurado
- [ ] Neon conectado al proyecto Vercel "reporte-clientes"
- [ ] Variable `POSTGRES_URL` existe en Vercel → Settings → Environment Variables
- [ ] Redeploy realizado después de conectar
- [ ] Probado añadir API key y recargar
- [ ] API key persiste después de recargar

---

**Si después de seguir estos pasos aún no funciona, comparte:**
1. ¿Qué error ves en los logs de Vercel?
2. ¿Qué variables de entorno tienes en Settings?
3. ¿Neon está conectado al proyecto?

