// assets/js/config.js
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const CONFIG = {
    // Sau khi gộp chung vào server.js, cả Auth và CDE đều chạy chung một cổng duy nhất (3000 khi chạy local)
    AUTH_API: isLocal ? 'http://localhost:3000/api/auth' : 'https://api.pvincons.cloud/api/auth',
    CDE_API: isLocal ? 'http://localhost:3000/api' : 'https://api.pvincons.cloud/api'
};