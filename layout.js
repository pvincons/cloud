async function loadLayout(pageId) {
    try {
        const [headerRes, footerRes] = await Promise.all([
            fetch('header.html'),
            fetch('footer.html')
        ]);

        const headerHtml = await headerRes.text();
        const footerHtml = await footerRes.text();

        document.getElementById('header-placeholder').innerHTML = headerHtml;
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