import { NextRequest, NextResponse } from 'next/server';
import type { ClientReport } from '@/lib/report-types';
import { 
  initializeDatabase, 
  getAllReportsFromDB, 
  saveReportToDB, 
  deleteReportFromDB 
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
      // Continuar aunque falle, puede que ya esté inicializada
    }
  }
}

// GET - Obtener todos los reportes
export async function GET() {
  try {
    await ensureDBInitialized();
    const reports = await getAllReportsFromDB();
    return NextResponse.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { message: 'Error fetching reports' },
      { status: 500 }
    );
  }
}

// POST - Crear o actualizar un reporte
export async function POST(request: NextRequest) {
  try {
    await ensureDBInitialized();
    const report: ClientReport = await request.json();
    
    await saveReportToDB(report);
    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('Error saving report:', error);
    return NextResponse.json(
      { message: 'Error saving report' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar un reporte
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
    
    await deleteReportFromDB(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json(
      { message: 'Error deleting report' },
      { status: 500 }
    );
  }
}

