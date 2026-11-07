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

  // const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwnudZdtcWdcNaBX-y_f_9KO15drju3bOC9aiK1Pr1YdIKs2FJZDE15g46QPPkIvrD0/exec';
  let userData = null;
  // let tokenData = 'FALLBACK_SHEETS_TOKEN_2026';
  let tokenData = ''; // Nếu dùng google sheets làm hệ thống xác thực, token này phải được coment

  try {
    // Trỏ trực tiếp về cổng 3000 sau khi gộp chung server.js
    const loginUrl = typeof CONFIG !== 'undefined' ? `${CONFIG.AUTH_API}/login` : 'http://localhost:3000/api/auth/login';

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(5000)
    });

    const data = await response.json();

    if (response.ok && data.success) {
      loginSuccess = true;
      userData = data.user;
      tokenData = data.token;
    } else {
      alert(data.error || 'Tài khoản hoặc mật khẩu không chính xác!');
      resetBtn();
      return;
    }

  } catch (primaryError) {
    console.warn('⚠️ Server xác thực không phản hồi...', primaryError);

    try {
      const scriptResponse = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'login', username, password })
      });

      const result = JSON.parse(await scriptResponse.text());

      if (result.success) {
        loginSuccess = true;
        userData = result.user || { username, fullName: result.fullName || username, role: result.role || 'DESIGNER', company: 'PV INCONS CO.LTD' };
      } else {
        alert(result.error || 'Xác thực thất bại!');
        resetBtn();
        return;
      }
    } catch (fallbackError) {
      alert('Không thể kết nối đến hệ thống xác thực!');
      resetBtn();
      return;
    }
  }

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