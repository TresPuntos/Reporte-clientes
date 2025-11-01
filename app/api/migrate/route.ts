import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { initializeDatabase, saveReportToDB, saveApiKeyToDB, getAllReportsFromDB, getAllApiKeysFromDB } from '@/lib/db';
import type { ClientReport } from '@/lib/report-types';
import type { ApiKeyInfo } from '@/lib/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const REPORTS_FILE = path.join(DATA_DIR, 'client-reports.json');

/**
 * Endpoint para migrar datos desde localStorage (cliente) o JSON (servidor) a Postgres
 * 
 * POST /api/migrate
 * Body opcional:
 * - reports: ClientReport[] (para migrar desde cliente)
 * - apiKeys: ApiKeyInfo[] (para migrar desde cliente)
 */
export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    
    const body = await request.json().catch(() => ({}));
    const reportsFromClient = body.reports || [];
    const apiKeysFromClient = body.apiKeys || [];
    
    const results: string[] = [];
    
    // 1. Migrar reportes
    let reports: ClientReport[] = [];
    
    // Prioridad: datos del cliente > JSON del servidor
    if (reportsFromClient.length > 0) {
      reports = reportsFromClient;
      results.push(`Recibidos ${reports.length} reportes del cliente para migrar`);
    } else {
      // Intentar leer del JSON local
      try {
        const data = await fs.readFile(REPORTS_FILE, 'utf-8');
        reports = JSON.parse(data);
        if (reports.length > 0) {
          results.push(`Encontrados ${reports.length} reportes en JSON local`);
        }
      } catch (error) {
        // No hay JSON, no hay problema
      }
    }
    
    // Verificar si ya hay datos en BD
    const existingReports = await getAllReportsFromDB();
    if (existingReports.length > 0 && reports.length > 0) {
      results.push(`⚠️ La BD ya tiene ${existingReports.length} reportes. Los nuevos se añadirán (sin duplicar IDs)`);
    }
    
    // Migrar reportes (evitando duplicados)
    let reportsMigrated = 0;
    const existingReportIds = new Set(existingReports.map(r => r.id));
    
    for (const report of reports) {
      try {
        if (!existingReportIds.has(report.id)) {
          await saveReportToDB(report);
          reportsMigrated++;
        }
      } catch (error) {
        console.error(`Error migrating report ${report.id}:`, error);
      }
    }
    
    if (reportsMigrated > 0) {
      results.push(`✅ Migrados ${reportsMigrated} reportes a la BD`);
    } else if (reports.length > 0) {
      results.push(`ℹ️ Los reportes ya estaban en la BD (sin duplicados)`);
    }
    
    // 2. Migrar API keys
    let apiKeys: ApiKeyInfo[] = [];
    
    if (apiKeysFromClient.length > 0) {
      apiKeys = apiKeysFromClient;
      results.push(`Recibidas ${apiKeys.length} API keys del cliente para migrar`);
    }
    
    // Verificar si ya hay API keys en BD
    const existingApiKeys = await getAllApiKeysFromDB();
    if (existingApiKeys.length > 0 && apiKeys.length > 0) {
      results.push(`⚠️ La BD ya tiene ${existingApiKeys.length} API keys. Las nuevas se añadirán (sin duplicar IDs)`);
    }
    
    // Migrar API keys (evitando duplicados)
    let apiKeysMigrated = 0;
    const existingApiKeyIds = new Set(existingApiKeys.map(k => k.id));
    
    for (const keyInfo of apiKeys) {
      try {
        if (!existingApiKeyIds.has(keyInfo.id)) {
          await saveApiKeyToDB(
            keyInfo.id,
            keyInfo.key,
            keyInfo.fullname,
            keyInfo.email,
            keyInfo.workspaces || [],
            keyInfo.clients || [],
            keyInfo.projects || [],
            keyInfo.tags || []
          );
          apiKeysMigrated++;
        }
      } catch (error) {
        console.error(`Error migrating API key ${keyInfo.id}:`, error);
      }
    }
    
    if (apiKeysMigrated > 0) {
      results.push(`✅ Migradas ${apiKeysMigrated} API keys a la BD`);
    } else if (apiKeys.length > 0) {
      results.push(`ℹ️ Las API keys ya estaban en la BD (sin duplicados)`);
    }
    
    // Resultado final
    const totalMigrated = reportsMigrated + apiKeysMigrated;
    
    if (totalMigrated === 0 && reports.length === 0 && apiKeys.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay datos para migrar',
        migrated: 0,
        details: results
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Migración completada: ${reportsMigrated} reportes, ${apiKeysMigrated} API keys`,
      migrated: totalMigrated,
      reportsMigrated,
      apiKeysMigrated,
      details: results
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

