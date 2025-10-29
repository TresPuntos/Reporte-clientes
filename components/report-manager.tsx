'use client';

import { useState, useEffect } from 'react';
import type { ClientReport } from '@/lib/report-types';
import { getAllReports, deleteReport, getReportById, saveReport } from '@/lib/report-types';
import EditReportDialog from './edit-report-dialog';
import {
  calculateConsumptionSpeed,
  calculateAverageHoursPerTask,
  groupTasksByDescription,
  calculateTeamDistribution,
  calculateConsumptionEvolution,
  calculateCumulativeEvolution,
} from '@/lib/report-calculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Copy, ExternalLink, RotateCcw, Edit, Trash2 } from 'lucide-react';

export default function ReportManager() {
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReport, setEditingReport] = useState<ClientReport | null>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);

  useEffect(() => {
    loadReports();
    loadApiKeys();
  }, []);

  const loadReports = async () => {
    const allReports = await getAllReports();
    setReports(allReports);
    setLoading(false);
  };

  const loadApiKeys = () => {
    const stored = localStorage.getItem('toggl_api_keys');
    if (stored) {
      const keys = JSON.parse(stored);
      setApiKeys(keys);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar este reporte?')) {
      await deleteReport(id);
      await loadReports();
    }
  };

  const copyPublicUrl = (url: string) => {
    const fullUrl = `${window.location.origin}/report/${url}`;
    navigator.clipboard.writeText(fullUrl);
    alert('Link copiado al portapapeles!');
  };

  const handleRecalculate = async (report: ClientReport) => {
    if (!confirm('¿Recalcular este reporte con los nuevos cálculos mejorados?')) {
      return;
    }

    try {
      // Recalcular estadísticas con las funciones mejoradas
      const totalConsumed = report.entries.reduce((sum, e) => sum + e.duration, 0) / 3600;
      const speed = calculateConsumptionSpeed(report.entries);
      const avgHours = calculateAverageHoursPerTask(report.entries);
      const groupedTasks = groupTasksByDescription(report.entries);
      const teamDist = calculateTeamDistribution(report.entries);
      const evolution = calculateConsumptionEvolution(report.entries);
      const cumulative = calculateCumulativeEvolution(evolution);

      const updatedReport: ClientReport = {
        ...report,
        summary: {
          totalHoursConsumed: totalConsumed,
          totalHoursAvailable: report.totalHours,
          consumptionPercentage: report.totalHours > 0 ? (totalConsumed / report.totalHours) * 100 : 0,
          consumptionSpeed: speed,
          estimatedDaysRemaining: (report.totalHours > totalConsumed && speed > 0) ? Math.ceil((report.totalHours - totalConsumed) / speed) : 0,
          completedTasks: report.entries.length, // Total de entradas de tiempo
          averageHoursPerTask: avgHours,
          tasksByDescription: groupedTasks,
          teamDistribution: teamDist,
          consumptionEvolution: cumulative,
        },
        lastUpdated: new Date().toISOString(),
      };

      await saveReport(updatedReport);
      alert('✓ Reporte recalculado exitosamente!');
      await loadReports();
    } catch (error) {
      alert('Error al recalcular el reporte: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <p className="text-muted-foreground">Cargando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-3xl">Gestión de Reportes de Clientes</CardTitle>
        </CardHeader>
      </Card>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Reportes Activos ({reports.length})</h3>
        </div>
        
        {reports.length === 0 ? (
          <Card>
            <CardContent className="p-12 flex flex-col items-center justify-center text-center">
              <p className="text-muted-foreground text-lg">No hay reportes creados aún</p>
              <p className="text-muted-foreground text-sm mt-2">Crea tu primer reporte desde la pestaña "Crear Reporte"</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <Card key={report.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-2xl mb-4">{report.name}</CardTitle>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground mb-1">Horas Totales</p>
                          <p className="font-semibold text-xl text-foreground">{report.totalHours}h</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Horas Consumidas</p>
                          <p className="font-semibold text-xl text-primary">{report.summary.totalHoursConsumed.toFixed(1)}h</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Última Actualización</p>
                          <p className="text-sm text-foreground">
                            {new Date(report.lastUpdated).toLocaleString('es-ES', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Estado</p>
                          <Badge variant={report.isActive ? 'default' : 'secondary'}>
                            {report.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-6">
                      <Button
                        onClick={() => copyPublicUrl(report.publicUrl)}
                        variant="secondary"
                        size="sm"
                        className="gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        Copiar Link
                      </Button>
                      <Button
                        onClick={() => window.open(`/report/${report.publicUrl}`, '_blank')}
                        variant="default"
                        size="sm"
                        className="gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Ver Reporte
                      </Button>
                      <Button
                        onClick={() => handleRecalculate(report)}
                        variant="secondary"
                        size="sm"
                        className="gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Recalcular
                      </Button>
                      <Button
                        onClick={() => setEditingReport(report)}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Editar
                      </Button>
                      <Button
                        onClick={() => handleDelete(report.id)}
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <Separator />
                
                <CardContent className="pt-4">
                  <div className="p-3 bg-primary/5 rounded-md border border-primary/20">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Link Público:</p>
                    <code className="text-xs break-all text-foreground">{window.location.origin}/report/{report.publicUrl}</code>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {editingReport && (
        <EditReportDialog
          report={editingReport}
          apiKeys={apiKeys}
          onClose={() => setEditingReport(null)}
          onUpdated={loadReports}
        />
      )}
    </div>
  );
}

