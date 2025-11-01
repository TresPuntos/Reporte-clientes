import type { Me, TimeEntry } from './types';

const TOGGL_BASE_URL = 'https://api.track.toggl.com/api/v9';

/**
 * Core function to fetch data from Toggl API through proxy
 * This avoids CORS issues by using our backend proxy
 */
export async function togglFetch<T>(
  apiKey: string,
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  const fullEndpoint = endpoint + queryString;

  console.log('=== TOGGL FETCH REQUEST ===');
  console.log('Endpoint:', endpoint);
  console.log('Params:', JSON.stringify(params, null, 2));
  console.log('Full URL:', `https://api.track.toggl.com/api/v9${endpoint}${queryString}`);
  console.log('============================');

  const response = await fetch('/api/toggl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey,
      endpoint: fullEndpoint,
    }),
  });

  // Read the response body once
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    
    // Try to extract useful error information
    let errorDetails = '';
    if (data && typeof data === 'object') {
      errorMessage = data.message || data.description || errorMessage;
      errorDetails = JSON.stringify(data, null, 2);
      
      // Log detailed error info if available
      if (data.url) {
        console.error('Failing URL:', data.url);
      }
      if (data.errorText) {
        console.error('Error text from API:', data.errorText);
        
        // Check if the error is about hourly API limit (402)
        // Toggl uses sliding window: limits reset after 60 minutes from first request
        if (response.status === 402 || data.errorText.includes('hourly limit') || data.errorText.includes('Payment Required')) {
          // Extract reset time if available
          const resetMatch = data.errorText.match(/reset in (\d+) seconds/);
          let resetSeconds = 3600; // Default to 60 minutes (sliding window)
          
          if (resetMatch) {
            resetSeconds = parseInt(resetMatch[1]);
          }
          
          const resetMinutes = Math.ceil(resetSeconds / 60);
          const resetTime = Date.now() + (resetSeconds * 1000);
          
          // Guardar información del límite en localStorage
          // Incluir información del tipo de límite si es posible detectarlo
          const limitInfo = {
            resetTime: resetTime,
            resetSeconds: resetSeconds,
            detectedAt: Date.now(),
            // Detectar si es endpoint /me (User-Specific: 30 req/hora) o workspace (varía por plan)
            isUserEndpoint: endpoint.includes('/me'),
            endpoint: endpoint,
          };
          
          localStorage.setItem('toggl_api_limit', JSON.stringify(limitInfo));
          
          // Mensaje más descriptivo según el tipo de límite
          if (endpoint.includes('/me')) {
            errorMessage = `Límite de API de Toggl alcanzado (30 requests/hora para datos del usuario). El límite se reseteará en aproximadamente ${resetMinutes} minuto(s) (ventana deslizante de 60 minutos).`;
          } else {
            errorMessage = `Límite de API de Toggl alcanzado (límite por workspace/organización). El límite se reseteará en aproximadamente ${resetMinutes} minuto(s) (ventana deslizante de 60 minutos).`;
          }
          
          console.warn(`⚠️ Límite de API alcanzado (${endpoint.includes('/me') ? 'User-Specific (30/hora)' : 'Workspace/Organization'}). Reset en ~${resetMinutes} minuto(s)`);
        }
        // Check if the error is about date restrictions
        else if (data.errorText.includes('start_date must not be earlier than')) {
          // Extract the minimum allowed date
          const match = data.errorText.match(/start_date must not be earlier than (\d{4}-\d{2}-\d{2})/);
          if (match) {
            const minDate = match[1];
            console.error(`Toggl API minimum date restriction: ${minDate}`);
            errorMessage = `Toggl solo permite obtener datos desde ${minDate}. Por favor, selecciona fechas a partir de ${minDate}`;
            
            // Guardar la fecha mínima en localStorage para uso futuro
            localStorage.setItem('toggl_min_date', minDate);
            localStorage.setItem('toggl_min_date_cache_time', Date.now().toString());
          }
        }
      }
    } else if (typeof data === 'string') {
      errorMessage = data;
      errorDetails = data;
    }
    
    console.error('=== TOGGL API ERROR ===');
    console.error('Status:', response.status);
    console.error('Response data:', data);
    console.error('Full error details:', errorDetails);
    console.error('======================');
    
    // Create a more descriptive error message
    const detailedError = errorMessage || `Toggl API Error (${response.status})`;
    throw new Error(detailedError);
  }

  return data;
}

