// Link Google Apps Script
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzkIAJeJivQPmDEcKYKHpEjSFi_9mOLrS_nN-C6pSdyXD8i3CK7RPn8srwTgo7xeDKN/exec';

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
    submitBtn.classList.add('opacity-75', 'cursor-not-allowed', 'pointer-events-none', 'transition-all', 'duration-200');
    submitBtn.innerHTML = `
        <div class="inline-flex items-center justify-center gap-2">
            <svg class="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="font-medium tracking-wider text-xs uppercase">Đang xác minh...</span>
        </div>
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
      alert('Tài khoản chưa được phân quyền!');
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
    alert('Không thể kết nối đến cơ sở dữ liệu');
    resetBtn();
  }
});