import { NextRequest, NextResponse } from 'next/server';
import { getApiUsageStats, getAllApiKeysFromDB } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const result = await verifyAdminToken(token);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401 }
      );
    }

    // Obtener todas las API keys
    const apiKeys = await getAllApiKeysFromDB();
    
    // Obtener estadísticas para cada API key
    const statsPromises = apiKeys.map(async (key) => {
      const stats = await getApiUsageStats(key.id);
      // Serializar fechas para JSON
      return {
        apiKeyId: key.id,
        email: key.email,
        fullname: key.fullname,
        stats: {
          ...stats,
          oldestRequestTimestamp: stats.oldestRequestTimestamp?.toISOString() || null,
          newestRequestTimestamp: stats.newestRequestTimestamp?.toISOString() || null,
          resetTime: stats.resetTime?.toISOString() || null,
        },
      };
    });
    
    const allStats = await Promise.all(statsPromises);
    
    return NextResponse.json(allStats);
  } catch (error: any) {
    console.error('Error fetching API usage stats:', error);
    return NextResponse.json(
      { 
        message: 'Error fetching API usage stats',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

