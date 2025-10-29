'use client';

import { useState, useEffect } from 'react';
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
import { Activity, TrendingUp, Clock, CheckCircle, Calendar, Users, Package, Filter, X } from 'lucide-react';

export default function ClientReportDashboard({ report: initialReport }: { report: ClientReport }) {
  const [report, setReport] = useState<ClientReport>(initialReport);
  const [activeView, setActiveView] = useState<'summary' | 'tasks'>('summary');
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastAutoUpdate, setLastAutoUpdate] = useState<Date | null>(null);
  
  // Filter states
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');

  // Auto-refresh cada 30 minutos  
  useEffect(() => {
    const updateWithReport = async () => {
      try {
        const stored = localStorage.getItem('toggl_api_keys');
        if (!stored) return;

        const apiKeys = JSON.parse(stored);
        
        // Separar entradas actuales del reporte
        const historicalEntries = report.entries.filter((e: any) => e.id < 0);
        const existingTogglEntries = report.entries.filter((e: any) => e.id >= 0);
        const existingTogglMap = new Map(
          existingTogglEntries.map((entry: any) => [entry.id, entry])
        );
        
        const currentDate = new Date().toISOString().split('T')[0];
        const freshTogglEntries: any[] = [];
        
        for (const config of report.configs) {
          const apiKeyInfo = apiKeys.find((k: any) => k.id === config.selectedApiKey);
          if (!apiKeyInfo) continue;

          const workspaceId = apiKeyInfo.workspaces[0]?.id;
          if (!workspaceId) continue;

          const entries = await getTimeEntries(apiKeyInfo.key, report.startDate, currentDate, workspaceId);

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
          if (report.reportTags && report.reportTags.length > 0) {
            const reportTagNames = report.reportTags.map(t => t.name);
            filtered = filtered.filter((entry: any) => 
              entry.tags && entry.tags.some((tag: string) => reportTagNames.includes(tag))
            );
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

          freshTogglEntries.push(...enriched);
        }

        // Preservar entradas que no han cambiado
        const preservedTogglEntries = freshTogglEntries.map((freshEntry: any) => {
          const existingEntry = existingTogglMap.get(freshEntry.id);
          if (existingEntry && existingEntry.at === freshEntry.at && existingEntry.duration === freshEntry.duration) {
            return existingEntry;
          }
          return freshEntry;
        });

        const allEntries = [...historicalEntries, ...preservedTogglEntries];

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

    // Actualizar cada 30 minutos
    const intervalId = setInterval(updateWithReport, 30 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []); // Solo ejecutar una vez al montar

  const toggleTask = (description: string) => {
    setExpandedTasks(prev => ({
      ...prev,
      [description]: !prev[description]
    }));
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
          alert('No se pueden actualizar los datos. Vuelve a abrir el reporte desde el panel de gestión.');
        }
        setIsUpdating(false);
        return;
      }

      const apiKeys = JSON.parse(stored);
      
      // SEPARAR: Entradas históricas (CSV) y entradas de Toggl existentes
      const historicalEntries = report.entries.filter((e: any) => e.id < 0); // IDs negativos = CSV
      const existingTogglEntries = report.entries.filter((e: any) => e.id >= 0); // IDs positivos = Toggl
      
      // Crear un mapa de entradas existentes de Toggl por ID para comparar
      const existingTogglMap = new Map(
        existingTogglEntries.map((entry: any) => [entry.id, entry])
      );
      
      // Obtener datos ACTUALIZADOS de Toggl
      const currentDate = new Date().toISOString().split('T')[0];
      const freshTogglEntries: any[] = [];
      
      for (const config of report.configs) {
        const apiKeyInfo = apiKeys.find((k: any) => k.id === config.selectedApiKey);
        if (!apiKeyInfo) continue;

        const workspaceId = apiKeyInfo.workspaces[0]?.id;
        if (!workspaceId) continue;

        const entries = await getTimeEntries(apiKeyInfo.key, report.startDate, currentDate, workspaceId);

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
        if (report.reportTags && report.reportTags.length > 0) {
          const reportTagNames = report.reportTags.map(t => t.name);
          filtered = filtered.filter((entry: any) => 
            entry.tags && entry.tags.some((tag: string) => reportTagNames.includes(tag))
          );
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

        freshTogglEntries.push(...enriched);
      }

      // COMBINAR: Preservar entradas existentes que no han cambiado
      const preservedTogglEntries = freshTogglEntries.map((freshEntry: any) => {
        const existingEntry = existingTogglMap.get(freshEntry.id);
        
        // Si existe y no ha cambiado (mismo `at` o `updated`), mantener el original
        if (existingEntry) {
          // Comparar si la entrada ha sido modificada
          // Si 'at' (timestamp de última actualización) es igual, no ha cambiado
          if (existingEntry.at === freshEntry.at && existingEntry.duration === freshEntry.duration) {
            return existingEntry; // Mantener la entrada existente (no ha cambiado)
          }
        }
        
        // Entrada nueva o modificada
        return freshEntry;
      });

      // COMBINAR: Históricos (CSV) + Entradas de Toggl (nuevas/modificadas + preservadas)
      const allEntries = [
        ...historicalEntries, // Mantener siempre los datos del CSV
        ...preservedTogglEntries // Datos de Toggl (nuevos o actualizados)
      ];

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
      
      if (!silent) {
        alert('✓ Reporte actualizado exitosamente');
      }
    } catch (error) {
      console.error('Error al actualizar:', error);
      if (!silent) {
        alert('Error al actualizar el reporte: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        {/* Theme Toggle */}
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>

        {/* Header con navegación moderna */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                    <Package className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="text-3xl">{report.name}</CardTitle>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm mb-1 text-muted-foreground">Total del Paquete</p>
                <p className="text-3xl font-bold text-foreground">{report.totalHours.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} horas</p>
                <p className="text-lg mt-1 text-muted-foreground">
                  {(report.summary.totalHoursAvailable - report.summary.totalHoursConsumed).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} disponibles
                </p>
                {typeof report.price === 'number' && report.price > 0 ? (
                  <p className="text-xl font-semibold mt-2 text-foreground">
                    {report.price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                ) : null}
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'summary' | 'tasks')}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="summary">Resumen</TabsTrigger>
                <TabsTrigger value="tasks">Tareas</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {activeView === 'summary' ? (
          <>
            {/* KPIs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* Consumo del Paquete - Large Card */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Consumo del Paquete
                  </CardTitle>
                </CardHeader>
                <CardContent>
                
                {/* Circular Progress */}
                <div className="flex items-center justify-center mb-8">
                  <div className="relative w-64 h-64">
                    <svg className="transform -rotate-90 w-64 h-64">
                      <circle
                        cx="128"
                        cy="128"
                        r="100"
                        stroke="hsl(var(--muted))"
                        strokeWidth="16"
                        fill="none"
                      />
                      <circle
                        cx="128"
                        cy="128"
                        r="100"
                        stroke="hsl(var(--primary))"
                        strokeWidth="16"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 100}`}
                        strokeDashoffset={`${2 * Math.PI * 100 * (1 - report.summary.consumptionPercentage / 100)}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-bold text-foreground">
                        {report.summary.consumptionPercentage.toFixed(1)}%
                      </span>
                      <span className="text-sm text-muted-foreground">consumido</span>
                    </div>
                  </div>
                </div>

                {/* Progress Bars */}
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Horas consumidas</span>
                      <span className="text-2xl font-bold text-foreground">{report.summary.totalHoursConsumed.toFixed(1)}h</span>
                    </div>
                    <div className="w-full rounded-full h-4 overflow-hidden bg-secondary">
                      <div
                        className="bg-primary h-full transition-all"
                        style={{ width: `${report.summary.consumptionPercentage}%` }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Horas disponibles</span>
                      <span className="text-2xl font-bold text-foreground">
                        {(report.summary.totalHoursAvailable - report.summary.totalHoursConsumed).toFixed(1)}h
                      </span>
                    </div>
                    <div className="w-full rounded-full h-4 overflow-hidden bg-secondary">
                      <div
                        className="bg-teal-400 h-full transition-all"
                        style={{ width: `${100 - report.summary.consumptionPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
                </CardContent>
              </Card>

              {/* Top Right - Grid of 4 small cards */}
              <div className="grid grid-cols-1 gap-4 lg:col-span-1">
                {/* Row 1 */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Velocidad de Consumo */}
                  <Card>
                    <CardContent className="p-4 flex items-start gap-3">
                      <TrendingUp className="w-8 h-8 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-2xl font-bold text-foreground">{report.summary.consumptionSpeed.toFixed(2)}h/día</p>
                        <p className="text-xs mt-1 text-muted-foreground">Últimos 7 días</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Estimación */}
                  <Card>
                    <CardContent className="p-4 flex items-start gap-3">
                      <Calendar className="w-8 h-8 text-blue-600 flex-shrink-0" />
                      <div>
                        <p className="text-2xl font-bold text-foreground">~{report.summary.estimatedDaysRemaining} días</p>
                        <p className="text-xs mt-1 text-muted-foreground">Para agotar paquete</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Tag Activo */}
                  {report.activeTag && (
                    <Card className="col-span-2 border-green-500 border-2">
                      <CardContent className="p-4 flex items-start gap-3">
                        <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-muted-foreground">Tag Activo</p>
                          <p className="text-xl font-bold text-green-700">{report.activeTag}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {/* Tareas Completadas */}
                  <Card>
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{report.summary.completedTasks}</p>
                        <p className="text-xs mt-1 text-muted-foreground">Entradas de tiempo</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Promedio por Tarea */}
                  <Card>
                    <CardContent className="p-4 flex items-start gap-3">
                      <Clock className="w-8 h-8 text-purple-600 flex-shrink-0" />
                      <div>
                        <p className="text-2xl font-bold text-foreground">{report.summary.averageHoursPerTask.toFixed(1)}h</p>
                        <p className="text-xs mt-1 text-muted-foreground">Por tarea única</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Evolución del Consumo Acumulado */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Consumo Acumulado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={report.summary.consumptionEvolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getDate()}/${date.getMonth() + 1}`;
                      }}
                    />
                    <YAxis 
                      label={{ value: 'Horas', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      labelFormatter={(label) => `Fecha: ${new Date(label).toLocaleDateString('es-ES')}`}
                      formatter={(value: number) => `${value.toFixed(1)}h`}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="hours" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-xs text-center mt-2 text-muted-foreground">
                  Total acumulado de horas trabajadas
                </p>
                </CardContent>
              </Card>

              {/* Distribución por Miembro del Equipo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Horas por Miembro del Equipo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                {report.summary.teamDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={report.summary.teamDistribution} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        type="number" 
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        label={{ value: 'Horas', position: 'insideBottom', offset: -5 }}
                      />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={100} 
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                      />
                      <Tooltip 
                        formatter={(value: number) => `${value.toFixed(1)}h`}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))' 
                        }}
                      />
                      <Bar 
                        dataKey="hours" 
                        fill="hsl(var(--primary))" 
                        radius={[0, 4, 4, 0]} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No hay datos de equipo disponibles
                  </div>
                )}
                </CardContent>
              </Card>

              {/* Consumo por Proyectos */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Consumo por Proyecto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                {projectConsumption().length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={projectConsumption()}>
                      <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis 
                      />
                      <Tooltip 
                        formatter={(value: number) => `${value.toFixed(1)}h`}
                      />
                      <Bar dataKey="hours" fill="#10b981" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No hay datos de proyectos disponibles
                  </div>
                )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          /* Vista de Tareas */
          <div className="space-y-6">
            {/* Header de Tareas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl">Tareas del {report.name}</CardTitle>
                <p className="text-muted-foreground">
                  {report.summary.completedTasks} tareas únicas • {report.summary.totalHoursConsumed.toFixed(1)} horas totales
                </p>
              </CardHeader>
            </Card>

            {/* Filtros */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    Filtros
                  </CardTitle>
                  {(selectedProjects.length > 0 || selectedTags.length > 0 || dateRangeStart || dateRangeEnd) && (
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
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Filtros activos */}
                  {(selectedProjects.length > 0 || selectedTags.length > 0 || dateRangeStart || dateRangeEnd) && (
                    <div className="flex flex-wrap gap-2">
                      {selectedProjects.map(project => (
                        <Badge key={project} variant="secondary" className="gap-2 pr-1">
                          {project}
                          <button
                            onClick={() => setSelectedProjects(selectedProjects.filter(p => p !== project))}
                            className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                      {selectedTags.map(tag => (
                        <Badge key={tag} variant="secondary" className="gap-2 pr-1">
                          {tag}
                          <button
                            onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}
                            className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
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
                            className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
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
                            className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Selectores de filtros */}
                  <div className="flex flex-wrap gap-3">
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
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Botones de Expandir/Colapsar */}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
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
                onClick={() => setExpandedTasks({})}
              >
                Colapsar Todo
              </Button>
            </div>

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
                        className="w-full p-4 flex items-center gap-4 transition-colors hover:bg-accent"
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
                          <p className="font-bold text-foreground">{task.description}</p>
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
                          
                          {/* Desplegable de Tags del Reporte */}
                          {report.reportTags && report.reportTags.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800 inline-block">
                                Tags del reporte ({report.reportTags.length}) ▼
                              </summary>
                              <div className="mt-2 flex flex-wrap gap-1 pl-4">
                                {report.reportTags.map((reportTag) => {
                                  const isActive = reportTag.name === report.activeTag;
                                  const status = reportTag.status === 'active' || isActive ? 'active' : 'completed';
                                  return (
                                    <Badge
                                      key={reportTag.name}
                                      variant={isActive ? 'default' : 'secondary'}
                                      className={isActive ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}
                                    >
                                      {reportTag.name}
                                      {isActive && <span className="ml-1 text-xs">(Activo)</span>}
                                      {status === 'completed' && !isActive && (
                                        <span className="ml-1 text-xs">(Completado)</span>
                                      )}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </details>
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
                                    <div className="flex gap-3 mt-1">
                                      <p className="text-xs text-muted-foreground">{entry.project_name}</p>
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