/**
 * Get user information with all related data (workspaces, clients, projects, tags)
 */
export async function getMe(apiKey: string): Promise<Me> {
  return togglFetch<Me>(apiKey, '/me', { with_related_data: 'true' });
}

/**
 * Calculate date chunks to avoid API limits
 * Splits large date ranges into 30-day chunks (or smaller if needed)
 */
function getDateChunks(startDate: string, endDate: string): Array<{ start: string; end: string }> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const chunks: Array<{ start: string; end: string }> = [];
  
  // Calculate total days difference
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  console.log(`Date range: ${startDate} to ${endDate}, total days: ${diffDays}`);
  
  // If the range is 90 days or less, return as is
  if (diffDays <= 90) {
    console.log('Range is <= 90 days, no chunking needed');
    return [{ start: startDate, end: endDate }];
  }
  
  // Split into chunks (90 days each, max allowed by Toggl API)
  const chunkSize = 90;
  let currentStart = new Date(start);
  let chunkIndex = 0;
  
  while (currentStart <= end) {
    // Create end date for this chunk
    let currentEnd = new Date(currentStart);
    
    // Add chunkSize days
    currentEnd.setDate(currentEnd.getDate() + chunkSize - 1);
    
    // If chunk exceeds end date, use end date instead
    if (currentEnd > end) {
      currentEnd = new Date(end);
    }
    
    const chunkStart = currentStart.toISOString().split('T')[0];
    const chunkEnd = currentEnd.toISOString().split('T')[0];
    
    chunks.push({
      start: chunkStart,
      end: chunkEnd,
    });
    
    console.log(`Chunk ${chunkIndex + 1}: ${chunkStart} to ${chunkEnd}`);
    
    // Move to next chunk (start where this chunk ended + 1 day)
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);
    
    chunkIndex++;
    
    // Safety break
    if (chunkIndex > 100) {
      console.error('Too many chunks, breaking');
      break;
    }
  }
  
  console.log(`Generated ${chunks.length} date chunks for ${startDate} to ${endDate}`);
  return chunks;
}

/**
 * Get time entries for a specific date range
 * Uses the /me/time_entries endpoint which is the recommended way to get time entries
 * Handles large date ranges by chunking into smaller periods
 * Implements exponential backoff when hitting API limits (402)
 */
