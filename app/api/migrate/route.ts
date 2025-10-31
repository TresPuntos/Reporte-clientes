import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { initializeDatabase, saveReportToDB } from '@/lib/db';
import type { ClientReport } from '@/lib/report-types';

const DATA_DIR = path.join(process.cwd(), 'data');
const REPORTS_FILE = path.join(DATA_DIR, 'client-reports.json');

/**
 * Endpoint para migrar datos de JSON a Postgres
 * SOLO debe ejecutarse una vez después del primer deploy
 * 
 * POST /api/migrate
 */
export async function POST(request: NextRequest) {
  try {
    // Inicializar BD
    await initializeDatabase();
    
    // Leer datos del JSON (si existe)
    let reports: ClientReport[] = [];
    try {
      const data = await fs.readFile(REPORTS_FILE, 'utf-8');
      reports = JSON.parse(data);
    } catch (error) {
      // Si no existe el archivo, no hay nada que migrar
      return NextResponse.json({
        success: true,
        message: 'No JSON file found, nothing to migrate',
        migrated: 0
      });
    }
    
    if (reports.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No reports to migrate',
        migrated: 0
      });
    }
    
    // Migrar cada reporte
    let migrated = 0;
    let errors: string[] = [];
    
    for (const report of reports) {
      try {
        await saveReportToDB(report);
        migrated++;
      } catch (error) {
        errors.push(`Error migrating report ${report.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Migration completed: ${migrated} of ${reports.length} reports migrated`,
      migrated,
      total: reports.length,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    console.error('Error during migration:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Migration failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET - Verificar estado de migración
export async function GET() {
  try {
    const exists = await fs.access(REPORTS_FILE).then(() => true).catch(() => false);
    
    if (!exists) {
      return NextResponse.json({
        status: 'no_file',
        message: 'No JSON file found to migrate'
      });
    }
    
    const data = await fs.readFile(REPORTS_FILE, 'utf-8');
    const reports = JSON.parse(data);
    
    return NextResponse.json({
      status: 'ready',
      message: `Found ${reports.length} reports in JSON file ready to migrate`,
      count: reports.length
    });
    
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

