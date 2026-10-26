/* ==========================================================================
   AUTH GUARD – kiểm tra phiên đăng nhập cho các trang trong /content
   - Xác minh token với server (/api/auth/me), không tin dữ liệu trong localStorage
   - Tự động gắn "Authorization: Bearer <token>" cho mọi lời gọi fetch tới API
     và gắn ?token= cho EventSource của chat (nên các trang cũ không cần sửa)
   - Token hết hạn / bị thu hồi → xóa phiên và chuyển về trang đăng nhập
   Yêu cầu: nạp SAU config.js (nếu có CONFIG.AUTH_API) và TRƯỚC các script gọi API.
   ========================================================================== */
window.CDEAuth = window.CDEAuth || (function () {
  const TOKEN_KEY = 'access_token';
  const USER_KEY = 'currentUser';
  const FORCE_LOGOUT_CODES = ['NO_TOKEN', 'TOKEN_EXPIRED', 'TOKEN_INVALID', 'ACCOUNT_INVALID'];

  // Trang đăng nhập = index.html ở thư mục gốc (tính từ vị trí file này: assets/js/ → ../../)
  const SCRIPT_SRC = document.currentScript ? document.currentScript.src : '';
  const LOGIN_URL = SCRIPT_SRC ? new URL('../../index.html', SCRIPT_SRC).href : '../../index.html';

  const nativeFetch = window.fetch.bind(window);
  const NativeEventSource = window.EventSource;

  /* ---------- Địa chỉ API ---------- */
  function authApi() {
    if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.AUTH_API) {
      return String(CONFIG.AUTH_API).replace(/\/+$/, '');
    }
    const local = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    return local ? 'http://localhost:3000/api/auth' : location.origin + '/api/auth';
  }
  function apiRoot() {
    return authApi().replace(/\/auth$/, '');
  }
  // Chỉ gắn token cho đúng API của hệ thống, không bao giờ gửi cho domain khác
  function isOwnApi(url) {
    return url.href.startsWith(apiRoot() + '/') ||
      (url.origin === location.origin && url.pathname.startsWith('/api/'));
  }

  /* ---------- Phiên làm việc ---------- */
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }
  function getUser() {
    try {
      const u = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
      return u && typeof u === 'object' ? u : null;
    } catch (e) {
      return null;
    }
  }
  function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  let loggingOut = false;
  function logout(message) {
    if (loggingOut) return;
    loggingOut = true;
    clearSession();
    if (message) alert(message);
    window.location.href = LOGIN_URL;
  }

  /* ---------- Đọc hạn dùng của JWT (chỉ để báo sớm, server mới là nơi quyết định) ---------- */
  function decodeJwt(token) {
    try {
      const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(b64).split('').map(
        c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }
  function isExpired(token) {
    const p = decodeJwt(token);
    return !p || !p.exp || p.exp * 1000 <= Date.now() + 5000;
  }

  /* ---------- Xác minh phiên với server ---------- */
  // Trả về { status: 'ok', user } | { status: 'invalid' } | { status: 'offline' }
  async function verifySession() {
    try {
      const res = await nativeFetch(authApi() + '/me', {
        headers: { Authorization: 'Bearer ' + getToken() },
        signal: AbortSignal.timeout(5000)
      });
      if (res.status === 401 || res.status === 403) return { status: 'invalid' };
      if (!res.ok) return { status: 'offline' };
      const data = await res.json();
      return data && data.success && data.user ? { status: 'ok', user: data.user } : { status: 'invalid' };
    } catch (e) {
      return { status: 'offline' }; // mất mạng / server tắt: không đăng xuất oan
    }
  }

  /* ---------- Tự gắn token cho fetch ---------- */
  window.fetch = async function (input, init) {
    let url;
    try {
      url = new URL(typeof input === 'string' ? input : (input.url || String(input)), location.href);
    } catch (e) {
      return nativeFetch(input, init);
    }

    const token = getToken();
    if (!token || !isOwnApi(url) || /\/api\/auth\/login\/?$/.test(url.pathname)) {
      return nativeFetch(input, init);
    }

    const headers = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined));
    if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);

    const res = await nativeFetch(input, Object.assign({}, init, { headers }));

    if (res.status === 401) {
      try {
        const body = await res.clone().json();
        if (body && FORCE_LOGOUT_CODES.includes(body.code)) {
          logout(body.code === 'TOKEN_EXPIRED'
            ? 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại!'
            : 'Phiên đăng nhập không còn hiệu lực, vui lòng đăng nhập lại!');
        }
      } catch (e) { /* không phải JSON từ API của mình */ }
    }
    return res;
  };

  /* ---------- Tự gắn token cho EventSource (chat realtime) ---------- */
  if (NativeEventSource) {
    const PatchedEventSource = function (url, config) {
      try {
        const u = new URL(String(url), location.href);
        const token = getToken();
        if (token && isOwnApi(u) && !u.searchParams.has('token')) {
          u.searchParams.set('token', token);
          url = u.href;
        }
      } catch (e) { /* giữ nguyên url */ }
      return new NativeEventSource(url, config);
    };
    PatchedEventSource.prototype = NativeEventSource.prototype;
    ['CONNECTING', 'OPEN', 'CLOSED'].forEach(k => { PatchedEventSource[k] = NativeEventSource[k]; });
    window.EventSource = PatchedEventSource;
  }

  return { LOGIN_URL, authApi, getToken, getUser, setUser, clearSession, logout, isExpired, verifySession };
})();


