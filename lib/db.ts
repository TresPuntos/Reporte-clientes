import { sql } from '@vercel/postgres';
// Nota: @vercel/postgres también funciona con Neon y otros proveedores Postgres compatibles
// Asegúrate de tener POSTGRES_URL o DATABASE_URL en variables de entorno
import type { ClientReport } from './report-types';
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Inicializar tablas si no existen
export async function initializeDatabase() {
  // Verificar que tenemos conexión a BD
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    throw new Error(
      'POSTGRES_URL o DATABASE_URL no está configurada. ' +
      'Por favor, conecta una base de datos en Vercel (Neon, Supabase, etc.)'
    );
  }

  try {
    // Tabla de reportes
    await sql`
      CREATE TABLE IF NOT EXISTS reports (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        package_id VARCHAR(255),
        total_hours INTEGER NOT NULL,
        price DECIMAL(10, 2),
        start_date VARCHAR(50) NOT NULL,
        end_date VARCHAR(50),
        created_at VARCHAR(50) NOT NULL,
        last_updated VARCHAR(50) NOT NULL,
        public_url VARCHAR(255) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        active_tag VARCHAR(255),
        data JSONB NOT NULL,
        created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Índice para búsqueda rápida por public_url
    await sql`
      CREATE INDEX IF NOT EXISTS idx_public_url ON reports(public_url)
    `;

    // Tabla de API keys
    await sql`
      CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR(255) PRIMARY KEY,
        key_hash VARCHAR(255) NOT NULL,
        key_encrypted TEXT NOT NULL,
        fullname VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        workspaces JSONB,
        clients JSONB,
        projects JSONB,
        tags JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Índice para búsqueda por email
    await sql`
      CREATE INDEX IF NOT EXISTS idx_api_keys_email ON api_keys(email)
    `;

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Funciones para reportes
export async function getAllReportsFromDB(): Promise<ClientReport[]> {
  try {
    const result = await sql`
      SELECT data FROM reports 
      WHERE is_active = true 
      ORDER BY created_on DESC
    `;
    
    return result.rows.map(row => row.data as ClientReport);
  } catch (error) {
    console.error('Error fetching reports from database:', error);
    throw error;
  }
}

export async function getReportByPublicUrlFromDB(publicUrl: string): Promise<ClientReport | null> {
  try {
    const result = await sql`
      SELECT data FROM reports 
      WHERE public_url = ${publicUrl} AND is_active = true
      LIMIT 1
    `;
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].data as ClientReport;
  } catch (error) {
    console.error('Error fetching report by public URL:', error);
    throw error;
  }
}

export async function saveReportToDB(report: ClientReport): Promise<void> {
  try {
    console.log('saveReportToDB called:', { 
      id: report.id, 
      name: report.name,
      publicUrl: report.publicUrl,
      totalHours: report.totalHours 
    });
    
    // Verificar que tenemos conexión a BD
    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      throw new Error('POSTGRES_URL o DATABASE_URL no está configurada');
    }
    
    // Validar que el reporte tenga los campos requeridos
    if (!report.id || !report.name || !report.publicUrl) {
      throw new Error(`Reporte inválido: faltan campos requeridos (id: ${!!report.id}, name: ${!!report.name}, publicUrl: ${!!report.publicUrl})`);
    }
    
    console.log('Inserting report into database...');
    
    const result = await sql`
      INSERT INTO reports (
        id, name, package_id, total_hours, price, start_date, end_date,
        created_at, last_updated, public_url, is_active, active_tag, data
      ) VALUES (
        ${report.id},
        ${report.name},
        ${report.packageId || null},
        ${report.totalHours},
        ${report.price || null},
        ${report.startDate},
        ${report.endDate || null},
        ${report.createdAt},
        ${report.lastUpdated},
        ${report.publicUrl},
        ${report.isActive !== undefined ? report.isActive : true},
        ${report.activeTag || null},
        ${JSON.stringify(report)}::jsonb
      )
      ON CONFLICT (id) 
      DO UPDATE SET
        name = EXCLUDED.name,
        package_id = EXCLUDED.package_id,
        total_hours = EXCLUDED.total_hours,
        price = EXCLUDED.price,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        last_updated = EXCLUDED.last_updated,
        is_active = EXCLUDED.is_active,
        active_tag = EXCLUDED.active_tag,
        data = EXCLUDED.data,
        updated_at = CURRENT_TIMESTAMP
    `;
    
    console.log('Report saved to database successfully:', report.id);
  } catch (error: any) {
    console.error('Error saving report to database:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    throw error;
  }
}

