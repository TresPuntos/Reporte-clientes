# 🚀 Inicio Rápido - Sistema de Autenticación

## ✅ Listo para Usar

**Todo está implementado.** Solo necesitas completar estos 3 pasos:

---

## 📝 PASO 1: Variables de Entorno ✅

**Ya hecho:** Archivo `.env.local` creado con JWT_SECRET.

---

## 📝 PASO 2: Crear Administrador

### Opción A: Script Automático (Más fácil)

```bash
# Desde tu terminal, en la raíz del proyecto
./create-admin.sh
```

Sigue las instrucciones en pantalla.

### Opción B: Manual (Más rápido)

Abre DOS terminales:

**Terminal 1:** Inicia el servidor
```bash
npm run dev
```

**Terminal 2:** Crea el admin
```bash
curl -X POST http://localhost:3000/api/admin/create \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tudominio.com","password":"TuPassword123","fullname":"Admin"}'
```

Reemplaza:
- `admin@tudominio.com` → tu email real
- `TuPassword123` → tu contraseña
- `Admin` → tu nombre

---

## 📝 PASO 3: Iniciar Sesión

1. Abre `http://localhost:3000`
2. Inicia sesión con tus credenciales
3. ¡Listo! 🎉

---

## 🧪 Probar Protección de Reportes

1. Ve a **"Crear Reporte de Cliente"**
2. Activa ✅ **"Proteger este reporte con contraseña"**
3. Ingresa:
   - Email: `cliente@test.com`
   - Contraseña: `test123`
4. Crea el reporte
5. Abre el link en **modo incógnito**
6. Deberías ver la pantalla de login
7. Ingresa `test123`
8. ¡Accede al reporte! 🎉

---

## 🆘 Problemas?

### "No autorizado"
- Reinicia el servidor: `npm run dev`
- Verifica que `.env.local` existe

### "No se puede conectar a la BD"
- Ejecuta: `curl http://localhost:3000/api/diagnose`
- Verifica que tu BD está conectada en Vercel

### Script no funciona
```bash
chmod +x create-admin.sh
./create-admin.sh
```

---

## 📚 Más Información

- **PASOS_COMPLETOS.md** - Guía detallada paso a paso
- **INSTRUCCIONES_AUTH.md** - Documentación técnica
- **CAMBIOS_PROTECCION_REPORTE.md** - Detalles de la protección

---

## ✨ ¡Eso es todo!

Ahora tienes:
- ✅ Login de administradores
- ✅ Protección de reportes con contraseña
- ✅ Base de datos configurada
- ✅ Todo funcionando

**🚀 ¡Tu aplicación está lista!**

