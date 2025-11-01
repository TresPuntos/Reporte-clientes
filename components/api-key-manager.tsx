'use client';

import { useState, useEffect } from 'react';
import type { ApiKeyInfo } from '@/lib/types';
import { getMe } from '@/lib/toggl';
import { Card } from '@/components/ui/card';
import type { ApiUsageStats } from '@/lib/db';

export default function ApiKeyManager({ onApiKeysChange }: { onApiKeysChange: (keys: ApiKeyInfo[]) => void }) {
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [apiStats, setApiStats] = useState<Record<string, ApiUsageStats>>({});
  const [newApiKey, setNewApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Load API keys from server (database) on mount
  useEffect(() => {
    loadApiKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar estadísticas de API cuando cambian las keys
  useEffect(() => {
    if (apiKeys.length > 0) {
      loadApiStats();
      // Recargar estadísticas cada 30 segundos
      const interval = setInterval(() => {
        loadApiStats();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [apiKeys.length]);

  // Forzar re-render cada segundo para actualizar el contador de tiempo restante
  const [timeNow, setTimeNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadApiKeys = async () => {
    try {
      const response = await fetch('/api/api-keys');
      if (response.ok) {
        const keys = await response.json();
        // Si hay keys en BD, usarlas (prioridad a BD)
        if (keys && keys.length > 0) {
          setApiKeys(keys);
          onApiKeysChange(keys);
          // Sincronizar localStorage con BD
          localStorage.setItem('toggl_api_keys', JSON.stringify(keys));
          return;
        }
      }
      
      // Si BD está vacía, intentar migrar desde localStorage
      const stored = localStorage.getItem('toggl_api_keys');
      if (stored) {
        try {
          const localKeys = JSON.parse(stored);
          if (localKeys.length > 0) {
            console.log('Migrando API keys desde localStorage a BD...');
            // Migrar cada key a BD
            for (const key of localKeys) {
              try {
                await fetch('/api/api-keys', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    id: key.id,
                    key: key.key,
                    fullname: key.fullname,
                    email: key.email,
                    workspaces: key.workspaces || [],
                    clients: key.clients || [],
                    projects: key.projects || [],
                    tags: key.tags || [],
                  }),
                });
              } catch (error) {
                console.error('Error migrating key:', error);
              }
            }
            // Recargar desde BD
            const refreshedResponse = await fetch('/api/api-keys');
            if (refreshedResponse.ok) {
              const refreshedKeys = await refreshedResponse.json();
              setApiKeys(refreshedKeys);
              onApiKeysChange(refreshedKeys);
              return;
            }
          }
          // Si no se pudo migrar, usar localStorage como fallback
          setApiKeys(localKeys);
          onApiKeysChange(localKeys);
        } catch (error) {
          console.error('Error loading API keys from localStorage:', error);
        }
      }
    } catch (error) {
      console.error('Error loading API keys from server:', error);
      // Fallback a localStorage solo si hay error de conexión
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
        console.log('Enviando API key al servidor...', { id: newKeyInfo.id, email: newKeyInfo.email });
        
        const saveResponse = await fetch('/api/api-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newKeyInfo.id,
            key: newKeyInfo.key,
            fullname: newKeyInfo.fullname,
            email: newKeyInfo.email,
            workspaces: newKeyInfo.workspaces || [],
            clients: newKeyInfo.clients || [],
            projects: newKeyInfo.projects || [],
            tags: newKeyInfo.tags || [],
          }),
        });

        const responseData = await saveResponse.json().catch(() => ({}));
        
        if (!saveResponse.ok) {
          console.error('Error response from server:', responseData);
          const errorMessage = responseData.message || 'Error al guardar en la base de datos';
          setError(`${errorMessage}. Intenta de nuevo.`);
          return;
        }

        if (!responseData.success) {
          console.error('Server returned success:false', responseData);
          setError(responseData.message || 'Error al guardar en la base de datos');
          return;
        }

        console.log('API key guardada exitosamente:', responseData);

        // Verificar que se guardó correctamente recargando
        await loadApiKeys();
        
        // Recargar estadísticas después de añadir nueva key
        setTimeout(() => {
          loadApiStats();
        }, 1000);
        
        // Verificar una vez más que se cargó
        const verifyResponse = await fetch('/api/api-keys');
        if (verifyResponse.ok) {
          const verifyKeys = await verifyResponse.json();
          console.log('API keys después de guardar:', verifyKeys.length);
          if (verifyKeys.length === 0) {
            setError('⚠️ La API key se guardó pero no se pudo verificar. Recarga la página.');
          }
        }
      } catch (error) {
        console.error('Error saving API key to server:', error);
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        setError(`Error de conexión: ${errorMessage}. Intenta de nuevo.`);
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

  const loadApiStats = async () => {
    try {
      setIsLoadingStats(true);
      const response = await fetch('/api/api-keys/stats');
      if (response.ok) {
        const statsData = await response.json();
        const statsMap: Record<string, ApiUsageStats> = {};
        statsData.forEach((item: { 
          apiKeyId: string; 
          stats: {
            apiKeyId: string;
            totalRequests: number;
            userEndpointRequests: number;
            workspaceEndpointRequests: number;
            oldestRequestTimestamp: string | null;
            newestRequestTimestamp: string | null;
            resetTime: string | null;
            remainingQuota: {
              userEndpoints: number;
              workspaceEndpoints: number;
            };
          };
        }) => {
          // Convertir strings ISO de vuelta a Date objects
          statsMap[item.apiKeyId] = {
            ...item.stats,
            oldestRequestTimestamp: item.stats.oldestRequestTimestamp ? new Date(item.stats.oldestRequestTimestamp) : null,
            newestRequestTimestamp: item.stats.newestRequestTimestamp ? new Date(item.stats.newestRequestTimestamp) : null,
            resetTime: item.stats.resetTime ? new Date(item.stats.resetTime) : null,
          };
        });
        setApiStats(statsMap);
      }
    } catch (error) {
      console.error('Error loading API stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const formatTimeRemaining = (resetTime: Date | null, currentTime: number = Date.now()): string => {
    if (!resetTime) return 'N/A';
    const now = new Date(currentTime);
    const diff = resetTime.getTime() - now.getTime();
    
    if (diff <= 0) return 'Regenerado';
    
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const getQuotaPercentage = (used: number, limit: number): number => {
    if (limit === 0) return 0;
    return Math.min(100, (used / limit) * 100);
  };

  const getStatusColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-destructive';
    if (percentage >= 70) return 'text-yellow-500';
    return 'text-primary';
  };

  const getStatusBgColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-destructive';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-primary';
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
      // Limpiar stats de la key eliminada
      const newStats = { ...apiStats };
      delete newStats[id];
      setApiStats(newStats);
    } catch (error) {
      console.error('Error deleting API key from server:', error);
      alert('Error de conexión al eliminar. Intenta de nuevo.');
    }
  };

  return (
    <div className="space-y-6">
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
            <div className="space-y-4">
              {apiKeys.map((keyInfo) => {
                const stats = apiStats[keyInfo.id];
                const userEndpointLimit = 30;
                const workspaceEndpointLimit = 100;
                
                const userUsed = stats?.userEndpointRequests || 0;
                const workspaceUsed = stats?.workspaceEndpointRequests || 0;
                const totalUsed = stats?.totalRequests || 0;
                
                const userPercentage = getQuotaPercentage(userUsed, userEndpointLimit);
                const workspacePercentage = getQuotaPercentage(workspaceUsed, workspaceEndpointLimit);
                
                return (
                  <Card key={keyInfo.id} className="p-4">
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
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
                      
                      {/* Estado de API */}
                      <div className="border-t pt-4 space-y-3">
                        <h4 className="text-sm font-semibold text-foreground">Estado de API Toggl</h4>
                        
                        {isLoadingStats && !stats ? (
                          <p className="text-xs text-muted-foreground">Cargando estadísticas...</p>
                        ) : stats ? (
                          <div className="space-y-3">
                            {/* Endpoints de Usuario (/me) */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-muted-foreground">Endpoints /me (User-Specific)</span>
                                <span className={`text-xs font-medium ${getStatusColor(userPercentage)}`}>
                                  {userUsed} / {userEndpointLimit} requests
                                </span>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${getStatusBgColor(userPercentage)}`}
                                  style={{ width: `${Math.min(userPercentage, 100)}%` }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Restante: {stats.remainingQuota.userEndpoints} requests
                              </p>
                            </div>
                            
                            {/* Endpoints de Workspace */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-muted-foreground">Endpoints Workspace/Organization</span>
                                <span className={`text-xs font-medium ${getStatusColor(workspacePercentage)}`}>
                                  {workspaceUsed} / {workspaceEndpointLimit} requests
                                </span>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${getStatusBgColor(workspacePercentage)}`}
                                  style={{ width: `${Math.min(workspacePercentage, 100)}%` }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Restante: {stats.remainingQuota.workspaceEndpoints} requests
                              </p>
                            </div>
                            
                            {/* Total y tiempo de regeneración */}
                            <div className="pt-2 border-t space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Total en última hora</span>
                                <span className="text-xs font-medium">{totalUsed} requests</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Regeneración en</span>
                                <span className="text-xs font-medium text-primary">
                                  {formatTimeRemaining(stats.resetTime, timeNow)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Sin actividad reciente. Las estadísticas aparecerán después de realizar llamadas a la API.
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </Card>
    </div>
  );
}

