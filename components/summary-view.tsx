'use client';

import type { TimeEntry } from '@/lib/types';

interface GroupedEntry {
  description: string;
  totalDuration: number;
  count: number;
  projects: Set<string>;
  clients: Set<string>;
}

export default function SummaryView({ entries }: { entries: TimeEntry[] }) {
  const totalHours = entries.reduce((sum, entry) => sum + entry.duration, 0) / 3600;

  const grouped = entries.reduce((acc, entry) => {
    const description = entry.description || 'Sin descripción';
    
    if (!acc[description]) {
      acc[description] = {
        description,
        totalDuration: 0,
        count: 0,
        projects: new Set<string>(),
        clients: new Set<string>(),
      };
    }
    
    acc[description].totalDuration += entry.duration;
    acc[description].count += 1;
    
    if (entry.project_name) {
      acc[description].projects.add(entry.project_name);
    }
    if (entry.client_name) {
      acc[description].clients.add(entry.client_name);
    }
    
    return acc;
  }, {} as Record<string, GroupedEntry>);

  const groupedList = Object.values(grouped).sort((a, b) => b.totalDuration - a.totalDuration);

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold mb-4">Resumen por Tarea</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Descripción</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Horas</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">%</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Entradas</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Proyectos</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Clientes</th>
            </tr>
          </thead>
          <tbody>
            {groupedList.map((item, idx) => {
              const hours = item.totalDuration / 3600;
              const percentage = totalHours > 0 ? (hours / totalHours * 100).toFixed(1) : '0';
              
              return (
                <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-800">{item.description}</td>
                  <td className="py-3 px-4 text-right font-semibold text-blue-600">{hours.toFixed(2)}h</td>
                  <td className="py-3 px-4 text-right text-gray-600">{percentage}%</td>
                  <td className="py-3 px-4 text-right text-gray-600">{item.count}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {Array.from(item.projects).map(project => (
                        <span key={project} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {project}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {Array.from(item.clients).map(client => (
                        <span key={client} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                          {client}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-bold bg-gray-50">
              <td className="py-3 px-4">Total</td>
              <td className="py-3 px-4 text-right text-blue-600">{totalHours.toFixed(2)}h</td>
              <td className="py-3 px-4 text-right">100%</td>
              <td className="py-3 px-4 text-right">{entries.length}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}


