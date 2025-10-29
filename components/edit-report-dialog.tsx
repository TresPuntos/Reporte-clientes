'use client';

import { useState } from 'react';
import type { ClientReport, ReportConfig } from '@/lib/report-types';
import type { ApiKeyInfo } from '@/lib/types';
import { saveReport } from '@/lib/report-types';
import {
  calculateConsumptionSpeed,
  calculateAverageHoursPerTask,
  groupTasksByDescription,
  calculateTeamDistribution,
  calculateConsumptionEvolution,
  calculateCumulativeEvolution,
} from '@/lib/report-calculations';

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

  const handleSave = async () => {
    const updatedReport: ClientReport = {
      ...report,
      name,
      totalHours,
      price,
      startDate,
      isActive,
      lastUpdated: new Date().toISOString(),
    };

    await saveReport(updatedReport);
    onUpdated();
    onClose();
  };

  const handleRecalculate = async () => {
    if (!confirm('¿Recalcular este reporte con los nuevos cálculos mejorados? Esto actualizará todas las estadísticas del reporte.')) {
      return;
    }

    try {
      // Recalcular estadísticas con las funciones mejoradas
      const totalConsumed = report.entries.reduce((sum, e) => sum + e.duration, 0) / 3600;
      const speed = calculateConsumptionSpeed(report.entries);
      const avgHours = calculateAverageHoursPerTask(report.entries);
      const groupedTasks = groupTasksByDescription(report.entries);
      const teamDist = calculateTeamDistribution(report.entries);
      const evolution = calculateConsumptionEvolution(report.entries);
      const cumulative = calculateCumulativeEvolution(evolution);

      const updatedReport: ClientReport = {
        ...report,
        name,
        totalHours,
        price,
        startDate,
        isActive,
        summary: {
          totalHoursConsumed: totalConsumed,
          totalHoursAvailable: totalHours,
          consumptionPercentage: totalHours > 0 ? (totalConsumed / totalHours) * 100 : 0,
          consumptionSpeed: speed,
          estimatedDaysRemaining: (totalHours > totalConsumed && speed > 0) ? Math.ceil((totalHours - totalConsumed) / speed) : 0,
          completedTasks: report.entries.length, // Total de entradas de tiempo
          averageHoursPerTask: avgHours,
          tasksByDescription: groupedTasks,
          teamDistribution: teamDist,
          consumptionEvolution: cumulative,
        },
        lastUpdated: new Date().toISOString(),
      };

      await saveReport(updatedReport);
      alert('✓ Reporte recalculado y actualizado exitosamente!');
      onUpdated();
      onClose();
    } catch (error) {
      alert('Error al recalcular el reporte: ' + (error instanceof Error ? error.message : 'Error desconocido'));
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

          {/* Información de configuración de Toggl */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-blue-900 mb-2">Configuraciones de Toggl</p>
            <p className="text-xs text-blue-700">
              {report.configs.length} configuración(es) activa(s). Los filtros de Toggl no se pueden editar aquí.
              Para modificar los filtros, deberás crear un nuevo reporte.
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
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            🔄 Recalcular Estadísticas
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
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

