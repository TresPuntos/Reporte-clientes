'use client';

import { useState, useEffect } from 'react';
import type { ApiKeyInfo } from '@/lib/types';
import { getMe } from '@/lib/toggl';
import { Card } from '@/components/ui/card';

export default function ApiKeyManager({ onApiKeysChange }: { onApiKeysChange: (keys: ApiKeyInfo[]) => void }) {
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [newApiKey, setNewApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load API keys from server (database) on mount
  useEffect(() => {
    loadApiKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadApiKeys = async () => {
    try {
      const response = await fetch('/api/api-keys');
      if (response.ok) {
        const keys = await response.json();
        setApiKeys(keys);
        onApiKeysChange(keys);
      } else {
        // Fallback a localStorage si el servidor no está disponible (desarrollo)
        const stored = localStorage.getItem('toggl_api_keys');
        if (stored) {
          try {
            const keys = JSON.parse(stored);
            setApiKeys(keys);
            onApiKeysChange(keys);
          } catch (error) {
            console.error('Error loading API keys from localStorage:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error loading API keys from server:', error);
      // Fallback a localStorage
      const stored = localStorage.getItem('toggl_api_keys');
      if (stored) {
        try {
          const keys = JSON.parse(stored);
          setApiKeys(keys);
          onApiKeysChange(keys);
        } catch (error) {
          console.error('Error loading API keys from localStorage:', error);
        }
      }
    }
  };

  const saveApiKeys = async (keys: ApiKeyInfo[]) => {
    setApiKeys(keys);
    onApiKeysChange(keys);
    
    // Guardar en BD a través de la API
    try {
      // Eliminar todas las keys existentes y guardar las nuevas
      // Por ahora, solo guardamos cuando se añade/elimina individualmente
    } catch (error) {
      console.error('Error syncing API keys to server:', error);
      // Fallback: también guardar en localStorage como backup
      localStorage.setItem('toggl_api_keys', JSON.stringify(keys));
    }
  };

  const handleAddApiKey = async () => {
    if (!newApiKey.trim()) {
      setError('Por favor ingresa una clave de API');
      return;
    }

    // Check if API key already exists
    if (apiKeys.some(key => key.key === newApiKey)) {
      setError('Esta clave de API ya está registrada');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const userData = await getMe(newApiKey);
      
      const newKeyInfo: ApiKeyInfo = {
        id: crypto.randomUUID(),
        key: newApiKey,
        fullname: userData.fullname,
        email: userData.email,
        workspaces: userData.workspaces,
        clients: userData.clients,
        projects: userData.projects,
        tags: userData.tags,
      };

      const updatedKeys = [...apiKeys, newKeyInfo];
      
      // Guardar en BD
      try {
        const saveResponse = await fetch('/api/api-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newKeyInfo.id,
            key: newKeyInfo.key,
            fullname: newKeyInfo.fullname,
            email: newKeyInfo.email,
            workspaces: newKeyInfo.workspaces,
            clients: newKeyInfo.clients,
            projects: newKeyInfo.projects,
            tags: newKeyInfo.tags,
          }),
        });

        if (!saveResponse.ok) {
          const errorData = await saveResponse.json().catch(() => ({}));
          console.error('Error saving API key:', errorData);
          setError('Error al guardar en la base de datos. Intenta de nuevo.');
          return;
        }

        // Verificar que se guardó correctamente recargando
        await loadApiKeys();
      } catch (error) {
        console.error('Error saving API key to server:', error);
        setError('Error de conexión al guardar. Intenta de nuevo.');
        return;
      }
      
      // Ya se recargó en loadApiKeys(), solo limpiar el input
      setNewApiKey('');
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al validar la clave de API';
      setError(errorMessage.includes('401') ? 'Clave de API inválida. Verifica tu token.' : errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveApiKey = async (id: string) => {
    // Eliminar de BD
    try {
      const deleteResponse = await fetch(`/api/api-keys?id=${id}`, {
        method: 'DELETE',
      });

      if (!deleteResponse.ok) {
        console.error('Error deleting API key:', await deleteResponse.json().catch(() => ({})));
        alert('Error al eliminar. Intenta de nuevo.');
        return;
      }

      // Recargar desde BD
      await loadApiKeys();
    } catch (error) {
      console.error('Error deleting API key from server:', error);
      alert('Error de conexión al eliminar. Intenta de nuevo.');
    }
  };

  return (
    <Card>
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6">Panel de Administración - Cuentas de Toggl</h2>
        
        <div className="mb-8">
          <label className="block text-sm font-medium mb-3">Nueva Clave de API de Toggl</label>
          <div className="flex gap-3">
            <input
              type="password"
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
              placeholder="Ingresa tu API Token de Toggl"
              className="flex-1 px-4 py-2 rounded-md border border-input bg-background hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              onClick={handleAddApiKey}
              disabled={isLoading}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Verificando...' : 'Añadir'}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <p className="mt-3 text-sm text-muted-foreground">
            Obtén tu API Token en{' '}
            <a href="https://track.toggl.com/profile" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              tu perfil de Toggl
            </a>
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Cuentas Conectadas ({apiKeys.length})</h3>
          {apiKeys.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hay cuentas conectadas</p>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((keyInfo) => (
                <Card key={keyInfo.id} className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-foreground">{keyInfo.fullname}</p>
                      <p className="text-sm text-muted-foreground">{keyInfo.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {keyInfo.workspaces.length} espacio(s) de trabajo • {keyInfo.projects.length} proyecto(s)
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveApiKey(keyInfo.id)}
                      className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 text-sm transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

