import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, createAdmin } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

/**
 * Endpoint para crear el primer administrador
 * POST /api/admin/create
 * Body: { email, password, fullname? }
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar que tenemos las variables de entorno necesarias
    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'Base de datos no configurada' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { email, password, fullname } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Inicializar BD si no está inicializada
    await initializeDatabase();

    // Generar hash de contraseña
    const passwordHash = await hashPassword(password);

    // Crear admin (con ID basado en email)
    const adminId = Buffer.from(email).toString('base64');
    await createAdmin(adminId, email, passwordHash, fullname);

    return NextResponse.json({
      success: true,
      message: 'Administrador creado exitosamente',
      email,
    });
  } catch (error: any) {
    console.error('Error creating admin:', error);
    
    // Si ya existe
    if (error.message && error.message.includes('UNIQUE constraint')) {
      return NextResponse.json(
        { error: 'Ya existe un administrador con este email' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Error creando administrador' },
      { status: 500 }
    );
  }
}

