# 🚀 Guía Paso a Paso: Desplegar en Vercel + Vercel Postgres

Esta guía te llevará paso a paso desde tu código local hasta tener tu aplicación funcionando en producción con Vercel Postgres.

---

## 📋 PREREQUISITOS

- ✅ Cuenta de Vercel (ya la tienes)
- ✅ Proyecto en GitHub (o preparado para subirlo)
- ✅ Node.js instalado localmente (para probar antes de desplegar)

---

## 📦 PASO 1: Instalar Dependencias

Primero, instala la nueva dependencia que hemos añadido:

```bash
npm install
```

Esto instalará `@vercel/postgres` que es necesario para conectar con la base de datos.

**Verifica que se instaló correctamente:**
```bash
npm list @vercel/postgres
```

---

## 🔧 PASO 2: Preparar el Repositorio de GitHub

### 2.1. Si tu proyecto NO está en GitHub aún:

```bash
# Desde la raíz del proyecto
git init
git add .
git commit -m "Migración a Vercel Postgres - Listo para producción"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

### 2.2. Si tu proyecto YA está en GitHub:

```bash
# Asegúrate de que todos los cambios están guardados
git add .
git commit -m "Migración a Vercel Postgres"
git push
```

---

## 🗄️ PASO 3: Crear Base de Datos en Vercel

1. **Inicia sesión en Vercel:**
   - Ve a [vercel.com](https://vercel.com) e inicia sesión

2. **Navega a Storage:**
   - En el dashboard, haz clic en **"Storage"** en el menú lateral
   - O ve directamente a: `https://vercel.com/dashboard/storage`

3. **Crear Postgres Database:**
   - Haz clic en **"Create Database"**
   - Selecciona **"Postgres"**
   - Asigna un nombre (ej: `reporte-clientes-db`)
   - Selecciona la región más cercana a ti (ej: `Europe West`)
   - Haz clic en **"Create"**

4. **Espera a que se cree:**
   - Puede tardar 1-2 minutos
   - Verás un indicador de progreso

5. **Anota las credenciales:**
   - Una vez creada, Vercel te mostrará:
     - `POSTGRES_URL`
     - `POSTGRES_PRISMA_URL`
     - `POSTGRES_URL_NON_POOLING`
   - **NO necesitas copiarlas manualmente**, Vercel las añadirá automáticamente cuando conectes el proyecto

---

## 🚀 PASO 4: Conectar Proyecto en Vercel

1. **Nuevo Proyecto:**
   - En el dashboard de Vercel, haz clic en **"Add New..."** → **"Project"**
   - O ve a: `https://vercel.com/new`

2. **Importar desde GitHub:**
   - Selecciona tu repositorio de GitHub
   - Si no aparece, haz clic en **"Adjust GitHub App Permissions"** y autoriza los repositorios

3. **Configurar Proyecto:**
   - **Framework Preset:** Vercel debería detectar automáticamente "Next.js"
   - **Root Directory:** `.` (dejar por defecto)
   - **Build Command:** `npm run build` (debería estar automático)
   - **Output Directory:** `.next` (debería estar automático)
   - **Install Command:** `npm install` (debería estar automático)

4. **Conectar la Base de Datos:**
   - En la sección **"Storage"** o **"Environment Variables"**
   - Verás una opción para conectar tu base de datos Postgres
   - Selecciona la base de datos que creaste en el Paso 3
   - Vercel añadirá automáticamente las variables de entorno necesarias

5. **Desplegar:**
   - Haz clic en **"Deploy"**
   - Espera a que termine el build (2-5 minutos)

---

## 🔐 PASO 5: Verificar Variables de Entorno

Después del primer deploy, verifica que las variables estén configuradas:

1. **Ve a tu proyecto en Vercel:**
   - Click en tu proyecto → **"Settings"** → **"Environment Variables"**

2. **Verifica que existan:**
   - `POSTGRES_URL`
   - `POSTGRES_PRISMA_URL` 
   - `POSTGRES_URL_NON_POOLING`

3. **Si no están:**
   - Ve a la base de datos que creaste
   - Copia las variables manualmente
   - Añádelas en **Settings → Environment Variables**

---

## 🗃️ PASO 6: Migrar Datos (Si tienes datos existentes)

Si tienes datos en `data/client-reports.json` que quieres migrar:

### Opción A: Migración Automática (Recomendado)

1. **Después del primer deploy, visita:**
   ```
   https://TU_PROYECTO.vercel.app/api/migrate
   ```

