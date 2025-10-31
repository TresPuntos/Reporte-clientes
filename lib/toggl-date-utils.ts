/**
 * Utilidades para gestionar la fecha mínima de Toggl API
 * Esta fecha se actualiza automáticamente cada día
 */

const TOGGL_MIN_DATE_KEY = 'toggl_min_date';
const TOGGL_MIN_DATE_CACHE_KEY = 'toggl_min_date_cache_time';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Obtiene la fecha mínima de Toggl desde el cache o la detecta desde la API
 */
export async function getTogglMinDate(apiKey?: string): Promise<string> {
  // Primero, verificar si tenemos una fecha en cache válida
  const cachedDate = localStorage.getItem(TOGGL_MIN_DATE_KEY);
  const cacheTime = localStorage.getItem(TOGGL_MIN_DATE_CACHE_KEY);
  
  if (cachedDate && cacheTime) {
    const cacheAge = Date.now() - parseInt(cacheTime, 10);
    // Si el cache tiene menos de 24 horas, usar la fecha cacheada
    if (cacheAge < CACHE_DURATION_MS) {
      console.log(`Usando fecha mínima de Toggl desde cache: ${cachedDate}`);
      return cachedDate;
    }
  }

  // Si no hay apiKey, usar la fecha cacheada aunque esté expirada, o una por defecto
  if (!apiKey) {
    const fallbackDate = cachedDate || '2025-07-29';
    console.log(`Sin API key, usando fecha mínima por defecto: ${fallbackDate}`);
    return fallbackDate;
  }

  // Intentar detectar la fecha mínima desde la API
  try {
    const detectedDate = await detectTogglMinDate(apiKey);
    if (detectedDate) {
      // Guardar en cache
      localStorage.setItem(TOGGL_MIN_DATE_KEY, detectedDate);
      localStorage.setItem(TOGGL_MIN_DATE_CACHE_KEY, Date.now().toString());
      console.log(`Fecha mínima de Toggl detectada y cacheada: ${detectedDate}`);
      return detectedDate;
    }
  } catch (error) {
    console.warn('Error detectando fecha mínima de Toggl, usando cache o valor por defecto:', error);
  }

  // Si falla la detección, usar cache expirado o valor por defecto
  return cachedDate || '2025-07-29';
}

/**
 * Detecta la fecha mínima de Toggl intentando obtener entradas de fechas anteriores
 * hasta encontrar el límite a través de errores de la API
 */
async function detectTogglMinDate(apiKey: string): Promise<string | null> {
  // Empezar desde una fecha muy anterior y buscar hacia adelante
  // Toggl normalmente permite datos desde hace ~1 año, pero puede variar
  
  const today = new Date();
  const testDates: Date[] = [];
  
  // Generar fechas de prueba: desde hace 400 días hasta hoy
  for (let daysAgo = 400; daysAgo >= 0; daysAgo -= 7) {
    const testDate = new Date(today);
    testDate.setDate(testDate.getDate() - daysAgo);
    testDates.push(testDate);
  }
  
  // Buscar la fecha mínima usando búsqueda binaria
  let min = 0;
  let max = testDates.length - 1;
  let minValidDate: Date | null = null;
  
  // Primero, intentar con la fecha más antigua conocida (2025-07-29)
  const knownMinDate = new Date('2025-07-29');
  const todayStr = today.toISOString().split('T')[0];
  
  try {
    // Importar dinámicamente para evitar dependencia circular
    const { togglFetch } = await import('./toggl');
    
    // Probar con la fecha conocida más antigua
    try {
      await togglFetch(
        apiKey,
        '/me/time_entries',
        {
          start_date: knownMinDate.toISOString().split('T')[0],
          end_date: todayStr,
        }
      );
      // Si funciona, usar esta fecha
      return knownMinDate.toISOString().split('T')[0];
    } catch (error: any) {
      // Si falla, extraer la fecha mínima del mensaje de error
      const errorText = error?.message || error?.errorText || '';
      if (errorText.includes('start_date must not be earlier than')) {
        const match = errorText.match(/start_date must not be earlier than (\d{4}-\d{2}-\d{2})/);
        if (match) {
          return match[1];
        }
      }
      
      // Si no podemos extraer del error, usar la fecha por defecto
      console.warn('No se pudo extraer fecha mínima del error, usando valor por defecto');
      return '2025-07-29';
    }
  } catch (error) {
    console.error('Error detectando fecha mínima:', error);
    return null;
  }
}

/**
 * Fuerza la actualización de la fecha mínima desde la API
 */
export async function refreshTogglMinDate(apiKey: string): Promise<string> {
  // Limpiar cache
  localStorage.removeItem(TOGGL_MIN_DATE_KEY);
  localStorage.removeItem(TOGGL_MIN_DATE_CACHE_KEY);
  
  // Obtener nueva fecha
  return await getTogglMinDate(apiKey);
}

/**
 * Obtiene la fecha mínima sin hacer llamadas a la API (solo cache o valor por defecto)
 */
export function getTogglMinDateSync(): string {
  const cachedDate = localStorage.getItem(TOGGL_MIN_DATE_KEY);
  return cachedDate || '2025-07-29';
}

/**
 * Verifica si necesita actualizar la fecha mínima (cache expirado)
 */
export function shouldRefreshMinDate(): boolean {
  const cacheTime = localStorage.getItem(TOGGL_MIN_DATE_CACHE_KEY);
  if (!cacheTime) return true;
  
  const cacheAge = Date.now() - parseInt(cacheTime, 10);
  return cacheAge >= CACHE_DURATION_MS;
}








