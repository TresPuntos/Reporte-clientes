import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth';
import { getReportPasswordHash } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicUrl: string }> }
) {
  try {
    const { publicUrl } = await params;
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: 'Contraseña requerida' },
        { status: 400 }
      );
    }

    // Obtener hash de la BD
    const passwordHash = await getReportPasswordHash(publicUrl);

    // Si no tiene contraseña, permitir acceso
    if (!passwordHash) {
      return NextResponse.json({ valid: true });
    }

    // Verificar contraseña
    const isValid = await verifyPassword(password, passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { valid: false, error: 'Contraseña incorrecta' },
        { status: 401 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch (error: any) {
    console.error('Password check error:', error);
    return NextResponse.json(
      { error: 'Error verificando contraseña' },
      { status: 500 }
    );
  }
}