2. **O ejecuta desde terminal:**
   ```bash
   curl -X POST https://TU_PROYECTO.vercel.app/api/migrate
   ```

3. **Verifica el resultado:**
   - Deberías ver un JSON con el número de reportes migrados

### Opción B: Migración Manual

Si prefieres migrar manualmente o la automática falla, puedes crear un script temporal:

```typescript
// scripts/migrate.ts (temporal)
import { promises as fs } from 'fs';
import { initializeDatabase, saveReportToDB } from '../lib/db';
import type { ClientReport } from '../lib/report-types';

async function migrate() {
  await initializeDatabase();
  const data = await fs.readFile('./data/client-reports.json', 'utf-8');
  const reports: ClientReport[] = JSON.parse(data);
  
  for (const report of reports) {
    await saveReportToDB(report);
    console.log(`Migrated: ${report.name}`);
  }
}

migrate();
```

---

## 🌐 PASO 7: Configurar Dominio Personalizado

1. **Ve a tu proyecto en Vercel:**
   - Click en **"Settings"** → **"Domains"**

2. **Añadir dominio:**
   - Escribe: `reportes.trespuntoscomunicacion.es`
   - Haz clic en **"Add"**

3. **Configurar DNS:**
   - Vercel te mostrará instrucciones
   - Normalmente necesitas añadir un registro **CNAME** en tu proveedor DNS:
     ```
     Tipo: CNAME
     Nombre: reportes
     Valor: cname.vercel-dns.com
     TTL: 3600
     ```

4. **Esperar propagación:**
   - Puede tardar desde minutos hasta 24 horas
   - Verifica en Vercel cuando esté listo (aparecerá un check verde)

---

## ✅ PASO 8: Verificar que Todo Funciona

1. **Visita tu sitio:**
   - `https://TU_PROYECTO.vercel.app`
   - O tu dominio personalizado si ya está configurado

2. **Prueba las funcionalidades:**
   - ✅ Añadir una API key de Toggl
   - ✅ Crear un reporte
   - ✅ Ver reportes existentes
   - ✅ Acceder a un reporte público por URL

3. **Verifica la base de datos:**
   - En Vercel → Storage → Tu BD → **"Data"**
   - Deberías ver las tablas `reports` y `api_keys` con datos

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Error: "Failed to initialize database"
- **Causa:** La BD no está conectada o las variables de entorno no están configuradas
- **Solución:** 
  1. Ve a Settings → Environment Variables
  2. Verifica que `POSTGRES_URL` esté configurada
  3. Haz un nuevo deploy después de añadir variables

### Error: "Module not found: @vercel/postgres"
- **Causa:** La dependencia no se instaló
- **Solución:**
  1. Verifica que `package.json` incluya `"@vercel/postgres": "^0.11.1"`
  2. Hace `git add package.json package-lock.json && git commit && git push`

### Los reportes no aparecen
- **Causa:** No se ejecutó la migración o los datos no están en la BD
- **Solución:**
  1. Ejecuta `/api/migrate` (ver Paso 6)
  2. O añade un reporte nuevo y verifica que se guarda

### Las API keys no se guardan
- **Causa:** El endpoint `/api/api-keys` no está funcionando
- **Solución:**
  1. Abre la consola del navegador (F12)
  2. Verifica errores en la pestaña "Network"
  3. Revisa los logs en Vercel → Deployments → Tu deploy → "Functions"

---

## 📝 CHECKLIST FINAL

Antes de considerar todo listo, verifica:

- [ ] Proyecto desplegado en Vercel sin errores
- [ ] Base de datos Postgres creada y conectada
- [ ] Variables de entorno configuradas
- [ ] Datos migrados (si tenías datos previos)
- [ ] Dominio configurado (opcional pero recomendado)
- [ ] Funcionalidades principales probadas y funcionando
- [ ] HTTPS activo (automático en Vercel)

---

## 🎉 ¡LISTO!

Tu aplicación debería estar funcionando en producción. Si encuentras algún problema, revisa los logs en Vercel o consulta la sección de solución de problemas.

**URLs útiles:**
- Dashboard de Vercel: https://vercel.com/dashboard
- Storage/Databases: https://vercel.com/dashboard/storage
- Logs de tu proyecto: Vercel → Tu Proyecto → Deployments → Click en un deploy → "Functions"

---

**¿Tienes dudas?** Los logs de Vercel son tu mejor amigo. Siempre muestran errores detallados si algo falla.

