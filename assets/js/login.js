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

  let userData = null;
  let tokenData = null;

  try {
    // GỌI API ĐĂNG NHẬP TRÊN SERVER TỔNG HỢP (DÙNG CONFIG CHUNG HOẶC LOCALHOST)
    const loginUrl = (typeof CONFIG !== 'undefined' && CONFIG.AUTH_API)
      ? `${CONFIG.AUTH_API}/login`
      : 'http://localhost:3000/api/auth/login';

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(5000) // Timeout sau 5 giây nếu server treo
    });

    const data = await response.json();

    if (response.ok && data.success && data.token && data.user) {
      userData = data.user;
      tokenData = data.token;
    } else {
      alert(data.error || 'Tài khoản hoặc mật khẩu không chính xác!');
      resetBtn();
      return;
    }

  } catch (error) {
    console.error('❌ Không thể kết nối đến server xác thực:', error);
    alert(
      error && error.name === 'TimeoutError'
        ? 'Máy chủ xác thực phản hồi quá chậm, vui lòng thử lại sau!'
        : 'Không thể kết nối đến máy chủ xác thực!'
    );
    resetBtn();
    return;
  }

  // ĐĂNG NHẬP THÀNH CÔNG
  let redirectUrl = './content/bim-vdc/index.html';

  if (userData.role === 'INTERNAL') {
    redirectUrl = './content/internal/index.html';
  }

  localStorage.setItem('access_token', tokenData);
  localStorage.setItem('currentUser', JSON.stringify(userData));

  window.location.href = redirectUrl;
});
