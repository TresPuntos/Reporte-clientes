'use client';

import { useState, useEffect } from 'react';
import type { ClientReport } from '@/lib/report-types';
import { getAllReports, deleteReport, getReportById, saveReport } from '@/lib/report-types';
import EditReportDialog from './edit-report-dialog';
import { getTimeEntries } from '@/lib/toggl';
import { getTogglMinDateSync } from '@/lib/toggl-date-utils';
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
    try {
      const allReports = await getAllReports();
      setReports(allReports);
      
      // Migrar datos de localStorage al servidor si existen y el servidor está vacío
      if (typeof window !== 'undefined' && allReports.length === 0) {
        const localData = localStorage.getItem('client_reports');
        if (localData) {
          try {
            const localReports = JSON.parse(localData);
            if (localReports.length > 0) {
              // Migrar cada reporte al servidor
              for (const report of localReports) {
                await saveReport(report);
              }
              // Recargar después de la migración
              const migratedReports = await getAllReports();
              setReports(migratedReports);
            }
          } catch (error) {
            console.error('Error migrating reports:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
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
    if (!confirm('¿Recalcular este reporte? Esto volverá a obtener las entradas de Toggl con los filtros actuales y recalculará todas las estadísticas.')) {
      return;
    }

    try {
      // Separar entradas históricas (CSV) de las entradas de Toggl
      let historicalEntries = report.entries.filter((e: any) => e.id < 0);
      
      // Filtrar entradas históricas por tags del reporte si están configurados
      if (report.reportTags && report.reportTags.length > 0) {
        const reportTagNames = report.reportTags.map(t => t.name);
        // Normalizar tags del reporte para comparación (lowercase y sin espacios)
        const normalizedReportTags = reportTagNames.map(tag => tag.toLowerCase().replace(/\s+/g, ''));
        historicalEntries = historicalEntries.filter((entry: any) => {
          const entryTags = entry.tag_names || entry.tags || [];
          if (entryTags.length === 0) {
            return false;
          }
          return entryTags.some((tag: string) => {
            const normalizedTag = tag.toLowerCase().replace(/\s+/g, '');
            return normalizedReportTags.includes(normalizedTag);
          });
        });
      }

      // Obtener API keys desde localStorage
      const stored = localStorage.getItem('toggl_api_keys');
      if (!stored) {
        throw new Error('No se encontraron API keys configuradas');
      }

      const storedApiKeys = JSON.parse(stored);
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Asegurar que la fecha de inicio no sea anterior a la fecha mínima de Toggl
      const togglMinDate = getTogglMinDateSync();
      const effectiveStartDate = report.startDate < togglMinDate ? togglMinDate : report.startDate;
      
      const allTogglEntries: any[] = [];

      // Obtener nuevas entradas de Toggl usando las configuraciones del reporte
      for (const config of report.configs) {
        const apiKeyInfo = storedApiKeys.find((k: any) => k.id === config.selectedApiKey);
        if (!apiKeyInfo) {
          console.warn(`API key no encontrada para config: ${config.id}`);
          continue;
        }

        // Usar el workspace seleccionado en la configuración, o el primero si no está especificado
        const workspaceId = config.selectedWorkspace 
          ? apiKeyInfo.workspaces.find((w: any) => w.id === config.selectedWorkspace)?.id
          : apiKeyInfo.workspaces[0]?.id;
        if (!workspaceId) {
          console.warn(`Workspace ID no encontrado para ${apiKeyInfo.fullname}`);
          continue;
        }

        console.log(`[Recalculate] Obteniendo entradas desde ${effectiveStartDate} hasta ${currentDate} para ${apiKeyInfo.fullname}, workspace ${workspaceId}`);
        const entries = await getTimeEntries(apiKeyInfo.key, effectiveStartDate, currentDate, workspaceId);
        console.log(`[Recalculate] Total entradas obtenidas: ${entries.length}`);

        // Aplicar filtros
        let filtered = entries;
        if (config.selectedClient) {
          filtered = filtered.filter((entry: any) => {
            const project = apiKeyInfo.projects.find((p: any) => p.id === entry.pid);
            return project && project.cid === Number(config.selectedClient);
          });
          console.log(`[Recalculate] Después de filtrar por cliente: ${filtered.length} de ${entries.length}`);
        }
        if (config.selectedProject) {
          filtered = filtered.filter((entry: any) => entry.pid === Number(config.selectedProject));
          console.log(`[Recalculate] Después de filtrar por proyecto: ${filtered.length}`);
        }
        // Filtrar por tags del reporte si están configurados
        if (report.reportTags && report.reportTags.length > 0) {
          const reportTagNames = report.reportTags.map(t => t.name);
          // Normalizar tags del reporte para comparación (lowercase y sin espacios)
          const normalizedReportTags = reportTagNames.map(tag => tag.toLowerCase().replace(/\s+/g, ''));
          const beforeTagFilter = filtered.length;
          filtered = filtered.filter((entry: any) => {
            if (!entry.tags || entry.tags.length === 0) {
              return false;
            }
            return entry.tags.some((tag: string) => {
              const normalizedTag = tag.toLowerCase().replace(/\s+/g, '');
              return normalizedReportTags.includes(normalizedTag);
            });
          });
          console.log(`[Recalculate] Después de filtrar por tags (${reportTagNames.join(', ')}): ${filtered.length} de ${beforeTagFilter}`);
        }

        // Enriquecer entradas
        const enriched = filtered.map((entry: any) => {
          const project = apiKeyInfo.projects.find((p: any) => p.id === entry.pid);
          const client = project?.cid ? apiKeyInfo.clients.find((c: any) => c.id === project.cid) : null;
          return {
            ...entry,
            project_name: project?.name || 'Sin proyecto',
            client_name: client?.name || 'Sin cliente',
            tag_names: entry.tags || [],
            user_name: apiKeyInfo.fullname,
          };
        });

        allTogglEntries.push(...enriched);
      }

      // Combinar entradas históricas (CSV) con las nuevas entradas de Toggl
      const allEntries = [...historicalEntries, ...allTogglEntries];
      console.log(`[Recalculate] Total entradas finales: ${allEntries.length} (${historicalEntries.length} históricas + ${allTogglEntries.length} de Toggl)`);

      // Recalcular estadísticas con todas las entradas
      const totalConsumed = allEntries.reduce((sum, e) => sum + e.duration, 0) / 3600;
      const speed = calculateConsumptionSpeed(allEntries);
      const avgHours = calculateAverageHoursPerTask(allEntries);
      const groupedTasks = groupTasksByDescription(allEntries);
      const teamDist = calculateTeamDistribution(allEntries);
      const evolution = calculateConsumptionEvolution(allEntries);
      const cumulative = calculateCumulativeEvolution(evolution);

      const updatedReport: ClientReport = {
        ...report,
        entries: allEntries,
        summary: {
          totalHoursConsumed: totalConsumed,
          totalHoursAvailable: report.totalHours,
          consumptionPercentage: report.totalHours > 0 ? (totalConsumed / report.totalHours) * 100 : 0,
          consumptionSpeed: speed,
          estimatedDaysRemaining: (report.totalHours > totalConsumed && speed > 0) ? Math.ceil((report.totalHours - totalConsumed) / speed) : 0,
          completedTasks: groupedTasks.length,
          averageHoursPerTask: avgHours,
          tasksByDescription: groupedTasks,
          teamDistribution: teamDist,
          consumptionEvolution: cumulative,
        },
        lastUpdated: new Date().toISOString(),
      };

      await saveReport(updatedReport);
      alert('✓ Reporte recalculado exitosamente! Se obtuvieron nuevas entradas de Toggl y se recalculó todo.');
      await loadReports();
    } catch (error) {
      console.error('Error al recalcular:', error);
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

