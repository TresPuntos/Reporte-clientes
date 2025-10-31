import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { ClientReport } from '@/lib/report-types';

const DATA_DIR = path.join(process.cwd(), 'data');
const REPORTS_FILE = path.join(DATA_DIR, 'client-reports.json');

// Asegurar que el directorio data existe
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Leer todos los reportes
async function getAllReports(): Promise<ClientReport[]> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(REPORTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    // Si el archivo no existe, retornar array vacío
    return [];
  }
}

// Guardar todos los reportes
async function saveAllReports(reports: ClientReport[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf-8');
}

// GET - Obtener todos los reportes
export async function GET() {
  try {
    const reports = await getAllReports();
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
    const report: ClientReport = await request.json();
    const reports = await getAllReports();
    
    const index = reports.findIndex(r => r.id === report.id);
    if (index >= 0) {
      reports[index] = report;
    } else {
      reports.push(report);
    }
    
    await saveAllReports(reports);
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { message: 'ID is required' },
        { status: 400 }
      );
    }
    
    const reports = await getAllReports();
    const filtered = reports.filter(r => r.id !== id);
    await saveAllReports(filtered);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json(
      { message: 'Error deleting report' },
      { status: 500 }
    );
  }
}

