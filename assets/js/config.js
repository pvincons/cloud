// assets/js/config.js
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Cổng server tổng hợp duy nhất (Chạy chung Auth + CDE)
const BASE_URL = isLocal ? 'http://localhost:3000' : 'https://api.pvincons.cloud';

const CONFIG = {
    BASE_URL: BASE_URL,
    API_URL: `${BASE_URL}/api`,
    AUTH_API: `${BASE_URL}/api/auth`,
    CDE_API: `${BASE_URL}/api`
};