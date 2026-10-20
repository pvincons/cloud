document.getElementById('loginForm')?.addEventListener('submit', async function (e) {
  e.preventDefault();

  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submitBtn');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';

  const originalBtnContent = submitBtn ? submitBtn.innerHTML : '';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-75', 'cursor-not-allowed', 'pointer-events-none');
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

  const resetBtn = () => {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-75', 'cursor-not-allowed', 'pointer-events-none');
      submitBtn.innerHTML = originalBtnContent;
    }
  };

  // ==========================================
  // BYPASS BACKEND CHO TÀI KHOẢN ADMIN ĐẶC BIỆT
  // ==========================================
  if (username === 'admin' && password === '0939751194hp') {
    const bypassUser = {
      username: 'admin',
      fullName: 'TRẦN HOÀNG PHƯỚC (SUPER ADMIN)',
      role: 'ADMIN',
      position: 'Administrator',
      company: 'PV INCONS CO.LTD'
    };
    
    // Lưu token giả lập và thông tin user vào localStorage
    localStorage.setItem('access_token', 'BYPASS_ADMIN_TOKEN_PV_INCONS_2026');
    localStorage.setItem('currentUser', JSON.stringify(bypassUser));
    
    // Điều hướng trực tiếp vào phân hệ chính
    window.location.href = './content/bim-vdc/index.html';
    return;
  }

  try {
    // Sử dụng CONFIG.AUTH_API từ file config.js nếu có, hoặc trỏ mặc định đến Auth Service (cổng 3001)
    const loginUrl = typeof CONFIG !== 'undefined' ? `${CONFIG.AUTH_API}/login` : 'http://localhost:3001/api/auth/login';

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      alert(data.error || 'Tài khoản hoặc mật khẩu không chính xác!');
      resetBtn();
      return;
    }

    // Phân luồng điều hướng chính xác theo yêu cầu
    let redirectUrl = './content/bim-vdc/index.html'; // Mặc định cho các Role: ADMIN, MASTER, DESIGNER, MANAGEMENT, CONTRACTOR

    if (data.user.role === 'INTERNAL') {
      redirectUrl = './content/internal/index.html'; // Dành riêng cho Role: INTERNAL
    }

    // Lưu JWT Token và thông tin User vào localStorage
    localStorage.setItem('access_token', data.token);
    localStorage.setItem('currentUser', JSON.stringify(data.user));

    window.location.href = redirectUrl;

  } catch (error) {
    console.error('Lỗi kết nối:', error);
    alert('Không thể kết nối đến Auth Service! Hãy chắc chắn Auth Service đang chạy ở cổng 3001.');
    resetBtn();
  }
});