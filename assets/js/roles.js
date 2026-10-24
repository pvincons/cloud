// assets/js/roles.js

/**
 * Áp dụng phân quyền giao diện dựa trên Role của User
 */
function applyRolePermissionsUI(userRole) {
    const role = userRole ? userRole.toUpperCase() : '';

    // 1. ADMIN / MASTER: Toàn quyền truy cập (mở tất cả các mục)
    if (role === 'ADMIN' || role === 'MASTER') return;

    // 2. DESIGNER: 
    if (role === 'DESIGNER') {
        lockCardItem('cardDataDoc', 'footerDataDoc', 'iconDataDoc');
        lockCardItem('cardManagement', 'footerManagement', 'iconManagement');
        lockButtonItem('btnRevitServer', 'iconRevitServer');
    }

    // 3. MANAGEMENT: 
    if (role === 'MANAGEMENT') {
        lockCardItem('cardDataDoc', 'footerDataDoc', 'iconDataDoc');
        lockButtonItem('btnRevitServer', 'iconRevitServer');
    }

    // 4. CONTRACTOR: 
    if (role === 'CONTRACTOR') {
        lockCardItem('cardDataDoc', 'footerDataDoc', 'iconDataDoc');
        lockButtonItem('btnRevitServer', 'iconRevitServer');
        lockButtonItem('btnClashDetection', 'iconClashDetection');
    }
}

function lockCardItem(cardId, footerId, iconId) {
    const card = document.getElementById(cardId);
    const icon = document.getElementById(iconId);

    if (card) {
        card.style.opacity = '0.75';
        card.style.border = '1px dashed rgba(245, 158, 11, 0.4)';
        card.style.pointerEvents = 'none';
        card.style.cursor = 'not-allowed';
        card.removeAttribute('href');
        card.setAttribute('title', 'Khu vực giới hạn theo phân quyền dự án ISO 19650');
    }

    if (icon) {
        icon.className = 'fa-solid fa-lock text-sm text-amber-400 animate-pulse';
    }
}

function lockButtonItem(btnId, iconId) {
    const btn = document.getElementById(btnId);
    const icon = document.getElementById(iconId);

    if (btn) {
        btn.style.opacity = '0.75';
        btn.style.background = 'rgba(15, 23, 42, 0.8)';
        btn.style.border = '1px dashed rgba(245, 158, 11, 0.4)';
        btn.style.boxShadow = 'none';
        btn.style.pointerEvents = 'none';
        btn.style.cursor = 'not-allowed';
        btn.removeAttribute('href');
        btn.setAttribute('title', 'Khu vực giới hạn theo phân quyền dự án ISO 19650');
    }

    if (icon) {
        icon.className = 'fa-solid fa-lock text-[10px] text-amber-400 animate-pulse';
    }
}