# 🔐 Guía de Configuración de Autenticación

## ✅ Lo que acabamos de implementar

Se ha implementado un sistema completo de autenticación con **dos niveles**:

### 1. 🔑 Login de Administrador
- Protege todo el panel de administración (`/`)
- Usa JWT con cookies seguras
- Requiere autenticación para crear/editar/eliminar reportes y API keys
- Sesión de 24 horas

### 2. 🛡️ Protección de Reportes (Opcional)
- Cada reporte puede tener una contraseña opcional
- Los clientes ven una pantalla de login si el reporte está protegido
- La sesión dura mientras la pestaña esté abierta

---

## 🚀 Configuración Inicial

### Paso 1: Configurar Variables de Entorno

Agrega estas variables a tu archivo `.env.local` (desarrollo) y en Vercel (producción):

```bash
# JWT Secret (cambiar en producción)
JWT_SECRET=tu-clave-secreta-muy-larga-y-aleatoria-aqui-cambiar-en-produccion

# Encryption Key (ya deberías tenerla)
ENCRYPTION_KEY=tu-clave-hexadecimal-32-bytes
```

**⚠️ IMPORTANTE:** Usa una clave JWT larga y aleatoria en producción. Puedes generar una con:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Paso 2: Crear el Primer Administrador

Tienes **3 opciones**:

#### Opción A: Usando la API (Recomendado)

```bash
# Desde tu terminal
curl -X POST http://localhost:3000/api/admin/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@tudominio.com",
    "password": "TuPasswordSeguro123",
    "fullname": "Administrador Principal"
  }'
```

#### Opción B: Usando Postman/Thunder Client

POST a `http://localhost:3000/api/admin/create` con body:
```json
{
  "email": "admin@tudominio.com",
  "password": "TuPasswordSeguro123",
  "fullname": "Administrador Principal"
}
```

#### Opción C: Desde el Navegador (Node.js)

1. Abre la consola del navegador
2. Ejecuta:
```javascript
fetch('/api/admin/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@tudominio.com',
    password: 'TuPasswordSeguro123',
    fullname: 'Administrador Principal'
  })
}).then(r => r.json()).then(console.log)
```

### Paso 3: Verificar que Funciona

1. Abre `http://localhost:3000`
2. Deberías ver la pantalla de login
3. Inicia sesión con tus credenciales
4. ✅ Ya estás dentro del panel de administración

---

## 📋 Configuración en Vercel (Producción)

1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Environment Variables
3. Agrega:
   - `JWT_SECRET`: Genera una clave aleatoria larga
   - `ENCRYPTION_KEY`: Tu clave de cifrado (hex)
4. Redeploy

**Después del deploy**, crea el admin usando la API de producción:
```bash
curl -X POST https://tu-dominio.com/api/admin/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@tudominio.com",
    "password": "TuPasswordSeguro123",
    "fullname": "Administrador Principal"
  }'
```

---

## 🔧 Comandos Útiles

### Inicializar Base de Datos
Si las tablas no se crearon automáticamente:
```bash
curl http://localhost:3000/api/diagnose
```
Esto creará todas las tablas necesarias.

### Verificar Autenticación
```bash
curl http://localhost:3000/api/auth/verify \
  --cookie-jar cookies.txt \
  --cookie cookies.txt
```

### Cerrar Sesión
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  --cookie-jar cookies.txt \
  --cookie cookies.txt
```

---

## 🔒 Proteger un Reporte con Contraseña

Cuando crees un reporte desde la UI, aún no hay opción en el formulario. Para agregar protección:

**Opción 1:** Modificar directamente en el código donde se genera el reporte
**Opción 2:** Editar en la BD (se puede hacer después)

Ejemplo de cómo agregar password a un reporte:
```typescript
import { hashPassword } from '@/lib/auth';

// Al crear un reporte
const report: ClientReport = {
  // ... otros campos
  passwordHash: await hashPassword('password_del_cliente'),
};
```

---

## 📁 Archivos Creados/Modificados

### Nuevos Archivos:
- `lib/auth.ts` - Funciones de autenticación JWT
- `app/api/auth/login/route.ts` - Endpoint de login
- `app/api/auth/logout/route.ts` - Endpoint de logout
- `app/api/auth/verify/route.ts` - Verificar sesión
- `app/api/admin/create/route.ts` - Crear admin
- `app/api/reports/[publicUrl]/check-password/route.ts` - Verificar password de reporte
- `app/login/page.tsx` - Pantalla de login
- `middleware.ts` - Protección de rutas
- `INSTRUCCIONES_AUTH.md` - Esta guía

### Archivos Modificados:
- `lib/db.ts` - Tabla de admins y campo password_hash en reports
- `lib/report-types.ts` - Interface ClientReport con passwordHash
- `app/page.tsx` - Verificación de auth y botón logout
- `components/client-report-dashboard.tsx` - Login para reportes protegidos

---

## 🐛 Solución de Problemas

### "No autorizado" al acceder
- Verifica que `JWT_SECRET` esté configurado
- Revisa las cookies del navegador
- Prueba cerrar sesión y volver a iniciar

### "No se puede conectar a la BD"
- Verifica `POSTGRES_URL` o `DATABASE_URL`
- Ejecuta `/api/diagnose` para ver el estado
- Asegúrate de que la BD esté correctamente conectada

### "Token inválido o expirado"
- La sesión expiró (24h)
- Cierra sesión y vuelve a iniciar
- Verifica que el JWT_SECRET sea el mismo entre requests

### Las tablas no existen
- Ejecuta: `curl http://localhost:3000/api/diagnose`
- Esto inicializará la BD automáticamente
- Verifica los logs del servidor

---

## 🔐 Seguridad Recomendada

- ✅ Usa HTTPS en producción
- ✅ Genera `JWT_SECRET` aleatorio y largo
- ✅ Cambia passwords por defecto
- ✅ Limita intentos de login (TODO: implementar rate limiting)
- ✅ Usa contraseñas fuertes para admins
- ✅ Considera implementar 2FA (TOTP) si es necesario

---

## 📝 Próximos Pasos Opcionales

- [ ] Agregar campo de contraseña opcional en el formulario de creación de reportes
- [ ] Implementar rate limiting en login
- [ ] Agregar "¿Olvidaste tu contraseña?"
- [ ] Soporte para múltiples roles (admin, viewer, etc.)
- [ ] Logs de auditoría de accesos
- [ ] Notificaciones por email
- [ ] Autenticación con OAuth (Google, GitHub, etc.)

---

## ✨ ¡Listo!

Ya tienes un sistema de autenticación funcional. Si necesitas ayuda, revisa los logs del servidor o ejecuta el endpoint de diagnóstico.

**Recuerda:** Cambia todas las passwords por defecto y configura correctamente las variables de entorno antes de ir a producción.

