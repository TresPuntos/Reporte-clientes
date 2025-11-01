import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

/**
 * Endpoint de diagnóstico para verificar el estado de la base de datos
 * GET /api/diagnose
 */
export async function GET() {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    status: 'checking',
    issues: [],
    success: [],
  };

  // 1. Verificar variables de entorno
  const postgresUrl = process.env.POSTGRES_URL;
  const postgresPrismaUrl = process.env.POSTGRES_PRISMA_URL;
  const postgresNonPooling = process.env.POSTGRES_URL_NON_POOLING;
  const databaseUrl = process.env.DATABASE_URL;

  diagnostics.env = {
    POSTGRES_URL: postgresUrl ? '✅ Configurada' : '❌ No configurada',
    POSTGRES_PRISMA_URL: postgresPrismaUrl ? '✅ Configurada' : '⚠️ Opcional',
    POSTGRES_URL_NON_POOLING: postgresNonPooling ? '✅ Configurada' : '⚠️ Opcional',
    DATABASE_URL: databaseUrl ? '✅ Configurada (puede ser de Neon)' : '⚠️ No configurada',
  };

  if (!postgresUrl && !databaseUrl) {
    diagnostics.issues.push({
      severity: 'critical',
      message: 'No hay variable POSTGRES_URL o DATABASE_URL configurada',
      solution: 'Necesitas conectar una base de datos (Neon, Supabase, etc.) en Vercel',
    });
    diagnostics.status = 'error';
    return NextResponse.json(diagnostics, { status: 500 });
  }

  // 2. Intentar conectar a la BD
  try {
    // Intentar una query simple
    const result = await sql`SELECT 1 as test`;
    diagnostics.connection = '✅ Conexión exitosa';
    diagnostics.success.push('Conexión a la base de datos funciona');
  } catch (error: any) {
    diagnostics.connection = '❌ Error de conexión';
    diagnostics.issues.push({
      severity: 'critical',
      message: `Error conectando a la BD: ${error.message}`,
      solution: 'Verifica que la variable POSTGRES_URL o DATABASE_URL tenga el formato correcto',
    });
    diagnostics.status = 'error';
    return NextResponse.json(diagnostics, { status: 500 });
  }

  // 3. Verificar que las tablas existen
  try {
    const tablesResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    const tables = tablesResult.rows.map((r: any) => r.table_name);
    diagnostics.tables = {
      found: tables,
      reports: tables.includes('reports') ? '✅ Existe' : '❌ No existe',
      api_keys: tables.includes('api_keys') ? '✅ Existe' : '❌ No existe',
    };

    if (!tables.includes('reports') || !tables.includes('api_keys')) {
      diagnostics.issues.push({
        severity: 'warning',
        message: 'Las tablas no existen. Se crearán automáticamente en el primer uso.',
        solution: 'Simplemente usa la aplicación y las tablas se crearán solas',
      });
    } else {
      diagnostics.success.push('Todas las tablas necesarias existen');
    }
  } catch (error: any) {
    diagnostics.issues.push({
      severity: 'warning',
      message: `Error verificando tablas: ${error.message}`,
      solution: 'Las tablas se crearán automáticamente cuando uses la aplicación',
    });
  }

  // 4. Contar registros
  try {
    const reportsCount = await sql`SELECT COUNT(*) as count FROM reports`;
    const apiKeysCount = await sql`SELECT COUNT(*) as count FROM api_keys`;
    
    diagnostics.data = {
      reports: reportsCount.rows[0]?.count || 0,
      api_keys: apiKeysCount.rows[0]?.count || 0,
    };
  } catch (error: any) {
    // Ignorar si las tablas no existen aún
  }

  diagnostics.status = diagnostics.issues.length === 0 ? 'ok' : 'warning';
  
  return NextResponse.json(diagnostics, {
    status: diagnostics.status === 'error' ? 500 : 200,
  });
}

