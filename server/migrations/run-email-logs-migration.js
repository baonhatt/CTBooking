import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync(path.join(__dirname, '../../ca.pem')).toString()
    }
  });

  try {
    console.log('🔄 Connecting to database...');
    const client = await pool.connect();

    console.log('📄 Reading migration file...');
    const migrationSQL = fs.readFileSync(path.join(__dirname, '0002_add_email_logs.sql'), 'utf8');

    console.log('🚀 Running migration...');
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');

    // Verify table was created
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'email_logs'
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 Table structure:');
    console.table(result.rows);

    client.release();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
