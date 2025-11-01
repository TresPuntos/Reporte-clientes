import { NextRequest, NextResponse } from 'next/server';
import { logApiUsage, getAllApiKeysFromDB, decryptApiKey } from '@/lib/db';

const TOGGL_BASE_URL = 'https://api.track.toggl.com/api/v9';

// Cache simple para evitar descifrar todas las keys en cada request
// Se limpia después de 5 minutos o cuando se añade/elimina una key
let apiKeyIdCache: Map<string, { id: string; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Encuentra el ID de la API key en la BD basado en el API token
 * Usa un cache para evitar descifrar todas las keys en cada request
 */
async function findApiKeyId(apiKey: string): Promise<string | null> {
  try {
    // Verificar cache primero
    const cached = apiKeyIdCache.get(apiKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.id;
    }

    const allKeys = await getAllApiKeysFromDB();
    for (const keyRecord of allKeys) {
      try {
        const decryptedKey = await decryptApiKey(keyRecord.key_encrypted);
        if (decryptedKey === apiKey) {
          // Actualizar cache
          apiKeyIdCache.set(apiKey, { id: keyRecord.id, timestamp: Date.now() });
          // Limpiar cache antiguo
          if (apiKeyIdCache.size > 100) {
            const now = Date.now();
            for (const [key, value] of apiKeyIdCache.entries()) {
              if (now - value.timestamp > CACHE_TTL) {
                apiKeyIdCache.delete(key);
              }
            }
          }
          return keyRecord.id;
        }
      } catch (error) {
        // Continuar con la siguiente key si falla el descifrado
        continue;
      }
    }
    return null;
  } catch (error) {
    console.error('Error finding API key ID:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { apiKey, endpoint } = await request.json();

    if (!apiKey || !endpoint) {
      return NextResponse.json(
        { message: 'API key and endpoint are required' },
        { status: 400 }
      );
    }

    // Buscar el ID de la API key para logging
    const apiKeyId = await findApiKeyId(apiKey);

    // Construct the full URL
    const url = `${TOGGL_BASE_URL}${endpoint}`;

    // Create headers with Basic Auth
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    // Use Buffer for server-side base64 encoding
    const authString = Buffer.from(`${apiKey}:api_token`).toString('base64');
    headers.append('Authorization', `Basic ${authString}`);

    // Make the request to Toggl API
    console.log('Calling Toggl API:', url);
    console.log('With headers:', Object.fromEntries(headers.entries()));
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    console.log('Toggl API response status:', response.status, response.statusText);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    // Registrar uso de API (asíncrono, no esperamos)
    if (apiKeyId) {
      logApiUsage(apiKeyId, endpoint, response.status).catch(err => {
        console.error('Error logging API usage:', err);
      });
    }

    // Check if response is ok before parsing
    if (!response.ok) {
      const errorText = await response.text();
      console.log('=== TOGGL API ERROR DETAILS ===');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('URL:', url);
      console.log('Error Response Text:', errorText);
      console.log('================================');
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { description: errorText || 'Toggl API error' };
      }
      
      // Send detailed error info to client
      return NextResponse.json(
        { 
          message: errorData.description || errorData.message || 'Toggl API error',
          status: response.status,
          statusText: response.statusText,
          url: url,
          errorText: errorText
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Toggl API success, data type:', typeof data);
    if (Array.isArray(data)) {
      console.log('Toggl API returned array with', data.length, 'items');
    } else if (typeof data === 'object' && data !== null) {
      console.log('Toggl API returned object with keys:', Object.keys(data));
      if ('data' in data) {
        console.log('Response contains "data" field with', Array.isArray(data.data) ? data.data.length : 'unknown', 'items');
      }
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('Toggl proxy error:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

