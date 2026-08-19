// Link Google Apps Script
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzSUCULCw3M_QivXc8cTP7FsbZY7sK2eg0qpQSiOa9ZvM7S8tqKav7p-X2mE7majbHW/exec';

document.getElementById('loginForm')?.addEventListener('submit', async function (e) {
  e.preventDefault();

  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submitBtn');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';

  // Lưu lại nội dung gốc của nút để khôi phục khi cần
  const originalBtnContent = submitBtn ? submitBtn.innerHTML : '';

  // 1. Chuyển nút sang trạng thái xoay tròn & Đang xác minh...
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-80', 'cursor-not-allowed');
    submitBtn.innerHTML = `
      <i class="fa-solid fa-circle-notch animate-spin text-sm"></i>
      <span>ĐANG XÁC MINH...</span>
    `;
  }

  // Hàm hỗ trợ reset nút đăng nhập về trạng thái ban đầu
  const resetBtn = () => {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-80', 'cursor-not-allowed');
      submitBtn.innerHTML = originalBtnContent;
    }
  };

  try {
    // 2. Đọc dữ liệu tài khoản từ Google Sheets
    const response = await fetch(SCRIPT_URL);
    const rows = await response.json();

    // 3. Kiểm tra khớp User & Pass (bỏ qua dòng tiêu đề [0])
    const matchedUser = rows.slice(1).find(
      row => String(row[0]).trim() === username && String(row[1]).trim() === password
    );

    if (!matchedUser) {
      alert('Tài khoản hoặc mật khẩu không chính xác!');
      resetBtn();
      return;
    }

    // 4. Phân luồng điều hướng
    let role = '';
    let redirectUrl = '';

    if (username === 'admin') {
      role = 'SUPER_ADMIN';
      redirectUrl = './admin/index.html';
    } else if (username.endsWith('-int')) {
      role = 'INTERNAL_USER';
      redirectUrl = './content/internal/index.html';
    } else if (username.endsWith('-vdc')) {
      role = 'BIM_VDC';
      redirectUrl = './content/bim-vdc/index.html';
    } else {
      alert('Tài khoản chưa được phân quyền phân hệ!');
      resetBtn();
      return;
    }

    // 5. Lưu Session & Chuyển hướng
    localStorage.setItem('access_token', 'token-' + Date.now());
    localStorage.setItem('currentUser', JSON.stringify({
      username: username,
      role: role
    }));

    window.location.href = redirectUrl;

  } catch (error) {
    alert('Không thể kết nối đến cơ sở dữ liệu Google Sheets!');
    resetBtn();
  }
});