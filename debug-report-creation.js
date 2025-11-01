// Script para depurar la creación de reportes
// Ejecutar: node debug-report-creation.js

const https = require('https');

const testCreateReport = async () => {
  console.log('🔍 Debugging report creation...\n');

  try {
    // Primero hacer login
    console.log('1️⃣  Haciendo login...');
    const loginResponse = await fetch('https://reporte-clientes.vercel.app/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'jordi@trespuntoscomunicacion.es',
        password: '1234'
      })
    });

    const loginData = await loginResponse.json();
    console.log('Login result:', loginData);
    
    if (!loginResponse.ok) {
      console.error('❌ Login failed!');
      return;
    }

    // Obtener cookie
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Cookies:', cookies);

    // Intentar crear reporte de prueba
    console.log('\n2️⃣  Creando reporte de prueba...');
    const reportResponse = await fetch('https://reporte-clientes.vercel.app/api/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies || ''
      },
      body: JSON.stringify({
        id: 'test-' + Date.now(),
        name: 'Test Report',
        publicUrl: 'test-' + Date.now(),
        totalHours: 0,
        startDate: '2025-01-01',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        isActive: true,
        configs: [],
        reportTags: [],
        entries: [],
        summary: {
          totalHoursConsumed: 0,
          totalHoursAvailable: 0,
          consumptionPercentage: 0,
          consumptionSpeed: 0,
          estimatedDaysRemaining: 0,
          completedTasks: 0,
          averageHoursPerTask: 0,
          tasksByDescription: [],
          teamDistribution: [],
          consumptionEvolution: []
        }
      })
    });

    const reportData = await reportResponse.json();
    console.log('Report creation result:', reportData);

    if (reportResponse.ok) {
      console.log('\n✅ ¡Reporte creado exitosamente!');
    } else {
      console.error('\n❌ Error al crear reporte:', reportData);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
};

testCreateReport();

