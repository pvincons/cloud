document.getElementById('loginForm')?.addEventListener('submit', async function (e) {
  e.preventDefault();

  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submitBtn');

  const username = usernameInput ? usernameInput.value.trim() : '';
  // Không trim mật khẩu: server so sánh nguyên văn
  const password = passwordInput ? passwordInput.value : '';

  if (!username || !password) {
    alert('Vui lòng nhập đầy đủ tài khoản và mật khẩu!');
    return;
  }

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

  // Địa chỉ API: ưu tiên CONFIG.AUTH_API; nếu không có thì dùng cùng domain (hoặc localhost:3000 khi chạy local)
  const authApi = (() => {
    if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.AUTH_API) {
      return String(CONFIG.AUTH_API).replace(/\/+$/, '');
    }
    const local = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    return local ? 'http://localhost:3000/api/auth' : location.origin + '/api/auth';
  })();

  let data;
  try {
    const response = await fetch(`${authApi}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(8000) // Timeout nếu server treo
    });

    // Server có thể trả HTML (vd: 502 từ proxy) → không để lỗi parse che mất nguyên nhân thật
    const body = await response.json().catch(() => null);

    if (!response.ok || !body || !body.success || !body.token || !body.user) {
      const fallbackMsg = response.status >= 500
        ? 'Máy chủ xác thực đang gặp sự cố, vui lòng thử lại sau!'
        : 'Tài khoản hoặc mật khẩu không chính xác!';
      alert((body && body.error) || fallbackMsg);
      resetBtn();
      return;
    }
    data = body;
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
  const userData = data.user;
  let redirectUrl = './content/bim-vdc/index.html';

  if (String(userData.role).toUpperCase() === 'INTERNAL') {
    redirectUrl = './content/internal/index.html';
  }

  localStorage.setItem('access_token', data.token);
  localStorage.setItem('currentUser', JSON.stringify(userData));

  window.location.href = redirectUrl;
});
