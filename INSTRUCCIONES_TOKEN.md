# 🔑 Instrucciones para Crear Token de GitHub

## Paso 1: Crear el Token

1. **Ve a GitHub.com** e inicia sesión con tu cuenta `TresPuntos`
2. **Click en tu avatar** (arriba derecha) → **Settings**
3. En el menú lateral izquierdo, baja hasta el final y haz click en **"Developer settings"**
4. Click en **"Personal access tokens"** → **"Tokens (classic)"**
5. Click en **"Generate new token"** → **"Generate new token (classic)"**
6. **Configura el token:**
   - **Note:** "Reporte-clientes proyecto"
   - **Expiration:** Elige una duración (90 días, 1 año, etc.)
   - **Scopes:** Marca al menos:
     - ✅ **repo** (todos los permisos de repositorio)
7. Click en **"Generate token"**
8. **COPIA EL TOKEN INMEDIATAMENTE** (solo se muestra una vez)
   - Se verá algo como: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Paso 2: Usar el Token

Una vez tengas el token, ejecuta:

```bash
cd /Users/jordi/Documents/GitHub/Reporte-clientes
git push -u origin main
```

Cuando te pida credenciales:
- **Username:** `TresPuntos`
- **Password:** Pega el **TOKEN** (no tu contraseña)

---

## Alternativa: Guardar el token

Si quieres evitar escribir el token cada vez:

```bash
cd /Users/jordi/Documents/GitHub/Reporte-clientes
git config --global credential.helper store
git push -u origin main
```

Luego cuando pida credenciales, usa el token como password.

---

**⚠️ IMPORTANTE:** 
- El token es como una contraseña, mantenlo secreto
- No lo compartas ni lo subas a repositorios públicos
- Si lo pierdes, puedes revocarlo y crear uno nuevo

