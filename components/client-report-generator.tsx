'use client';

import { useState, useEffect } from 'react';
import type { ApiKeyInfo } from '@/lib/types';
import type { ClientReport, ReportConfig } from '@/lib/report-types';
import { getMe, getTimeEntries } from '@/lib/toggl';
import { saveReport, getAllReports } from '@/lib/report-types';
import {
  calculateConsumptionSpeed,
  calculateAverageHoursPerTask,
  groupTasksByDescription,
  calculateTeamDistribution,
  calculateConsumptionEvolution,
  calculateCumulativeEvolution,
} from '@/lib/report-calculations';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function ClientReportGenerator({ apiKeys }: { apiKeys: ApiKeyInfo[] }) {
  const [reportName, setReportName] = useState('');
  const [totalHours, setTotalHours] = useState(80);
  const [configs, setConfigs] = useState<ReportConfig[]>([]);
  const [startDate, setStartDate] = useState('');
  const [manualEntries, setManualEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [newReportUrl, setNewReportUrl] = useState<string | null>(null);

  // Set default date to the earliest allowed date by Toggl API
  useEffect(() => {
    // Toggl API allows data from 2025-07-27 onwards
    const togglMinDate = '2025-07-27';
    setStartDate(togglMinDate);
  }, []);

  const addConfig = () => {
    if (apiKeys.length === 0) {
      setError('Primero debes agregar al menos una cuenta de Toggl');
      return;
    }
    const newConfig: ReportConfig = {
      id: crypto.randomUUID(),
      selectedApiKey: apiKeys[0].id,
    };
    setConfigs([...configs, newConfig]);
  };

  const removeConfig = (id: string) => {
    setConfigs(configs.filter(config => config.id !== id));
  };

  const updateConfig = (id: string, updates: Partial<ReportConfig>) => {
    setConfigs(configs.map(config => (config.id === id ? { ...config, ...updates } : config)));
  };

  const generatePublicUrl = (): string => {
    return crypto.randomUUID();
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const entries = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',').map(v => v.trim());
        const entry: any = {};
        headers.forEach((header, index) => {
          entry[header] = values[index];
        });
        return entry;
      }).filter(entry => entry.Description);

      // Convert to TimeEntry format
      const timeEntries = entries.map((entry, index) => {
        // Parse duration from HH:MM:SS to seconds
        const [h, m, s] = entry['Duration (HH:MM:SS)']?.split(':').map(Number) || [0, 0, 0];
        const duration = (h * 3600) + (m * 60) + s;

        // Combine date and time
        const date = entry.Date;
        const [sh, sm] = entry['Start Time']?.split(':').map(Number) || [0, 0];
        const [eh, em] = entry['End Time']?.split(':').map(Number) || [0, 0];

        const startDate = new Date(date);
        startDate.setHours(sh, sm, 0, 0);

        return {
          id: -1000 - index, // Negative IDs to differentiate from API entries
          guid: `manual-${index}`,
          wid: 1,
          pid: null,
          billable: false,
          start: startDate.toISOString(),
          stop: null,
          duration: duration,
          description: entry.Description,
          duronly: false,
          at: new Date().toISOString(),
          uid: 1,
          tags: entry.Tags ? [entry.Tags] : [],
          project_name: entry.Project || 'Sin proyecto',
          client_name: 'Gibobs',
          tag_names: entry.Tags ? [entry.Tags] : [],
          user_name: entry.Member || 'Desconocido',
        };
      });

      setManualEntries(timeEntries);
      setError(null);
    };

    reader.readAsText(file);
  };

  const handleCreateReport = async () => {
    if (!reportName.trim()) {
      setError('Por favor ingresa un nombre para el reporte');
      return;
    }
    if (configs.length === 0) {
      setError('Por favor agrega al menos una configuración');
      return;
    }
    if (!startDate) {
      setError('Por favor selecciona la fecha de inicio');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);
    
    // Calculate date range to show progress
    const currentDate = new Date().toISOString().split('T')[0];
    const start = new Date(startDate);
    const end = new Date(currentDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const chunksNeeded = Math.ceil(diffDays / 90);
    
    if (chunksNeeded > 1) {
      setLoadingMessage(`Cargando datos de ${chunksNeeded} períodos... Esto puede tomar unos momentos.`);
    } else {
      setLoadingMessage('Cargando datos...');
    }

    try {
      const allEntries: any[] = [];
      
      for (const config of configs) {
        const apiKeyInfo = apiKeys.find(k => k.id === config.selectedApiKey);
        if (!apiKeyInfo) continue;

        const workspaceId = apiKeyInfo.workspaces[0]?.id;
        if (!workspaceId) continue;

        const entries = await getTimeEntries(apiKeyInfo.key, startDate, currentDate, workspaceId);

        let filtered = entries;
        if (config.selectedClient) {
          filtered = filtered.filter(entry => {
            const project = apiKeyInfo.projects.find(p => p.id === entry.pid);
            return project && project.cid === Number(config.selectedClient);
          });
        }
        if (config.selectedProject) {
          filtered = filtered.filter(entry => entry.pid === Number(config.selectedProject));
        }
        if (config.selectedTag) {
          filtered = filtered.filter(entry => entry.tags && entry.tags.includes(config.selectedTag!));
        }

        const enriched = filtered.map(entry => {
          const project = apiKeyInfo.projects.find(p => p.id === entry.pid);
          const client = project?.cid ? apiKeyInfo.clients.find(c => c.id === project.cid) : null;
          return {
            ...entry,
            project_name: project?.name || 'Sin proyecto',
            client_name: client?.name || 'Sin cliente',
            tag_names: entry.tags || [],
            user_name: apiKeyInfo.fullname,
          };
        });

        allEntries.push(...enriched);
      }

      // Añadir las entradas manuales importadas del CSV
      allEntries.push(...manualEntries);

      // Añadir un aviso si hay entradas antes de 2025-07-27 que necesitan ser añadidas manualmente
      const earliestEntry = allEntries.length > 0 ? allEntries.reduce((earliest, entry) => {
        const entryDate = new Date(entry.start);
        return entryDate < new Date(earliest.start) ? entry : earliest;
      }) : null;
      
      if (earliestEntry && new Date(earliestEntry.start) >= new Date('2025-07-27')) {
        console.log('Todas las entradas son desde 2025-07-27 o posterior');
        console.log('Para añadir datos anteriores, por favor indícame los datos del PDF');
      }

      // Calcular estadísticas
      const totalConsumed = allEntries.reduce((sum, e) => sum + e.duration, 0) / 3600;
      const speed = calculateConsumptionSpeed(allEntries);
      const avgHours = calculateAverageHoursPerTask(allEntries);
      const groupedTasks = groupTasksByDescription(allEntries);
      const teamDist = calculateTeamDistribution(allEntries);
      const evolution = calculateConsumptionEvolution(allEntries);
      const cumulative = calculateCumulativeEvolution(evolution);

      const report: ClientReport = {
        id: crypto.randomUUID(),
        name: reportName,
        totalHours,
        price: 0,
        startDate,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        publicUrl: generatePublicUrl(),
        isActive: true,
        configs,
        entries: allEntries,
        summary: {
          totalHoursConsumed: totalConsumed,
          totalHoursAvailable: totalHours,
          consumptionPercentage: totalHours > 0 ? (totalConsumed / totalHours) * 100 : 0,
          consumptionSpeed: speed,
          estimatedDaysRemaining: (totalHours > totalConsumed && speed > 0) ? Math.ceil((totalHours - totalConsumed) / speed) : 0,
          completedTasks: allEntries.length, // Total de entradas de tiempo
          averageHoursPerTask: avgHours,
          tasksByDescription: groupedTasks,
          teamDistribution: teamDist,
          consumptionEvolution: cumulative,
        },
      };

      await saveReport(report);
      setSuccess(true);
      setLoadingMessage('');
      
      // Mostrar el link del reporte
      const reportUrl = `${window.location.origin}/report/${report.publicUrl}`;
      setNewReportUrl(reportUrl);
      console.log('Reporte creado:', reportUrl);
      
      setReportName('');
      setConfigs([]);
      
      setTimeout(() => {
        setSuccess(false);
        setNewReportUrl(null);
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el reporte');
      setLoadingMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6">Crear Reporte de Cliente</h2>

      <div className="mb-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nombre del Reporte</label>
            <Input
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="Ej: Cliente ABC - Q1 2025"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Total de Horas del Paquete</label>
            <Input
              type="number"
              value={totalHours}
              onChange={(e) => setTotalHours(Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Fecha de Inicio del Paquete</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            min="2025-07-27"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Toggl solo permite obtener datos desde 2025-07-27 en adelante
          </p>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Configuraciones de Toggl</h3>
          <Button onClick={addConfig}>
            + Añadir Configuración
          </Button>
        </div>

        <div className="space-y-4">
          {configs.map((config) => {
            const apiKeyInfo = apiKeys.find(k => k.id === config.selectedApiKey);
            return (
              <Card key={config.id} className="p-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Cuenta</label>
                    <select
                      value={config.selectedApiKey}
                      onChange={(e) => updateConfig(config.id, { selectedApiKey: e.target.value, selectedClient: '', selectedProject: '', selectedTag: '' })}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background"
                    >
                      {apiKeys.map(key => (
                        <option key={key.id} value={key.id}>{key.fullname}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Cliente</label>
                    <select
                      value={config.selectedClient || ''}
                      onChange={(e) => updateConfig(config.id, { selectedClient: e.target.value })}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background"
                    >
                      <option value="">Todos</option>
                      {(apiKeyInfo?.clients || []).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Proyecto</label>
                    <select
                      value={config.selectedProject || ''}
                      onChange={(e) => updateConfig(config.id, { selectedProject: e.target.value })}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background"
                    >
                      <option value="">Todos</option>
                      {(apiKeyInfo?.projects || []).filter(p => !config.selectedClient || p.cid === Number(config.selectedClient)).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Tag</label>
                    <select
                      value={config.selectedTag || ''}
                      onChange={(e) => updateConfig(config.id, { selectedTag: e.target.value })}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background"
                    >
                      <option value="">Todas</option>
                      {(apiKeyInfo?.tags || []).map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button onClick={() => removeConfig(config.id)} variant="destructive" size="sm" className="mt-3">
                  Eliminar
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="mb-6 p-4 bg-primary/5 border-primary/20">
        <h3 className="text-lg font-semibold mb-2">Importar Datos Históricos (CSV)</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Si necesitas añadir datos anteriores al 2025-07-27, sube un archivo CSV con el formato de la plantilla.
        </p>
        <input
          type="file"
          accept=".csv"
          onChange={handleCsvUpload}
          className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
        />
        {manualEntries.length > 0 && (
          <Badge className="mt-2 bg-primary text-primary-foreground">
            ✓ {manualEntries.length} entradas importadas correctamente
          </Badge>
        )}
      </Card>

      <Button
        onClick={handleCreateReport}
        disabled={isLoading || configs.length === 0}
        className="w-full"
      >
        {isLoading ? 'Creando...' : 'Crear Reporte de Cliente'}
      </Button>

      {error && <p className="mt-4 text-destructive">{error}</p>}
      {isLoading && loadingMessage && (
        <Card className="mt-4 p-4 bg-primary/5 border-primary/20">
          <p className="text-primary">{loadingMessage}</p>
        </Card>
      )}
      {success && newReportUrl && (
        <Card className="mt-4 p-4 bg-primary/5 border-primary/20">
          <p className="font-semibold mb-2">✓ Reporte creado exitosamente!</p>
          <p className="text-sm text-muted-foreground mb-2">Link del reporte:</p>
          <div className="flex gap-2">
            <code className="flex-1 p-2 bg-background border border-input rounded-md text-xs break-all">
              {newReportUrl}
            </code>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(newReportUrl);
                alert('Link copiado!');
              }}
              size="sm"
              variant="secondary"
            >
              Copiar
            </Button>
            <a
              href={newReportUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="default">
                Ver Reporte
              </Button>
            </a>
          </div>
        </Card>
      )}
      </div>
    </Card>
  );
}

