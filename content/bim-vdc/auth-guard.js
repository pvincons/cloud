function protectRoute(allowedRoles = null, deniedRoles = []) {
  // Ẩn nội dung gốc trước khi kiểm tra để tránh chớp giật giao diện
  document.documentElement.style.display = 'none';

  const token = localStorage.getItem('access_token');
  if (!token) {
    alert('Bạn chưa đăng nhập!');
    window.location.href = '../../index.html';
    return false;
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
    return true;
  }

  const denied = deniedRoles.map(role => String(role).toUpperCase());
  if (denied.includes(userRole) || denied.includes(userPermission)) {
    window.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.display = '';
      renderLockedScreen(userRole || userPermission);
    });
    return false;
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
      return false;
    }
  }

  const revealPage = () => { document.documentElement.style.display = ''; };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', revealPage);
  } else {
    revealPage();
  }
  return true;
}

function renderLockedScreen(userRole) {
  const container = document.createElement('main');
  container.style.cssText = 'min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;background:#0f172a;color:#e2e8f0;font:14px sans-serif;text-align:center';

  const heading = document.createElement('h1');
  heading.textContent = 'Không có quyền truy cập';
  heading.style.cssText = 'margin:0;font-size:24px;font-weight:700';

  const message = document.createElement('p');
  message.textContent = `Tài khoản ${userRole} không được phép mở trang này.`;
  message.style.margin = '0';

  const backLink = document.createElement('a');
  backLink.href = './index.html';
  backLink.textContent = 'Quay lại trang chính';
  backLink.style.cssText = 'color:#60a5fa;text-decoration:underline';

  container.append(heading, message, backLink);
  document.body.replaceChildren(container);
}