export async function deleteReportFromDB(id: string): Promise<void> {
  try {
    await sql`
      UPDATE reports 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error('Error deleting report from database:', error);
    throw error;
  }
}

// Funciones para API keys
export interface ApiKeyDB {
  id: string;
  key_encrypted: string;
  fullname: string;
  email: string;
  workspaces: any;
  clients: any;
  projects: any;
  tags: any;
}

// Clave de cifrado desde variable de entorno o una por defecto
// IMPORTANTE: En producción, usa una clave segura desde variables de entorno
const getEncryptionKey = async (): Promise<Buffer> => {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    return Buffer.from(envKey, 'hex');
  }
  // Clave por defecto (cambiar en producción!)
  const defaultKey = 'default-encryption-key-change-in-production-32chars!!';
  return (await scryptAsync(defaultKey, 'salt', 32)) as Buffer;
};

async function encrypt(text: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Retornar IV + texto cifrado (IV necesario para descifrar)
  return iv.toString('hex') + ':' + encrypted;
}

async function decrypt(encrypted: string): Promise<string> {
  const key = await getEncryptionKey();
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export async function saveApiKeyToDB(
  id: string,
  key: string,
  fullname: string,
  email: string,
  workspaces: any[],
  clients: any[],
  projects: any[],
  tags: any[]
): Promise<void> {
  try {
    console.log('saveApiKeyToDB called:', { id, email, hasKey: !!key });
    
    // Verificar que tenemos conexión a BD
    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      throw new Error('POSTGRES_URL o DATABASE_URL no está configurada');
    }
    
    console.log('Encrypting API key...');
    const encrypted = await encrypt(key);
    console.log('API key encrypted successfully');
    
    const keyHash = Buffer.from(key).toString('base64'); // Hash simple para verificación
    
    console.log('Inserting into database...', { id, email });
    
    const result = await sql`
      INSERT INTO api_keys (
        id, key_hash, key_encrypted, fullname, email, 
        workspaces, clients, projects, tags
      ) VALUES (
        ${id},
        ${keyHash},
        ${encrypted},
        ${fullname},
        ${email},
        ${JSON.stringify(workspaces)}::jsonb,
        ${JSON.stringify(clients)}::jsonb,
        ${JSON.stringify(projects)}::jsonb,
        ${JSON.stringify(tags)}::jsonb
      )
      ON CONFLICT (id) 
      DO UPDATE SET
        key_hash = EXCLUDED.key_hash,
        key_encrypted = EXCLUDED.key_encrypted,
        fullname = EXCLUDED.fullname,
        email = EXCLUDED.email,
        workspaces = EXCLUDED.workspaces,
        clients = EXCLUDED.clients,
        projects = EXCLUDED.projects,
        tags = EXCLUDED.tags,
        updated_at = CURRENT_TIMESTAMP
    `;
    
    console.log('API key saved to database successfully:', id);
  } catch (error: any) {
    console.error('Error saving API key to database:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    throw error;
  }
}

export async function getAllApiKeysFromDB(): Promise<ApiKeyDB[]> {
  try {
    const result = await sql`
      SELECT id, key_encrypted, fullname, email, workspaces, clients, projects, tags
      FROM api_keys
      ORDER BY created_at DESC
    `;
    
    return result.rows.map(row => ({
      id: row.id,
      key_encrypted: row.key_encrypted,
      fullname: row.fullname,
      email: row.email,
      workspaces: row.workspaces,
      clients: row.clients,
      projects: row.projects,
      tags: row.tags,
    }));
  } catch (error) {
    console.error('Error fetching API keys from database:', error);
    throw error;
  }
}

export async function deleteApiKeyFromDB(id: string): Promise<void> {
  try {
    await sql`DELETE FROM api_keys WHERE id = ${id}`;
  } catch (error) {
    console.error('Error deleting API key from database:', error);
    throw error;
  }
}

// Función helper para descifrar API key
export async function decryptApiKey(encrypted: string): Promise<string> {
  return decrypt(encrypted);
}

