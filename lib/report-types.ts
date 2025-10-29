import type { TimeEntry } from './types';

export interface ClientReport {
  id: string;
  name: string;
  packageId?: string;
  totalHours: number;
  price?: number;
  startDate: string;
  endDate?: string | null;
  createdAt: string;
  lastUpdated: string;
  publicUrl: string; // Token único para el link
  isActive: boolean;
  configs: ReportConfig[];
  entries: TimeEntry[];
  summary: ReportSummary;
}

export interface ReportSummary {
  totalHoursConsumed: number;
  totalHoursAvailable: number;
  consumptionPercentage: number;
  consumptionSpeed: number; // horas por día (últimos 7 días)
  estimatedDaysRemaining: number;
  completedTasks: number;
  averageHoursPerTask: number;
  tasksByDescription: GroupedTask[];
  teamDistribution: TeamMemberData[];
  consumptionEvolution: ConsumptionPoint[];
}

export interface GroupedTask {
  description: string;
  totalHours: number;
  count: number;
  entries: TimeEntry[]; // Entradas individuales
  expanded: boolean; // Estado de expandido/colapsado
}

export interface TeamMemberData {
  name: string;
  hours: number;
}

export interface ConsumptionPoint {
  date: string;
  hours: number;
}

export interface ReportConfig {
  id: string;
  selectedApiKey: string;
  selectedClient?: string;
  selectedProject?: string;
  selectedTag?: string;
}

export interface ApiKeyInfo {
  key: string;
  fullname: string;
  email: string;
  id: string;
}

// Storage helpers
const REPORTS_FILE = 'data/client-reports.json';

export async function saveReport(report: ClientReport): Promise<void> {
  const reports = await getAllReports();
  const index = reports.findIndex(r => r.id === report.id);
  
  if (index >= 0) {
    reports[index] = report;
  } else {
    reports.push(report);
  }
  
  // En producción, esto sería una llamada a una base de datos
  // Por ahora, simulamos con localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('client_reports', JSON.stringify(reports));
  }
}

export async function getAllReports(): Promise<ClientReport[]> {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('client_reports');
    return stored ? JSON.parse(stored) : [];
  }
  return [];
}

export async function getReportById(id: string): Promise<ClientReport | null> {
  const reports = await getAllReports();
  return reports.find(r => r.id === id) || null;
}

export async function getReportByPublicUrl(url: string): Promise<ClientReport | null> {
  const reports = await getAllReports();
  return reports.find(r => r.publicUrl === url) || null;
}

export async function deleteReport(id: string): Promise<void> {
  const reports = await getAllReports();
  const filtered = reports.filter(r => r.id !== id);
  if (typeof window !== 'undefined') {
    localStorage.setItem('client_reports', JSON.stringify(filtered));
  }
}

