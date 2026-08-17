document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:5000/api';

    // 1. Khởi tạo Lucide Icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // 2. Xử lý Đăng nhập & Xác thực Tài khoản (thphuocks / 123456)
    const loginForm = document.querySelector('form');
    const loginBtn = document.querySelector('button');

    const handleLogin = (e) => {
        if (e) e.preventDefault();

        // Lấy thông tin từ các ô input
        const usernameInput = document.querySelector('input[type="text"]')?.value.trim();
        const passwordInput = document.querySelector('input[type="password"]')?.value.trim();

        // Kiểm tra thông tin đăng nhập
        if (usernameInput === 'thphuocks' && passwordInput === '123456') {
            const loginSection = document.getElementById('loginSection');
            const workspaceSection = document.getElementById('workspaceSection');

            // Nếu nằm chung 1 file SPA -> Toggle ẩn/hiện
            if (loginSection && workspaceSection) {
                loginSection.classList.add('hidden');
                workspaceSection.classList.remove('hidden');
                return;
            }

            // Điều hướng từ trang gốc ngoài vào thư mục frontend/index.html
            const currentPath = window.location.pathname;
            if (!currentPath.includes('/frontend/')) {
                window.location.href = './frontend/index.html';
            } else {
                console.log('Đã đăng nhập thành công vào Sub-Workspace!');
            }
        } else {
            alert('Tên đăng nhập hoặc mật khẩu không chính xác!\nTài khoản: thphuocks | Mật khẩu: 123456');
        }
    };

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }

    // 3. Xử lý Toggle cây thư mục CDE (ISO 19650 Tree View)
    const treeToggles = document.querySelectorAll('.tree-toggle');
    treeToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const parentLi = toggle.parentElement;
            const subList = parentLi.querySelector('ul');
            const icon = toggle.querySelector('[data-lucide="chevron-right"], [data-lucide="chevron-down"]');

            if (subList) {
                const isHidden = subList.classList.contains('hidden');
                if (isHidden) {
                    subList.classList.remove('hidden');
                    if (icon) icon.style.transform = 'rotate(0deg)';
                } else {
                    subList.classList.add('hidden');
                    if (icon) icon.style.transform = 'rotate(-90deg)';
                }
            }
        });
    });

    // 4. Xử lý Tìm kiếm & Hỏi Gemini AI qua Thanh Search Header
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (!query) return;

                const originalPlaceholder = searchInput.placeholder;
                searchInput.value = '';
                searchInput.placeholder = 'Gemini đang tra cứu CDE...';
                searchInput.disabled = true;

                try {
                    const response = await fetch(`${API_BASE_URL}/cde/search`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query })
                    });

                    const data = await response.json();
                    appendLiveFeed('Gemini AI', data.answer, 'Just now');
                } catch (err) {
                    console.error('Lỗi khi hỏi Gemini:', err);
                    alert('Không thể kết nối tới Backend Server AI. Vui lòng kiểm tra server Node.js!');
                } finally {
                    searchInput.placeholder = originalPlaceholder;
                    searchInput.disabled = false;
                    searchInput.focus();
                }
            }
        });
    }

    // Dynamic Live Feed Helper
    function appendLiveFeed(user, message, time) {
        const feedContainer = document.querySelector('.custom-scrollbar');
        if (!feedContainer) return;

        const newItem = document.createElement('div');
        newItem.className = 'flex items-start gap-3 text-xs bg-blue-950/40 p-2 rounded-lg border border-blue-500/30 animate-fade-in';
        newItem.innerHTML = `
            <div class="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-400 text-blue-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                AI
            </div>
            <div>
                <p class="text-slate-100 font-medium leading-relaxed"><span class="text-blue-400 font-bold">${user}:</span> ${message}</p>
                <span class="text-[10px] text-slate-400">${time}</span>
            </div>
        `;

        feedContainer.prepend(newItem);
    }
});