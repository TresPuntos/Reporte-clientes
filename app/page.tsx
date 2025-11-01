'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ApiKeyManager from '@/components/api-key-manager';
import ClientReportGenerator from '@/components/client-report-generator';
import ReportManager from '@/components/report-manager';
import { ThemeToggle } from '@/components/theme-toggle';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ApiKeyInfo } from '@/lib/types';
import { LogOut } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'admin' | 'create' | 'manage'>('admin');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Verificar autenticación
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/verify');
        if (response.ok) {
          setAuthenticated(true);
        } else {
          router.push('/login');
          return;
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        router.push('/login');
        return;
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  // Load API keys from localStorage on mount
  useEffect(() => {
    if (!authenticated) return;
    
    const stored = localStorage.getItem('toggl_api_keys');
    if (stored) {
      try {
        const keys = JSON.parse(stored);
        setApiKeys(keys);
      } catch (error) {
        console.error('Error loading API keys:', error);
      }
    }
  }, [authenticated]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null; // El redirect ya está en proceso
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto p-6 md:p-8 lg:p-12 space-y-8">
        {/* Header */}
        <div className="relative flex flex-col items-center mb-8">
          <div className="absolute top-0 right-0 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </Button>
            <ThemeToggle />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
            Reporte Clientes - Toggl
          </h1>
          <p className="text-muted-foreground text-lg">
            Genera reportes de tiempo profesional para tus clientes
          </p>
        </div>

        {/* Tabs Navigation */}
        <Card className="mb-8">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'admin' | 'create' | 'manage')}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="admin">Panel de Administración</TabsTrigger>
              <TabsTrigger value="create">Crear Reporte de Cliente</TabsTrigger>
              <TabsTrigger value="manage">Gestionar Reportes</TabsTrigger>
            </TabsList>
          </Tabs>
        </Card>

        {/* Content */}
        <div className="min-h-[500px]">
          {activeTab === 'admin' && <ApiKeyManager onApiKeysChange={setApiKeys} />}
          {activeTab === 'create' && <ClientReportGenerator apiKeys={apiKeys} />}
          {activeTab === 'manage' && <ReportManager />}
        </div>
      </div>
    </main>
  );
}

