'use client';

import { useState, useEffect } from 'react';
import type { ClientReport, ReportConfig } from '@/lib/report-types';
import type { ApiKeyInfo } from '@/lib/types';
import { saveReport } from '@/lib/report-types';
import { getMe, getTimeEntries } from '@/lib/toggl';
import ReportTagsManager from '@/components/report-tags-manager';
import type { ReportTag } from '@/lib/report-types';
import {
  calculateConsumptionSpeed,
  calculateAverageHoursPerTask,
  groupTasksByDescription,
  calculateTeamDistribution,
  calculateConsumptionEvolution,
  calculateCumulativeEvolution,
} from '@/lib/report-calculations';
import { ShieldCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export default function EditReportDialog({ 
  report, 
  apiKeys, 
  onClose, 
  onUpdated 
}: { 
  report: ClientReport;
  apiKeys: ApiKeyInfo[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(report.name);
  const [totalHours, setTotalHours] = useState(report.totalHours);
  const [price, setPrice] = useState(report.price || 0);
  const [startDate, setStartDate] = useState(report.startDate);
  const [isActive, setIsActive] = useState(report.isActive);
  const [configs, setConfigs] = useState<ReportConfig[]>(report.configs);
  const [availableData, setAvailableData] = useState<Record<string, { clients: any[], projects: any[], tags: any[] }>>({});
  const [loading, setLoading] = useState(false);
  const [reportTags, setReportTags] = useState(report.reportTags || []);
  const [activeTag, setActiveTag] = useState(report.activeTag);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  
  // Password management states
  const [hasPassword, setHasPassword] = useState(!!report.passwordHash);
  const [newPassword, setNewPassword] = useState('');
  const [enableNewPassword, setEnableNewPassword] = useState(false);

  // Cargar datos disponibles de Toggl para cada API key
  useEffect(() => {
    const loadAvailableData = async () => {
      const data: Record<string, { clients: any[], projects: any[], tags: any[] }> = {};
      const allTags = new Set<string>();
      
      for (const apiKey of apiKeys) {
        try {
          const me = await getMe(apiKey.key);
          data[apiKey.id] = {
            clients: me.clients || [],
            projects: me.projects || [],
            tags: me.tags || [],
          };
          // Recolectar todos los tags disponibles
          (me.tags || []).forEach((tag: any) => {
            allTags.add(tag.name);
          });
        } catch (error) {
          console.error(`Error loading data for API key ${apiKey.id}:`, error);
          data[apiKey.id] = { clients: [], projects: [], tags: [] };
        }
      }
      
      setAvailableData(data);
      setAvailableTags(Array.from(allTags));
    };
    
    loadAvailableData();
  }, [apiKeys]);

  // Asegurarse de que los tags se inicializan correctamente cuando cambia el reporte
  useEffect(() => {
    if (report.reportTags) {
      setReportTags(report.reportTags);
    }
    if (report.activeTag !== undefined) {
      setActiveTag(report.activeTag);
    }
  }, [report.id]); // Solo cuando cambia el ID del reporte

  const updateConfig = (configId: string, updates: Partial<ReportConfig>) => {
    setConfigs(prev => prev.map(config => 
      config.id === configId ? { ...config, ...updates } : config
    ));
  };

  const addConfig = () => {
    if (apiKeys.length === 0) return;
    const newConfig: ReportConfig = {
      id: crypto.randomUUID(),
      selectedApiKey: apiKeys[0].id,
    };
    setConfigs([...configs, newConfig]);
  };

  const removeConfig = (configId: string) => {
    setConfigs(prev => prev.filter(config => config.id !== configId));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Verificar si han cambiado los filtros, tags o configuraciones que requieren recalcular entradas
      const filtersChanged = 
        JSON.stringify(configs) !== JSON.stringify(report.configs) ||
        JSON.stringify(reportTags) !== JSON.stringify(report.reportTags || []) ||
        startDate !== report.startDate;

      let entriesToUse = report.entries;
      let summaryToUse = report.summary;

      // Si cambiaron los filtros, recalcular las entradas
      if (filtersChanged) {
        // Separar entradas históricas (CSV) de las entradas de Toggl
        let historicalEntries = report.entries.filter((e: any) => e.id < 0);
        
      // Filtrar entradas históricas por tags si están configurados
      if (reportTags.length > 0) {
        const reportTagNames = reportTags.map(t => t.name);
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
        if (stored) {
          const storedApiKeys = JSON.parse(stored);
          const currentDate = new Date().toISOString().split('T')[0];
          const allTogglEntries: any[] = [];

          // Obtener nuevas entradas de Toggl usando las configuraciones ACTUALIZADAS
          for (const config of configs) {
            const apiKeyInfo = storedApiKeys.find((k: any) => k.id === config.selectedApiKey);
            if (!apiKeyInfo) continue;

            // Usar el workspace seleccionado en la configuración, o el primero si no está especificado
            const workspaceId = config.selectedWorkspace 
              ? apiKeyInfo.workspaces.find((w: any) => w.id === config.selectedWorkspace)?.id
              : apiKeyInfo.workspaces[0]?.id;
            if (!workspaceId) continue;

            const entries = await getTimeEntries(apiKeyInfo.key, startDate, currentDate, workspaceId);

            // Aplicar filtros con las configuraciones actualizadas
            let filtered = entries;
            if (config.selectedClient) {
              filtered = filtered.filter((entry: any) => {
                const project = apiKeyInfo.projects.find((p: any) => p.id === entry.pid);
                return project && project.cid === Number(config.selectedClient);
              });
            }
            if (config.selectedProject) {
              filtered = filtered.filter((entry: any) => entry.pid === Number(config.selectedProject));
            }
            // Filtrar por tags del reporte si están configurados
            if (reportTags.length > 0) {
              const reportTagNames = reportTags.map(t => t.name);
              filtered = filtered.filter((entry: any) => 
                entry.tags && entry.tags.some((tag: string) => reportTagNames.includes(tag))
              );
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
          entriesToUse = [...historicalEntries, ...allTogglEntries];

          // Recalcular estadísticas
          const totalConsumed = entriesToUse.reduce((sum, e) => sum + e.duration, 0) / 3600;
          const speed = calculateConsumptionSpeed(entriesToUse);
          const avgHours = calculateAverageHoursPerTask(entriesToUse);
          const groupedTasks = groupTasksByDescription(entriesToUse);
          const teamDist = calculateTeamDistribution(entriesToUse);
          const evolution = calculateConsumptionEvolution(entriesToUse);
          const cumulative = calculateCumulativeEvolution(evolution);

          summaryToUse = {
            totalHoursConsumed: totalConsumed,
            totalHoursAvailable: totalHours,
            consumptionPercentage: totalHours > 0 ? (totalConsumed / totalHours) * 100 : 0,
            consumptionSpeed: speed,
            estimatedDaysRemaining: (totalHours > totalConsumed && speed > 0) ? Math.ceil((totalHours - totalConsumed) / speed) : 0,
            completedTasks: groupedTasks.length,
            averageHoursPerTask: avgHours,
            tasksByDescription: groupedTasks,
            teamDistribution: teamDist,
            consumptionEvolution: cumulative,
          };
        }
      }

      const updatedReport: ClientReport = {
        ...report,
        name,
        totalHours,
        price,
        startDate,
        isActive,
        configs, // Incluir las configuraciones actualizadas
        reportTags,
        activeTag,
        entries: entriesToUse,
        summary: summaryToUse,
        lastUpdated: new Date().toISOString(),
      };

      // Add new password if provided
      if (enableNewPassword && newPassword) {
        (updatedReport as any)._passwordPlaintext = newPassword;
      }

      await saveReport(updatedReport);
      onUpdated();
      onClose();
    } catch (error) {
      alert('Error al guardar: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    if (!confirm('¿Recalcular este reporte con los nuevos filtros y cálculos mejorados? Esto actualizará todas las estadísticas y volverá a obtener las entradas de Toggl con los filtros actualizados.')) {
      return;
    }

    setLoading(true);
    try {
      // Separar entradas históricas (CSV) de las entradas de Toggl
      let historicalEntries = report.entries.filter((e: any) => e.id < 0);
      
      // Filtrar entradas históricas por tags del reporte si están configurados
      if (reportTags.length > 0) {
        const reportTagNames = reportTags.map(t => t.name);
        historicalEntries = historicalEntries.filter((entry: any) => {
          const entryTags = entry.tag_names || entry.tags || [];
          return entryTags.length > 0 && entryTags.some((tag: string) => reportTagNames.includes(tag));
        });
      }
      
      // Obtener API keys desde localStorage
      const stored = localStorage.getItem('toggl_api_keys');
      if (!stored) {
        throw new Error('No se encontraron API keys configuradas');
      }
      
      const storedApiKeys = JSON.parse(stored);
      const currentDate = new Date().toISOString().split('T')[0];
      const allTogglEntries: any[] = [];

      // Obtener nuevas entradas de Toggl usando las configuraciones ACTUALIZADAS
      for (const config of configs) {
        const apiKeyInfo = storedApiKeys.find((k: any) => k.id === config.selectedApiKey);
        if (!apiKeyInfo) continue;

        // Usar el workspace seleccionado en la configuración, o el primero si no está especificado
        const workspaceId = config.selectedWorkspace 
          ? apiKeyInfo.workspaces.find((w: any) => w.id === config.selectedWorkspace)?.id
          : apiKeyInfo.workspaces[0]?.id;
        if (!workspaceId) continue;
        
        console.log(`[Edit] Usando workspace ${workspaceId} para ${apiKeyInfo.fullname}`);

        const entries = await getTimeEntries(apiKeyInfo.key, startDate, currentDate, workspaceId);

        // Aplicar filtros con las configuraciones actualizadas
        let filtered = entries;
        if (config.selectedClient) {
          filtered = filtered.filter((entry: any) => {
            const project = apiKeyInfo.projects.find((p: any) => p.id === entry.pid);
            return project && project.cid === Number(config.selectedClient);
          });
        }
        if (config.selectedProject) {
          filtered = filtered.filter((entry: any) => entry.pid === Number(config.selectedProject));
        }
        // Filtrar por tags del reporte si están configurados
        if (reportTags.length > 0) {
          const reportTagNames = reportTags.map(t => t.name);
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
          console.log(`[Edit] Después de filtrar por tags (${reportTagNames.join(', ')}): ${filtered.length} de ${beforeTagFilter}`);
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
        name,
        totalHours,
        price,
        startDate,
        isActive,
        configs, // Usar las configuraciones actualizadas
        reportTags,
        activeTag,
        entries: allEntries, // Actualizar con las nuevas entradas
        summary: {
          totalHoursConsumed: totalConsumed,
          totalHoursAvailable: totalHours,
          consumptionPercentage: totalHours > 0 ? (totalConsumed / totalHours) * 100 : 0,
          consumptionSpeed: speed,
          estimatedDaysRemaining: (totalHours > totalConsumed && speed > 0) ? Math.ceil((totalHours - totalConsumed) / speed) : 0,
          completedTasks: groupedTasks.length,
          averageHoursPerTask: avgHours,
          tasksByDescription: groupedTasks,
          teamDistribution: teamDist,
          consumptionEvolution: cumulative,
        },
        lastUpdated: new Date().toISOString(),
      };

      // Add new password if provided
      if (enableNewPassword && newPassword) {
        (updatedReport as any)._passwordPlaintext = newPassword;
      }

      await saveReport(updatedReport);
      alert('✓ Reporte recalculado y actualizado exitosamente con los nuevos filtros!');
      onUpdated();
      onClose();
    } catch (error) {
      alert('Error al recalcular el reporte: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      console.error('Error al recalcular:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Editar Reporte</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nombre del Reporte</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Cliente ABC - Q1 2025"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Total de Horas</label>
              <input
                type="number"
                value={totalHours}
                onChange={(e) => setTotalHours(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Precio (€)</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Fecha de Inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Reporte Activo (visible para el cliente)
            </label>
          </div>

          {/* Gestión de Contraseña */}
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Checkbox
                    id="enableNewPassword"
                    checked={enableNewPassword}
                    onCheckedChange={(checked) => setEnableNewPassword(!!checked)}
                  />
                  <Label htmlFor="enableNewPassword" className="text-sm font-medium text-purple-900 cursor-pointer">
                    {hasPassword ? 'Cambiar contraseña de acceso al reporte' : 'Proteger reporte con contraseña'}
                  </Label>
                </div>
                {hasPassword && !enableNewPassword && (
                  <p className="text-xs text-purple-700 mb-3 ml-7">
                    ✓ Este reporte está protegido con contraseña. Activa el checkbox para cambiarla.
                  </p>
                )}
                {enableNewPassword && (
                  <div className="space-y-3 mt-3 ml-7">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-purple-900">
                        {hasPassword ? 'Nueva Contraseña' : 'Contraseña'}
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Contraseña segura"
                        className="w-full px-4 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                      <p className="text-xs text-purple-700 mt-1">
                        El cliente necesitará esta contraseña para ver el reporte.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Gestión de Tags del Reporte */}
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm font-medium text-green-900 mb-3">Tags del Reporte</p>
            <ReportTagsManager
              reportTags={reportTags}
              activeTag={activeTag}
              availableTags={availableTags}
              onTagsChange={setReportTags}
              onActiveTagChange={setActiveTag}
            />
          </div>

          {/* Configuraciones de Toggl - Editable */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-medium text-blue-900">Configuraciones de Toggl</p>
              <button
                onClick={addConfig}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                + Añadir Configuración
              </button>
            </div>
            
            <div className="space-y-4">
              {configs.map((config) => {
                const apiKeyInfo = apiKeys.find(k => k.id === config.selectedApiKey);
                const data = availableData[config.selectedApiKey] || { clients: [], projects: [], tags: [] };
                
                const availableClients = data.clients || [];
                const availableProjects = data.projects.filter(p => 
                  !config.selectedClient || p.cid === Number(config.selectedClient)
                ) || [];
                const availableTags = data.tags || [];

                return (
                  <div key={config.id} className="p-3 bg-white rounded border border-blue-200">
                    <div className="flex justify-between items-start mb-3">
                      <p className="text-xs font-medium text-blue-900">
                        Configuración {configs.indexOf(config) + 1}
                      </p>
                      {configs.length > 1 && (
                        <button
                          onClick={() => removeConfig(config.id)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">API Key</label>
                        <select
                          value={config.selectedApiKey}
                          onChange={(e) => updateConfig(config.id, { selectedApiKey: e.target.value, selectedWorkspace: undefined, selectedClient: undefined, selectedProject: undefined, selectedTags: undefined })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        >
                          {apiKeys.map(key => (
                            <option key={key.id} value={key.id}>{key.fullname}</option>
                          ))}
                        </select>
                      </div>

                      {apiKeyInfo && apiKeyInfo.workspaces && apiKeyInfo.workspaces.length > 1 && (
                        <div>
                          <label className="block text-xs font-medium mb-1">Workspace</label>
                          <select
                            value={config.selectedWorkspace || apiKeyInfo.workspaces[0]?.id || ''}
                            onChange={(e) => updateConfig(config.id, { selectedWorkspace: e.target.value ? Number(e.target.value) : undefined })}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            {apiKeyInfo.workspaces.map((workspace: any) => (
                              <option key={workspace.id} value={workspace.id}>
                                {workspace.name || `Workspace ${workspace.id}`}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            {config.selectedWorkspace ? `✓ Seleccionado: ${apiKeyInfo.workspaces.find((w: any) => w.id === config.selectedWorkspace)?.name || config.selectedWorkspace}` : `⚠️ Por defecto usa: ${apiKeyInfo.workspaces[0]?.name || apiKeyInfo.workspaces[0]?.id}`}
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium mb-1">Cliente (opcional)</label>
                        <select
                          value={config.selectedClient || ''}
                          onChange={(e) => updateConfig(config.id, { selectedClient: e.target.value || undefined, selectedProject: undefined })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        >
                          <option value="">Todos los clientes</option>
                          {availableClients.map(client => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1">Proyecto (opcional)</label>
                        <select
                          value={config.selectedProject || ''}
                          onChange={(e) => updateConfig(config.id, { selectedProject: e.target.value || undefined })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        >
                          <option value="">Todos los proyectos</option>
                          {availableProjects.map(project => (
                            <option key={project.id} value={project.id}>{project.name}</option>
                          ))}
                        </select>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
            
            <p className="text-xs text-blue-600 mt-3">
              ⚠️ Nota: Al modificar los filtros y guardar, las entradas del reporte se actualizarán automáticamente en la próxima actualización (cada 30 min) o al recargar el reporte.
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900 mb-1">Última Actualización</p>
            <p className="text-xs text-gray-600">
              {new Date(report.lastUpdated).toLocaleString('es-ES', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-between">
          <button
            onClick={handleRecalculate}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '🔄 Recalculando...' : '🔄 Recalcular Estadísticas'}
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

