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

// Hàm bắt sự kiện và gửi dữ liệu form qua AJAX
async function submitContactForm(e) {
    e.preventDefault(); // Chặn đứng hành vi chuyển trang của trình duyệt

    const form = e.target;
    const thankYouModal = document.getElementById('thankYouModal');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerText;

    // Đổi trạng thái nút bấm
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
            form.reset(); // Xóa sạch dữ liệu ô nhập
            if (thankYouModal) {
                thankYouModal.classList.remove('hidden');
                thankYouModal.classList.add('flex'); // Bật bảng thông báo
            }
        } else {
            alert('Có lỗi xảy ra khi gửi thông tin. Vui lòng thử lại!');
        }
    } catch (error) {
        alert('Không thể kết nối máy chủ. Vui lòng kiểm tra lại kết nối mạng!');
    } finally {
        // Mở lại nút bấm
        submitBtn.disabled = false;
        submitBtn.innerText = originalBtnText;
    }
}

// Hàm đóng Bảng thông báo (Modal)
function closeModal() {
    const thankYouModal = document.getElementById('thankYouModal');
    if (thankYouModal) {
        thankYouModal.classList.add('hidden');
        thankYouModal.classList.remove('flex');
    }
}

// ==============================================
// THỐNG KÊ LƯỢT TRUY CẬP THỰC TẾ (GLOBAL API)
// ==============================================
async function initVisitorCounter() {
    const totalVisitsEl = document.getElementById('totalVisits');
    const onlineVisitorsEl = document.getElementById('onlineVisitors');

    if (!totalVisitsEl || !onlineVisitorsEl) return;

    // Tên định danh duy nhất cho PV INCONS trên Server đếm toàn cầu
    const NAMESPACE = 'pvincons_construct_2026';
    const KEY = 'total_visits';

    try {
        // Kiểm tra xem khách hàng này đã được đếm trong phiên làm việc (Session) này chưa
        // Mục đích: Tránh việc 1 người cố tình ấn F5 liên tục làm rác số liệu
        let endpoint = `https://api.counterapi.dev/v1/${NAMESPACE}/${KEY}/`;

        if (!sessionStorage.getItem('pv_counted_session')) {
            endpoint += 'up'; // Tăng +1 trên Server toàn cầu nếu là người dùng mới vào web
            sessionStorage.setItem('pv_counted_session', 'true');
        }

        // Gọi API toàn cầu
        const response = await fetch(endpoint);
        if (response.ok) {
            const data = await response.json();

            // CON SỐ CƠ SỞ KHỞI ĐIỂM + CON SỐ ĐẾM THẬT TỪ API
            // (Ví dụ cộng thêm 10,000 lượt xem tích lũy trước đây của công ty)
            const BASE_OFFSET = 10000;
            const finalTotal = (data.count || 0) + BASE_OFFSET;

            totalVisitsEl.innerText = Number(finalTotal).toLocaleString('vi-VN');
        } else {
            throw new Error('Lỗi phản hồi API');
        }
    } catch (error) {
        console.warn('API đếm toàn cầu bị gián đoạn, sử dụng số liệu fallback:', error);
        // Số dự phòng nếu mạng chập chờn hoặc API bị nghẽn
        totalVisitsEl.innerText = '10,050';
    }
}

// Khởi chạy sau khi giao diện đã tải
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(initVisitorCounter, 300);
});

// Chạy hàm khi trang web tải xong
document.addEventListener('DOMContentLoaded', loadHomeNews);