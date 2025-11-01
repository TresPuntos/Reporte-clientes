'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ClientReport } from '@/lib/report-types';
import { saveReport, getReportByPublicUrl, getAllReports } from '@/lib/report-types';
import {
  calculateConsumptionSpeed,
  calculateAverageHoursPerTask,
  groupTasksByDescription,
  calculateTeamDistribution,
  calculateConsumptionEvolution,
  calculateCumulativeEvolution,
} from '@/lib/report-calculations';
import { getTimeEntries } from '@/lib/toggl';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme-toggle';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Activity, TrendingUp, Clock, CheckCircle, Calendar, Users, Package, Filter, X, ArrowRight, Rocket, ShieldCheck, MessageSquare, Send, Zap, ChevronDown } from 'lucide-react';
import { getTogglMinDateSync } from '@/lib/toggl-date-utils';
import { toast } from '@/lib/toast';

export default function ClientReportDashboard({ report: initialReport }: { report: ClientReport }) {
  const [report, setReport] = useState<ClientReport>(initialReport);
  const [activeView, setActiveView] = useState<'summary' | 'tasks'>('summary');
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastAutoUpdate, setLastAutoUpdate] = useState<Date | null>(null);
  
  // Password protection states
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // Filter states
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
  
  // Time period selector state
  const [timePeriod, setTimePeriod] = useState<string>('año-actual');
  const [customDateStart, setCustomDateStart] = useState<string>('');
  const [customDateEnd, setCustomDateEnd] = useState<string>('');
  
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
  
  // Check if report is password protected on mount
  useEffect(() => {
    const hasPassword = !!report.passwordHash;
    setIsPasswordProtected(hasPassword);
    
    // Check if already authenticated in session
    const sessionKey = `report_auth_${report.publicUrl}`;
    const isAuth = sessionStorage.getItem(sessionKey) === 'true';
    setIsAuthenticated(isAuth);
  }, [report]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    try {
      const response = await fetch(`/api/reports/${report.publicUrl}/check-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        setPasswordError('Contraseña incorrecta');
        return;
      }

      // Guardar en sesión
      const sessionKey = `report_auth_${report.publicUrl}`;
      sessionStorage.setItem(sessionKey, 'true');
      setIsAuthenticated(true);
    } catch (error) {
      setPasswordError('Error verificando contraseña');
    }
  };

  // Auto-refresh cada 12 horas  
  useEffect(() => {
    const updateWithReport = async () => {
      try {
        // Verificar si hay un límite de API activo antes de hacer llamadas
        const apiLimitData = localStorage.getItem('toggl_api_limit');
        if (apiLimitData) {
          try {
            const limitInfo = JSON.parse(apiLimitData);
            const resetTime = limitInfo.resetTime || 0;
            const now = Date.now();
            
            if (resetTime > now) {
              const resetSeconds = Math.ceil((resetTime - now) / 1000);
              const resetMinutes = Math.ceil(resetSeconds / 60);
              console.log(`⏸️ [Auto-refresh] Límite de API activo. Saltando actualización. Reset en ~${resetMinutes} minuto(s)`);
              return; // No hacer llamadas si hay límite activo
            }
          } catch (error) {
            // Continuar si hay error parseando
          }
        }
        
        const stored = localStorage.getItem('toggl_api_keys');
        if (!stored) return;

        const apiKeys = JSON.parse(stored);
        
        // Separar entradas actuales del reporte
        let historicalEntries = report.entries.filter((e: any) => e.id < 0);
        const existingTogglEntries = report.entries.filter((e: any) => e.id >= 0);
        
        // Filtrar entradas históricas por tags del reporte si están configurados
        if (report.reportTags && report.reportTags.length > 0) {
          const reportTagNames = report.reportTags.map(t => t.name);
          // Normalizar tags del reporte para comparación (lowercase y sin espacios)
          const normalizedReportTags = reportTagNames.map(tag => tag.toLowerCase().replace(/\s+/g, ''));
          const beforeHistoricalFilter = historicalEntries.length;
          historicalEntries = historicalEntries.filter((entry: any) => {
            const entryTags = entry.tag_names || entry.tags || [];
            if (entryTags.length === 0) {
              return false;
            }
            const hasMatchingTag = entryTags.some((tag: string) => {
              const normalizedTag = tag.toLowerCase().replace(/\s+/g, '');
              return normalizedReportTags.includes(normalizedTag);
            });
            if (!hasMatchingTag) {
              console.log(`[Auto-refresh] ❌ Entrada histórica rechazada por tags: "${entry.description}"`, {
                tags: entryTags,
                normalizedTags: entryTags.map((t: string) => t.toLowerCase().replace(/\s+/g, '')),
                buscaTags: reportTagNames,
                buscaTagsNormalized: normalizedReportTags,
                fecha: entry.start
              });
            }
            return hasMatchingTag;
          });
          console.log(`[Auto-refresh] ✅ Entradas históricas después de filtrar por tags (${reportTagNames.join(', ')}): ${historicalEntries.length} de ${beforeHistoricalFilter}`);
        }
        
        // Determinar qué workspaces se están usando en las configuraciones actuales
        const activeWorkspaceIds = new Set<number>();
        for (const config of report.configs) {
          const apiKeyInfo = apiKeys.find((k: any) => k.id === config.selectedApiKey);
          if (apiKeyInfo) {
            const workspaceId = config.selectedWorkspace 
              ? apiKeyInfo.workspaces.find((w: any) => w.id === config.selectedWorkspace)?.id
              : apiKeyInfo.workspaces[0]?.id;
            if (workspaceId) {
              activeWorkspaceIds.add(workspaceId);
            }
          }
        }
        
        console.log(`[Auto-refresh] Workspaces activos en configuraciones:`, Array.from(activeWorkspaceIds));
        
        // Crear un mapa de entradas existentes, filtrando por workspace activo
        const existingTogglMap = new Map<number, any>();
        let discardedCount = 0;
        
        for (const entry of existingTogglEntries) {
          // Solo incluir si pertenece a un workspace activo o si no tiene workspace ID (compatibilidad)
          if (!entry.wid || activeWorkspaceIds.has(entry.wid)) {
            existingTogglMap.set(entry.id, entry);
          } else {
            discardedCount++;
            console.log(`[Auto-refresh] 🗑️ Descartando entrada existente: ${entry.description?.substring(0, 50)} (workspace ${entry.wid} no está activo)`);
          }
        }
        
        if (discardedCount > 0) {
          console.log(`[Auto-refresh] Se descartaron ${discardedCount} entradas existentes que no pertenecen a workspaces activos`);
        }
        
        const currentDate = new Date().toISOString().split('T')[0];
        const freshTogglEntries: any[] = [];
        
        for (const config of report.configs) {
          try {
          const apiKeyInfo = apiKeys.find((k: any) => k.id === config.selectedApiKey);
            if (!apiKeyInfo) {
              console.warn(`[Auto-refresh] API key no encontrada para config: ${config.id}`);
              continue;
            }

            // Log todos los workspaces disponibles
            console.log(`[Auto-refresh][${apiKeyInfo.fullname}] Workspaces disponibles:`, apiKeyInfo.workspaces.map((w: any) => ({ id: w.id, name: w.name })));
            
            // Usar el workspace seleccionado en la configuración, o el primero si no está especificado
            const workspaceId = config.selectedWorkspace 
              ? apiKeyInfo.workspaces.find((w: any) => w.id === config.selectedWorkspace)?.id
              : apiKeyInfo.workspaces[0]?.id;
              
            if (!workspaceId) {
              console.warn(`[Auto-refresh] Workspace ID no encontrado para ${apiKeyInfo.fullname}. Workspace seleccionado: ${config.selectedWorkspace}, workspaces disponibles: ${apiKeyInfo.workspaces.map((w: any) => w.id).join(', ')}`);
              continue;
            }
            
            const workspaceName = apiKeyInfo.workspaces.find((w: any) => w.id === workspaceId)?.name || 'sin nombre';
            console.log(`[Auto-refresh][${apiKeyInfo.fullname}] ✅ Usando workspace: ${workspaceId} (${workspaceName})${config.selectedWorkspace ? ' [seleccionado en config]' : ' [por defecto, primero]'}`);

            // Asegurar que la fecha de inicio no sea anterior a la fecha mínima de Toggl
            const togglMinDate = getTogglMinDateSync();
            const effectiveStartDate = report.startDate < togglMinDate ? togglMinDate : report.startDate;
            
            if (report.startDate < togglMinDate) {
              console.warn(`[Auto-refresh][${apiKeyInfo.fullname}] Fecha de inicio del reporte (${report.startDate}) es anterior a la fecha mínima de Toggl (${togglMinDate}). Usando ${togglMinDate} en su lugar.`);
            }
            
            console.log(`[Auto-refresh][${apiKeyInfo.fullname}] Obteniendo entradas desde ${effectiveStartDate} hasta ${currentDate}...`);
            const entries = await getTimeEntries(apiKeyInfo.key, effectiveStartDate, currentDate, workspaceId);
            console.log(`[Auto-refresh][${apiKeyInfo.fullname}] Total entradas obtenidas: ${entries.length}`);

          let filtered = entries;
            
          if (config.selectedClient) {
              const beforeClientFilter = filtered.length;
            filtered = filtered.filter((entry: any) => {
              const project = apiKeyInfo.projects.find((p: any) => p.id === entry.pid);
              return project && project.cid === Number(config.selectedClient);
            });
              console.log(`[Auto-refresh][${apiKeyInfo.fullname}] Después de filtrar por cliente: ${filtered.length} de ${beforeClientFilter}`);
          }
            
          if (config.selectedProject) {
              const beforeProjectFilter = filtered.length;
            filtered = filtered.filter((entry: any) => entry.pid === Number(config.selectedProject));
              console.log(`[Auto-refresh][${apiKeyInfo.fullname}] Después de filtrar por proyecto: ${filtered.length} de ${beforeProjectFilter}`);
            }
            
            // Filtrar por tags del reporte si están configurados
            if (report.reportTags && report.reportTags.length > 0) {
              const reportTagNames = report.reportTags.map(t => t.name);
              // Normalizar tags del reporte para comparación (lowercase y sin espacios)
              const normalizedReportTags = reportTagNames.map(tag => tag.toLowerCase().replace(/\s+/g, ''));
              const beforeTagFilter = filtered.length;
              
              // Log todas las entradas antes del filtro para debug
              console.log(`[Auto-refresh][${apiKeyInfo.fullname}] Entradas antes de filtrar por tags (${reportTagNames.join(', ')}):`, 
                filtered.map((e: any) => ({
                  desc: e.description,
                  tags: e.tags || [],
                  normalizedTags: (e.tags || []).map((t: string) => t.toLowerCase().replace(/\s+/g, '')),
                  hasTag: e.tags && e.tags.some((tag: string) => {
                    const normalized = tag.toLowerCase().replace(/\s+/g, '');
                    return normalizedReportTags.includes(normalized);
                  })
                }))
              );
              
              filtered = filtered.filter((entry: any) => {
                if (!entry.tags || entry.tags.length === 0) {
                  console.log(`[Auto-refresh][${apiKeyInfo.fullname}] ❌ Entrada sin tags rechazada: "${entry.description}"`);
                  return false;
                }
                
                const hasMatchingTag = entry.tags.some((tag: string) => {
                  const normalizedTag = tag.toLowerCase().replace(/\s+/g, '');
                  return normalizedReportTags.includes(normalizedTag);
                });
                
                if (!hasMatchingTag) {
                  console.log(`[Auto-refresh][${apiKeyInfo.fullname}] ❌ Entrada rechazada por tags: "${entry.description}"`, {
                    tags: entry.tags || [],
                    normalizedTags: (entry.tags || []).map((t: string) => t.toLowerCase().replace(/\s+/g, '')),
                    buscaTags: reportTagNames,
                    buscaTagsNormalized: normalizedReportTags,
                    fecha: entry.start
                  });
                }
                return hasMatchingTag;
              });
              console.log(`[Auto-refresh][${apiKeyInfo.fullname}] ✅ Después de filtrar por tags del reporte (${reportTagNames.join(', ')}): ${filtered.length} de ${beforeTagFilter}`);
          }

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

            console.log(`[Auto-refresh][${apiKeyInfo.fullname}] Total entradas enriquecidas añadidas: ${enriched.length}`);
          freshTogglEntries.push(...enriched);
          } catch (error) {
            console.error(`[Auto-refresh] Error procesando config para ${config.selectedApiKey}:`, error);
            // Continuar con la siguiente configuración
          }
        }
        
        console.log(`[Auto-refresh] Total entradas de todas las configuraciones: ${freshTogglEntries.length}`);
        
        // Debug: Contar entradas por usuario
        const entriesByUser = freshTogglEntries.reduce((acc: any, entry: any) => {
          const user = entry.user_name || 'Desconocido';
          acc[user] = (acc[user] || 0) + 1;
          return acc;
        }, {});
        console.log('[Auto-refresh] Entradas por usuario:', entriesByUser);

        // Preservar entradas que no han cambiado
        const preservedTogglEntries = freshTogglEntries.map((freshEntry: any) => {
          const existingEntry = existingTogglMap.get(freshEntry.id);
          if (existingEntry && existingEntry.at === freshEntry.at && existingEntry.duration === freshEntry.duration) {
            return existingEntry;
          }
          return freshEntry;
        });
        
        console.log(`[Auto-refresh] Total entradas preservadas/actualizadas: ${preservedTogglEntries.length}`);
        const preservedByUser = preservedTogglEntries.reduce((acc: any, entry: any) => {
          const user = entry.user_name || 'Desconocido';
          acc[user] = (acc[user] || 0) + 1;
          return acc;
        }, {});
        console.log('[Auto-refresh] Entradas preservadas por usuario:', preservedByUser);

        const allEntries = [...historicalEntries, ...preservedTogglEntries];
        
        console.log(`[Auto-refresh] Total entradas finales: ${allEntries.length} (${historicalEntries.length} históricas + ${preservedTogglEntries.length} de Toggl)`);

        const totalConsumed = allEntries.reduce((sum: number, e: any) => sum + e.duration, 0) / 3600;
        const speed = calculateConsumptionSpeed(allEntries);
        const avgHours = calculateAverageHoursPerTask(allEntries);
        const groupedTasks = groupTasksByDescription(allEntries);
        const teamDist = calculateTeamDistribution(allEntries);
        const evolution = calculateConsumptionEvolution(allEntries);
        const cumulative = calculateCumulativeEvolution(evolution);

        const updatedReport: ClientReport = {
          ...report,
          entries: allEntries,
          lastUpdated: new Date().toISOString(),
          summary: {
            totalHoursConsumed: totalConsumed,
            totalHoursAvailable: report.totalHours,
            consumptionPercentage: (totalConsumed / report.totalHours) * 100,
            consumptionSpeed: speed,
            estimatedDaysRemaining: report.totalHours > totalConsumed ? Math.ceil((report.totalHours - totalConsumed) / speed) : 0,
            completedTasks: groupedTasks.length,
            averageHoursPerTask: avgHours,
            tasksByDescription: groupedTasks,
            teamDistribution: teamDist,
            consumptionEvolution: cumulative,
          },
        };

        const reports = await getAllReports();
        const index = reports.findIndex(r => r.id === report.id);
        if (index >= 0) {
          reports[index] = updatedReport;
          localStorage.setItem('client_reports', JSON.stringify(reports));
        }

        setReport(updatedReport);
        setLastAutoUpdate(new Date());
      } catch (error) {
        console.error('Auto-refresh error:', error);
      }
    };

    // Actualizar cada 12 horas
    const intervalId = setInterval(updateWithReport, 12 * 60 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []); // Solo ejecutar una vez al montar

  const toggleTask = (description: string) => {
    setExpandedTasks(prev => ({
      ...prev,
      [description]: !prev[description]
    }));
  };

  // Helper: Formatear fecha en español (DD Mon YYYY)
  const formatDateES = (date: Date): string => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Helper: Obtener fecha de última actualización
  const getLastUpdateTime = (): string => {
    if (report.lastUpdated) {
      const date = new Date(report.lastUpdated);
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
    const now = new Date();
    return now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  // Helper: Obtener fecha de última actualización completa
  const getLastUpdateDate = (): string => {
    if (report.lastUpdated) {
      const date = new Date(report.lastUpdated);
      const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
    }
    const now = new Date();
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}`;
  };

  // Helper: Calcular velocidad de consumo semanal (promedio de últimas 4 semanas)
  const calculateWeeklySpeed = (): number => {
    const now = new Date();
    const fourWeeksAgo = new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000);
    
    const recentEntries = report.entries.filter(entry => {
      const entryDate = new Date(entry.start);
      return entryDate >= fourWeeksAgo;
    });
    
    const totalHours = recentEntries.reduce((sum, entry) => sum + entry.duration, 0) / 3600;
    return totalHours / 4; // Promedio por semana
  };

  // Helper: Calcular estimación de agotamiento en semanas
  const calculateWeeksRemaining = (): number => {
    const weeklySpeed = calculateWeeklySpeed();
    const remainingHours = report.summary.totalHoursAvailable - report.summary.totalHoursConsumed;
    if (weeklySpeed <= 0) return 0;
    return remainingHours / weeklySpeed;
  };

  // Helper: Calcular rango de fechas según período seleccionado
  const getDateRange = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    switch (timePeriod) {
      case 'año-actual':
        return {
          start: new Date(currentYear, 0, 1),
          end: now,
        };
      case 'año-anterior':
        return {
          start: new Date(currentYear - 1, 0, 1),
          end: new Date(currentYear - 1, 11, 31),
        };
      case 'ultimos-12-meses':
        return {
          start: new Date(now.getFullYear(), now.getMonth() - 11, 1),
          end: now,
        };
      case 'ultimos-7-dias':
        return {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: now,
        };
      case 'mes-actual':
        return {
          start: new Date(currentYear, currentMonth, 1),
          end: now,
        };
      case 'mes-anterior':
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        return {
          start: new Date(prevYear, prevMonth, 1),
          end: new Date(prevYear, prevMonth + 1, 0),
        };
      case 'trimestre-1':
        return {
          start: new Date(currentYear, 0, 1),
          end: new Date(currentYear, 2, 31),
        };
      case 'trimestre-2':
        return {
          start: new Date(currentYear, 3, 1),
          end: new Date(currentYear, 5, 30),
        };
      case 'trimestre-3':
        return {
          start: new Date(currentYear, 6, 1),
          end: new Date(currentYear, 8, 30),
        };
      case 'trimestre-4':
        return {
          start: new Date(currentYear, 9, 1),
          end: new Date(currentYear, 11, 31),
        };
      case 'personalizado':
        return {
          start: customDateStart ? new Date(customDateStart) : new Date(currentYear, 0, 1),
          end: customDateEnd ? new Date(customDateEnd) : now,
        };
      default:
        return {
          start: new Date(currentYear, 0, 1),
          end: now,
        };
    }
  };

  // Helper: Obtener distribución mensual para el gráfico de barras
  const getMonthlyConsumption = () => {
    const { start, end } = getDateRange();
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    // Filtrar entradas por rango de fechas
    const filteredEntries = report.entries.filter(entry => {
      const entryDate = new Date(entry.start);
      return entryDate >= start && entryDate <= end;
    });
    
    // Agrupar por mes
    const monthlyData: Record<string, number> = {};
    
    filteredEntries.forEach(entry => {
      const date = new Date(entry.start);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + entry.duration / 3600;
    });
    
    // Crear array de 12 meses del año del rango seleccionado
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    const result: Array<{ month: string; hours: number; monthIndex: number; fullMonth: string }> = [];
    
    // Para períodos de un año completo, mostrar todos los meses del año
    if (timePeriod === 'año-actual' || timePeriod === 'año-anterior') {
      for (let i = 0; i < 12; i++) {
        const monthKey = `${startYear}-${String(i + 1).padStart(2, '0')}`;
        result.push({
          month: months[i],
          hours: monthlyData[monthKey] || 0,
          monthIndex: i,
          fullMonth: monthKey,
        });
      }
    } else {
      // Para otros períodos, mostrar solo los meses con datos
      return Object.entries(monthlyData)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, hours]) => {
          const [year, month] = key.split('-');
          return {
            month: months[parseInt(month) - 1],
            hours: hours,
            monthIndex: parseInt(month) - 1,
            fullMonth: key,
          };
        });
    }
    
    return result;
  };

  // Helper: Calcular estadísticas mensuales
  const getMonthlyStats = () => {
    const monthlyData = getMonthlyConsumption();
    const { start, end } = getDateRange();
    
    if (monthlyData.length === 0) {
      return {
        average: 0,
        maxMonth: null,
        trend: 'Estable',
        totalHours: 0,
      };
    }
    
    // Filtrar entradas por rango de fechas para calcular totales
    const filteredEntries = report.entries.filter(entry => {
      const entryDate = new Date(entry.start);
      return entryDate >= start && entryDate <= end;
    });
    
    const totalHours = filteredEntries.reduce((sum, entry) => sum + entry.duration, 0) / 3600;
    const numMonths = monthlyData.length;
    const average = numMonths > 0 ? totalHours / numMonths : 0;
    
    const maxMonth = monthlyData.reduce((max, curr) => 
      curr.hours > max.hours ? curr : max, monthlyData[0]
    );
    
    // Determinar tendencia comparando últimos 2 meses
    let trend = 'Estable';
    if (monthlyData.length >= 2) {
      const lastTwo = monthlyData.slice(-2);
      const diff = lastTwo[1].hours - lastTwo[0].hours;
      const avgHours = monthlyData.reduce((sum, m) => sum + m.hours, 0) / monthlyData.length;
      if (diff > avgHours * 0.1) trend = 'Creciente';
      else if (diff < -avgHours * 0.1) trend = 'Decreciente';
    }
    
    return {
      average,
      maxMonth,
      trend,
      totalHours,
    };
  };

  // Helper: Obtener distribución por descripción para donut chart
  const getDescriptionDistribution = () => {
    return report.summary.tasksByDescription.map(task => ({
      name: task.description,
      value: task.totalHours,
      percentage: ((task.totalHours / report.summary.totalHoursConsumed) * 100).toFixed(1),
    }));
  };

  // Helper: Obtener últimas 8 tareas (entradas más recientes)
  const getLatestTasks = () => {
    return report.entries
      .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
      .slice(0, 8);
  };

  // Helper: Asignar color a cada proyecto (estilo pill tag)
  const projectColorMap = useMemo(() => {
    const uniqueProjects = Array.from(new Set(report.entries.map(e => e.project_name || 'Sin proyecto')));
    const colors = [
      '#5CFFBE', // Verde menta
      '#7B68EE', // Púrpura
      '#FF6B9D', // Rosa
      '#FFD93D', // Amarillo
      '#6BCF7F', // Verde suave (de la misma gama)
      '#A78BFA', // Púrpura claro (de la misma gama)
      '#F472B6', // Rosa claro (de la misma gama)
      '#FCD34D', // Amarillo claro (de la misma gama)
    ];
    
    const colorMap: Record<string, string> = {};
    uniqueProjects.forEach((project, idx) => {
      colorMap[project] = colors[idx % colors.length];
    });
    
    return colorMap;
  }, [report.entries]);

  // Helper: Convertir hex a RGBA con opacidad
  const hexToRgba = (hex: string, opacity: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const getProjectColor = (projectName: string): { fill: string; stroke: string; base: string } => {
    const baseColor = projectColorMap[projectName] || '#5CFFBE';
    // Fill: 20% opacidad, Stroke: 30% opacidad
    return {
      fill: hexToRgba(baseColor, 0.2), // 20%
      stroke: hexToRgba(baseColor, 0.3), // 30%
      base: baseColor,
    };
  };

  // Calcular consumo por proyectos
  const projectConsumption = () => {
    const projectMap = new Map<string, number>();
    report.entries.forEach(entry => {
      const projectName = entry.project_name || 'Sin proyecto';
      const hours = (entry.duration / 3600);
      projectMap.set(projectName, (projectMap.get(projectName) || 0) + hours);
    });
    
    return Array.from(projectMap.entries())
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5); // Top 5 proyectos
  };

  // Get unique values for filters
  const getUniqueProjects = () => {
    const projects = new Set(report.entries.map(e => e.project_name || 'Sin proyecto').filter(p => p));
    return Array.from(projects).sort();
  };

  const getUniqueTags = () => {
    const tags = new Set<string>();
    report.entries.forEach(entry => {
      if (entry.tag_names && entry.tag_names.length > 0) {
        entry.tag_names.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  };

  // Apply filters to tasks
  const getFilteredTasks = () => {
    let filteredTasks = report.summary.tasksByDescription.map(task => {
      const filteredEntries = task.entries.filter(entry => {
        // Filter by project
        if (selectedProjects.length > 0) {
          const projectName = entry.project_name || 'Sin proyecto';
          if (!selectedProjects.includes(projectName)) return false;
        }
        
        // Filter by tag
        if (selectedTags.length > 0) {
          const entryTags = entry.tag_names || [];
          const hasAnyTag = selectedTags.some(tag => entryTags.includes(tag));
          if (!hasAnyTag) return false;
        }
        
        // Filter by date range
        if (dateRangeStart) {
          const entryDate = new Date(entry.start).toISOString().split('T')[0];
          if (entryDate < dateRangeStart) return false;
        }
        if (dateRangeEnd) {
          const entryDate = new Date(entry.start).toISOString().split('T')[0];
          if (entryDate > dateRangeEnd) return false;
        }
        
        return true;
      });
      
      // Recalculate totals for filtered entries
      const totalHours = filteredEntries.reduce((sum, e) => sum + e.duration, 0) / 3600;
      
      return {
        ...task,
        entries: filteredEntries,
        totalHours,
        count: filteredEntries.length
      };
    }).filter(task => task.entries.length > 0);
    
    return filteredTasks;
  };

  const handleUpdateReport = async (silent = false) => {
    setIsUpdating(true);
    try {
      // Obtener API keys del localStorage
      const stored = localStorage.getItem('toggl_api_keys');
      if (!stored) {
        if (!silent) {
          toast.error('No se pueden actualizar los datos. Vuelve a abrir el reporte desde el panel de gestión.');
        }
        setIsUpdating(false);
        return;
      }

      const apiKeys = JSON.parse(stored);
      
      // SEPARAR: Entradas históricas (CSV) y entradas de Toggl existentes
      let historicalEntries = report.entries.filter((e: any) => e.id < 0); // IDs negativos = CSV
      const existingTogglEntries = report.entries.filter((e: any) => e.id >= 0); // IDs positivos = Toggl
      
      // Filtrar entradas históricas por tags del reporte si están configurados
      if (report.reportTags && report.reportTags.length > 0) {
        const reportTagNames = report.reportTags.map(t => t.name);
        // Normalizar tags del reporte para comparación (lowercase y sin espacios)
        const normalizedReportTags = reportTagNames.map(tag => tag.toLowerCase().replace(/\s+/g, ''));
        const beforeHistoricalFilter = historicalEntries.length;
        historicalEntries = historicalEntries.filter((entry: any) => {
          const entryTags = entry.tag_names || entry.tags || [];
          if (entryTags.length === 0) {
            return false;
          }
          const hasMatchingTag = entryTags.some((tag: string) => {
            const normalizedTag = tag.toLowerCase().replace(/\s+/g, '');
            return normalizedReportTags.includes(normalizedTag);
          });
          if (!hasMatchingTag) {
            console.log(`❌ Entrada histórica rechazada por tags: "${entry.description}"`, {
              tags: entryTags,
              normalizedTags: entryTags.map((t: string) => t.toLowerCase().replace(/\s+/g, '')),
              buscaTags: reportTagNames,
              buscaTagsNormalized: normalizedReportTags,
              fecha: entry.start
            });
          }
          return hasMatchingTag;
        });
        console.log(`✅ Entradas históricas después de filtrar por tags (${reportTagNames.join(', ')}): ${historicalEntries.length} de ${beforeHistoricalFilter}`);
      }
      
      // Determinar qué workspaces y API keys se están usando en las configuraciones actuales
      const activeWorkspaceIds = new Set<number>();
      const activeApiKeyIds = new Set<string>();
      for (const config of report.configs) {
        const apiKeyInfo = apiKeys.find((k: any) => k.id === config.selectedApiKey);
        if (apiKeyInfo) {
          activeApiKeyIds.add(config.selectedApiKey);
          const workspaceId = config.selectedWorkspace 
            ? apiKeyInfo.workspaces.find((w: any) => w.id === config.selectedWorkspace)?.id
            : apiKeyInfo.workspaces[0]?.id;
          if (workspaceId) {
            activeWorkspaceIds.add(workspaceId);
          }
        }
      }
      
      console.log(`Workspaces activos en configuraciones:`, Array.from(activeWorkspaceIds));
      console.log(`API keys activas en configuraciones:`, Array.from(activeApiKeyIds));
      
      // Crear un mapa de entradas existentes de Toggl por ID para comparar
      // Solo considerar entradas que pertenecen a workspaces activos
      const existingTogglMap = new Map<number, any>();
      let discardedCount = 0;
      
      for (const entry of existingTogglEntries) {
        // Solo incluir en el mapa si pertenece a un workspace activo
        // O si no tenemos el workspace ID guardado, mantenerla (compatibilidad con datos antiguos)
        if (!entry.wid || activeWorkspaceIds.has(entry.wid)) {
          existingTogglMap.set(entry.id, entry);
        } else {
          discardedCount++;
          console.log(`🗑️ Descartando entrada existente: ${entry.description?.substring(0, 50)} (workspace ${entry.wid} no está activo)`);
        }
      }
      
      if (discardedCount > 0) {
        console.log(`Se descartaron ${discardedCount} entradas existentes que no pertenecen a workspaces activos`);
      }
      
      // Obtener datos ACTUALIZADOS de Toggl
      const currentDate = new Date().toISOString().split('T')[0];
      const freshTogglEntries: any[] = [];
      
      for (const config of report.configs) {
        try {
        const apiKeyInfo = apiKeys.find((k: any) => k.id === config.selectedApiKey);
          if (!apiKeyInfo) {
            console.warn(`API key no encontrada para config: ${config.id}`);
            continue;
          }

          // Log todos los workspaces disponibles
          console.log(`[${apiKeyInfo.fullname}] Workspaces disponibles:`, apiKeyInfo.workspaces.map((w: any) => ({ id: w.id, name: w.name })));
          
          // Usar el workspace seleccionado en la configuración, o el primero si no está especificado
          const workspaceId = config.selectedWorkspace 
            ? apiKeyInfo.workspaces.find((w: any) => w.id === config.selectedWorkspace)?.id
            : apiKeyInfo.workspaces[0]?.id;
            
          if (!workspaceId) {
            console.warn(`Workspace ID no encontrado para ${apiKeyInfo.fullname}. Workspace seleccionado: ${config.selectedWorkspace}, workspaces disponibles: ${apiKeyInfo.workspaces.map((w: any) => w.id).join(', ')}`);
            continue;
          }
          
          const workspaceName = apiKeyInfo.workspaces.find((w: any) => w.id === workspaceId)?.name || 'sin nombre';
          console.log(`[${apiKeyInfo.fullname}] ✅ Usando workspace: ${workspaceId} (${workspaceName})${config.selectedWorkspace ? ' [seleccionado en config]' : ' [por defecto, primero]'}`);

          // Asegurar que la fecha de inicio no sea anterior a la fecha mínima de Toggl
          const togglMinDate = getTogglMinDateSync();
          const effectiveStartDate = report.startDate < togglMinDate ? togglMinDate : report.startDate;
          
          if (report.startDate < togglMinDate) {
            console.warn(`[${apiKeyInfo.fullname}] Fecha de inicio del reporte (${report.startDate}) es anterior a la fecha mínima de Toggl (${togglMinDate}). Usando ${togglMinDate} en su lugar.`);
          }
          
          console.log(`[${apiKeyInfo.fullname}] Obteniendo entradas desde ${effectiveStartDate} hasta ${currentDate}...`);
          const entries = await getTimeEntries(apiKeyInfo.key, effectiveStartDate, currentDate, workspaceId);
          console.log(`[${apiKeyInfo.fullname}] Total entradas obtenidas: ${entries.length}`);

        let filtered = entries;
          
          // Aplicar filtros de configuración
          const initialCount = filtered.length;
        if (config.selectedClient) {
          filtered = filtered.filter((entry: any) => {
            const project = apiKeyInfo.projects.find((p: any) => p.id === entry.pid);
            return project && project.cid === Number(config.selectedClient);
          });
            console.log(`[${apiKeyInfo.fullname}] Después de filtrar por cliente (${config.selectedClient}): ${filtered.length} de ${initialCount}`);
        }
          
        if (config.selectedProject) {
            const beforeProjectFilter = filtered.length;
          filtered = filtered.filter((entry: any) => entry.pid === Number(config.selectedProject));
            console.log(`[${apiKeyInfo.fullname}] Después de filtrar por proyecto (${config.selectedProject}): ${filtered.length} de ${beforeProjectFilter}`);
          }
          
          // Filtrar por tags del reporte si están configurados
          if (report.reportTags && report.reportTags.length > 0) {
            const reportTagNames = report.reportTags.map(t => t.name);
            // Normalizar tags del reporte para comparación (lowercase y sin espacios)
            const normalizedReportTags = reportTagNames.map(tag => tag.toLowerCase().replace(/\s+/g, ''));
            const beforeTagFilter = filtered.length;
            
            // Log todas las entradas antes del filtro para debug
            console.log(`[${apiKeyInfo.fullname}] Entradas antes de filtrar por tags (${reportTagNames.join(', ')}):`, 
              filtered.map((e: any) => ({
                desc: e.description,
                tags: e.tags || [],
                normalizedTags: (e.tags || []).map((t: string) => t.toLowerCase().replace(/\s+/g, '')),
                hasTag: e.tags && e.tags.some((tag: string) => {
                  const normalized = tag.toLowerCase().replace(/\s+/g, '');
                  return normalizedReportTags.includes(normalized);
                })
              }))
            );
            
            filtered = filtered.filter((entry: any) => {
              if (!entry.tags || entry.tags.length === 0) {
                console.log(`[${apiKeyInfo.fullname}] ❌ Entrada sin tags rechazada: "${entry.description}"`);
                return false;
              }
              
              const hasMatchingTag = entry.tags.some((tag: string) => {
                const normalizedTag = tag.toLowerCase().replace(/\s+/g, '');
                return normalizedReportTags.includes(normalizedTag);
              });
              
              if (!hasMatchingTag) {
                // Log todas las entradas que no pasan el filtro de tags
                console.log(`[${apiKeyInfo.fullname}] ❌ Entrada rechazada por tags: "${entry.description}"`, {
                  tags: entry.tags || [],
                  normalizedTags: (entry.tags || []).map((t: string) => t.toLowerCase().replace(/\s+/g, '')),
                  buscaTags: reportTagNames,
                  buscaTagsNormalized: normalizedReportTags,
                  fecha: entry.start,
                  proyecto: entry.pid
                });
              }
              return hasMatchingTag;
            });
            console.log(`[${apiKeyInfo.fullname}] ✅ Después de filtrar por tags del reporte (${reportTagNames.join(', ')}): ${filtered.length} de ${beforeTagFilter}`);
          } else {
            console.log(`[${apiKeyInfo.fullname}] No hay tags del reporte configurados, no se filtra por tags`);
        }

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

          console.log(`[${apiKeyInfo.fullname}] Total entradas enriquecidas añadidas: ${enriched.length}`);
        freshTogglEntries.push(...enriched);
        } catch (error: any) {
          const errorMessage = error?.message || 'Error desconocido';
          console.error(`Error procesando config para ${config.selectedApiKey}:`, error);
          
          // Detectar error de límite de API
          if (errorMessage.includes('hourly limit') || errorMessage.includes('402')) {
            console.warn(`⚠️ [${config.selectedApiKey}] Error de límite de API - los datos no se pueden actualizar en este momento`);
            // Continuar sin fallar completamente, pero usar las entradas existentes
          }
          
          // Continuar con la siguiente configuración en lugar de fallar completamente
        }
      }
      
      console.log(`Total entradas de todas las configuraciones: ${freshTogglEntries.length}`);
      
      // Debug: Contar entradas por usuario
      const entriesByUser = freshTogglEntries.reduce((acc: any, entry: any) => {
        const user = entry.user_name || 'Desconocido';
        acc[user] = (acc[user] || 0) + 1;
        return acc;
      }, {});
      console.log('Entradas por usuario:', entriesByUser);

      // COMBINAR: Preservar entradas existentes que no han cambiado y añadir nuevas
      // Solo preservar entradas que pertenecen a workspaces activos
      const preservedTogglEntries = freshTogglEntries.map((freshEntry: any) => {
        const existingEntry = existingTogglMap.get(freshEntry.id);
        
        // Si existe y no ha cambiado (mismo `at` o `updated`), mantener el original
        // Pero solo si pertenece a un workspace activo
        if (existingEntry) {
          const entryWorkspaceId = existingEntry.wid || freshEntry.wid;
          // Verificar que la entrada pertenece a un workspace activo
          if (!entryWorkspaceId || activeWorkspaceIds.has(entryWorkspaceId)) {
          // Comparar si la entrada ha sido modificada
          if (existingEntry.at === freshEntry.at && existingEntry.duration === freshEntry.duration) {
            return existingEntry; // Mantener la entrada existente (no ha cambiado)
            }
          }
        }
        
        // Entrada nueva o modificada
        return freshEntry;
      });
      
      // Asegurarse de que todas las entradas preservadas pertenecen a workspaces activos
      const finalPreservedTogglEntries = preservedTogglEntries.filter((entry: any) => {
        const entryWorkspaceId = entry.wid;
        if (entryWorkspaceId && !activeWorkspaceIds.has(entryWorkspaceId)) {
          console.warn(`⚠️ Entrada preservada no pertenece a workspace activo: ${entry.description?.substring(0, 50)} (workspace ${entryWorkspaceId})`);
          return false;
        }
        return true;
      });
      
      // Verificar que se preservaron todas las entradas
      console.log(`Total entradas preservadas/actualizadas: ${finalPreservedTogglEntries.length}`);
      const preservedByUser = finalPreservedTogglEntries.reduce((acc: any, entry: any) => {
        const user = entry.user_name || 'Desconocido';
        acc[user] = (acc[user] || 0) + 1;
        return acc;
      }, {});
      console.log('Entradas preservadas por usuario:', preservedByUser);

      // COMBINAR: Históricos (CSV) + Entradas de Toggl (nuevas/modificadas + preservadas)
      const allEntries = [
        ...historicalEntries, // Mantener siempre los datos del CSV
        ...finalPreservedTogglEntries // Datos de Toggl (nuevos o actualizados, solo de workspaces activos)
      ];
      
      console.log(`Total entradas finales: ${allEntries.length} (${historicalEntries.length} históricas + ${preservedTogglEntries.length} de Toggl)`);

      // Recalcular estadísticas
      const totalConsumed = allEntries.reduce((sum: number, e: any) => sum + e.duration, 0) / 3600;
      const speed = calculateConsumptionSpeed(allEntries);
      const avgHours = calculateAverageHoursPerTask(allEntries);
      const groupedTasks = groupTasksByDescription(allEntries);
      const teamDist = calculateTeamDistribution(allEntries);
      const evolution = calculateConsumptionEvolution(allEntries);
      const cumulative = calculateCumulativeEvolution(evolution);

      const updatedReport: ClientReport = {
        ...report,
        entries: allEntries,
        lastUpdated: new Date().toISOString(),
        summary: {
          totalHoursConsumed: totalConsumed,
          totalHoursAvailable: report.totalHours,
          consumptionPercentage: (totalConsumed / report.totalHours) * 100,
          consumptionSpeed: speed,
          estimatedDaysRemaining: report.totalHours > totalConsumed ? Math.ceil((report.totalHours - totalConsumed) / speed) : 0,
          completedTasks: groupedTasks.length,
          averageHoursPerTask: avgHours,
          tasksByDescription: groupedTasks,
          teamDistribution: teamDist,
          consumptionEvolution: cumulative,
        },
      };

      // Actualizar el reporte en localStorage
      const reports = await getAllReports();
      const index = reports.findIndex(r => r.id === report.id);
      if (index >= 0) {
        reports[index] = updatedReport;
        localStorage.setItem('client_reports', JSON.stringify(reports));
      }

      setReport(updatedReport);
      
      // Debug temporal: Mostrar resumen de actualización
      const summary = Object.entries(entriesByUser).map(([user, count]) => `${user}: ${count} entradas`).join(', ');
      console.log('=== RESUMEN DE ACTUALIZACIÓN ===');
      console.log('Entradas por usuario:', summary);
      console.log('Total entradas finales:', allEntries.length);
      console.log('================================');
      
      if (!silent) {
        const userSummary = Object.entries(entriesByUser).map(([user, count]) => `${user}: ${count}`).join(' | ');
        toast.success(`Reporte actualizado exitosamente. ${userSummary}. Total: ${allEntries.length} entradas`);
      }
    } catch (error) {
      console.error('Error al actualizar:', error);
      if (!silent) {
        toast.error('Error al actualizar el reporte: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // Mostrar pantalla de login si está protegido y no autenticado
  if (isPasswordProtected && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <ShieldCheck className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">
              Reporte Protegido
            </CardTitle>
            <p className="text-muted-foreground">
              Este reporte requiere contraseña para acceder
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {passwordError && (
                <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md border border-red-200 dark:border-red-800">
                  {passwordError}
                </div>
              )}

              <Button type="submit" className="w-full">
                Acceder al Reporte
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <div className="max-w-[1400px] mx-auto p-6 md:p-8 lg:p-12 space-y-8">
        {/* Theme Toggle */}
        <div className="absolute top-6 right-6 flex items-center gap-3">
          <ThemeToggle />
        </div>

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
                  Los datos se actualizarán automáticamente cuando el límite se resetee en aproximadamente {apiLimitInfo.resetMinutes} minuto(s). 
                  Mientras tanto, estás viendo los datos más recientes disponibles en cache.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header Section - Exactamente como la imagen */}
        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <Badge variant="outline" className="border-primary/30 text-primary">
              Actualizado hoy, {getLastUpdateTime()}h
            </Badge>
                </div>
          
          {/* Title */}
          <h1 className="text-2xl font-medium text-foreground">Resumen del paquete contratado</h1>
          
          {/* Intro Text */}
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground max-w-2xl">
              Aquí puedes ver en qué punto está tu proyecto y cómo avanzamos juntos
            </p>
            <Rocket className="w-4 h-4 text-red-500" />
          </div>
          
        </div>

        {activeView === 'summary' ? (
          <>
            {/* 4 Bloques en una sola fila: Cliente + 3 KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Client Card */}
              <Card className="border-l-4 border-l-primary">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-bold text-foreground mb-2">{report.name}</h2>
                </CardContent>
              </Card>

              {/* 3 KPIs Horizontales */}
              {/* Horas contratadas */}
              <Card>
                <CardContent className="p-6 relative">
                  <div className="absolute top-4 right-4 w-10 h-10 rounded-full border border-primary/30 bg-muted flex items-center justify-center">
                    <Clock className="w-5 h-5 text-foreground" />
                    </div>
                  <p className="text-sm text-muted-foreground mb-2">Horas contratadas</p>
                  <p className="text-3xl font-bold text-foreground mb-1">{report.totalHours}</p>
                  <p className="text-xs text-muted-foreground">
                    Fecha de inicio: {new Date(report.startDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                  </p>
                </CardContent>
              </Card>

              {/* Horas consumidas */}
              <Card>
                <CardContent className="p-6 relative">
                  <div className="absolute top-4 right-4 w-10 h-10 rounded-full border border-primary/30 bg-muted flex items-center justify-center">
                    <Clock className="w-5 h-5 text-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">Horas consumidas</p>
                  <p className="text-3xl font-bold text-foreground mb-1">{report.summary.totalHoursConsumed.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">
                    {report.summary.consumptionPercentage.toFixed(0)}% del total
                  </p>
                </CardContent>
              </Card>

              {/* Horas disponibles */}
              <Card>
                <CardContent className="p-6 relative">
                  <div className="absolute top-4 right-4 w-10 h-10 rounded-full border border-primary/30 bg-muted flex items-center justify-center">
                    <Zap className="w-5 h-5 text-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">Horas disponibles</p>
                  <p className="text-3xl font-bold text-foreground mb-1">
                    {(report.summary.totalHoursAvailable - report.summary.totalHoursConsumed).toFixed(0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Listas para usar</p>
                </CardContent>
              </Card>
                </div>

            {/* Progreso del paquete y Ritmo y proyección en paralelo */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Progreso del paquete */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Progreso del paquete</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">
                      {report.summary.totalHoursConsumed.toFixed(0)} de {report.totalHours} horas utilizadas
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {report.summary.consumptionPercentage.toFixed(0)}%
                    </p>
                    </div>
                  <div className="w-full rounded-full h-3 bg-muted overflow-hidden">
                      <div
                      className="bg-primary h-full rounded-full transition-all"
                        style={{ width: `${report.summary.consumptionPercentage}%` }}
                      />
                    </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Última actualización: {getLastUpdateDate()}
                  </p>
                </CardContent>
              </Card>

              {/* Ritmo y proyección */}
              <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  Ritmo y proyección
                  <TrendingUp className="w-4 h-4 text-primary" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Velocidad de consumo</p>
                    <p className="text-2xl font-bold text-foreground mb-1">
                      {calculateWeeklySpeed().toFixed(1)}h/semana
                    </p>
                    <p className="text-xs text-muted-foreground">Promedio de las últimas 4 semanas</p>
                    </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Estimación de agotamiento</p>
                    <p className="text-2xl font-bold text-foreground mb-1">
                      {calculateWeeksRemaining().toFixed(1)} semanas
                    </p>
                    <p className="text-xs text-muted-foreground">Al ritmo actual de trabajo</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>

            {/* Últimas tareas registradas */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium">Últimas tareas registradas</CardTitle>
                  <Button
                    variant="ghost"
                    onClick={() => setActiveView('tasks')}
                    className="gap-2 text-muted-foreground group"
                  >
                    <span className="group-hover:text-[#000000] transition-colors duration-200 ease-in-out">Ver todas las tareas</span>
                    <ArrowRight className="w-4 h-4 group-hover:text-[#000000] transition-colors duration-200 ease-in-out" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Tarea</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Fecha</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Proyecto</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Responsable</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-foreground">Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getLatestTasks().map((entry, idx) => (
                        <tr key={idx} className="border-b border-border hover:bg-muted/20 transition-all duration-200 ease-in-out">
                          <td className="py-3 px-4 text-sm text-foreground">{entry.description || 'Sin descripción'}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {formatDateES(new Date(entry.start))}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              className="rounded-full px-3 py-1 border font-bold"
                              style={{
                                backgroundColor: getProjectColor(entry.project_name || 'Sin proyecto').fill,
                                borderColor: getProjectColor(entry.project_name || 'Sin proyecto').stroke,
                                borderWidth: '1px',
                                color: getProjectColor(entry.project_name || 'Sin proyecto').base,
                              }}
                            >
                              {entry.project_name || 'Sin proyecto'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {entry.user_name || 'Sin usuario'}
                          </td>
                          <td className="py-3 px-4 text-sm text-foreground text-right">
                            {(entry.duration / 3600).toFixed(1)}h
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
              </CardContent>
            </Card>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Distribución de horas por descripción - Donut Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Distribución de horas por descripción</CardTitle>
                </CardHeader>
                <CardContent>
                  {getDescriptionDistribution().length > 0 ? (
                    <div className="flex gap-6">
                      {/* Legend */}
                      <div className="flex-1 space-y-3">
                        {getDescriptionDistribution().slice(0, 6).map((item, idx) => {
                          const colors = ['#5CFFBE', '#7B68EE', '#FF6B9D', '#FFD93D', '#6BCF7F', '#A78BFA'];
                          return (
                            <div key={idx} className="flex items-center gap-2 cursor-pointer hover:bg-muted/20 p-2 rounded transition-all duration-200 ease-in-out">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: colors[idx % colors.length] }}
                              />
                              <div className="flex-1 text-sm text-foreground">
                                <span>{item.name}</span>
                    </div>
                              <div className="text-sm text-muted-foreground">
                                {item.percentage}% ({item.value.toFixed(1)}h)
                  </div>
                </div>
                          );
                        })}
                        <Separator className="my-3" />
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-sm font-medium text-foreground">Total de horas</span>
                          <span className="text-lg font-bold text-foreground">
                            {report.summary.totalHoursConsumed.toFixed(0)}h
                          </span>
              </div>
                    </div>
                      {/* Donut Chart */}
                      <div className="flex-1 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={getDescriptionDistribution().slice(0, 6)}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={false}
                              outerRadius={110}
                              innerRadius={70}
                              fill="#8884d8"
                              dataKey="value"
                              paddingAngle={3}
                            >
                              {getDescriptionDistribution().slice(0, 6).map((entry, index) => {
                                const colors = ['#5CFFBE', '#7B68EE', '#FF6B9D', '#FFD93D', '#6BCF7F', '#A78BFA'];
                                return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                              })}
                            </Pie>
                            <Tooltip
                              formatter={(value: number, name: string) => [`${value.toFixed(1)}h`, name]}
                              contentStyle={{
                                backgroundColor: 'var(--card)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)',
                                color: '#FFFFFF',
                              }}
                              labelStyle={{
                                color: '#FFFFFF',
                                fontWeight: 100,
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                  </div>
                    </div>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      No hay datos disponibles
                  </div>
                  )}
                </CardContent>
              </Card>

              {/* Horas por miembro del equipo - Bar Chart Horizontal */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Horas por miembro del equipo</CardTitle>
                </CardHeader>
                <CardContent>
                  {report.summary.teamDistribution.length > 0 ? (
                    <div className="space-y-4">
                      {report.summary.teamDistribution.map((member, idx) => {
                        const colors = ['#5CFFBE', '#7B68EE', '#FFD93D', '#FF6B9D'];
                        const color = colors[idx % colors.length];
                        const maxHours = Math.max(...report.summary.teamDistribution.map(m => m.hours));
                        return (
                          <div key={idx} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: color }}
                                />
                    <div>
                                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {member.name === 'Dani' ? 'Chief Development' : 
                                     member.name === 'Alberto' ? 'Front Developer' : 
                                     member.name === 'Jordi' ? 'UX/UI Designer' : 
                                     'Developer'}
                                  </p>
                    </div>
                  </div>
                              <p className="text-sm font-semibold text-foreground">
                                {member.hours.toFixed(0)}h
                              </p>
                </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${(member.hours / maxHours) * 100}%`,
                                  backgroundColor: color,
                                }}
                              />
                    </div>
                    </div>
                        );
                      })}
                  </div>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      No hay datos de equipo disponibles
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Consumo acumulado por meses - Bar Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium">Consumo acumulado por meses</CardTitle>
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-muted-foreground">
                        {getMonthlyStats().totalHours.toFixed(0)}h totales
                      </p>
                      {/* Selector de tiempo */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="gap-2">
                            <Calendar className="w-4 h-4" />
                            {timePeriod === 'año-actual' && 'Año actual'}
                            {timePeriod === 'año-anterior' && 'Año anterior'}
                            {timePeriod === 'ultimos-12-meses' && 'Últimos 12 meses'}
                            {timePeriod === 'ultimos-7-dias' && 'Últimos 7 días'}
                            {timePeriod === 'mes-actual' && 'Mes actual'}
                            {timePeriod === 'mes-anterior' && 'Mes anterior'}
                            {timePeriod === 'trimestre-1' && '1 trimestre'}
                            {timePeriod === 'trimestre-2' && '2 trimestre'}
                            {timePeriod === 'trimestre-3' && '3 trimestre'}
                            {timePeriod === 'trimestre-4' && '4 trimestre'}
                            {timePeriod === 'personalizado' && 'Personalizado'}
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56">
                          <div className="space-y-1">
                            <Button
                              variant={timePeriod === 'año-actual' ? 'default' : 'ghost'}
                              className="w-full justify-start"
                              onClick={() => setTimePeriod('año-actual')}
                            >
                              Año actual
                            </Button>
                            <Button
                              variant={timePeriod === 'año-anterior' ? 'default' : 'ghost'}
                              className="w-full justify-start"
                              onClick={() => setTimePeriod('año-anterior')}
                            >
                              Año anterior
                            </Button>
                            <Button
                              variant={timePeriod === 'ultimos-12-meses' ? 'default' : 'ghost'}
                              className="w-full justify-start"
                              onClick={() => setTimePeriod('ultimos-12-meses')}
                            >
                              Últimos 12 meses
                            </Button>
                            <Button
                              variant={timePeriod === 'ultimos-7-dias' ? 'default' : 'ghost'}
                              className="w-full justify-start"
                              onClick={() => setTimePeriod('ultimos-7-dias')}
                            >
                              Últimos 7 días
                            </Button>
                            <Button
                              variant={timePeriod === 'mes-actual' ? 'default' : 'ghost'}
                              className="w-full justify-start"
                              onClick={() => setTimePeriod('mes-actual')}
                            >
                              Mes actual
                            </Button>
                            <Button
                              variant={timePeriod === 'mes-anterior' ? 'default' : 'ghost'}
                              className="w-full justify-start"
                              onClick={() => setTimePeriod('mes-anterior')}
                            >
                              Mes anterior
                            </Button>
                            <Separator />
                            <Button
                              variant={timePeriod === 'trimestre-1' ? 'default' : 'ghost'}
                              className="w-full justify-start"
                              onClick={() => setTimePeriod('trimestre-1')}
                            >
                              1 trimestre
                            </Button>
                            <Button
                              variant={timePeriod === 'trimestre-2' ? 'default' : 'ghost'}
                              className="w-full justify-start"
                              onClick={() => setTimePeriod('trimestre-2')}
                            >
                              2 trimestre
                            </Button>
                            <Button
                              variant={timePeriod === 'trimestre-3' ? 'default' : 'ghost'}
                              className="w-full justify-start"
                              onClick={() => setTimePeriod('trimestre-3')}
                            >
                              3 trimestre
                            </Button>
                            <Button
                              variant={timePeriod === 'trimestre-4' ? 'default' : 'ghost'}
                              className="w-full justify-start"
                              onClick={() => setTimePeriod('trimestre-4')}
                            >
                              4 trimestre
                            </Button>
                            <Separator />
                            <Button
                              variant={timePeriod === 'personalizado' ? 'default' : 'ghost'}
                              className="w-full justify-start"
                              onClick={() => setTimePeriod('personalizado')}
                            >
                              Personalizado
                            </Button>
                            {timePeriod === 'personalizado' && (
                              <div className="mt-2 space-y-2 pt-2 border-t">
                    <div>
                                  <Label htmlFor="custom-start" className="text-xs">
                                    Fecha inicio
                                  </Label>
                                  <input
                                    id="custom-start"
                                    type="date"
                                    value={customDateStart}
                                    onChange={(e) => setCustomDateStart(e.target.value)}
                                    className="w-full mt-1 px-2 py-1 text-xs rounded-md border border-input bg-background"
                                  />
                    </div>
                                <div>
                                  <Label htmlFor="custom-end" className="text-xs">
                                    Fecha fin
                                  </Label>
                                  <input
                                    id="custom-end"
                                    type="date"
                                    value={customDateEnd}
                                    onChange={(e) => setCustomDateEnd(e.target.value)}
                                    className="w-full mt-1 px-2 py-1 text-xs rounded-md border border-input bg-background"
                                  />
                  </div>
                </div>
                            )}
              </div>
                        </PopoverContent>
                      </Popover>
            </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {getMonthlyConsumption().length > 0 ? (
                    <>
                <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={getMonthlyConsumption()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis 
                            dataKey="month"
                            stroke="var(--foreground)"
                            tickLine={false}
                            axisLine={{ stroke: 'var(--border)' }}
                            tick={{ fill: 'var(--muted-foreground)' }}
                    />
                    <YAxis 
                            stroke="var(--foreground)"
                            tickLine={false}
                            axisLine={{ stroke: 'var(--border)' }}
                            tick={{ fill: 'var(--muted-foreground)' }}
                            domain={[0, Math.max(...getMonthlyConsumption().map(d => d.hours), 1) * 1.2]}
                    />
                    <Tooltip 
                      formatter={(value: number) => `${value.toFixed(1)}h`}
                            contentStyle={{
                              backgroundColor: 'var(--card)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius)',
                              padding: '0.75rem',
                              color: '#FFFFFF',
                            }}
                            labelStyle={{
                              color: '#FFFFFF',
                              fontWeight: 100,
                            }}
                          />
                          <Bar
                      dataKey="hours" 
                            fill="#5CFFBE"
                            radius={[8, 8, 0, 0]}
                          />
                        </BarChart>
                </ResponsiveContainer>
                      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Promedio mensual</p>
                          <p className="text-sm font-semibold text-foreground">
                            {getMonthlyStats().average.toFixed(1)}h
                </p>
              </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Mes con más horas</p>
                          <p className="text-sm font-semibold text-foreground">
                            {getMonthlyStats().maxMonth ? `${getMonthlyStats().maxMonth?.month} (${getMonthlyStats().maxMonth?.hours.toFixed(0)}h)` : 'N/A'}
                          </p>
                  </div>
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Tendencia</p>
                            <p className="text-sm font-semibold text-foreground">
                              {getMonthlyStats().trend}
                            </p>
                          </div>
                          {getMonthlyStats().trend !== 'Decreciente' && (
                            <TrendingUp className="w-4 h-4 text-primary" />
                )}
              </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No hay datos mensuales disponibles
                  </div>
                )}
                </CardContent>
              </Card>
              </div>

            {/* Transparencia total */}
            <Card>
              <CardContent className="p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-6 h-6 text-primary-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Cada hora registrada se asocia a una tarea concreta. Los datos se actualizan automáticamente desde nuestro sistema de control horario, garantizando precisión y claridad en todo momento.
                </p>
              </CardContent>
            </Card>

            {/* Call to Action */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <MessageSquare className="w-5 h-5 text-foreground mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-base font-medium text-foreground mb-2">
                      ¿Quieres priorizar una tarea o comentar algo sobre el progreso?
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Estamos aquí para adaptarnos a tus necesidades. No dudes en contactarnos.
                    </p>
                  </div>
                </div>
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                  Enviar mensaje al equipo
                  <Send className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Footer */}
            <div className="text-center py-8">
              <p className="text-xs text-muted-foreground">
                © 2025 Tres Puntos Comunicación · Agencia de UX/UI
              </p>
            </div>
          </>
        ) : (
          /* Vista de Tareas - Con botón para volver */
          <div className="space-y-6">
            {/* Botón para volver al resumen */}
            <Button
              variant="ghost"
              onClick={() => setActiveView('summary')}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Volver al resumen
            </Button>

            {/* Header de Tareas y Filtros en la misma fila */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Header de Tareas */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-2xl">Tareas del {report.name}</CardTitle>
                  <p className="text-muted-foreground text-sm">
                {report.summary.completedTasks} tareas únicas • {report.summary.totalHoursConsumed.toFixed(1)} horas totales
              </p>
                </CardHeader>
              </Card>

            {/* Filtros */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Filter className="w-5 h-5" />
                    Filtros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Project Filter Popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <Package className="w-4 h-4" />
                          Proyectos
                          {selectedProjects.length > 0 && (
                            <Badge variant="secondary" className="ml-1">
                              {selectedProjects.length}
                            </Badge>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Seleccionar Proyectos</Label>
                          <Separator />
                          <div className="max-h-64 overflow-y-auto space-y-2">
                            {getUniqueProjects().map(project => (
                              <div key={project} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`project-${project}`}
                                  checked={selectedProjects.includes(project)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedProjects([...selectedProjects, project]);
                                    } else {
                                      setSelectedProjects(selectedProjects.filter(p => p !== project));
                                    }
                                  }}
                                />
                                <Label
                                  htmlFor={`project-${project}`}
                                  className="text-sm font-normal cursor-pointer"
                                >
                                  {project}
                                </Label>
                              </div>
                            ))}
                </div>
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Tag Filter Popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <Filter className="w-4 h-4" />
                          Tags
                          {selectedTags.length > 0 && (
                            <Badge variant="secondary" className="ml-1">
                              {selectedTags.length}
                            </Badge>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Seleccionar Tags</Label>
                          <Separator />
                          <div className="max-h-64 overflow-y-auto space-y-2">
                    {getUniqueTags().map(tag => (
                              <div key={tag} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`tag-${tag}`}
                                  checked={selectedTags.includes(tag)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedTags([...selectedTags, tag]);
                                    } else {
                                      setSelectedTags(selectedTags.filter(t => t !== tag));
                                    }
                                  }}
                                />
                                <Label
                                  htmlFor={`tag-${tag}`}
                                  className="text-sm font-normal cursor-pointer"
                                >
                                  {tag}
                                </Label>
                              </div>
                            ))}
                </div>
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Date Range */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <Calendar className="w-4 h-4" />
                          Fechas
                          {(dateRangeStart || dateRangeEnd) && (
                            <Badge variant="secondary" className="ml-1">
                              {(dateRangeStart ? 1 : 0) + (dateRangeEnd ? 1 : 0)}
                            </Badge>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <div className="space-y-4">
                          <Label className="text-sm font-semibold">Rango de Fechas</Label>
                          <Separator />
                  <div className="space-y-2">
                            <div>
                              <Label htmlFor="date-start" className="text-xs text-muted-foreground">
                                Fecha Inicio
                              </Label>
                    <input
                                id="date-start"
                      type="date"
                      value={dateRangeStart}
                      onChange={(e) => setDateRangeStart(e.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background"
                    />
                            </div>
                            <div>
                              <Label htmlFor="date-end" className="text-xs text-muted-foreground">
                                Fecha Fin
                              </Label>
                    <input
                                id="date-end"
                      type="date"
                      value={dateRangeEnd}
                      onChange={(e) => setDateRangeEnd(e.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background"
                    />
                  </div>
                </div>
              </div>
                      </PopoverContent>
                    </Popover>

            {/* Botones de Expandir/Colapsar */}
                    <div className="flex gap-2 ml-auto">
                      <Button
                        variant="outline"
                        size="sm"
                onClick={() => {
                          const allExpanded: Record<string, boolean> = {};
                  getFilteredTasks().forEach(task => {
                    allExpanded[task.description] = true;
                  });
                  setExpandedTasks(allExpanded);
                }}
              >
                Expandir Todo
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                onClick={() => setExpandedTasks({})}
              >
                Colapsar Todo
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filtros activos */}
            {(selectedProjects.length > 0 || selectedTags.length > 0 || dateRangeStart || dateRangeEnd) && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap gap-2">
                      {selectedProjects.map(project => {
                        const colors = getProjectColor(project);
                        return (
                          <Badge
                            key={project}
                            className="rounded-full px-3 py-1 border gap-2 pr-1"
                            style={{
                              backgroundColor: colors.fill,
                              borderColor: colors.stroke,
                              borderWidth: '1px',
                              color: colors.base,
                            }}
                          >
                            {project}
                            <button
                              onClick={() => setSelectedProjects(selectedProjects.filter(p => p !== project))}
                              className="ml-1 hover:bg-white/10 rounded-full p-0.5 transition-all duration-200 ease-in-out"
                            >
                              <X className="w-3 h-3" />
              </button>
                          </Badge>
                        );
                      })}
                      {selectedTags.map(tag => (
                        <Badge key={tag} variant="secondary" className="gap-2 pr-1">
                          {tag}
                          <button
                            onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}
                            className="ml-1 hover:bg-destructive/10 rounded-full p-0.5 transition-all duration-200 ease-in-out"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                      {dateRangeStart && (
                        <Badge variant="secondary" className="gap-2 pr-1">
                          Desde: {dateRangeStart}
                          <button
                            onClick={() => setDateRangeStart('')}
                            className="ml-1 hover:bg-destructive/10 rounded-full p-0.5 transition-all duration-200 ease-in-out"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      )}
                      {dateRangeEnd && (
                        <Badge variant="secondary" className="gap-2 pr-1">
                          Hasta: {dateRangeEnd}
                          <button
                            onClick={() => setDateRangeEnd('')}
                            className="ml-1 hover:bg-destructive/10 rounded-full p-0.5 transition-all duration-200 ease-in-out"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedProjects([]);
                          setSelectedTags([]);
                          setDateRangeStart('');
                          setDateRangeEnd('');
                        }}
                        className="gap-2"
                      >
                        <X className="w-4 h-4" />
                        Limpiar Todo
                      </Button>
            </div>
                </CardContent>
              </Card>
            )}

            {/* Tareas Agrupadas */}
            <Card>
              <CardHeader>
                <CardTitle>Tareas Agrupadas</CardTitle>
              </CardHeader>
              <CardContent>
              <div className="space-y-0">
                {getFilteredTasks().map((task, idx) => {
                  const totalFilteredHours = getFilteredTasks().reduce((sum, t) => sum + t.totalHours, 0);
                  const percentageOfTotal = totalFilteredHours > 0 ? (task.totalHours / totalFilteredHours * 100).toFixed(0) : '0';
                  
                  // Obtener tags únicos de las entradas
                  const tags = new Set<string>();
                  task.entries.forEach(entry => {
                    if (entry.tag_names) {
                      entry.tag_names.forEach(tag => tags.add(tag));
                    }
                  });

                  return (
                    <div key={idx} className="border-b last:border-b-0">
                      <button
                        onClick={() => toggleTask(task.description)}
                        className="w-full p-4 flex items-center gap-4 transition-all duration-300 ease-in-out hover:bg-muted/30 hover:shadow-sm group"
                      >
                        <svg
                          className={`w-5 h-5 transform transition-transform ${expandedTasks[task.description] ? 'rotate-90' : ''} text-muted-foreground`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        
                        <div className="flex-1 text-left">
                          <p className="font-bold text-foreground transition-colors duration-200 ease-in-out group-hover:text-[#5CFFBE]">{task.description}</p>
                          <p className="text-sm mt-1 text-muted-foreground">{task.count} entradas</p>
                          
                          {/* Tags de las entradas */}
                          {Array.from(tags).length > 0 && (
                            <div className="flex gap-2 mt-2">
                              {Array.from(tags).slice(0, 5).map((tag, tIdx) => (
                                <Badge key={tIdx} variant="secondary">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-right">
                          <p className="text-xl font-bold text-primary">{task.totalHours.toFixed(1)}h</p>
                          <p className="text-sm text-muted-foreground">{percentageOfTotal}% del total filtrado</p>
                        </div>
                      </button>
                      
                      {expandedTasks[task.description] && (
                        <div className="border-t bg-muted/50 px-4 py-4">
                          <div className="space-y-2">
                            {task.entries.map((entry, eIdx) => (
                              <Card key={eIdx} className="p-3">
                                <div className="flex justify-between items-center text-sm">
                                <div className="flex-1">
                                    <p className="font-medium text-foreground">{entry.description || 'Sin descripción'}</p>
                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                      <Badge
                                        className="rounded-full text-xs px-2 py-0.5 border font-bold"
                                        style={{
                                          backgroundColor: getProjectColor(entry.project_name || 'Sin proyecto').fill,
                                          borderColor: getProjectColor(entry.project_name || 'Sin proyecto').stroke,
                                          borderWidth: '1px',
                                          color: getProjectColor(entry.project_name || 'Sin proyecto').base,
                                        }}
                                      >
                                        {entry.project_name || 'Sin proyecto'}
                                      </Badge>
                                      <p className="text-xs text-muted-foreground">•</p>
                                      <p className="text-xs text-muted-foreground">{entry.user_name}</p>
                                      <p className="text-xs text-muted-foreground">•</p>
                                      <p className="text-xs text-muted-foreground">{new Date(entry.start).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                  <p className="font-semibold text-primary">{(entry.duration / 3600).toFixed(2)}h</p>
                              </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

