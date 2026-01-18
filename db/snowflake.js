// db/snowflake.js
// Snowflake connection module using official snowflake-sdk

const snowflake = require('snowflake-sdk');

// Connection instance (module-level for reuse)
let connection = null;

/**
 * Creates and establishes a Snowflake connection.
 * Reads all credentials from environment variables.
 * @returns {Promise<void>} Resolves when connected
 */
async function connect() {
    return new Promise((resolve, reject) => {
        // Create connection with credentials from environment
        connection = snowflake.createConnection({
            account: process.env.SNOWFLAKE_ACCOUNT,
            username: process.env.SNOWFLAKE_USERNAME,
            password: process.env.SNOWFLAKE_PASSWORD,
            warehouse: process.env.SNOWFLAKE_WAREHOUSE,
            database: process.env.SNOWFLAKE_DATABASE,
            schema: process.env.SNOWFLAKE_SCHEMA,
        });

        // Establish the connection (callback-based API wrapped in Promise)
        connection.connect((err) => {
            if (err) {
                reject(new Error(`Failed to connect to Snowflake: ${err.message}`));
            } else {
                resolve();
            }
        });
    });
}

/**
 * Executes a read-only SQL query.
 * @param {string} sqlText - The SQL query to execute (should be SELECT only)
 * @returns {Promise<Array<Object>>} Array of row objects
 */
async function executeQuery(sqlText) {
    if (!connection) {
        throw new Error('Not connected to Snowflake. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
        connection.execute({
            sqlText: sqlText,
            // 'complete' callback fires when all rows are fetched
            complete: (err, stmt, rows) => {
                if (err) {
                    reject(new Error(`Query failed: ${err.message}`));
                } else {
                    resolve(rows);
                }
            }
        });
    });
}

/**
 * Closes the Snowflake connection cleanly.
 * Safe to call even if not connected.
 * @returns {Promise<void>}
 */
async function disconnect() {
    if (!connection) {
        return; // Nothing to disconnect
    }

    return new Promise((resolve, reject) => {
        connection.destroy((err) => {
            if (err) {
                // Log but don't reject - we're cleaning up anyway
                console.warn(`Warning during disconnect: ${err.message}`);
            }
            connection = null;
            resolve();
        });
    });
}

module.exports = {
    connect,
    executeQuery,
    disconnect,
};