/**
 * Bảo vệ một trang. Gọi ở đầu trang: protectRoute() hoặc protectRoute(['DESIGNER', 'MASTER'])
 * - ADMIN được vào mọi trang
 * - Trả về Promise (các trang cũ gọi mà không cần quan tâm giá trị trả về)
 */
function protectRoute(allowedRoles = null) {
  const A = window.CDEAuth;

  // Ẩn nội dung gốc trước khi kiểm tra để tránh chớp giật giao diện
  document.documentElement.style.display = 'none';

  const whenReady = (fn) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  };
  const reveal = () => whenReady(() => { document.documentElement.style.display = ''; });

  const token = A.getToken();
  if (!token) {
    A.logout('Bạn chưa đăng nhập!');
    return Promise.resolve(false);
  }
  if (A.isExpired(token)) {
    A.logout('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại!');
    return Promise.resolve(false);
  }

  return A.verifySession().then((result) => {
    if (result.status === 'invalid') {
      A.logout('Phiên đăng nhập không còn hiệu lực, vui lòng đăng nhập lại!');
      return false;
    }

    // Ưu tiên hồ sơ mới nhất từ server (role, dự án... luôn đúng với users.json);
    // chỉ khi server không liên lạc được mới dùng bản đã lưu.
    let userSession = A.getUser();
    if (result.status === 'ok') {
      userSession = result.user;
      A.setUser(userSession);
    }

    // Tài khoản ADMIN tối cao được phép qua tất cả các trang
    if (userSession && userSession.role === 'ADMIN') {
      reveal();
      return true;
    }

    if (allowedRoles) {
      const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      // Nếu không có quyền truy cập: hiển thị giao diện khóa trực tiếp trên trang
      if (!userSession || !rolesArray.includes(userSession.role)) {
        whenReady(() => {
          document.documentElement.style.display = '';
          renderLockedScreen(userSession ? userSession.role : 'Khách');
        });
        return false;
      }
    }

    reveal();
    return true;
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Hàm vẽ giao diện ổ khóa và thông báo hạn chế quyền chuyên nghiệp
function renderLockedScreen(currentRole) {
  const homeUrl = window.CDEAuth ? window.CDEAuth.LOGIN_URL : '../../index.html';
  document.body.innerHTML = `
    <div class="min-h-screen flex items-center justify-center relative selection:bg-blue-500 selection:text-white bg-slate-950">
      <!-- Video nền mờ nếu có -->
      <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-md -z-10"></div>

      <div class="max-w-md w-full mx-4 p-8 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl text-center relative overflow-hidden">
        <!-- Hiệu ứng sáng trang trí -->
        <div class="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div class="absolute -bottom-24 -left-24 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl"></div>

        <!-- Biểu tượng ổ khóa -->
        <div class="w-20 h-20 mx-auto mb-6 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center text-3xl shadow-inner animate-pulse">
          <i class="fa-solid fa-lock"></i>
        </div>

        <h2 class="text-lg font-bold text-white tracking-wide mb-2 uppercase">Khu vực bảo mật CDE</h2>
        <p class="text-xs text-slate-400 mb-6 leading-relaxed">
          Tài khoản của bạn (<span class="text-blue-400 font-semibold">${escapeHtml(currentRole)}</span>) không được cấp quyền truy cập hoặc thao tác trên phân hệ này theo chuẩn ISO 19650.
        </p>

        <div class="space-y-3">
          <button onclick="history.back()" class="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs tracking-wider uppercase rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2">
            <i class="fa-solid fa-arrow-left"></i> Quay lại trang trước
          </button>

          <a href="${homeUrl}" class="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs tracking-wider uppercase rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2">
            <i class="fa-solid fa-house"></i> Về trang chủ Portal
          </a>
        </div>

        <div class="mt-6 pt-4 border-t border-white/10 text-[10px] text-slate-500 font-mono">
          PV INCONS Enterprise CDE Workspace v2.6
        </div>
      </div>
    </div>
  `;
}
