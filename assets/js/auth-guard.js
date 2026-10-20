function protectRoute(allowedRoles = null) {
  // Ẩn nội dung gốc trước khi kiểm tra để tránh chớp giật giao diện
  document.documentElement.style.display = 'none';

  const token = localStorage.getItem('access_token');
  if (!token) {
    alert('Bạn chưa đăng nhập!');
    window.location.href = '../../index.html';
    return;
  }

  const userSession = JSON.parse(localStorage.getItem('currentUser') || 'null');
  
  // Tài khoản ADMIN tối cao được phép qua tất cả các trang
  if (userSession && userSession.role === 'ADMIN') {
    const revealPage = () => { document.documentElement.style.display = ''; };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', revealPage);
    } else {
      revealPage();
    }
    return;
  }

  if (allowedRoles) {
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    // Nếu không có quyền truy cập
    if (!userSession || !rolesArray.includes(userSession.role)) {
      // Hiển thị giao diện khóa trực tiếp trên trang thay vì chuyển hướng
      window.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.display = '';
        renderLockedScreen(userSession ? userSession.role : 'Khách');
      });
      return;
    }
  }

  const revealPage = () => { document.documentElement.style.display = ''; };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', revealPage);
  } else {
    revealPage();
  }
}

// Hàm vẽ giao diện ổ khóa và thông báo hạn chế quyền chuyên nghiệp
function renderLockedScreen(currentRole) {
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
          Tài khoản của bạn (<span class="text-blue-400 font-semibold">${currentRole}</span>) không được cấp quyền truy cập hoặc thao tác trên phân hệ này theo chuẩn ISO 19650.
        </p>

        <div class="space-y-3">
          <button onclick="history.back()" class="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs tracking-wider uppercase rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2">
            <i class="fa-solid fa-arrow-left"></i> Quay lại trang trước
          </button>
          
          <a href="../../index.html" class="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs tracking-wider uppercase rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2">
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