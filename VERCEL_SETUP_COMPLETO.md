# 🚀 Setup Completo en Vercel - Sistema de Autenticación

## ✅ Lo que acabamos de hacer

✅ Código subido a GitHub: `https://github.com/TresPuntos/Reporte-clientes.git`  
✅ Vercel debería estar haciendo deploy automáticamente ahora

---

## 📋 PASO 1: Verificar el Deploy en Vercel

1. Ve a https://vercel.com
2. Selecciona tu proyecto **Reporte-clientes**
3. Espera a que el deploy termine (verás "Building..." → "Ready")
4. Copia tu URL de producción (algo como: `https://reporte-clientes.vercel.app`)

---

## 📋 PASO 2: Configurar Variables de Entorno en Vercel

1. En tu proyecto de Vercel, ve a **Settings** → **Environment Variables**
2. Agrega estas variables:

### Variable 1: JWT_SECRET
- **Name:** `JWT_SECRET`
- **Value:** 
```
5dc8b634b472ee5c6226d269a09d8f2e9a4404986dec16332c4332e06ca715ebf785ccafac48d1b2231875be97307720743aa92517229fa5d672ad131243e2ae
```
- **Environments:** ✅ Production, ✅ Preview, ✅ Development
- Click **Save**

### Variable 2: ENCRYPTION_KEY (Si ya la tienes)
- **Name:** `ENCRYPTION_KEY`
- **Value:** Tu clave hexadecimal existente
- **Environments:** ✅ Production, ✅ Preview, ✅ Development
- Click **Save**

### Variable 3: Base de Datos (Si aún no está)
- **Name:** `POSTGRES_URL` o `DATABASE_URL`
- **Value:** Tu conexión a PostgreSQL
- **Environments:** ✅ Production, ✅ Preview, ✅ Development
- Click **Save**

---

## 📋 PASO 3: Redeploy

Después de agregar las variables:

1. Ve a la pestaña **Deployments**
2. Click en los **3 puntos** (...) del último deploy
3. Click **Redeploy**
4. Espera a que termine

---

## 📋 PASO 4: Crear el Administrador

Una vez que el deploy esté listo, crea tu primer admin:

### Opción A: Desde la terminal (Más fácil)

```bash
# Reemplaza TU-DOMINIO.vercel.app con tu URL real
curl -X POST https://TU-DOMINIO.vercel.app/api/admin/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@tudominio.com",
    "password": "TuPasswordSeguro123",
    "fullname": "Administrador Principal"
  }'
```

### Opción B: Desde la consola del navegador

1. Abre tu dominio en el navegador
2. Abre la consola (F12 → Console)
3. Ejecuta:

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

**Importante:** Cambia:
- `admin@tudominio.com` → tu email real
- `TuPasswordSeguro123` → una contraseña fuerte

---

## 📋 PASO 5: Iniciar Sesión

1. Ve a tu dominio: `https://TU-DOMINIO.vercel.app`
2. Verás la pantalla de login
3. Ingresa tu email y contraseña
4. ¡Listo! 🎉

---

## 📋 PASO 6: Probar la Protección de Reportes

1. Inicia sesión en tu dominio
2. Ve a **"Crear Reporte de Cliente"**
3. Activa ✅ **"Proteger este reporte con contraseña"**
4. Ingresa:
   - Email: `cliente@test.com`
   - Contraseña: `test123`
5. Crea el reporte
6. Copia el link del reporte
7. Abre el link en **modo incógnito**
8. Deberías ver la pantalla de login
9. Ingresa `test123`
10. ¡Accede al reporte protegido! 🎉

---

## 🐛 Solución de Problemas

### "No autorizado" al iniciar sesión

**Causa:** JWT_SECRET no está configurado en Vercel

**Solución:**
1. Verifica que agregaste `JWT_SECRET` en Settings → Environment Variables
2. Haz **Redeploy** después de agregar la variable
3. Vuelve a intentar iniciar sesión

### "No se puede conectar a la BD"

**Causa:** Base de datos no conectada

**Solución:**
1. Ve a tu proyecto en Vercel
2. Settings → Storage
3. Conecta una base de datos PostgreSQL (Neon, Supabase, etc.)
4. Vercel creará automáticamente `POSTGRES_URL`
5. Haz Redeploy

### El deploy falló

**Causa:** Errores de build

**Solución:**
1. Click en el deploy fallido
2. Ve a la pestaña "Logs"
3. Revisa el error
4. Si es un error de dependencias, ejecuta local:
   ```bash
   npm install
   git add package-lock.json
   git commit -m "Fix dependencies"
   git push
   ```

### No veo la pantalla de login

**Causa:** El admin aún no se ha creado

**Solución:**
1. Ve a `/api/admin/create` en el navegador
2. Verás un error, eso está bien
3. Usa el método del PASO 4 para crearlo
4. Vuelve a la página principal

---

## ✅ Checklist Final

- [ ] Deploy exitoso en Vercel
- [ ] JWT_SECRET configurado en Variables de Entorno
- [ ] POSTGRES_URL configurado (si usas BD)
- [ ] Admin creado exitosamente
- [ ] Puedo iniciar sesión
- [ ] Puedo crear reportes sin contraseña
- [ ] Puedo crear reportes con contraseña
- [ ] Los reportes protegidos piden login
- [ ] Todo funciona correctamente

---

## 📝 Variables de Entorno Importantes

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `JWT_SECRET` | ✅ Sí | Clave para firmar tokens JWT |
| `POSTGRES_URL` | ✅ Sí* | URL de conexión a PostgreSQL |
| `ENCRYPTION_KEY` | ⚠️ Opcional | Clave para cifrar API keys (ya deberías tenerla) |

*Solo si usas base de datos (que ya deberías estar usando)

---

## 🎯 Comandos Útiles

### Verificar que el API funciona
```bash
curl https://TU-DOMINIO.vercel.app/api/diagnose
```

### Crear admin
```bash
curl -X POST https://TU-DOMINIO.vercel.app/api/admin/create \
  -H "Content-Type: application/json" \
  -d '{"email":"tu@email.com","password":"TuPass123","fullname":"Tu Nombre"}'
```

### Verificar autenticación
```bash
curl https://TU-DOMINIO.vercel.app/api/auth/verify
```

---

## 🚀 ¡Listo!

Tu aplicación está en producción con:
- ✅ Login de administradores
- ✅ Protección de reportes con contraseña
- ✅ Base de datos persistente
- ✅ Todo funcionando en Vercel

**🎉 ¡Felicidades!**

