'use client';

import { useState, useEffect } from 'react';
import { getTimeEntries } from '@/lib/toggl';
import { getTogglMinDateSync } from '@/lib/toggl-date-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ApiKeyInfo } from '@/lib/types';

interface TagSummary {
  name: string;
  hours: number;
}

export default function TagSummaryCard({ apiKeys }: { apiKeys: ApiKeyInfo[] }) {
  const [summary, setSummary] = useState<TagSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const calculateTagHours = async () => {
    if (apiKeys.length === 0) return;

    setLoading(true);
    try {
      const stored = localStorage.getItem('toggl_api_keys');
      if (!stored) {
        setSummary([]);
        return;
      }

      const storedApiKeys = JSON.parse(stored);
      const currentDate = new Date().toISOString().split('T')[0];
      const togglMinDate = getTogglMinDateSync();
      const startDate = togglMinDate; // Empezar desde la fecha mínima de Toggl

      // Acumulador de horas por tag
      const tagHours: Record<string, number> = {};

      // Obtener entradas de todas las API keys
      for (const apiKeyInfo of storedApiKeys) {
        try {
          // Usar el primer workspace disponible
          const workspaceId = apiKeyInfo.workspaces[0]?.id;
          if (!workspaceId) continue;

          console.log(`[TagSummary] Obteniendo entradas para ${apiKeyInfo.fullname}, workspace ${workspaceId}`);
          const entries = await getTimeEntries(apiKeyInfo.key, startDate, currentDate, workspaceId);
          console.log(`[TagSummary] Total entradas obtenidas: ${entries.length}`);

          // Agrupar horas por tag
          for (const entry of entries) {
            if (entry.tags && entry.tags.length > 0) {
              for (const tag of entry.tags) {
                const tagName = tag.toLowerCase();
                // Filtrar solo los tags que nos interesan
                if (tagName.includes('tres puntos') || tagName.includes('trespuntos') || 
                    tagName.includes('truman')) {
                  const normalizedTag = tagName.includes('truman') ? 'truman' : 'tres puntos';
                  tagHours[normalizedTag] = (tagHours[normalizedTag] || 0) + (entry.duration / 3600);
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error obteniendo entradas para ${apiKeyInfo.fullname}:`, error);
        }
      }

      // Convertir a array y ordenar
      const summaryArray: TagSummary[] = Object.entries(tagHours)
        .map(([name, hours]) => ({ name, hours }))
        .sort((a, b) => b.hours - a.hours);

      setSummary(summaryArray);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error calculando horas por tag:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiKeys.length > 0) {
      calculateTagHours();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKeys.length]); // Solo cuando cambia el número de API keys

  const totalHours = summary.reduce((sum, item) => sum + item.hours, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Resumen por Tags
          </CardTitle>
          <Button
            onClick={calculateTagHours}
            disabled={loading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
        {lastUpdate && (
          <p className="text-xs text-muted-foreground mt-2">
            Última actualización: {lastUpdate.toLocaleTimeString('es-ES')}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {loading && summary.length === 0 ? (
          <p className="text-sm text-muted-foreground">Calculando...</p>
        ) : summary.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No se encontraron entradas con los tags "tres puntos" o "truman"
          </p>
        ) : (
          <div className="space-y-4">
            {summary.map((item) => {
              const percentage = totalHours > 0 ? (item.hours / totalHours) * 100 : 0;
              return (
                <div key={item.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground capitalize">{item.name}</span>
                    <span className="text-lg font-bold text-primary">
                      {item.hours.toFixed(1)}h
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {percentage.toFixed(1)}% del total
                  </p>
                </div>
              );
            })}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Total</span>
                <span className="text-xl font-bold text-primary">
                  {totalHours.toFixed(1)}h
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

