import { NextRequest, NextResponse } from 'next/server';
import type { ApiKeyInfo } from '@/lib/types';
import { 
  initializeDatabase, 
  getAllApiKeysFromDB, 
  saveApiKeyToDB, 
  deleteApiKeyFromDB,
  decryptApiKey 
} from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// Inicializar BD en el primer uso
let dbInitialized = false;
async function ensureDBInitialized() {
  if (!dbInitialized) {
    try {
      await initializeDatabase();
      dbInitialized = true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  }
}

// GET - Obtener todas las API keys
export async function GET() {
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

    await ensureDBInitialized();
    
    // Verificar conexión antes de continuar
    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      console.warn('No database configured, returning empty array');
      return NextResponse.json([]);
    }
    
    const apiKeysDB = await getAllApiKeysFromDB();
    
    // Convertir a formato ApiKeyInfo (descifrando las claves)
    const apiKeysPromises = apiKeysDB.map(async (key) => {
      const decryptedKey = await decryptApiKey(key.key_encrypted);
      return {
        id: key.id,
        key: decryptedKey,
        fullname: key.fullname,
        email: key.email,
        workspaces: key.workspaces || [],
        clients: key.clients || [],
        projects: key.projects || [],
        tags: key.tags || [],
      } as ApiKeyInfo;
    });
    
    const apiKeys = await Promise.all(apiKeysPromises);
    
    return NextResponse.json(apiKeys);
  } catch (error: any) {
    console.error('Error fetching API keys:', error);
    
    // Si no hay BD configurada, retornar array vacío (no es error crítico)
    if (error.message?.includes('POSTGRES_URL') || error.message?.includes('DATABASE_URL')) {
      console.warn('Database not configured, returning empty array');
      return NextResponse.json([]);
    }
    
    return NextResponse.json(
      { 
        message: 'Error fetching API keys',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// POST - Crear o actualizar una API key
export async function POST(request: NextRequest) {
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

    await ensureDBInitialized();
    
    // Verificar que la BD esté configurada
    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      console.error('No database configured');
      return NextResponse.json(
        { 
          success: false,
          message: 'Base de datos no configurada. Por favor, conecta una base de datos en Vercel.' 
        },
        { status: 500 }
      );
    }
    
    const body = await request.json();
    const { id, key, fullname, email, workspaces, clients, projects, tags } = body;
    
    console.log('Saving API key:', { id, email, hasKey: !!key, hasFullname: !!fullname });
    
    if (!id || !key || !fullname || !email) {
      console.error('Missing required fields:', { id: !!id, key: !!key, fullname: !!fullname, email: !!email });
      return NextResponse.json(
        { 
          success: false,
          message: 'Faltan campos requeridos: id, key, fullname, email' 
        },
        { status: 400 }
      );
    }
    
    await saveApiKeyToDB(
      id,
      key,
      fullname,
      email,
      workspaces || [],
      clients || [],
      projects || [],
      tags || []
    );
    
    console.log('API key saved successfully:', id);
    
    // Verificar que se guardó correctamente
    const allKeys = await getAllApiKeysFromDB();
    console.log(`Total API keys in DB after save: ${allKeys.length}`);
    
    return NextResponse.json({ 
      success: true,
      message: 'API key guardada correctamente',
      totalKeys: allKeys.length
    });
  } catch (error: any) {
    console.error('Error saving API key:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return NextResponse.json(
      { 
        success: false,
        message: 'Error al guardar API key',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar una API key
export async function DELETE(request: NextRequest) {
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

    await ensureDBInitialized();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { message: 'ID is required' },
        { status: 400 }
      );
    }
    
    await deleteApiKeyFromDB(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json(
      { message: 'Error deleting API key' },
      { status: 500 }
    );
  }
}

