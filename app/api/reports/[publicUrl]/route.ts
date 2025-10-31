import { NextRequest, NextResponse } from 'next/server';
import type { ClientReport } from '@/lib/report-types';
import { 
  initializeDatabase, 
  getReportByPublicUrlFromDB 
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicUrl: string }> }
) {
  try {
    await ensureDBInitialized();
    const { publicUrl } = await params;
    const report = await getReportByPublicUrlFromDB(publicUrl);
    
    if (!report) {
      return NextResponse.json(
        { message: 'Report not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(report);
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { message: 'Error fetching report' },
      { status: 500 }
    );
  }
}

