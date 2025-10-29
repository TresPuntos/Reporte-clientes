'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ApiKeyInfo, ReportConfig, TimeEntry } from '@/lib/types';
import { getTimeEntries } from '@/lib/toggl';
import SummaryView from './summary-view';
import TimeEntriesTable from './time-entries-table';

export default function ReportGenerator({ apiKeys }: { apiKeys: ApiKeyInfo[] }) {
  const [configs, setConfigs] = useState<ReportConfig[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Set default dates (last 30 days)
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
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
    setConfigs(
      configs.map(config => 
        config.id === id ? { ...config, ...updates } : config
      )
    );
  };

  const handleShowEntries = async () => {
    if (configs.length === 0) {
      setError('Por favor agrega al menos una configuración de reporte');
      return;
    }

    if (!startDate || !endDate) {
      setError('Por favor selecciona las fechas');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    // Calculate date range to show progress
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const chunksNeeded = Math.ceil(diffDays / 90);
    
    if (chunksNeeded > 1) {
      setLoadingMessage(`Cargando datos de ${chunksNeeded} períodos... Esto puede tomar unos momentos.`);
    } else {
      setLoadingMessage('Cargando datos...');
    }

    try {
      const allEntries: TimeEntry[] = [];

      for (const config of configs) {
        const apiKeyInfo = apiKeys.find(k => k.id === config.selectedApiKey);
        if (!apiKeyInfo) continue;

        const workspaceId = apiKeyInfo.workspaces[0]?.id;
        if (!workspaceId) continue;

        const entries = await getTimeEntries(
          apiKeyInfo.key,
          startDate,
          endDate,
          workspaceId
        );

        // Filter entries based on selected filters
        let filteredEntries = entries;

        if (config.selectedClient) {
          filteredEntries = filteredEntries.filter(entry => {
            const project = apiKeyInfo.projects.find(p => p.id === entry.pid);
            return project && project.cid === Number(config.selectedClient);
          });
        }

        if (config.selectedProject) {
          filteredEntries = filteredEntries.filter(entry => 
            entry.pid === Number(config.selectedProject)
          );
        }

        if (config.selectedTag) {
          filteredEntries = filteredEntries.filter(entry =>
            entry.tags && entry.tags.includes(config.selectedTag!)
          );
        }

        // Enrich entries with additional data
        const enrichedEntries = filteredEntries.map(entry => {
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

        allEntries.push(...enrichedEntries);
      }

      // Sort by date
      allEntries.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

      setTimeEntries(allEntries);
      setLoadingMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al obtener las entradas');
      setLoadingMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  const generateClientReport = () => {
    if (timeEntries.length === 0) {
      setError('No hay entradas para generar el reporte');
      return;
    }

    // Group entries for summary
    const grouped = timeEntries.reduce((acc, entry) => {
      if (!acc[entry.description]) {
        acc[entry.description] = {
          description: entry.description,
          totalDuration: 0,
          count: 0,
          projects: new Set<string>(),
          clients: new Set<string>(),
        };
      }
      acc[entry.description].totalDuration += entry.duration;
      acc[entry.description].count += 1;
      if (entry.project_name) acc[entry.description].projects.add(entry.project_name);
      if (entry.client_name) acc[entry.description].clients.add(entry.client_name);
      return acc;
    }, {} as Record<string, { description: string; totalDuration: number; count: number; projects: Set<string>; clients: Set<string> }>);

    const totalHours = timeEntries.reduce((sum, e) => sum + e.duration, 0) / 3600;

    // Generate HTML for client report
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte de Tiempo - Toggl</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header h1 {
      margin: 0 0 10px 0;
      color: #333;
    }
    .header p {
      margin: 5px 0;
      color: #666;
    }
    .total-hours {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
      margin-top: 10px;
    }
    .summary, .entries {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary h2, .entries h2 {
      margin-top: 0;
      color: #333;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th, td {
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid #eee;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #555;
    }
    tr:hover {
      background: #f8f9fa;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      margin-right: 4px;
    }
    .badge-project {
      background: #dbeafe;
      color: #1e40af;
    }
    .badge-client {
      background: #dcfce7;
      color: #166534;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Reporte de Tiempo</h1>
    <p><strong>Período:</strong> ${new Date(startDate).toLocaleDateString('es-ES')} - ${new Date(endDate).toLocaleDateString('es-ES')}</p>
    <p><strong>Total de Entradas:</strong> ${timeEntries.length}</p>
    <p class="total-hours">Total: ${totalHours.toFixed(2)} horas</p>
  </div>

  <div class="summary">
    <h2>Resumen de Tareas</h2>
    <table>
      <thead>
        <tr>
          <th>Tarea</th>
          <th>Horas</th>
          <th>%</th>
          <th>Entradas</th>
          <th>Proyectos</th>
          <th>Clientes</th>
        </tr>
      </thead>
      <tbody>
        ${Object.values(grouped)
          .sort((a, b) => b.totalDuration - a.totalDuration)
          .map(item => {
            const hours = item.totalDuration / 3600;
            const percentage = (hours / totalHours * 100).toFixed(1);
            return `
            <tr>
              <td>${item.description || 'Sin descripción'}</td>
              <td><strong>${hours.toFixed(2)}h</strong></td>
              <td>${percentage}%</td>
              <td>${item.count}</td>
              <td>${Array.from(item.projects).map(p => `<span class="badge badge-project">${p}</span>`).join('')}</td>
              <td>${Array.from(item.clients).map(c => `<span class="badge badge-client">${c}</span>`).join('')}</td>
            </tr>
          `;
          }).join('')}
      </tbody>
    </table>
  </div>

  <div class="entries">
    <h2>Detalle de Entradas</h2>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Hora</th>
          <th>Descripción</th>
          <th>Proyecto</th>
          <th>Cliente</th>
          <th>Duración</th>
        </tr>
      </thead>
      <tbody>
        ${timeEntries.map(entry => {
          const date = new Date(entry.start);
          const duration = entry.duration / 3600;
          return `
          <tr>
            <td>${date.toLocaleDateString('es-ES')}</td>
            <td>${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td>
            <td>${entry.description || 'Sin descripción'}</td>
            <td>${entry.project_name || '-'}</td>
            <td>${entry.client_name || '-'}</td>
            <td>${duration.toFixed(2)}h</td>
          </tr>
        `;
        }).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
    `;

    // Download the HTML file
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-toggl-${startDate}-${endDate}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Generador de Reportes</h2>

      <div className="mb-6 flex gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Fecha Inicio</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Fecha Fin</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Configuraciones de Reporte</h3>
          <button
            onClick={addConfig}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            + Añadir Configuración
          </button>
        </div>

        <div className="space-y-4">
          {configs.map((config) => {
            const apiKeyInfo = apiKeys.find(k => k.id === config.selectedApiKey);
            
            const availableClients = apiKeyInfo?.clients || [];
            const availableProjects = apiKeyInfo?.projects || [];
            const availableTags = apiKeyInfo?.tags || [];

            return (
              <div key={config.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Cuenta Toggl</label>
                    <select
                      value={config.selectedApiKey}
                      onChange={(e) => updateConfig(config.id, { selectedApiKey: e.target.value, selectedClient: '', selectedProject: '', selectedTag: '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {apiKeys.map(key => (
                        <option key={key.id} value={key.id}>{key.fullname}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Cliente (opcional)</label>
                    <select
                      value={config.selectedClient || ''}
                      onChange={(e) => updateConfig(config.id, { selectedClient: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Todos los clientes</option>
                      {availableClients.map(client => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Proyecto (opcional)</label>
                    <select
                      value={config.selectedProject || ''}
                      onChange={(e) => updateConfig(config.id, { selectedProject: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Todos los proyectos</option>
                      {availableProjects
                        .filter(p => !config.selectedClient || p.cid === Number(config.selectedClient))
                        .map(project => (
                          <option key={project.id} value={project.id}>{project.name}</option>
                        ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Tag (opcional)</label>
                    <select
                      value={config.selectedTag || ''}
                      onChange={(e) => updateConfig(config.id, { selectedTag: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Todas las tags</option>
                      {availableTags.map(tag => (
                        <option key={tag.id} value={tag.name}>{tag.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <button
                  onClick={() => removeConfig(config.id)}
                  className="mt-3 px-4 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                >
                  Eliminar
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-6 flex gap-3">
        <button
          onClick={handleShowEntries}
          disabled={isLoading || configs.length === 0}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Cargando...' : 'Actualizar Reporte'}
        </button>
        
        {timeEntries.length > 0 && (
          <button
            onClick={generateClientReport}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Generar Reporte HTML para Cliente
          </button>
        )}
      </div>

      {error && <p className="mb-4 text-red-600">{error}</p>}
      {isLoading && loadingMessage && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800">{loadingMessage}</p>
        </div>
      )}

      {timeEntries.length > 0 && (
        <div className="mt-6">
          <div className="flex gap-4 mb-4">
            <div className="px-4 py-2 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Entradas</p>
              <p className="text-2xl font-bold text-blue-600">{timeEntries.length}</p>
            </div>
            <div className="px-4 py-2 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Horas</p>
              <p className="text-2xl font-bold text-green-600">
                {(timeEntries.reduce((sum, e) => sum + e.duration, 0) / 3600).toFixed(2)}h
              </p>
            </div>
          </div>
          
          <div className="border-t pt-6">
            <SummaryView entries={timeEntries} />
            <TimeEntriesTable entries={timeEntries} />
          </div>
        </div>
      )}
    </div>
  );
}

