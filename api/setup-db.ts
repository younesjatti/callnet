
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    host: process.env.PGHOST || '34.69.101.176',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD, 
    database: process.env.PGDATABASE || 'callnet_db',
    ssl: { rejectUnauthorized: false }
});

async function setup() {
    try {
        console.log('⏳ Tentative de connexion...');
        await client.connect();
        
        console.log('✅ Connecté !');
        await client.query('DROP TABLE IF EXISTS orders CASCADE');
        await client.query('DROP TABLE IF EXISTS users CASCADE');

        console.log('🏗️ Création de la table USERS...');
        await client.query(`
            CREATE TABLE users (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                assigned_client_ids TEXT[],
                google_sheet_url TEXT,
                selected_sheet VARCHAR(255),
                auto_sync BOOLEAN DEFAULT FALSE,
                column_mapping JSONB,
                logo_data TEXT,
                logo_scale NUMERIC(4, 2) DEFAULT 1.0
            )
        `);

        console.log('🏗️ Création de la table ORDERS...');
        await client.query(`
            CREATE TABLE orders (
                id VARCHAR(255) PRIMARY KEY,
                customer_name VARCHAR(255) NOT NULL,
                product VARCHAR(255) NOT NULL,
                quantity INTEGER DEFAULT 1,
                variant VARCHAR(255),
                price NUMERIC(10, 2) NOT NULL,
                date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                status VARCHAR(50) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                address TEXT NOT NULL,
                city VARCHAR(255),
                district VARCHAR(255),
                note TEXT,
                client_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
                archived BOOLEAN DEFAULT FALSE
            )
        `);

        console.log('👤 Création admin...');
        await client.query(`
            INSERT INTO users (id, name, email, password, role)
            VALUES ('admin-init', 'Administrateur', 'admin@callnet.ma', 'adminpass', 'Admin')
        `);

        console.log('✅ TERMINÉ !');
    } catch (err: any) {
        console.error('❌ ERREUR :', err.message);
    } finally {
        await client.end();
    }
}

setup();
