document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const usernameInput = document.querySelector('#username') || document.querySelector('input[type="text"]');
    const passwordInput = document.querySelector('#password') || document.querySelector('input[type="password"]');

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';

    try {
      // Đọc danh sách tài khoản từ file JSON (đường dẫn tính từ vị trí trang index.html)
      const response = await fetch('./assets/data/users.json');
      if (!response.ok) throw new Error('Không thể đọc file users.json');
      
      const USERS_DB = await response.json();

      // Kiểm tra sự tồn tại và mật khẩu
      if (!USERS_DB[username] || USERS_DB[username] !== password) {
        alert('Tài khoản hoặc mật khẩu không chính xác!');
        return;
      }

      let role = '';
      let redirectUrl = '';

      // Phân quyền và tạo đường dẫn điều hướng
      if (username === 'admin') {
        role = 'SUPER_ADMIN';
        redirectUrl = './admin/index.html';
      } else if (username.toLowerCase().endsWith('-int')) {
        role = 'INTERNAL_USER';
        redirectUrl = './content/internal/index.html';
      } else if (username.toLowerCase().endsWith('-vdc')) {
        role = 'BIM_VDC';
        redirectUrl = './content/bim-vdc/index.html';
      } else {
        alert('Tài khoản chưa được phân quyền phân hệ!');
        return;
      }

      // Lưu LocalStorage đồng bộ dữ liệu với auth-guard.js
      localStorage.setItem('access_token', 'token-' + Date.now());
      localStorage.setItem('currentUser', JSON.stringify({
        username: username,
        role: role
      }));

      // Chuyển hướng trang
      window.location.href = redirectUrl;

    } catch (error) {
      console.error(error);
      alert('Không thể tải dữ liệu tài khoản từ hệ thống! Hãy chạy dự án qua Live Server.');
    }
  });
});