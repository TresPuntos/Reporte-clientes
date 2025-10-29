'use client';

import { useState, useEffect } from 'react';
import ApiKeyManager from '@/components/api-key-manager';
import ClientReportGenerator from '@/components/client-report-generator';
import ReportManager from '@/components/report-manager';
import { ThemeToggle } from '@/components/theme-toggle';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import type { ApiKeyInfo } from '@/lib/types';

export default function Home() {
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'admin' | 'create' | 'manage'>('admin');

  // Load API keys from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('toggl_api_keys');
    if (stored) {
      try {
        const keys = JSON.parse(stored);
        setApiKeys(keys);
      } catch (error) {
        console.error('Error loading API keys:', error);
      }
    }
  }, []);

  return (
    <main className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="relative flex flex-col items-center mb-8">
          <div className="absolute top-0 right-0">
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

