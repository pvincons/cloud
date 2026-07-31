async function loadLayout(pageId) {
    try {
        const [headerRes, footerRes] = await Promise.all([
            fetch('header.html'),
            fetch('footer.html')
        ]);

        const headerHtml = await headerRes.text();
        const footerHtml = await footerRes.text();

        const headerPlaceholder = document.getElementById('header-placeholder');
        if (headerPlaceholder) {
            headerPlaceholder.outerHTML = headerHtml;
        }        
        document.getElementById('footer-placeholder').innerHTML = footerHtml;

        // Highlight tab đang mở
        const activeTabs = document.querySelectorAll(`[data-tab="${pageId}"]`);
        activeTabs.forEach(el => {
            if (el.classList.contains('nav-tab-btn')) {
                el.classList.add('border-brand-blue', 'text-brand-blue');
                el.classList.remove('border-transparent', 'text-slate-600');
            }
            if (el.classList.contains('mobile-tab-btn')) {
                el.classList.add('text-brand-blue', 'bg-blue-50');
                el.classList.remove('text-slate-700');
            }
        });

        // Sự kiện toggle Menu Mobile
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const mobileMenu = document.getElementById('mobileMenu');
        if (mobileMenuBtn && mobileMenu) {
            mobileMenuBtn.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });
        }
    } catch (error) {
        console.error('Lỗi khi nạp Header/Footer:', error);
    }
}

function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.add('hidden');
    }
}

// Hàm tự động lấy tin tức từ news.html sang index.html
async function loadHomeNews() {
    const placeholder = document.getElementById('latest-news-placeholder');
    if (!placeholder) return;

    try {
        const response = await fetch('news.html');
        const htmlText = await response.text();

        // Đọc dữ liệu HTML từ trang news.html
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const newsContent = doc.querySelector('#news-container');

        if (newsContent) {
            placeholder.innerHTML = newsContent.innerHTML;
        }
    } catch (error) {
        console.error('Lỗi đồng bộ tin tức:', error);
    }
}

// Chạy hàm khi trang web tải xong
document.addEventListener('DOMContentLoaded', loadHomeNews);