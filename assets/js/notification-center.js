(() => {
    const NOTIFICATIONS_URL = '/assets/data/notifications.json';
    const colorClasses = {
        blue: 'bg-blue-500/10 text-blue-500',
        emerald: 'bg-emerald-500/10 text-emerald-500',
        amber: 'bg-amber-500/10 text-amber-500',
        purple: 'bg-purple-500/10 text-purple-500',
        rose: 'bg-rose-500/10 text-rose-500'
    };
    let activeNotifications = [];
    let loadError = '';

    function createModal() {
        if (document.getElementById('notificationModal')) return;

        const modal = document.createElement('div');
        modal.id = 'notificationModal';
        modal.className = 'fixed inset-0 bg-slate-950/80 backdrop-blur-md hidden flex-col justify-end sm:justify-center items-center z-[100] transition-all';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'notificationModalTitle');
        modal.innerHTML = `
            <div id="notificationModalContent" class="bg-white dark:bg-slate-900 border-0 sm:border border-slate-200/80 dark:border-slate-800/80 w-full h-full sm:h-auto sm:max-w-lg p-6 sm:p-7 pb-24 sm:pb-7 rounded-none sm:rounded-3xl shadow-2xl relative flex flex-col justify-between transform translate-y-full transition-transform duration-300 ease-out overflow-y-auto no-scrollbar max-h-screen">
                <div>
                    <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
                        <h3 id="notificationModalTitle" class="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
                            <span class="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-sm"><i class="fa-solid fa-bell"></i></span>
                            Thông báo hệ thống
                        </h3>
                        <button type="button" class="text-slate-400 hover:text-slate-700 dark:hover:text-white p-2" data-close-notifications aria-label="Đóng thông báo">✕</button>
                    </div>
                    <div id="notificationList" class="space-y-3 text-xs" aria-live="polite"></div>
                </div>
                <div class="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button type="button" data-close-notifications class="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white rounded-xl shadow-lg shadow-blue-500/25 transition-all">Đóng thông báo</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', event => {
            if (event.target === modal || event.target.closest('[data-close-notifications]')) {
                window.toggleNotificationModal(false);
            }
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
                window.toggleNotificationModal(false);
            }
        });
    }

    function updateIndicator() {
        const indicator = document.getElementById('notificationIndicator');
        if (indicator) indicator.classList.toggle('hidden', activeNotifications.length === 0);
    }

    function renderNotifications() {
        const list = document.getElementById('notificationList');
        if (!list) return;
        list.replaceChildren();

        if (loadError) {
            const error = document.createElement('p');
            error.className = 'p-4 rounded-2xl bg-rose-500/10 text-rose-500';
            error.textContent = loadError;
            list.appendChild(error);
            return;
        }

        if (!activeNotifications.length) {
            const empty = document.createElement('p');
            empty.className = 'p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400';
            empty.textContent = 'Hiện chưa có thông báo.';
            list.appendChild(empty);
            return;
        }

        activeNotifications.forEach(notification => {
            const card = document.createElement('article');
            card.className = 'p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-start gap-3';

            const iconBox = document.createElement('div');
            const color = colorClasses[notification.color] || colorClasses.blue;
            iconBox.className = `w-8 h-8 rounded-xl ${color} flex items-center justify-center shrink-0 mt-0.5`;
            const icon = document.createElement('i');
            const iconName = /^fa-[a-z0-9-]+$/.test(notification.icon || '') ? notification.icon : 'fa-circle-info';
            icon.className = `fa-solid ${iconName} text-xs`;
            iconBox.appendChild(icon);

            const content = document.createElement('div');
            content.className = 'min-w-0 flex-1';
            const header = document.createElement('div');
            header.className = 'flex items-center justify-between gap-3';
            const title = document.createElement('h4');
            title.className = 'font-bold text-slate-900 dark:text-white text-xs';
            title.textContent = notification.title;
            const date = document.createElement('span');
            date.className = 'text-[9px] text-slate-400 shrink-0';
            const timestamp = Date.parse(notification.updatedAt || notification.createdAt || '');
            date.textContent = Number.isNaN(timestamp)
                ? ''
                : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(timestamp);
            header.append(title, date);

            const message = document.createElement('p');
            message.className = 'text-slate-600 dark:text-slate-300 text-[11px] mt-1 leading-relaxed whitespace-pre-wrap break-words';
            message.textContent = notification.message;
            content.append(header, message);
            card.append(iconBox, content);
            list.appendChild(card);
        });
    }

    async function loadNotifications() {
        try {
            const response = await fetch(`${NOTIFICATIONS_URL}?_=${Date.now()}`, {
                headers: { Accept: 'application/json' },
                cache: 'no-store'
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!data || !Array.isArray(data.notifications)) {
                throw new Error('Dữ liệu notifications.json không đúng định dạng.');
            }
            activeNotifications = data.notifications.filter(item =>
                item && item.active !== false &&
                typeof item.title === 'string' && typeof item.message === 'string'
            );
            loadError = '';
        } catch (error) {
            activeNotifications = [];
            loadError = 'Không tải được thông báo hệ thống. Vui lòng thử lại sau.';
            console.error('[CDE] Không tải được notifications.json:', error);
        }
        updateIndicator();
        renderNotifications();
    }

    window.toggleNotificationModal = function (show) {
        createModal();
        const modal = document.getElementById('notificationModal');
        const content = document.getElementById('notificationModalContent');
        if (show) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            requestAnimationFrame(() => {
                content.classList.remove('translate-y-full');
                content.classList.add('translate-y-0');
            });
            loadNotifications();
        } else {
            content.classList.remove('translate-y-0');
            content.classList.add('translate-y-full');
            setTimeout(() => {
                modal.classList.remove('flex');
                modal.classList.add('hidden');
            }, 300);
        }
    };

    function initialize() {
        createModal();
        loadNotifications();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
