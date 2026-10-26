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

  // Định nghĩa SCRIPT_URL Google Sheets dự phòng
  const SCRIPT_URL = 'https://script.google.com';

  let loginSuccess = false;
  let userData = null;
  let tokenData = 'FALLBACK_SHEETS_TOKEN_2026';

  try {
    // 1. THỬ KẾT NỐI AUTH SERVICE CHÍNH TRƯỚC (Dùng chung cổng 3000 sau khi gộp file)
    const loginUrl = typeof CONFIG !== 'undefined' ? `${CONFIG.AUTH_API}/login` : 'http://localhost:3000/api/auth/login';

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(5000) // Timeout sau 5 giây nếu server treo
    });

    const data = await response.json();

    if (response.ok && data.success) {
      loginSuccess = true;
      userData = data.user;
      tokenData = data.token;
    } else {
      // Nếu server chính trả về lỗi (sai mật khẩu, tài khoản không tồn tại), thông báo thẳng luôn
      alert(data.error || 'Tài khoản hoặc mật khẩu không chính xác!');
      resetBtn();
      return;
    }

  } catch (primaryError) {
    console.warn('⚠️ Auth Service chính không phản hồi, đang chuyển hướng xác thực sang Google Sheets...', primaryError);

    try {
      // 2. KHI SERVER CHÍNH LỖI -> FALLBACK SANG GOOGLE APPS SCRIPT (GOOGLE SHEETS)
      const scriptResponse = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'login', username, password })
      });

      const textResult = await scriptResponse.text();
      let result;
      try {
        result = JSON.parse(textResult);
      } catch (e) {
        result = { success: false, error: textResult };
      }

      if (result.success) {
        loginSuccess = true;
        userData = result.user || {
          username: username,
          fullName: result.fullName || username,
          role: result.role || 'DESIGNER',
          company: 'PV INCONS CO.LTD'
        };
      } else {
        alert(result.error || 'Xác thực qua Google Sheets thất bại: Sai tài khoản hoặc mật khẩu!');
        resetBtn();
        return;
      }

    } catch (fallbackError) {
      console.error('❌ Cả Auth Service và Google Sheets đều không thể kết nối:', fallbackError);
      alert('Không thể kết nối đến hệ thống xác thực (Cả Server chính và Google Sheets đều ngoại tuyến)!');
      resetBtn();
      return;
    }
  }

  // NẾU ĐĂNG NHẬP THÀNH CÔNG (TỪ BẤT KỲ NGUỒN NÀO)
  if (loginSuccess && userData) {
    let redirectUrl = './content/bim-vdc/index.html';

    if (userData.role === 'INTERNAL') {
      redirectUrl = './content/internal/index.html';
    }

    localStorage.setItem('access_token', tokenData);
    localStorage.setItem('currentUser', JSON.stringify(userData));

    window.location.href = redirectUrl;
  }
});