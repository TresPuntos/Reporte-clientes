// Script para migrar la base de datos - Agregar columna password_hash
const { sql } = require('@vercel/postgres');

async function migrateDatabase() {
  try {
    console.log('🔄 Migrating database...');
    
    // Verificar si la columna existe
    console.log('Checking if password_hash column exists...');
    
    try {
      // Intentar agregar la columna
      await sql`
        ALTER TABLE reports 
        ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)
      `;
      console.log('✅ Column password_hash added successfully');
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        console.log('✅ Column password_hash already exists');
      } else {
        throw error;
      }
    }
    
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrateDatabase();

