import type { TimeEntry } from './types';
import type { GroupedTask, TeamMemberData, ConsumptionPoint } from './report-types';
import { differenceInDays, parseISO, format, startOfDay } from 'date-fns';

export function calculateConsumptionPercentage(consumed: number, total: number): number {
  if (total === 0) return 0;
  return (consumed / total) * 100;
}

export function calculateConsumptionSpeed(entries: TimeEntry[]): number {
  if (entries.length === 0) return 0;
  
  // Calcular usando todos los datos históricos con ponderación por tiempo
  const sortedEntries = entries.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  
  if (sortedEntries.length === 0) return 0;
  
  const totalHours = entries.reduce((sum, entry) => sum + entry.duration, 0) / 3600;
  
  // Calcular días transcurridos desde la primera entrada hasta ahora
  const firstEntry = sortedEntries[0];
  const lastEntry = sortedEntries[sortedEntries.length - 1];
  const startDate = parseISO(firstEntry.start);
  const endDate = new Date();
  
  const diffTime = endDate.getTime() - startDate.getTime();
  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  
  return totalHours / diffDays; // Horas por día promedio desde el inicio
}

export function calculateEstimatedDaysRemaining(
  consumedHours: number,
  totalHours: number,
  avgHoursPerDay: number
): number {
  const remainingHours = totalHours - consumedHours;
  if (remainingHours <= 0) return 0;
  if (avgHoursPerDay <= 0) return Infinity;
  return Math.ceil(remainingHours / avgHoursPerDay);
}

export function calculateAverageHoursPerTask(entries: TimeEntry[]): number {
  if (entries.length === 0) return 0;
  
  // Calcular promedio por tarea única (no por entrada)
  const uniqueTasks = new Map<string, number>();
  
  entries.forEach(entry => {
    const description = entry.description || 'Sin descripción';
    uniqueTasks.set(description, (uniqueTasks.get(description) || 0) + entry.duration / 3600);
  });
  
  const totalHours = Array.from(uniqueTasks.values()).reduce((sum, hours) => sum + hours, 0);
  return totalHours / uniqueTasks.size;
}

export function groupTasksByDescription(entries: TimeEntry[]): GroupedTask[] {
  const grouped = entries.reduce((acc, entry) => {
    const description = entry.description || 'Sin descripción';
    
    if (!acc[description]) {
      acc[description] = {
        description,
        totalHours: 0,
        count: 0,
        entries: [],
        expanded: false,
      };
    }
    
    acc[description].totalHours += entry.duration / 3600;
    acc[description].count += 1;
    acc[description].entries.push(entry);
    
    return acc;
  }, {} as Record<string, GroupedTask>);
  
  return Object.values(grouped).sort((a, b) => b.totalHours - a.totalHours);
}

export function calculateTeamDistribution(entries: TimeEntry[]): TeamMemberData[] {
  const distribution: Record<string, number> = {};
  
  entries.forEach(entry => {
    const userName = entry.user_name || 'Sin usuario';
    distribution[userName] = (distribution[userName] || 0) + entry.duration / 3600;
  });
  
  return Object.entries(distribution)
    .map(([name, hours]) => ({ name, hours }))
    .sort((a, b) => b.hours - a.hours);
}

export function calculateConsumptionEvolution(entries: TimeEntry[]): ConsumptionPoint[] {
  // Agrupar por día
  const dailyConsumption: Record<string, number> = {};
  
  entries.forEach(entry => {
    const date = format(parseISO(entry.start), 'yyyy-MM-dd');
    dailyConsumption[date] = (dailyConsumption[date] || 0) + entry.duration / 3600;
  });
  
  // Convertir a array y ordenar por fecha
  return Object.entries(dailyConsumption)
    .map(([date, hours]) => ({ date, hours }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateCumulativeEvolution(evolution: ConsumptionPoint[]): ConsumptionPoint[] {
  let cumulativeHours = 0;
  
  return evolution.map(point => {
    cumulativeHours += point.hours;
    return {
      date: point.date,
      hours: cumulativeHours,
    };
  });
}

