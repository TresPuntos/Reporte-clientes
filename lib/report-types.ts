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
  reportTags: ReportTag[]; // Tags del reporte con su estado
  activeTag?: string; // Tag actualmente activo
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
  selectedWorkspace?: number; // Workspace ID específico (opcional, por defecto usa el primero)
  selectedClient?: string;
  selectedProject?: string;
  selectedTags?: string[]; // Múltiples tags en lugar de uno solo
}

export interface ReportTag {
  name: string;
  status: 'active' | 'completed'; // Estado del tag
}

export interface ApiKeyInfo {
  key: string;
  fullname: string;
  email: string;
  id: string;
}

// Storage helpers
// Usa el servidor para persistencia, con localStorage como fallback/cache

async function fetchFromServer<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching from server:', error);
    throw error;
  }
}

export async function saveReport(report: ClientReport): Promise<void> {
  try {
    // Intentar guardar en el servidor (base de datos)
    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error saving report to server:', errorData);
      throw new Error(`Error al guardar: ${errorData.message || 'Error desconocido'}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error('El servidor no confirmó el guardado');
    }

    // También guardar en localStorage como backup/cache local
    if (typeof window !== 'undefined') {
      const reports = await getAllReports();
      const index = reports.findIndex(r => r.id === report.id);
      const updatedReports = index >= 0 
        ? reports.map((r, i) => i === index ? report : r)
        : [...reports, report];
      localStorage.setItem('client_reports', JSON.stringify(updatedReports));
    }
  } catch (error) {
    console.error('Error saving report to server:', error);
    // Si el servidor falla, intentar localStorage como último recurso
    if (typeof window !== 'undefined') {
      const reports = await getAllReports();
      const index = reports.findIndex(r => r.id === report.id);
      const updatedReports = index >= 0 
        ? reports.map((r, i) => i === index ? report : r)
        : [...reports, report];
      localStorage.setItem('client_reports', JSON.stringify(updatedReports));
      // Lanzar error para que el usuario sepa que no se guardó en BD
      throw new Error('No se pudo guardar en la base de datos. Los datos están solo localmente.');
    } else {
      throw error;
    }
  }
}

export async function getAllReports(): Promise<ClientReport[]> {
  // En el servidor (SSR), retornar array vacío ya que no tenemos acceso a localStorage
  if (typeof window === 'undefined') {
    return [];
  }
  
  try {
    // Intentar obtener del servidor (BD) primero
    const response = await fetch('/api/reports');
    if (response.ok) {
      const reports = await response.json();
      // Si hay reportes en BD, usarlos y sincronizar localStorage
      if (reports && reports.length > 0) {
        localStorage.setItem('client_reports', JSON.stringify(reports));
        return reports;
      }
    }
    
    // Si BD está vacía, intentar migrar desde localStorage
    const stored = localStorage.getItem('client_reports');
    if (stored) {
      try {
        const localReports = JSON.parse(stored);
        if (localReports.length > 0) {
          console.log('Migrando reportes desde localStorage a BD...');
          // Migrar cada reporte a BD
          for (const report of localReports) {
            try {
              await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(report),
              });
            } catch (error) {
              console.error('Error migrating report:', error);
            }
          }
          // Recargar desde BD
          const refreshedResponse = await fetch('/api/reports');
          if (refreshedResponse.ok) {
            const refreshedReports = await refreshedResponse.json();
            return refreshedReports;
          }
          // Si falla, devolver los locales
          return localReports;
        }
      } catch (error) {
        console.error('Error parsing localStorage reports:', error);
      }
    }
    
    // Si no hay nada, retornar array vacío
    return [];
  } catch (error) {
    console.error('Error fetching reports from server, using localStorage fallback:', error);
    // Fallback a localStorage solo si hay error de conexión
    const stored = localStorage.getItem('client_reports');
    return stored ? JSON.parse(stored) : [];
  }
}

export async function getReportById(id: string): Promise<ClientReport | null> {
  const reports = await getAllReports();
  return reports.find(r => r.id === id) || null;
}

export async function getReportByPublicUrl(url: string): Promise<ClientReport | null> {
  // En el cliente, intentar obtener del servidor primero
  if (typeof window !== 'undefined') {
    try {
      const response = await fetch(`/api/reports/${url}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error fetching report from server:', error);
    }
    
    // Fallback a localStorage
    const reports = await getAllReports();
    return reports.find(r => r.publicUrl === url) || null;
  }
  
  // En el servidor (SSR), retornar null ya que no podemos hacer fetch a sí mismo
  return null;
}

export async function deleteReport(id: string): Promise<void> {
  try {
    // Intentar eliminar en el servidor
    await fetchFromServer(`/api/reports?id=${id}`, {
      method: 'DELETE',
    });
    
    // También actualizar localStorage
    if (typeof window !== 'undefined') {
      const reports = await getAllReports();
      const filtered = reports.filter(r => r.id !== id);
      localStorage.setItem('client_reports', JSON.stringify(filtered));
    }
  } catch (error) {
    console.error('Error deleting report from server, using localStorage fallback:', error);
    // Fallback a localStorage
    if (typeof window !== 'undefined') {
      const reports = await getAllReports();
      const filtered = reports.filter(r => r.id !== id);
      localStorage.setItem('client_reports', JSON.stringify(filtered));
    } else {
      throw error;
    }
  }
}

