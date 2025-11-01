# Consumo de Llamadas de API en Reportes

## Sí, los reportes consumen llamadas de API de Toggl

### Cuándo se consumen llamadas:

#### 1. **Crear un reporte nuevo**
- **`getTimeEntries()`**: Se llama por cada configuración del reporte
- **Cantidad**: 1 llamada por configuración × número de chunks de fechas
  - Si el rango de fechas es ≤ 90 días: 1 llamada por configuración
  - Si es > 90 días: múltiples llamadas (1 por cada chunk de 90 días)
- **Ejemplo**: 
  - 1 configuración, 30 días → **1 llamada**
  - 2 configuraciones, 180 días → **4 llamadas** (2 configs × 2 chunks)
  - 3 configuraciones, 90 días → **3 llamadas** (3 configs × 1 chunk)

#### 2. **Auto-refresh automático (cada 30 minutos)**
- **`getTimeEntries()`**: Se ejecuta automáticamente cada 30 minutos para cada configuración activa
- **Cantidad**: Similar a crear un reporte
- **Nota**: Se salta automáticamente si hay límite de API activo

#### 3. **Actualizar reporte manualmente (botón "Actualizar")**
- **`getTimeEntries()`**: Igual que crear un reporte
- **Cantidad**: 1 llamada por configuración × número de chunks

#### 4. **Recalcular reporte (botón "Recalcular")**
- **`getTimeEntries()`**: Se ejecuta para todas las configuraciones
- **Cantidad**: Igual que crear un reporte

#### 5. **Cargar tags disponibles**
- **`getMe()`**: Se llama al cargar el generador de reportes (User-Specific endpoint)
- **Cantidad**: 1 llamada por API key configurada (máximo 30 req/h para este endpoint)
- **Nota**: Usa cache cuando hay límite activo

#### 6. **Editar reporte y guardar cambios**
- **`getTimeEntries()`**: Si se cambian filtros/tags/fecha de inicio, se ejecuta
- **Cantidad**: Igual que crear un reporte

### Cómo reducir el consumo:

1. **Usar entradas CSV**: Las entradas del CSV no consumen llamadas de API
2. **Limitar auto-refresh**: El auto-refresh ya salta cuando hay límite activo
3. **Reducir configuraciones**: Menos configuraciones = menos llamadas
4. **Acortar rangos de fechas**: Rangos más pequeños = menos chunks = menos llamadas
5. **Usar cache**: El sistema ya usa cache para tags cuando hay límite activo

### Límites de Toggl API:

- **Free**: 30 requests/hora por usuario por organización (workspace endpoints)
- **Starter**: 240 requests/hora por usuario por organización
- **Premium**: 600 requests/hora por usuario por organización
- **User-Specific** (`/me`): 30 requests/hora por usuario (independiente del plan)

### Optimizaciones ya implementadas:

✅ **Pausa entre chunks**: 100ms entre requests para evitar saturar
✅ **Exponential backoff**: Reintentos con espera progresiva cuando hay 402
✅ **Cache de límites**: Evita hacer llamadas cuando hay límite activo
✅ **Skip auto-refresh**: No hace llamadas si hay límite activo
✅ **Cache de tags**: Usa cache cuando hay límite activo

### Recomendaciones:

1. **Para usuarios Free (30 req/h)**:
   - Crear reportes solo cuando sea necesario
   - Usar CSV para datos históricos
   - Limitar auto-refresh desactivando reportes que no se usan

2. **Para usuarios Starter (240 req/h)**:
   - Monitorear el uso, especialmente con múltiples configuraciones
   - Usar CSV para reducir llamadas

3. **Para usuarios Premium (600 req/h)**:
   - Usualmente suficiente para uso normal
   - Monitorear en casos de muchos reportes con múltiples configuraciones

