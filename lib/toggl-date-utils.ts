/**
 * Utilidades para gestionar la fecha mínima de Toggl API
 * Esta fecha se actualiza automáticamente cada día
 * Toggl normalmente permite datos desde hace ~90 días, pero puede variar según el plan
 */

const TOGGL_MIN_DATE_KEY = 'toggl_min_date';
const TOGGL_MIN_DATE_CACHE_KEY = 'toggl_min_date_cache_time';
const TOGGL_MIN_DATE_DAY_KEY = 'toggl_min_date_day'; // Día en que se calculó la fecha
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas
const TOGGL_MAX_HISTORICAL_DAYS = 90; // Días máximos que Toggl permite hacia atrás (ajustar según el plan)

/**
 * Calcula la fecha mínima dinámicamente basándose en la fecha actual
 * Esto asegura que la fecha se actualice cada día automáticamente
 */
function calculateMinDateFromToday(): string {
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() - TOGGL_MAX_HISTORICAL_DAYS);
  return minDate.toISOString().split('T')[0];
}

/**
 * Obtiene la fecha mínima de Toggl desde el cache o la detecta desde la API
 * Ahora también calcula dinámicamente basándose en la fecha actual
 */
export async function getTogglMinDate(apiKey?: string): Promise<string> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0].substring(0, 10); // YYYY-MM-DD
  
  // Verificar si ya calculamos la fecha mínima para hoy
  const lastCalculatedDay = localStorage.getItem(TOGGL_MIN_DATE_DAY_KEY);
  if (lastCalculatedDay === todayStr) {
    const cachedDate = localStorage.getItem(TOGGL_MIN_DATE_KEY);
    if (cachedDate) {
      console.log(`Usando fecha mínima de Toggl calculada hoy: ${cachedDate}`);
      return cachedDate;
    }
  }

  // Calcular fecha mínima dinámicamente para hoy (hoy - 90 días)
  const calculatedMinDate = calculateMinDateFromToday();
  
  // Si tenemos API key, intentar detectar la fecha real desde la API
  if (apiKey) {
    try {
      const detectedDate = await detectTogglMinDate(apiKey, calculatedMinDate);
      if (detectedDate) {
        // Guardar en cache con la fecha de hoy
        localStorage.setItem(TOGGL_MIN_DATE_KEY, detectedDate);
        localStorage.setItem(TOGGL_MIN_DATE_CACHE_KEY, Date.now().toString());
        localStorage.setItem(TOGGL_MIN_DATE_DAY_KEY, todayStr);
        console.log(`Fecha mínima de Toggl detectada y cacheada para hoy: ${detectedDate}`);
        return detectedDate;
      }
    } catch (error) {
      console.warn('Error detectando fecha mínima de Toggl, usando cálculo dinámico:', error);
    }
  }

  // Si falla la detección o no hay API key, usar la fecha calculada dinámicamente
  localStorage.setItem(TOGGL_MIN_DATE_KEY, calculatedMinDate);
  localStorage.setItem(TOGGL_MIN_DATE_CACHE_KEY, Date.now().toString());
  localStorage.setItem(TOGGL_MIN_DATE_DAY_KEY, todayStr);
  console.log(`Usando fecha mínima calculada dinámicamente para hoy: ${calculatedMinDate}`);
  return calculatedMinDate;
}

/**
 * Detecta la fecha mínima de Toggl intentando obtener entradas de fechas anteriores
 * hasta encontrar el límite a través de errores de la API
 */
async function detectTogglMinDate(apiKey: string, suggestedDate: string): Promise<string | null> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  try {
    // Importar dinámicamente para evitar dependencia circular
    const { togglFetch } = await import('./toggl');
    
    // Probar con la fecha sugerida (calculada dinámicamente)
    try {
      await togglFetch(
        apiKey,
        '/me/time_entries',
        {
          start_date: suggestedDate,
          end_date: todayStr,
        }
      );
      // Si funciona, usar esta fecha
      return suggestedDate;
    } catch (error: any) {
      // Si falla, extraer la fecha mínima del mensaje de error
      const errorText = error?.message || error?.errorText || '';
      if (errorText.includes('start_date must not be earlier than')) {
        const match = errorText.match(/start_date must not be earlier than (\d{4}-\d{2}-\d{2})/);
        if (match) {
          const detectedDate = match[1];
          console.log(`Fecha mínima detectada desde error de API: ${detectedDate}`);
          return detectedDate;
        }
      }
      
      // Si no podemos extraer del error, usar la fecha sugerida (calculada)
      console.warn('No se pudo extraer fecha mínima del error, usando fecha calculada');
      return suggestedDate;
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
 * Obtiene la fecha mínima sin hacer llamadas a la API (solo cache o valor calculado dinámicamente)
 * Ahora verifica si la fecha cacheada es de hoy, si no, calcula una nueva
 */
export function getTogglMinDateSync(): string {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0].substring(0, 10);
  const lastCalculatedDay = localStorage.getItem(TOGGL_MIN_DATE_DAY_KEY);
  
  // Si la fecha fue calculada hoy, usar el cache
  if (lastCalculatedDay === todayStr) {
    const cachedDate = localStorage.getItem(TOGGL_MIN_DATE_KEY);
    if (cachedDate) {
      return cachedDate;
    }
  }
  
  // Si no hay cache de hoy, calcular dinámicamente
  const calculatedDate = calculateMinDateFromToday();
  
  // Actualizar cache
  localStorage.setItem(TOGGL_MIN_DATE_KEY, calculatedDate);
  localStorage.setItem(TOGGL_MIN_DATE_CACHE_KEY, Date.now().toString());
  localStorage.setItem(TOGGL_MIN_DATE_DAY_KEY, todayStr);
  
  return calculatedDate;
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