export async function getTimeEntries(
  apiKey: string,
  startDate: string,
  endDate: string,
  workspaceId: number,
  retryCount: number = 0,
  maxRetries: number = 3
): Promise<TimeEntry[]> {
  // Check if there's an active API limit before making requests
  const apiLimitData = localStorage.getItem('toggl_api_limit');
  if (apiLimitData) {
    try {
      const limitInfo = JSON.parse(apiLimitData);
      const resetTime = limitInfo.resetTime || 0;
      const now = Date.now();
      
      if (resetTime > now) {
        const resetSeconds = Math.ceil((resetTime - now) / 1000);
        const resetMinutes = Math.ceil(resetSeconds / 60);
        throw new Error(`Límite de API de Toggl aún activo. El límite se reseteará en aproximadamente ${resetMinutes} minuto(s). Por favor, espera antes de intentar nuevamente.`);
      }
    } catch (error) {
      // If limit expired or error parsing, continue
    }
  }
  
  const chunks = getDateChunks(startDate, endDate);
  const allEntries: TimeEntry[] = [];
  
  console.log(`Fetching time entries in ${chunks.length} chunks for date range ${startDate} to ${endDate}`);
  
  // Fetch entries for each chunk with error handling
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    try {
      console.log(`Fetching chunk ${i + 1}/${chunks.length}: ${chunk.start} to ${chunk.end}`);
      
      // Fetch with pagination support
      const chunkEntries = await fetchAllPages(apiKey, chunk.start, chunk.end, workspaceId);
      
      console.log(`Received ${chunkEntries.length} entries from chunk ${i + 1}`);
      
      // Deduplicate entries by ID to avoid any overlaps
      const existingIds = new Set(allEntries.map(e => e.id));
      const uniqueEntries = chunkEntries.filter(entry => !existingIds.has(entry.id));
      
      allEntries.push(...uniqueEntries);
    } catch (error: any) {
      const errorMessage = error?.message || '';
      
      // Si es error de límite de API (402), implementar exponential backoff
      if ((errorMessage.includes('hourly limit') || errorMessage.includes('402') || errorMessage.includes('Límite de API')) && retryCount < maxRetries) {
        // Exponential backoff: 2^retryCount seconds (1s, 2s, 4s, etc.)
        const backoffSeconds = Math.pow(2, retryCount);
        console.warn(`⚠️ Límite de API detectado. Esperando ${backoffSeconds} segundo(s) antes de reintentar...`);
        
        await new Promise(resolve => setTimeout(resolve, backoffSeconds * 1000));
        
        // Reintentar solo este chunk con exponential backoff
        try {
          const chunkEntries = await fetchAllPages(apiKey, chunk.start, chunk.end, workspaceId);
          const existingIds = new Set(allEntries.map(e => e.id));
          const uniqueEntries = chunkEntries.filter(entry => !existingIds.has(entry.id));
          allEntries.push(...uniqueEntries);
          console.log(`✅ Reintento exitoso para chunk ${i + 1}`);
        } catch (retryError) {
          // Si falla el reintento, continuar con el siguiente chunk
          console.error(`❌ Reintento fallido para chunk ${i + 1}:`, retryError);
          // Si es el último chunk o todos los chunks fallaron, lanzar el error
          if (i === chunks.length - 1 || allEntries.length === 0) {
            throw error;
          }
        }
      } else {
        // Para otros errores o si se alcanzó el máximo de reintentos
        console.error(`Error fetching entries for ${chunk.start} to ${chunk.end}:`, error);
        
        // Si es el último chunk o no tenemos entradas, lanzar el error
        if (i === chunks.length - 1 || allEntries.length === 0) {
          throw error;
        }
        
        // Continuar con el siguiente chunk para otros errores
        console.warn(`Continuando con siguiente chunk después de error...`);
      }
    }
    
    // Pequeña pausa entre chunks para evitar saturar la API (especialmente importante con límites)
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms entre chunks
    }
  }
  
  console.log(`Total entries fetched: ${allEntries.length}`);
  return allEntries;
}

/**
 * Fetch all pages of results for a date range
 * Toggl API v9 returns results directly without needing pagination params
 */
async function fetchAllPages(
  apiKey: string,
  startDate: string,
  endDate: string,
  workspaceId: number
): Promise<TimeEntry[]> {
  // Toggl API v9 doesn't accept workspace_id as a query parameter
  // We need to get all entries and filter by workspace on client side
  const params = {
    start_date: startDate,
    end_date: endDate,
  };
  
  console.log(`Fetching entries for date range: ${startDate} to ${endDate}`);
  console.log('Fetching with params:', params);
  
  try {
    const entries = await togglFetch<TimeEntry[]>(apiKey, '/me/time_entries', params);
    console.log('Response received, entries count:', entries?.length);
    
    if (!entries || !Array.isArray(entries)) {
      console.warn('Invalid response from Toggl API:', entries);
      return [];
    }
    
    // Filter entries by workspace on client side
    const filteredEntries = entries.filter(entry => entry.wid === workspaceId);
    
    // Debug: Ver qué workspaces tienen las entradas obtenidas
    const workspaceCounts = entries.reduce((acc: any, entry: any) => {
      acc[entry.wid] = (acc[entry.wid] || 0) + 1;
      return acc;
    }, {});
    console.log(`Workspace distribution de entradas obtenidas:`, workspaceCounts);
    console.log(`✅ Filtradas ${entries.length} entradas totales → ${filteredEntries.length} para workspace ${workspaceId}`);
    
    return filteredEntries;
  } catch (error) {
    console.error(`Failed to fetch entries for ${startDate} to ${endDate}:`, error);
    // Return empty array instead of throwing to continue processing other chunks
    return [];
  }
}

