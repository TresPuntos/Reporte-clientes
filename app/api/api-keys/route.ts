import { NextRequest, NextResponse } from 'next/server';
import type { ApiKeyInfo } from '@/lib/types';
import { 
  initializeDatabase, 
  getAllApiKeysFromDB, 
  saveApiKeyToDB, 
  deleteApiKeyFromDB,
  decryptApiKey 
} from '@/lib/db';

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
    await ensureDBInitialized();
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
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { message: 'Error fetching API keys' },
      { status: 500 }
    );
  }
}

// POST - Crear o actualizar una API key
export async function POST(request: NextRequest) {
  try {
    await ensureDBInitialized();
    const body = await request.json();
    const { id, key, fullname, email, workspaces, clients, projects, tags } = body;
    
    if (!id || !key || !fullname || !email) {
      return NextResponse.json(
        { message: 'Missing required fields' },
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
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving API key:', error);
    return NextResponse.json(
      { message: 'Error saving API key' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar una API key
export async function DELETE(request: NextRequest) {
  try {
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

