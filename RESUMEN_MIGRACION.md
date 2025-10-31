# 📋 Resumen de la Migración a Vercel Postgres

## ✅ Cambios Realizados

### 1. **Nuevas Dependencias**
- `@vercel/postgres`: Cliente oficial de Vercel para PostgreSQL

### 2. **Nuevos Archivos Creados**
- `lib/db.ts`: Módulo de conexión y funciones de base de datos
- `app/api/api-keys/route.ts`: API para gestionar API keys en BD
- `app/api/migrate/route.ts`: Endpoint para migrar datos de JSON a BD
- `GUIA_VERCEL.md`: Guía paso a paso para desplegar en Vercel
- `backup/backup_20251031_173525_funcional_json/`: Copia de seguridad completa

### 3. **Archivos Modificados**
- `package.json`: Añadida dependencia `@vercel/postgres`
- `app/api/reports/route.ts`: Migrado de JSON a Postgres
- `app/api/reports/[publicUrl]/route.ts`: Migrado de JSON a Postgres
- `components/api-key-manager.tsx`: Migrado de localStorage a BD
- `lib/report-types.ts`: Sin cambios (mantiene compatibilidad)

### 4. **Estructura de Base de Datos**

#### Tabla `reports`
- `id` (VARCHAR, PK): ID único del reporte
- `name` (VARCHAR): Nombre del reporte
- `package_id` (VARCHAR, nullable): ID del paquete
- `total_hours` (INTEGER): Horas totales
- `price` (DECIMAL, nullable): Precio
- `start_date`, `end_date` (VARCHAR): Fechas
- `created_at`, `last_updated` (VARCHAR): Timestamps
- `public_url` (VARCHAR, UNIQUE): URL pública única
- `is_active` (BOOLEAN): Si está activo
- `active_tag` (VARCHAR, nullable): Tag activo
- `data` (JSONB): Todo el objeto ClientReport completo
- `created_on` (TIMESTAMP): Timestamp automático

#### Tabla `api_keys`
- `id` (VARCHAR, PK): ID único de la API key
- `key_hash` (VARCHAR): Hash simple para identificación
- `key_encrypted` (TEXT): API key cifrada con AES-256-CBC
- `fullname`, `email` (VARCHAR): Datos del usuario
- `workspaces`, `clients`, `projects`, `tags` (JSONB): Datos de Toggl
- `created_at`, `updated_at` (TIMESTAMP): Timestamps automáticos

---

## 🔒 Seguridad

### Cifrado de API Keys
- Las API keys se cifran usando **AES-256-CBC** antes de guardarse
- Se usa una clave de cifrado (configurable vía `ENCRYPTION_KEY`)
- En producción, define `ENCRYPTION_KEY` en variables de entorno de Vercel

### Variables de Entorno Necesarias
Vercel las añade automáticamente al conectar la BD:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

Opcional (recomendado en producción):
- `ENCRYPTION_KEY`: Clave hexadecimal de 64 caracteres para cifrar API keys

---

## 🚀 Pasos para Desplegar

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Subir a GitHub:**
   ```bash
   git add .
   git commit -m "Migración a Vercel Postgres"
   git push
   ```

3. **Seguir la guía:**
   - Abre `GUIA_VERCEL.md`
   - Sigue los pasos del 3 al 8

---

## 📊 Migración de Datos

Si tienes datos existentes en `data/client-reports.json`:

1. **Después del deploy, visita:**
   ```
   https://TU_PROYECTO.vercel.app/api/migrate
   ```
   O ejecuta: `curl -X POST https://TU_PROYECTO.vercel.app/api/migrate`

2. **Verifica el resultado:**
   - Deberías ver cuántos reportes se migraron

---

## ⚠️ Compatibilidad

- ✅ **Backward compatible:** El código mantiene fallbacks a localStorage
- ✅ **Sin romper funcionalidad:** Si la BD falla, intenta usar localStorage
- ✅ **Migración automática:** La BD se inicializa automáticamente en el primer uso

---

## 🔄 Rollback

Si necesitas volver a la versión anterior:

1. Ve a `backup/backup_20251031_173525_funcional_json/`
2. Restaura los archivos según las instrucciones en el README del backup
3. Elimina la dependencia `@vercel/postgres` del `package.json`

---

## 📝 Notas Importantes

- **La BD se inicializa automáticamente** la primera vez que se usa
- **Las tablas se crean con `IF NOT EXISTS`** para evitar errores
- **Los reportes se guardan como JSONB** para mantener flexibilidad
- **Las API keys se cifran** antes de guardarse
- **Hay fallbacks a localStorage** para desarrollo local sin BD

---

## 🎯 Próximos Pasos Recomendados

1. **Configurar `ENCRYPTION_KEY`** en Vercel para mayor seguridad
2. **Probar todas las funcionalidades** después del deploy
3. **Migrar datos existentes** si los tienes
4. **Configurar dominio personalizado** (`reportes.trespuntoscomunicacion.es`)
5. **Revisar logs** en Vercel si algo no funciona

---

**Estado:** ✅ Código listo para producción
**Backup:** ✅ Disponible en `backup/backup_20251031_173525_funcional_json/`
**Guía:** ✅ Disponible en `GUIA_VERCEL.md`

