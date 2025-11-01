'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TestApiKeyPage() {
  const [testKey, setTestKey] = useState('');
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testSave = async () => {
    if (!testKey.trim()) {
      setResult({ error: 'Por favor ingresa una API key' });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // Primero validar la key con Toggl
      const togglResponse = await fetch('/api/toggl/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: testKey }),
      });

      if (!togglResponse.ok) {
        const error = await togglResponse.json();
        setResult({ error: `API key inválida: ${error.message || 'Error de autenticación'}` });
        setIsLoading(false);
        return;
      }

      const userData = await togglResponse.json();

      // Intentar guardar
      const saveResponse = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          key: testKey,
          fullname: userData.fullname,
          email: userData.email,
          workspaces: userData.workspaces || [],
          clients: userData.clients || [],
          projects: userData.projects || [],
          tags: userData.tags || [],
        }),
      });

      const saveData = await saveResponse.json();
      
      setResult({
        status: saveResponse.status,
        ok: saveResponse.ok,
        data: saveData,
      });

      // Verificar que se guardó
      if (saveResponse.ok && saveData.success) {
        setTimeout(async () => {
          const verifyResponse = await fetch('/api/api-keys');
          const verifyData = await verifyResponse.json();
          setResult(prev => ({
            ...prev,
            verification: {
              count: verifyData.length,
              keys: verifyData.map((k: any) => ({ id: k.id, email: k.email })),
            },
          }));
        }, 1000);
      }
    } catch (error: any) {
      setResult({
        error: error.message,
        stack: error.stack,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkDatabase = async () => {
    try {
      const response = await fetch('/api/api-keys');
      const data = await response.json();
      setResult({
        check: {
          status: response.status,
          count: data.length,
          keys: data.map((k: any) => ({ id: k.id, email: k.email, fullname: k.fullname })),
        },
      });
    } catch (error: any) {
      setResult({ error: error.message });
    }
  };

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-4">Prueba de Guardado de API Key</h1>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">API Key de Toggl</label>
              <input
                type="password"
                value={testKey}
                onChange={(e) => setTestKey(e.target.value)}
                placeholder="Ingresa tu API Token"
                className="w-full px-4 py-2 rounded-md border border-input bg-background"
              />
            </div>
            
            <div className="flex gap-3">
              <Button onClick={testSave} disabled={isLoading}>
                {isLoading ? 'Probando...' : 'Probar Guardado'}
              </Button>
              <Button onClick={checkDatabase} variant="outline">
                Verificar BD
              </Button>
            </div>
          </div>

          {result && (
            <div className="p-4 bg-muted rounded-lg">
              <pre className="text-xs overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          <div className="mt-6 pt-6 border-t">
            <Button variant="outline" onClick={() => window.location.href = '/'} className="w-full">
              Volver al inicio
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

