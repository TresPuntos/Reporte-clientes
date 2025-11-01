'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function MigratePage() {
  const [isMigrating, setIsMigrating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; details?: string[] } | null>(null);
  const [localData, setLocalData] = useState({ reports: 0, apiKeys: 0 });
  const [isClient, setIsClient] = useState(false);

  // Verificar datos en localStorage (solo en cliente)
  useEffect(() => {
    setIsClient(true);
    const checkLocalData = () => {
      try {
        const storedReports = localStorage.getItem('client_reports');
        const storedApiKeys = localStorage.getItem('toggl_api_keys');

        const reports = storedReports ? JSON.parse(storedReports) : [];
        const apiKeys = storedApiKeys ? JSON.parse(storedApiKeys) : [];

        return { reports: reports.length, apiKeys: apiKeys.length };
      } catch (error) {
        console.error('Error checking localStorage:', error);
        return { reports: 0, apiKeys: 0 };
      }
    };

    setLocalData(checkLocalData());
  }, []);

  const handleMigrate = async () => {
    if (!isClient) return;
    
    setIsMigrating(true);
    setResult(null);

    try {
      // Obtener datos de localStorage (solo si estamos en cliente)
      const storedReports = typeof window !== 'undefined' ? localStorage.getItem('client_reports') : null;
      const storedApiKeys = typeof window !== 'undefined' ? localStorage.getItem('toggl_api_keys') : null;

      const reports = storedReports ? JSON.parse(storedReports) : [];
      const apiKeys = storedApiKeys ? JSON.parse(storedApiKeys) : [];

      if (reports.length === 0 && apiKeys.length === 0) {
        setResult({
          success: false,
          message: 'No se encontraron datos en localStorage para migrar'
        });
        setIsMigrating(false);
        return;
      }

      // Enviar a la API de migración
      const response = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports, apiKeys }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: data.message || 'Migración completada exitosamente',
          details: data.details
        });
        
        // Recargar la página después de 2 segundos para ver los datos
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        setResult({
          success: false,
          message: data.message || 'Error durante la migración'
        });
      }
    } catch (error) {
      console.error('Migration error:', error);
      setResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
      });
    } finally {
      setIsMigrating(false);
    }
  };


  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-4">Migración de Datos</h1>
          <p className="text-muted-foreground mb-6">
            Esta página migra tus datos existentes desde localStorage a la base de datos de Vercel.
          </p>

          <div className="mb-6 p-4 bg-muted rounded-lg">
            <h2 className="font-semibold mb-2">Datos encontrados en localStorage:</h2>
            <ul className="space-y-1 text-sm">
              <li>📊 Reportes: {localData.reports}</li>
              <li>🔑 API Keys: {localData.apiKeys}</li>
            </ul>
          </div>

          {!isClient ? (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm">Cargando...</p>
            </div>
          ) : localData.reports === 0 && localData.apiKeys === 0 ? (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm">
                No se encontraron datos en localStorage. Si tenías datos antes, pueden haberse migrado automáticamente.
              </p>
            </div>
          ) : (
            <Button
              onClick={handleMigrate}
              disabled={isMigrating}
              className="w-full"
            >
              {isMigrating ? 'Migrando...' : `Migrar ${localData.reports + localData.apiKeys} elementos a la BD`}
            </Button>
          )}

          {result && (
            <div className={`mt-6 p-4 rounded-lg ${
              result.success 
                ? 'bg-green-50 dark:bg-green-900/20' 
                : 'bg-red-50 dark:bg-red-900/20'
            }`}>
              <p className={`font-semibold mb-2 ${
                result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
              }`}>
                {result.success ? '✅ Éxito' : '❌ Error'}
              </p>
              <p className="text-sm mb-2">{result.message}</p>
              {result.details && result.details.length > 0 && (
                <ul className="text-sm space-y-1 mt-2">
                  {result.details.map((detail, index) => (
                    <li key={index} className="text-muted-foreground">• {detail}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-6 pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => window.location.href = '/'}
              className="w-full"
            >
              Volver al inicio
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

