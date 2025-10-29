'use client';

import type { TimeEntry } from '@/lib/types';

export default function TimeEntriesTable({ entries }: { entries: TimeEntry[] }) {
  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold mb-4">Tabla Detallada de Entradas</h3>
      <div className="overflow-x-auto border border-gray-300 rounded-lg">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Fecha</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Hora</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Descripción</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Proyecto</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Cliente</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Usuario</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Duración</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => {
              const date = new Date(entry.start);
              const duration = entry.duration / 3600;
              return (
                <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-800">{date.toLocaleDateString('es-ES')}</td>
                  <td className="py-3 px-4 text-gray-700">{date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="py-3 px-4 text-gray-800">{entry.description || 'Sin descripción'}</td>
                  <td className="py-3 px-4 text-gray-700">{entry.project_name || '-'}</td>
                  <td className="py-3 px-4 text-gray-700">{entry.client_name || '-'}</td>
                  <td className="py-3 px-4 text-gray-700">{entry.user_name || '-'}</td>
                  <td className="py-3 px-4 text-right font-semibold text-blue-600">{duration.toFixed(2)}h</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


