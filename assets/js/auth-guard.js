function protectRoute(allowedRoles = null) {
  // Ẩn nội dung gốc trước khi kiểm tra để tránh chớp giật giao diện
  document.documentElement.style.display = 'none';

  const token = localStorage.getItem('access_token');
  if (!token) {
    alert('Bạn chưa đăng nhập!');
    window.location.href = '../../index.html';
    return;
  }

  let userSession = null;
  try {
    userSession = JSON.parse(localStorage.getItem('currentUser') || 'null');
  } catch (error) {
    userSession = null;
  }
  const userRole = String(userSession && userSession.role || '').toUpperCase();
  const userPermission = String(userSession && userSession.permission || '').toUpperCase();
  
  // Tài khoản ADMIN tối cao được phép qua tất cả các trang
  if (userRole === 'ADMIN' || userPermission === 'ADMIN') {
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
    const allowed = rolesArray.map(role => String(role).toUpperCase());
    if (!userSession || (!allowed.includes(userRole) && !allowed.includes(userPermission))) {
      // Hiển thị giao diện khóa trực tiếp trên trang thay vì chuyển hướng
      window.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.display = '';
        renderLockedScreen(userSession ? userRole || userPermission : 'Khách');
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
