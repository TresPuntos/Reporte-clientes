'use client';

import { useState, useEffect, use } from 'react';
import ClientReportDashboard from '@/components/client-report-dashboard';
import { getReportByPublicUrl, type ClientReport } from '@/lib/report-types';

export default function ClientReportPage({ params }: { params: Promise<{ publicUrl: string }> }) {
  const { publicUrl } = use(params);
  const [report, setReport] = useState<ClientReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReport() {
      const found = await getReportByPublicUrl(publicUrl);
      setReport(found);
      setLoading(false);
    }
    loadReport();
  }, [publicUrl]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando reporte...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Reporte no encontrado</h1>
          <p className="text-gray-600">El reporte que buscas no existe o ha sido eliminado.</p>
        </div>
      </div>
    );
  }

  return <ClientReportDashboard report={report} />;
}

