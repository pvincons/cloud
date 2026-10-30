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
