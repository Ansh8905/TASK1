const axios = require('axios');
const mysql = require('mysql2/promise');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs').promises;

// Database Configuration
const dbConfig = {
    host: 'localhost',
    user: 'ansh',
    password: 'your_secure_password', // Replace with your actual password
    database: 'catfacts_db',
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0
};

// CSV Writer Configuration
function createCsvWriterInstance() {
    return createCsvWriter({
        path: 'cat_facts.csv',
        header: [
            { id: 'id', title: 'ID' },
            { id: 'fact', title: 'Fact' },
            { id: 'created_at', title: 'Created At' }
        ]
    });
}

// Fetch Cat Fact with Retry Logic
async function fetchCatFact(maxRetries = 3) {
    const url = 'https://catfact.ninja/fact';
    let attempts = 0;

    while (attempts < maxRetries) {
        try {
            const response = await axios.get(url, {
                timeout: 5000 // 5 seconds timeout
            });
            return response.data;
        } catch (error) {
            attempts++;
            console.log(`Fetch attempt ${attempts} failed:`, error.message);

            if (error.response && error.response.status === 429) {
                // Rate limiting
                console.log(`Rate limited. Waiting before retry...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            } else if (attempts >= maxRetries) {
                throw new Error('Failed to fetch cat fact after multiple attempts');
            }
        }
    }
}

// Database Connection Pool
class DatabaseManager {
    constructor(config) {
        this.pool = mysql.createPool(config);
    }

    async connect() {
        try {
            const connection = await this.pool.getConnection();
            console.log('Database connection successful');
            connection.release();
            return this.pool;
        } catch (error) {
            console.error('Database connection failed:', error);
            throw error;
        }
    }

    async storeFact(fact) {
        try {
            const [result] = await this.pool.execute(
                'INSERT INTO facts (fact) VALUES (?)', 
                [fact]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error storing fact:', error);
            throw error;
        }
    }

    async getFacts() {
        try {
            const [rows] = await this.pool.query('SELECT * FROM facts');
            return rows;
        } catch (error) {
            console.error('Error retrieving facts:', error);
            throw error;
        }
    }
}

// Export to CSV
async function exportToCSV(facts) {
    try {
        const csvWriter = createCsvWriterInstance();
        await csvWriter.writeRecords(facts);
        console.log('CSV export successful');
    } catch (error) {
        console.error('CSV export failed:', error);
    }
}

// Main Application Logic
async function main() {
    try {
        // Initialize Database Manager
        const dbManager = new DatabaseManager(dbConfig);
        await dbManager.connect();

        // Fetch Cat Fact
        const catFactData = await fetchCatFact();
        console.log('Fetched Cat Fact:', catFactData.fact);

        // Store Fact in Database
        const factId = await dbManager.storeFact(catFactData.fact);
        console.log('Fact stored with ID:', factId);

        // Retrieve and Export Facts
        const facts = await dbManager.getFacts();
        await exportToCSV(facts);

    } catch (error) {
        console.error('Application Error:', error);
        process.exit(1);
    }
}

// Run the Application
main();