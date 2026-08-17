const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'pvincons_cde',
    password: process.env.DB_PASSWORD || '123456',
    port: process.env.DB_PORT || 5432,
});

pool.on('connect', () => {
    console.log('[Database] Kết nối thành công tới PostgreSQL CDE Database');
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};