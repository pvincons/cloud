// assets/js/auth-guard.js
function protectRoute(requiredRole = null) {
  // Ẩn trang tạm thời để tránh nhấp nháy giao diện (Anti-FOUC)
  document.documentElement.style.display = 'none';

  const token = localStorage.getItem('access_token');
  if (!token) {
    alert('Bạn chưa đăng nhập!');
    window.location.href = '../../index.html';
    return;
  }

  const userSession = JSON.parse(localStorage.getItem('currentUser') || 'null');
  
  // Nếu trang yêu cầu Role cụ thể mà User không đáp ứng
  if (requiredRole && (!userSession || userSession.role !== requiredRole)) {
    alert(`Cảnh báo: Bạn không có quyền truy cập khu vực này!`);
    window.location.href = '../../index.html';
    return;
  }

  // Xác thực thành công -> Hiển thị lại giao diện
  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.style.display = '';
  });
}