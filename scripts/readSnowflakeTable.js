// scripts/readSnowflakeTable.js
// Standalone script to query a Snowflake table and print results

// Load environment variables from .env file in project root
require('dotenv').config();

const { connect, executeQuery, disconnect } = require('../db/snowflake');

/**
 * Main function - queries specified table and prints results
 * Usage: node scripts/readSnowflakeTable.js <TABLE_NAME>
 */
async function main() {
    // Get table name from command line arguments
    const tableName = process.argv[2];

    if (!tableName) {
        console.error('Usage: node scripts/readSnowflakeTable.js <TABLE_NAME>');
        console.error('Example: node scripts/readSnowflakeTable.js USERS');
        process.exit(1);
    }

    // Validate required environment variables
    const requiredEnvVars = [
        'SNOWFLAKE_ACCOUNT',
        'SNOWFLAKE_USERNAME',
        'SNOWFLAKE_PASSWORD',
        'SNOWFLAKE_WAREHOUSE',
        'SNOWFLAKE_DATABASE',
        'SNOWFLAKE_SCHEMA',
    ];

    const missing = requiredEnvVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
        console.error('Missing required environment variables:');
        missing.forEach(v => console.error(`  - ${v}`));
        console.error('\nCreate a .env file with these variables or set them in your environment.');
        process.exit(1);
    }

    try {
        console.log('Connecting to Snowflake...');
        await connect();
        console.log('Connected successfully.\n');

        // Build read-only query (SELECT only, with LIMIT for safety)
        const sql = `SELECT * FROM ${tableName} LIMIT 10`;
        console.log(`Executing: ${sql}\n`);

        const rows = await executeQuery(sql);

        if (rows.length === 0) {
            console.log('Query returned no results.');
        } else {
            // Print formatted table to console
            console.table(rows);
            console.log(`\nReturned ${rows.length} row(s).`);
        }

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        // Always close connection, even if query failed
        await disconnect();
        console.log('\nConnection closed.');
    }
}

// Run the script
main();
