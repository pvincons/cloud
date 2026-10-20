// assets/js/config.js
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const CONFIG = {
    // Nếu chạy local, tự động trỏ về cổng 3001 và 3000. Nếu lên VPS, dùng chung domain qua Caddy Server
    AUTH_API: isLocal ? 'http://localhost:3001/api/auth' : 'https://api.pvincons.cloud/api/auth',
    CDE_API: isLocal ? 'http://localhost:3000/api' : 'https://api.pvincons.cloud/api'
};