function protectRoute(requiredRole = null) {
  document.documentElement.style.display = 'none';

  const token = localStorage.getItem('access_token');
  if (!token) {
    alert('Bạn chưa đăng nhập!');
    window.location.href = '../../index.html';
    return;
  }

  const userSession = JSON.parse(localStorage.getItem('currentUser') || 'null');
  
  if (requiredRole && (!userSession || userSession.role !== requiredRole)) {
    alert(`Cảnh báo: Bạn không có quyền truy cập khu vực này!`);
    window.location.href = '../../index.html';
    return;
  }

  const revealPage = () => { document.documentElement.style.display = ''; };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', revealPage);
  } else {
    revealPage();
  }
}