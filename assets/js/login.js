// Dán link bạn vừa sao chép từ Google Apps Script vào đây
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzTHhPd4KdRpGgScuw_IBzaRcl_5TSac6guGm1Lvrws0UhzsOGJNM_nR2W406kslRFO/exec';

document.querySelector('form')?.addEventListener('submit', async function (e) {
  e.preventDefault();

  const username = document.querySelector('input[type="text"]').value.trim();
  const password = document.querySelector('input[type="password"]').value.trim();

  try {
    // 1. Đọc dữ liệu tài khoản từ Google Sheets
    const response = await fetch(SCRIPT_URL);
    const rows = await response.json();

    // 2. Kiểm tra khớp User & Pass (bỏ qua dòng tiêu đề [0])
    const matchedUser = rows.slice(1).find(
      row => String(row[0]).trim() === username && String(row[1]).trim() === password
    );

    if (!matchedUser) {
      alert('Tài khoản hoặc mật khẩu không chính xác!');
      return;
    }

    // 3. Phân luồng điều hướng
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
      return;
    }

    // 4. Lưu Session
    localStorage.setItem('access_token', 'token-' + Date.now());
    localStorage.setItem('currentUser', JSON.stringify({
      username: username,
      role: role
    }));

    window.location.href = redirectUrl;

  } catch (error) {
    alert('Không thể kết nối đến cơ sở dữ liệu Google Sheets!');
  }
});