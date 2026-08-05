// ==========================================
// CHỨC NĂNG ĐỔI NGÔN NGỮ (GLOBAL LANGUAGE SWITCHER)
// ==========================================
window.toggleLanguage = function () {
    var isEn = document.cookie.indexOf('/en') !== -1;
    var host = location.hostname;
    var rootDomain = host.replace(/^www\./, '');

    if (isEn) {
        // Xóa Cookie trên mọi cấp độ Domain để quay về Tiếng Việt
        var pastDate = "expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;";
        document.cookie = "googtrans=; " + pastDate;
        document.cookie = "googtrans=; domain=" + host + "; " + pastDate;
        document.cookie = "googtrans=; domain=." + rootDomain + "; " + pastDate;
    } else {
        // Thiết lập Cookie chuyển sang Tiếng Anh
        document.cookie = "googtrans=/vi/en; path=/;";
        document.cookie = "googtrans=/vi/en; path=/; domain=" + host + ";";
        document.cookie = "googtrans=/vi/en; path=/; domain=." + rootDomain + ";";
    }
    location.reload();
};

// Khởi tạo Google Translate Widget ngầm
window.googleTranslateElementInit = function () {
    new google.translate.TranslateElement({
        pageLanguage: 'vi',
        includedLanguages: 'en,vi',
        layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false
    }, 'google_translate_element');
};

// ==========================================
// NẠP HEADER / FOOTER DỰ ÁN
// ==========================================
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

        const footerPlaceholder = document.getElementById('footer-placeholder');
        if (footerPlaceholder) {
            footerPlaceholder.innerHTML = footerHtml;
        }

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

// ==========================================
// TỰ ĐỘNG LẤY TIN TỨC TỪ NEWS.HTML SANG INDEX.HTML
// ==========================================
async function loadHomeNews() {
    const placeholder = document.getElementById('latest-news-placeholder');
    if (!placeholder) return;

    try {
        const response = await fetch('news.html');
        const htmlText = await response.text();

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

// ==========================================
// GỬI DỮ LIỆU FORM QUA AJAX
// ==========================================
async function submitContactForm(e) {
    e.preventDefault();

    const form = e.target;
    const thankYouModal = document.getElementById('thankYouModal');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerText;

    submitBtn.disabled = true;
    submitBtn.innerText = 'Đang gửi...';

    try {
        const response = await fetch(form.action, {
            method: 'POST',
            body: new FormData(form),
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            form.reset();
            if (thankYouModal) {
                thankYouModal.classList.remove('hidden');
                thankYouModal.classList.add('flex');
            }
        } else {
            alert('Có lỗi xảy ra khi gửi thông tin. Vui lòng thử lại!');
        }
    } catch (error) {
        alert('Không thể kết nối máy chủ. Vui lòng kiểm tra lại kết nối mạng!');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalBtnText;
    }
}

function closeModal() {
    const thankYouModal = document.getElementById('thankYouModal');
    if (thankYouModal) {
        thankYouModal.classList.add('hidden');
        thankYouModal.classList.remove('flex');
    }
}

// ==========================================
// THỐNG KÊ LƯỢT TRUY CẬP THỰC TẾ (GLOBAL API)
// ==========================================
async function initVisitorCounter() {
    const totalVisitsEl = document.getElementById('totalVisits');
    const onlineVisitorsEl = document.getElementById('onlineVisitors');

    if (!totalVisitsEl && !onlineVisitorsEl) return;

    const NAMESPACE = 'pvincons_construct_2026';
    const KEY = 'total_visits';

    try {
        let endpoint = `https://api.counterapi.dev/v1/${NAMESPACE}/${KEY}/`;

        if (!sessionStorage.getItem('pv_counted_session')) {
            endpoint += 'up/';
            sessionStorage.setItem('pv_counted_session', 'true');
        }

        const response = await fetch(endpoint);
        if (response.ok) {
            const data = await response.json();
            const BASE_OFFSET = 12000;
            const finalTotal = (data.count || 0) + BASE_OFFSET;
            if (totalVisitsEl) {
                totalVisitsEl.innerText = Number(finalTotal).toLocaleString('vi-VN');
            }
        } else {
            throw new Error('Lỗi phản hồi API');
        }
    } catch (error) {
        console.warn('API đếm toàn cầu bị gián đoạn, sử dụng số liệu fallback:', error);
        if (totalVisitsEl) {
            totalVisitsEl.innerText = '12.000';
        }
    }
}

// ==========================================
// THIẾT LẬP KHI TRANG TẢI XONG
// ==========================================
document.addEventListener('DOMContentLoaded', function () {
    // 1. Tự động chèn Container và Script cho Google Translate
    if (!document.getElementById('google_translate_element')) {
        const translateDiv = document.createElement('div');
        translateDiv.id = 'google_translate_element';
        translateDiv.style.display = 'none';
        document.body.appendChild(translateDiv);

        const translateScript = document.createElement('script');
        translateScript.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        document.body.appendChild(translateScript);
    }

    // 2. Chạy các tính năng phụ trợ
    setTimeout(initVisitorCounter, 300);
    loadHomeNews();
});