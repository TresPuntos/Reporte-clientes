import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json(
        { authenticated: false, error: 'No token provided' },
        { status: 401 }
      );
    }

    const result = await verifyAdminToken(token);

    if (!result.success) {
      return NextResponse.json(
        { authenticated: false, error: result.error },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      admin: result.admin,
    });
  } catch (error: any) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Error verificando autenticación' },
      { status: 500 }
    );
  }
}

