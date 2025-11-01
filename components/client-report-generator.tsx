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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import ReportTagsManager from '@/components/report-tags-manager';
import { Clock, ShieldCheck } from 'lucide-react';
import type { ReportTag } from '@/lib/report-types';
import { getTogglMinDate, getTogglMinDateSync, shouldRefreshMinDate } from '@/lib/toggl-date-utils';
import { toast } from '@/lib/toast';
import { hashPassword } from '@/lib/auth';

export default function ClientReportGenerator({ apiKeys }: { apiKeys: ApiKeyInfo[] }) {
  const [reportName, setReportName] = useState('');
  const [totalHours, setTotalHours] = useState(80);
  const [configs, setConfigs] = useState<ReportConfig[]>([]);
  const [startDate, setStartDate] = useState('');
  const [togglMinDate, setTogglMinDate] = useState<string>('');
  const [manualEntries, setManualEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [newReportUrl, setNewReportUrl] = useState<string | null>(null);
  const [reportTags, setReportTags] = useState<ReportTag[]>([]);
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  
  // Password protection for client report
  const [enablePassword, setEnablePassword] = useState(false);
  const [clientEmail, setClientEmail] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  
  // API limit state
  const [apiLimitInfo, setApiLimitInfo] = useState<{ resetTime: number; resetMinutes: number } | null>(null);
  
  // Check API limit status
  useEffect(() => {
    const checkApiLimit = () => {
      const apiLimitData = localStorage.getItem('toggl_api_limit');
      if (apiLimitData) {
        try {
          const limitInfo = JSON.parse(apiLimitData);
          const resetTime = limitInfo.resetTime || 0;
          const now = Date.now();
          
          if (resetTime > now) {
            const resetSeconds = Math.ceil((resetTime - now) / 1000);
            const resetMinutes = Math.ceil(resetSeconds / 60);
            setApiLimitInfo({ resetTime, resetMinutes });
          } else {
            setApiLimitInfo(null);
          }
        } catch (error) {
          setApiLimitInfo(null);
        }
      } else {
        setApiLimitInfo(null);
      }
    };
    
    checkApiLimit();
    // Verificar cada minuto
    const interval = setInterval(checkApiLimit, 60000);
    return () => clearInterval(interval);
  }, []);

  // Set default date to the earliest allowed date by Toggl API (actualizado automáticamente)
  useEffect(() => {
    const initializeMinDate = async () => {
      // Usar fecha sincrónica primero para render rápido
      const syncDate = getTogglMinDateSync();
      setTogglMinDate(syncDate);
      setStartDate(syncDate);
      
      // Si el cache está expirado o no existe, intentar obtener fecha actualizada
      if (shouldRefreshMinDate() && apiKeys.length > 0) {
        try {
          const freshDate = await getTogglMinDate(apiKeys[0].key);
          setTogglMinDate(freshDate);
          if (!startDate || startDate < freshDate) {
            setStartDate(freshDate);
          }
        } catch (error) {
          console.warn('Error obteniendo fecha mínima de Toggl, usando cache:', error);
        }
      }
    };
    
    initializeMinDate();
    
    // Verificar cada día si necesita actualizar la fecha
    const checkInterval = setInterval(() => {
      if (shouldRefreshMinDate() && apiKeys.length > 0) {
        getTogglMinDate(apiKeys[0].key).then(date => {
          setTogglMinDate(date);
        }).catch(() => {});
      }
    }, 60 * 60 * 1000); // Cada hora
    
    return () => clearInterval(checkInterval);
  }, [apiKeys.length]);

  // Cargar tags disponibles de todas las API keys
  const loadAvailableTags = async () => {
    const allTags = new Set<string>();
    
    // Verificar si hay un límite de API activo guardado
    const apiLimitData = localStorage.getItem('toggl_api_limit');
    let shouldSkipApiCalls = false;
    let resetTimeSeconds = 0;
    
    if (apiLimitData) {
      try {
        const limitInfo = JSON.parse(apiLimitData);
        const resetTime = limitInfo.resetTime || 0;
        const now = Date.now();
        
        // Si el límite aún está activo (no ha pasado el tiempo de reset), no hacer llamadas
        if (resetTime > now) {
          shouldSkipApiCalls = true;
          resetTimeSeconds = Math.ceil((resetTime - now) / 1000);
          console.log(`⏸️ Límite de API aún activo. Usando solo cache. Reset en ~${Math.ceil(resetTimeSeconds / 60)} minutos.`);
        } else {
          // El límite ya expiró, limpiar el dato
          localStorage.removeItem('toggl_api_limit');
        }
      } catch (error) {
        console.warn('Error leyendo información de límite de API:', error);
      }
    }
    
    // Primero, cargar tags desde localStorage (cache)
    const stored = localStorage.getItem('toggl_api_keys');
    if (stored) {
      try {
        const storedApiKeys = JSON.parse(stored);
        for (const apiKeyInfo of storedApiKeys) {
          if (apiKeyInfo.tags && Array.isArray(apiKeyInfo.tags)) {
            apiKeyInfo.tags.forEach((tag: any) => {
              allTags.add(tag.name);
            });
          }
        }
        console.log(`✅ Tags cargados desde cache: ${allTags.size}`);
        // Actualizar inmediatamente con tags del cache
        setAvailableTags(Array.from(allTags));
      } catch (error) {
        console.warn('Error leyendo tags desde cache:', error);
      }
    }
    
    // Si hay límite activo, no intentar llamadas a la API
    if (shouldSkipApiCalls) {
      return;
    }
    
    // Luego, intentar actualizar desde la API (pero detenerse si hay límite)
    let hasApiLimitError = false;
    
    for (const apiKey of apiKeys) {
      // Si ya hay un error de límite, no intentar más llamadas
      if (hasApiLimitError) {
        console.warn(`⛔ Deteniendo carga de tags - límite de API alcanzado`);
        break;
      }
      
      try {
        const me = await getMe(apiKey.key);
        (me.tags || []).forEach((tag: any) => {
          allTags.add(tag.name);
        });
        // Si esta llamada fue exitosa, actualizar el estado de límite (limpiar si existe)
        localStorage.removeItem('toggl_api_limit');
      } catch (error: any) {
        const errorMessage = error?.message || '';
        
        // Detectar error de límite de API
        if (errorMessage.includes('hourly limit') || errorMessage.includes('402') || errorMessage.includes('Payment Required')) {
          hasApiLimitError = true;
          
          // Intentar extraer el tiempo de reset
          const resetMatch = errorMessage.match(/reset in (\d+) seconds/);
          if (resetMatch) {
            resetTimeSeconds = parseInt(resetMatch[1]);
            const resetTime = Date.now() + (resetTimeSeconds * 1000);
            
            // Guardar información del límite en localStorage
            localStorage.setItem('toggl_api_limit', JSON.stringify({
              resetTime: resetTime,
              detectedAt: Date.now(),
            }));
          }
          
          // No hacer console.error para este caso, ya que es esperado y tenemos cache
          console.warn(`⚠️ Límite de API alcanzado al cargar tags. Usando tags desde cache.`);
          // Detener el loop para no hacer más llamadas
          break;
        } else {
          // Para otros errores, sí mostrar el error
          console.error(`Error loading tags for ${apiKey.fullname}:`, error);
        }
      }
    }
    
    // Actualizar tags (ya sea desde cache o API)
    const finalTags = Array.from(allTags);
    if (finalTags.length > 0) {
      setAvailableTags(finalTags);
    }
    
    // Si hubo error de límite y tenemos tiempo de reset, informar
    if (hasApiLimitError && resetTimeSeconds > 0) {
      const resetMinutes = Math.ceil(resetTimeSeconds / 60);
      console.warn(`💡 Límite de API. Usando tags desde cache. Reset en ~${resetMinutes} minuto(s).`);
    }
  };

  useEffect(() => {
    if (apiKeys.length > 0) {
      loadAvailableTags();
    }
  }, [apiKeys]);

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
      
      // Asegurar que la fecha de inicio no sea anterior a la fecha mínima de Toggl
      const effectiveMinDate = togglMinDate || getTogglMinDateSync();
      const effectiveStartDate = startDate < effectiveMinDate ? effectiveMinDate : startDate;
      
      if (startDate < effectiveMinDate) {
        console.warn(`Fecha de inicio ${startDate} es anterior a la fecha mínima de Toggl (${effectiveMinDate}). Usando ${effectiveMinDate} en su lugar.`);
      }
      
      console.log(`Iniciando obtención de entradas de Toggl. Total configuraciones: ${configs.length}`);
      
      for (const config of configs) {
        const apiKeyInfo = apiKeys.find(k => k.id === config.selectedApiKey);
        if (!apiKeyInfo) {
          console.warn(`⚠️ API key no encontrada para config ${config.id}`);
          continue;
        }

        // Usar el workspace seleccionado en la configuración, o el primero si no está especificado
        const workspaceId = config.selectedWorkspace 
          ? apiKeyInfo.workspaces.find((w: any) => w.id === config.selectedWorkspace)?.id
          : apiKeyInfo.workspaces[0]?.id;
        if (!workspaceId) {
          console.warn(`[${apiKeyInfo.fullname}] ⚠️ Workspace ID no encontrado`);
          continue;
        }
        
        const workspaceName = apiKeyInfo.workspaces.find((w: any) => w.id === workspaceId)?.name || 'sin nombre';
        console.log(`[${apiKeyInfo.fullname}] ✅ Obteniendo entradas desde ${effectiveStartDate} hasta ${currentDate}... Workspace: ${workspaceId} (${workspaceName})`);
        
        try {
          const entries = await getTimeEntries(apiKeyInfo.key, effectiveStartDate, currentDate, workspaceId);
          console.log(`[${apiKeyInfo.fullname}] ✅ Total entradas obtenidas de Toggl: ${entries.length}`);

          let filtered = entries;
          const initialCount = filtered.length;
          
          if (config.selectedClient) {
            filtered = filtered.filter(entry => {
              const project = apiKeyInfo.projects.find(p => p.id === entry.pid);
              return project && project.cid === Number(config.selectedClient);
            });
            console.log(`[${apiKeyInfo.fullname}] Después de filtrar por cliente: ${filtered.length} de ${initialCount}`);
          }
          if (config.selectedProject) {
            const beforeProjectFilter = filtered.length;
            filtered = filtered.filter(entry => entry.pid === Number(config.selectedProject));
            console.log(`[${apiKeyInfo.fullname}] Después de filtrar por proyecto: ${filtered.length} de ${beforeProjectFilter}`);
          }
          // Filtrar por tags del reporte si están configurados
          // Solo incluir entradas que tengan alguno de los tags del reporte
          if (reportTags.length > 0) {
            const reportTagNames = reportTags.map(t => t.name);
            // Normalizar tags del reporte para comparación (lowercase y sin espacios)
            const normalizedReportTags = reportTagNames.map(tag => tag.toLowerCase().replace(/\s+/g, ''));
            const beforeTagFilter = filtered.length;
            filtered = filtered.filter(entry => {
              if (!entry.tags || entry.tags.length === 0) {
                return false;
              }
              return entry.tags.some((tag: string) => {
                const normalizedTag = tag.toLowerCase().replace(/\s+/g, '');
                return normalizedReportTags.includes(normalizedTag);
              });
            });
            console.log(`[${apiKeyInfo.fullname}] Después de filtrar por tags (${reportTagNames.join(', ')}): ${filtered.length} de ${beforeTagFilter}`);
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
          console.log(`[${apiKeyInfo.fullname}] ✅ Entradas enriquecidas añadidas: ${enriched.length}`);
        } catch (error: any) {
          const errorMessage = error?.message || 'Error desconocido';
          console.error(`[${apiKeyInfo.fullname}] ❌ Error obteniendo entradas de Toggl:`, errorMessage);
          
          // Detectar error de límite de API (402)
          if (errorMessage.includes('hourly limit') || errorMessage.includes('402') || errorMessage.includes('Límite de API')) {
            const resetMatch = errorMessage.match(/reseteará en (\d+) minuto/);
            const resetSecondsMatch = errorMessage.match(/reset in (\d+) seconds/);
            
            let resetInfo = '';
            if (resetMatch) {
              resetInfo = ` El límite se reseteará en ${resetMatch[1]} minuto(s).`;
            } else if (resetSecondsMatch) {
              const resetMinutes = Math.ceil(parseInt(resetSecondsMatch[1]) / 60);
              resetInfo = ` El límite se reseteará en ${resetMinutes} minuto(s).`;
            }
            
            // Mostrar advertencia pero continuar con otras configuraciones
            console.warn(`⚠️ [${apiKeyInfo.fullname}] Límite de API alcanzado.${resetInfo} Continuando con otras configuraciones...`);
            setError(`⚠️ Límite de API de Toggl alcanzado para ${apiKeyInfo.fullname}.${resetInfo} El reporte se creará con las entradas disponibles.`);
            // Continuar con las siguientes configuraciones
          } else {
            // Para otros errores, mostrar pero continuar
            console.error(`[${apiKeyInfo.fullname}] Error procesando config:`, error);
            const currentError = error?.message || 'Error desconocido';
            setError(`Error obteniendo datos de ${apiKeyInfo.fullname}: ${currentError}. Continuando con otras configuraciones...`);
          }
          // Continuar con las siguientes configuraciones aunque una falle
        }
      }
      
      console.log(`✅ Total entradas de Toggl obtenidas de todas las configuraciones: ${allEntries.length}`);

      console.log(`Total entradas de Toggl antes de añadir CSV: ${allEntries.length}`);

      // Filtrar las entradas manuales del CSV por tags del reporte si están configurados
      let filteredManualEntries = manualEntries;
      if (reportTags.length > 0) {
        const reportTagNames = reportTags.map(t => t.name);
        // Normalizar tags del reporte para comparación (lowercase y sin espacios)
        const normalizedReportTags = reportTagNames.map(tag => tag.toLowerCase().replace(/\s+/g, ''));
        const beforeManualFilter = filteredManualEntries.length;
        filteredManualEntries = filteredManualEntries.filter((entry: any) => {
          const entryTags = entry.tag_names || entry.tags || [];
          if (entryTags.length === 0) {
            return false;
          }
          return entryTags.some((tag: string) => {
            const normalizedTag = tag.toLowerCase().replace(/\s+/g, '');
            return normalizedReportTags.includes(normalizedTag);
          });
        });
        console.log(`Entradas manuales después de filtrar por tags: ${filteredManualEntries.length} de ${beforeManualFilter}`);
      }

      // Añadir las entradas manuales importadas del CSV (ya filtradas por tags si aplica)
      allEntries.push(...filteredManualEntries);
      console.log(`Total entradas finales (Toggl + CSV): ${allEntries.length} (${allEntries.length - filteredManualEntries.length} de Toggl + ${filteredManualEntries.length} del CSV)`);

      // Mostrar advertencia si no hay entradas de Toggl pero hay CSV
      if (allEntries.length - filteredManualEntries.length === 0 && filteredManualEntries.length > 0) {
        console.warn('⚠️ No se obtuvieron entradas de Toggl. Solo se incluirán las entradas del CSV.');
      }

      // Añadir un aviso si hay entradas antes de 2025-07-29 que necesitan ser añadidas manualmente
      const earliestEntry = allEntries.length > 0 ? allEntries.reduce((earliest, entry) => {
        const entryDate = new Date(entry.start);
        return entryDate < new Date(earliest.start) ? entry : earliest;
      }) : null;
      
      const minDate = togglMinDate || getTogglMinDateSync();
      if (earliestEntry && new Date(earliestEntry.start) >= new Date(minDate)) {
        console.log(`Todas las entradas son desde ${minDate} o posterior`);
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

      // Hash password if enabled
      let passwordHash: string | undefined = undefined;
      if (enablePassword && clientPassword) {
        passwordHash = await hashPassword(clientPassword);
      }

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
        passwordHash,
        configs,
        reportTags,
        activeTag,
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
      setReportTags([]);
      setActiveTag(undefined);
      setEnablePassword(false);
      setClientEmail('');
      setClientPassword('');
      
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
    <div className="space-y-6">
      {/* API Limit Disclaimer */}
      {apiLimitInfo && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Clock className="w-3 h-3 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-1">
                ⚠️ Límite de API de Toggl alcanzado
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Estamos usando datos en cache debido al límite de llamadas por hora de Toggl (ventana deslizante de 60 minutos). 
                Los límites varían según el plan: Free (30 req/h), Starter (240 req/h), Premium (600 req/h). 
                Puedes crear el reporte usando las entradas del CSV, pero las entradas de Toggl no se actualizarán hasta que el límite se resetee en aproximadamente {apiLimitInfo.resetMinutes} minuto(s).
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
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
            min={togglMinDate || getTogglMinDateSync()}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Toggl solo permite obtener datos desde {togglMinDate || getTogglMinDateSync()} en adelante
          </p>
        </div>
      </div>

      {/* Protección con Contraseña */}
      <Card className="mb-6 p-4 border-primary/20">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-primary mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Checkbox 
                id="enablePassword" 
                checked={enablePassword}
                onCheckedChange={(checked) => setEnablePassword(checked as boolean)}
              />
              <Label htmlFor="enablePassword" className="font-semibold cursor-pointer">
                Proteger este reporte con contraseña
              </Label>
            </div>
            {enablePassword && (
              <div className="space-y-3 mt-3 pl-7">
                <div>
                  <label className="block text-sm font-medium mb-2">Email del Cliente (Opcional)</label>
                  <Input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="cliente@email.com"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Solo para referencia. No se usa para autenticación.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Contraseña</label>
                  <Input
                    type="password"
                    value={clientPassword}
                    onChange={(e) => setClientPassword(e.target.value)}
                    placeholder="Contraseña segura"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    El cliente necesitará esta contraseña para ver el reporte.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Gestión de Tags del Reporte */}
      <Card className="mb-6 p-4">
        <h3 className="text-lg font-semibold mb-4">Tags del Reporte</h3>
        <ReportTagsManager
          reportTags={reportTags}
          activeTag={activeTag}
          availableTags={availableTags}
          onTagsChange={setReportTags}
          onActiveTagChange={setActiveTag}
        />
      </Card>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Configuraciones de Toggl</h3>
          <div className="flex gap-2">
            <Button onClick={addConfig}>
              + Añadir Configuración
            </Button>
          </div>
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
                      onChange={(e) => updateConfig(config.id, { selectedApiKey: e.target.value, selectedWorkspace: undefined, selectedClient: '', selectedProject: '', selectedTags: undefined })}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background"
                    >
                      {apiKeys.map(key => (
                        <option key={key.id} value={key.id}>{key.fullname}</option>
                      ))}
                    </select>
                  </div>
                  {apiKeyInfo && apiKeyInfo.workspaces && apiKeyInfo.workspaces.length > 1 && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Workspace</label>
                      <select
                        value={config.selectedWorkspace || apiKeyInfo.workspaces[0]?.id || ''}
                        onChange={(e) => updateConfig(config.id, { selectedWorkspace: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background"
                      >
                        {apiKeyInfo.workspaces.map((workspace: any) => (
                          <option key={workspace.id} value={workspace.id}>
                            {workspace.name || `Workspace ${workspace.id}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
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
          Si necesitas añadir datos anteriores al {togglMinDate || getTogglMinDateSync()}, sube un archivo CSV con el formato de la plantilla.
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
    </div>
  );
}

