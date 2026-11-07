// assets/js/config.js
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const CONFIG = {
    // Cả Auth và CDE đều chạy chung một cổng duy nhất sau khi gộp file server.js
    AUTH_API: isLocal ? 'http://localhost:3000/api/auth' : 'https://api.pvincons.cloud/api/auth',
    CDE_API: isLocal ? 'http://localhost:3000/api' : 'https://api.pvincons.cloud/api'
};