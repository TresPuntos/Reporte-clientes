#!/usr/bin/env node

/**
 * Script para verificar que el sistema de autenticación está correctamente configurado
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración de autenticación...\n');

let errors = [];
let warnings = [];

// 1. Verificar que los archivos existen
const requiredFiles = [
  'lib/auth.ts',
  'lib/db.ts',
  'app/api/auth/login/route.ts',
  'app/api/auth/logout/route.ts',
  'app/api/auth/verify/route.ts',
  'app/api/admin/create/route.ts',
  'app/login/page.tsx',
  'app/api/reports/[publicUrl]/check-password/route.ts',
];

console.log('📁 Verificando archivos...');
requiredFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - NO ENCONTRADO`);
    errors.push(`Archivo faltante: ${file}`);
  }
});

// 2. Verificar package.json
console.log('\n📦 Verificando dependencias...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

const requiredDeps = ['jsonwebtoken', 'bcryptjs', '@types/jsonwebtoken', '@types/bcryptjs'];
requiredDeps.forEach(dep => {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  if (deps[dep]) {
    console.log(`  ✅ ${dep}`);
  } else {
    console.log(`  ❌ ${dep} - NO INSTALADA`);
    errors.push(`Dependencia faltante: ${dep}`);
  }
});

// 3. Verificar modificaciones en archivos existentes
console.log('\n🔧 Verificando modificaciones...');

// Verificar que db.ts tiene tabla admins
const dbContent = fs.readFileSync(path.join(__dirname, 'lib/db.ts'), 'utf8');
if (dbContent.includes('CREATE TABLE IF NOT EXISTS admins')) {
  console.log('  ✅ Tabla admins en db.ts');
} else {
  console.log('  ❌ Tabla admins no encontrada en db.ts');
  errors.push('Tabla admins no encontrada');
}

if (dbContent.includes('password_hash VARCHAR(255)')) {
  console.log('  ✅ Campo password_hash en reports');
} else {
  console.log('  ❌ Campo password_hash no encontrado en reports');
  errors.push('Campo password_hash no encontrado');
}

// Verificar que page.tsx tiene auth check
const pageContent = fs.readFileSync(path.join(__dirname, 'app/page.tsx'), 'utf8');
if (pageContent.includes('/api/auth/verify')) {
  console.log('  ✅ Verificación de auth en page.tsx');
} else {
  console.log('  ❌ Verificación de auth no encontrada en page.tsx');
  errors.push('Verificación de auth no encontrada');
}

// 4. Verificar variables de entorno
console.log('\n🌍 Verificando variables de entorno...');
const envExists = fs.existsSync(path.join(__dirname, '.env.local'));
if (envExists) {
  console.log('  ✅ .env.local existe');
  const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
  if (envContent.includes('JWT_SECRET=')) {
    console.log('  ✅ JWT_SECRET configurado');
  } else {
    console.log('  ⚠️  JWT_SECRET no encontrado en .env.local');
    warnings.push('JWT_SECRET no configurado (usa default)');
  }
} else {
  console.log('  ⚠️  .env.local no existe');
  warnings.push('.env.local no existe - usa variables por defecto');
}

// Resumen
console.log('\n' + '='.repeat(50));
if (errors.length === 0) {
  console.log('✅ Configuración completa: Sin errores');
} else {
  console.log(`❌ Se encontraron ${errors.length} errores:`);
  errors.forEach(error => console.log(`  - ${error}`));
}

if (warnings.length > 0) {
  console.log(`\n⚠️  Se encontraron ${warnings.length} advertencias:`);
  warnings.forEach(warning => console.log(`  - ${warning}`));
}

console.log('\n📖 Para más información, ver INSTRUCCIONES_AUTH.md\n');

process.exit(errors.length > 0 ? 1 : 0);

