/**
 * chat-client.js — Chat nhóm realtime cho CDE Master
 *
 * Sử dụng trong trang:
 *   <script src="/assets/js/chat-client.js"></script>
 *   CdeChat.init({
 *       apiBase: () => DATA_SERVER_API,
 *       getUser: () => JSON.parse(localStorage.getItem('currentUser') || '{}')
 *   });
 *   CdeChat.toggle();   // mở / đóng khung chat
 *
 * Phần tử có thuộc tính [data-chat-trigger] sẽ tự có badge tin chưa đọc.
 */
(function () {
    'use strict';
    if (window.CdeChat) return;

    const DND_KEY = 'cde_chat_dnd';
    const READ_KEY = 'cde_chat_lastread_';
    let OPEN_KEY = 'cde_chat_open';   // sessionStorage: khung chat đang mở
    let DRAFT_KEY = 'cde_chat_draft'; // sessionStorage: nội dung đang soạn
    const MAX_RENDERED = 200;
    const POPUP_MS = 6000;
    const MAX_POPUPS = 3;

    const S = {
        apiBase: () => '',
        getUser: () => ({}),
        user: null,
        messages: [],
        seen: new Set(),
        online: [],
        es: null,
        everConnected: false,
        retryTimer: null,
        open: false,
        unread: 0,
        baseTitle: '',
        sending: false,
        room: 'general',      // 'general' = chat chung; 'site' = nhóm công trường
        title: 'Chat nhóm',
        denied: false,
        lastRendered: null,
        built: false,
        sheet: 'half',      // mobile: 'half' = nửa màn hình, 'full' = gần toàn màn hình
        prevActive: null    // mục bottom-nav đang active trước khi mở chat
    };

    const $ = (id) => document.getElementById(id);

    // ---------- Tiện ích ----------
    function esc(str) {
        return String(str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function linkify(escaped) {
        return escaped.replace(/(https?:\/\/[^\s<]+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    }

    function hashColor(name) {
        let h = 0;
        for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
        return `hsl(${h % 360}, 65%, 60%)`;
    }

    function initials(name) {
        const parts = String(name).trim().split(/\s+/);
        const last = parts[parts.length - 1] || '?';
        return last.charAt(0).toUpperCase();
    }

    function fmtTime(ts) {
        return new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    function dayKey(ts) {
        const d = new Date(ts);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }

    function dayLabel(ts) {
        const today = new Date();
        const yest = new Date(Date.now() - 86400000);
        if (dayKey(ts) === dayKey(today.getTime())) return 'Hôm nay';
        if (dayKey(ts) === dayKey(yest.getTime())) return 'Hôm qua';
        return new Date(ts).toLocaleDateString('vi-VN');
    }

    // ---------- Không làm phiền ----------
    function readDnd() {
        try {
            const d = JSON.parse(localStorage.getItem(DND_KEY) || 'null');
            if (!d || d.mode === 'off') return { mode: 'off', until: 0 };
            if (d.mode !== 'forever' && Date.now() >= d.until) {
                localStorage.removeItem(DND_KEY);
                return { mode: 'off', until: 0 };
            }
            return d;
        } catch (e) { return { mode: 'off', until: 0 }; }
    }

    function isDnd() { return readDnd().mode !== 'off'; }

    function setDnd(mode) {
        if (mode === 'off') {
            localStorage.removeItem(DND_KEY);
        } else {
            let until = 0;
            if (mode === '30') until = Date.now() + 30 * 60000;
            else if (mode === '60') until = Date.now() + 60 * 60000;
            else if (mode === 'today') {
                const end = new Date();
                end.setHours(24, 0, 0, 0);
                until = end.getTime();
            }
            localStorage.setItem(DND_KEY, JSON.stringify({ mode, until }));
        }
        refreshDndUi();
        updateBadges();
    }

    const ICON_BELL = '<svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>';
    const ICON_BELL_OFF = '<svg viewBox="0 0 24 24"><path d="M20 18.69L7.84 6.14 5.27 3.49 4 4.76l2.8 2.8v.01c-.52.99-.8 2.16-.8 3.42v5l-2 2v1h13.73l2 2L21 19.72l-1-1.03zM12 22c1.11 0 2-.89 2-2h-4c0 1.11.89 2 2 2zm6-7.32V11c0-3.08-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68c-.15.03-.29.08-.42.12-.1.03-.2.07-.3.11h-.01c-.01 0-.01 0-.02.01-.23.09-.46.2-.68.31 0 0-.01 0-.01.01L18 14.68z"/></svg>';

    // Chuông thường = nhận thông báo; chuông gạch chéo = Không làm phiền
    function refreshDndUi() {
        const bell = $('cdeChatBell');
        if (!bell) return;
        const d = readDnd();
        const dnd = d.mode !== 'off';
        bell.innerHTML = dnd ? ICON_BELL_OFF : ICON_BELL;
        bell.classList.toggle('dnd', dnd);
        if (!dnd) {
            bell.title = 'Đang nhận thông báo tin mới - bấm để bật Không làm phiền';
        } else if (d.mode === 'forever') {
            bell.title = 'Đang Không làm phiền - bấm để nhận thông báo lại';
        } else {
            bell.title = 'Không làm phiền đến ' + fmtTime(d.until) + ' - bấm để nhận thông báo lại';
        }
        bell.setAttribute('aria-pressed', String(dnd));
        bell.setAttribute('aria-label', bell.title);
    }

    // ---------- Chưa đọc & badge ----------
    function rk() { return READ_KEY + (S.room === 'general' ? '' : S.room + '_') + S.user.username; }

    function lastRead() {
        return parseInt(localStorage.getItem(rk()) || '0', 10);
    }

    function markRead() {
        const latest = S.messages.length ? S.messages[S.messages.length - 1].ts : Date.now();
        localStorage.setItem(rk(), String(latest));
        S.unread = 0;
        updateBadges();
    }

    function recomputeUnread() {
        const lr = lastRead();
        S.unread = S.messages.filter(m => m.username !== S.user.username && m.ts > lr).length;
        updateBadges();
    }

    function updateBadges() {
        const dnd = isDnd();
        document.querySelectorAll('[data-chat-trigger]').forEach(el => {
            let b = el.querySelector('.cdechat-badge');
            if (!b) {
                if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
                b = document.createElement('span');
                b.className = 'cdechat-badge';
                el.appendChild(b);
            }
            b.textContent = S.unread > 99 ? '99+' : String(S.unread);
            b.hidden = S.unread === 0;
            b.classList.toggle('muted', dnd);
        });
        document.title = (S.unread > 0 ? `(${S.unread > 99 ? '99+' : S.unread}) ` : '') + S.baseTitle;
    }

    // ---------- Giao diện ----------
    function injectStyles() {
        const css = `
        .cdechat-panel [hidden], .cdechat-popups [hidden], .cdechat-badge[hidden] { display: none !important; }
        .cdechat-panel { display: flex; position: fixed; right: 16px; bottom: 16px; width: 380px;
            height: min(560px, calc(100vh - 90px)); background: var(--bg-card, #0f172a);
            border: 1px solid var(--border-color, #1e293b); border-radius: 10px; z-index: 100001;
            flex-direction: column; overflow: hidden; color: var(--text-main, #94a3b8);
            box-shadow: 0 20px 40px -8px rgba(0,0,0,.5); font-size: 0.78rem;
            transform: translateY(120%); opacity: 0; visibility: hidden;
            transition: transform 400ms cubic-bezier(0.25, 1, 0.5, 1), opacity 400ms ease, visibility 400ms; }
        .cdechat-panel.open { transform: translateY(0); opacity: 1; visibility: visible; }
        .cdechat-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px;
            border-bottom: 1px solid var(--border-color, #1e293b); gap: 8px; }
        .cdechat-title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.85rem;
            color: var(--text-heading, #f1f5f9); min-width: 0; }
        .cdechat-dot { width: 8px; height: 8px; border-radius: 50%; background: #64748b; flex: none; }
        .cdechat-dot.on { background: #34d399; }
        .cdechat-dot.off { background: #ef4444; }
        .cdechat-online { background: none; border: 1px solid var(--border-color, #1e293b); color: var(--text-main, #94a3b8);
            border-radius: 999px; padding: 2px 8px; font-size: 0.68rem; cursor: pointer; font-weight: 500; }
        .cdechat-online:hover { border-color: var(--primary, #38bdf8); }
        .cdechat-actions { display: flex; align-items: center; gap: 2px; flex: none; }
        .cdechat-bell { background: none; border: none; cursor: pointer; padding: 4px 6px; border-radius: 6px;
            color: var(--text-muted, #64748b); display: inline-flex; align-items: center; }
        .cdechat-bell:hover { background: var(--bg-input, #131b2e); color: var(--text-heading, #f1f5f9); }
        .cdechat-bell.dnd { color: #fbbf24; }
        .cdechat-bell svg { width: 18px; height: 18px; fill: currentColor; }
        .cdechat-x { background: none; border: none; color: var(--text-muted, #64748b); cursor: pointer; font-size: 1rem; padding: 2px 6px; }
        .cdechat-x:hover { color: var(--text-heading, #f1f5f9); }
        .cdechat-onlinelist { padding: 8px 12px; border-bottom: 1px solid var(--border-color, #1e293b);
            display: flex; flex-wrap: wrap; gap: 6px; max-height: 90px; overflow-y: auto; }
        .cdechat-chip { display: inline-flex; align-items: center; gap: 5px; background: var(--bg-input, #131b2e);
            border-radius: 999px; padding: 2px 8px; font-size: 0.68rem; color: var(--text-heading, #f1f5f9); }
        .cdechat-chip i { width: 6px; height: 6px; border-radius: 50%; background: #34d399; display: inline-block; }
        .cdechat-body { flex: 1; min-height: 0; overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;
            overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
        .cdechat-grab { display: none; }
        .cdechat-empty { margin: auto; text-align: center; color: var(--text-muted, #64748b); padding: 20px; }
        .cdechat-day { align-self: center; font-size: 0.64rem; color: var(--text-muted, #64748b); margin: 8px 0 4px;
            background: var(--bg-input, #131b2e); border-radius: 999px; padding: 2px 10px; }
        .cdechat-msg { display: flex; flex-direction: column; max-width: 82%; }
        .cdechat-msg.mine { align-self: flex-end; align-items: flex-end; }
        .cdechat-msg.other { align-self: flex-start; align-items: flex-start; }
        .cdechat-msg.first { margin-top: 6px; }
        .cdechat-sender { font-size: 0.66rem; font-weight: 700; margin-bottom: 2px; padding-left: 2px; }
        .cdechat-bubble { padding: 6px 10px; border-radius: 12px; line-height: 1.4; word-break: break-word;
            white-space: pre-wrap; background: var(--bg-input, #131b2e); color: var(--text-heading, #f1f5f9); }
        .cdechat-msg.mine .cdechat-bubble { background: var(--primary-dark, #0284c7); color: #fff; }
        .cdechat-bubble a { color: inherit; text-decoration: underline; }
        .cdechat-time { font-size: 0.6rem; color: var(--text-muted, #64748b); margin-top: 2px; padding: 0 2px; }
        .cdechat-error { padding: 6px 12px; font-size: 0.7rem; color: #f87171; background: rgba(239,68,68,.1); }
        .cdechat-foot { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--border-color, #1e293b); align-items: flex-end; }
        .cdechat-foot textarea { flex: 1; resize: none; max-height: 100px; background: var(--bg-input, #131b2e);
            color: var(--text-heading, #f1f5f9); border: 1px solid var(--border-color, #1e293b); border-radius: 8px;
            padding: 7px 10px; font-size: 0.78rem; outline: none; font-family: inherit; line-height: 1.35; }
        .cdechat-foot textarea:focus { border-color: var(--primary, #38bdf8); }
        .cdechat-foot button { background: var(--primary-dark, #0284c7); color: #fff; border: none; border-radius: 8px;
            padding: 8px 14px; font-weight: 600; font-size: 0.75rem; cursor: pointer; }
        .cdechat-foot button:disabled { opacity: .5; cursor: not-allowed; }
        .cdechat-badge { position: absolute; top: -5px; right: -5px; min-width: 16px; height: 16px; padding: 0 4px;
            border-radius: 999px; background: #ef4444; color: #fff; font-size: 0.6rem; font-weight: 700;
            display: inline-flex; align-items: center; justify-content: center; line-height: 1; pointer-events: none; }
        .cdechat-badge.muted { background: #64748b; }
        .cdechat-popups { position: fixed; bottom: 16px; right: 16px; width: 320px; max-width: calc(100vw - 32px);
            display: flex; flex-direction: column; gap: 8px; z-index: 200001; pointer-events: none; }
        .cdechat-popups > * { pointer-events: auto; }
        .cdechat-popup { display: flex; gap: 10px; background: var(--bg-card, #0f172a); color: var(--text-main, #94a3b8);
            border: 1px solid var(--border-color, #1e293b); border-left: 3px solid var(--primary, #38bdf8);
            border-radius: 8px; padding: 10px 12px; cursor: pointer; box-shadow: 0 12px 24px rgba(0,0,0,.35);
            animation: cdechatIn .18s ease; position: relative; }
        .cdechat-avatar { width: 30px; height: 30px; border-radius: 50%; flex: none; display: flex; align-items: center;
            justify-content: center; font-weight: 700; color: #0b1220; font-size: 0.8rem; }
        .cdechat-pop-main { min-width: 0; flex: 1; }
        .cdechat-pop-name { font-weight: 700; font-size: 0.75rem; color: var(--text-heading, #f1f5f9); padding-right: 16px; }
        .cdechat-pop-text { font-size: 0.74rem; margin-top: 2px; overflow: hidden; display: -webkit-box;
            -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; }
        .cdechat-pop-dnd { margin-top: 6px; background: none; border: 1px solid var(--border-color, #1e293b);
            color: var(--text-muted, #64748b); border-radius: 999px; font-size: 0.64rem; padding: 2px 8px; cursor: pointer; }
        .cdechat-pop-dnd:hover { color: #fbbf24; border-color: #fbbf24; }
        .cdechat-pop-x { position: absolute; top: 4px; right: 6px; background: none; border: none;
            color: var(--text-muted, #64748b); cursor: pointer; font-size: 0.8rem; }
        @keyframes cdechatIn { from { transform: translateX(30px); opacity: 0; } to { transform: none; opacity: 1; } }
        @media (max-width: 1024px) {
            /* Bottom sheet: trượt từ dưới lên, nằm TRÊN thanh bottom-nav (không đè lên), phần trang phía trên vẫn thao tác được */
            .cdechat-panel { left: 0; right: 0; top: auto; width: 100%;
                bottom: var(--cc-bottom, 0px); height: var(--cc-height, 60vh);
                max-height: calc(100dvh - var(--cc-bottom, 0px) - env(safe-area-inset-top, 0px) - 8px);
                border-radius: 16px 16px 0 0; border-width: 1px 0 0 0;
                box-shadow: 0 -10px 30px -6px rgba(0,0,0,.45);
                transform: translateY(calc(100% + var(--cc-bottom, 0px) + 24px));
                transition: transform 350ms cubic-bezier(0.22, 1, 0.36, 1), height 250ms ease, opacity 250ms ease, visibility 350ms; }
            .cdechat-panel.open { transform: translateY(0); }
            .cdechat-panel.dragging { transition: none; }
            .cdechat-grab { display: flex; justify-content: center; padding: 10px 0 4px; touch-action: none; cursor: grab; flex: none; }
            .cdechat-grab span { width: 40px; height: 4px; border-radius: 999px; background: var(--text-muted, #64748b); opacity: .55; }
            .cdechat-head { touch-action: none; padding: 6px 12px 8px; }
            .cdechat-foot textarea { font-size: 16px; } /* >=16px để iOS không tự phóng to khi focus */
            .cdechat-panel.flush .cdechat-foot { padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px)); }
            .cdechat-popups { top: calc(8px + env(safe-area-inset-top, 0px)); bottom: auto; left: 8px; right: 8px; width: auto; max-width: none; }
        }`;
        const style = document.createElement('style');
        style.id = 'cdeChatStyles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function buildUi() {
        injectStyles();
        const wrap = document.createElement('div');
        wrap.innerHTML = `
        <div id="cdeChatPanel" class="cdechat-panel" role="dialog" aria-label="Chat nhóm">
            <div class="cdechat-grab" id="cdeChatGrab" aria-hidden="true"><span></span></div>
            <div class="cdechat-head">
                <div class="cdechat-title">
                    <span class="cdechat-dot" id="cdeChatDot"></span>
                    <span id="cdeChatTitle">Chat nhóm</span>
                    <button class="cdechat-online" id="cdeChatOnlineBtn" type="button">0 online</button>
                </div>
                <div class="cdechat-actions">
                    <button class="cdechat-bell" id="cdeChatBell" type="button"></button>
                    <button class="cdechat-x" id="cdeChatClose" type="button" aria-label="Đóng">✕</button>
                </div>
            </div>
            <div class="cdechat-onlinelist" id="cdeChatOnlineList" hidden></div>
            <div class="cdechat-body" id="cdeChatBody"></div>
            <div class="cdechat-error" id="cdeChatError" hidden></div>
            <div class="cdechat-foot">
                <textarea id="cdeChatInput" rows="1" maxlength="2000" placeholder="Nhập tin nhắn..."></textarea>
                <button id="cdeChatSend" type="button">Gửi</button>
            </div>
        </div>
        <div class="cdechat-popups" id="cdeChatPopups"></div>`;
        while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

        $('cdeChatClose').addEventListener('click', close);
        $('cdeChatOnlineBtn').addEventListener('click', () => {
            const list = $('cdeChatOnlineList');
            list.hidden = !list.hidden;
        });
        $('cdeChatBell').addEventListener('click', () => setDnd(isDnd() ? 'off' : 'forever'));
        $('cdeChatSend').addEventListener('click', send);


        const input = $('cdeChatInput');
        input.addEventListener('keydown', (e) => {
            // Bỏ qua Enter khi đang gõ tiếng Việt bằng bộ gõ (IME)
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                send();
            }
        });
        input.addEventListener('input', () => {
            sessionStorage.setItem(DRAFT_KEY, input.value);
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && S.open) close();
        });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && S.open) markRead();
        });
        window.addEventListener('focus', () => { if (S.open) markRead(); });

        bindSheetDrag();
        const relayout = () => { if (S.open) applyLayout(); };
        window.addEventListener('resize', relayout);
        window.addEventListener('orientationchange', () => setTimeout(relayout, 250));
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', relayout);
            window.visualViewport.addEventListener('scroll', relayout);
        }
        input.addEventListener('focus', () => setTimeout(relayout, 300));

        S.built = true;
        refreshDndUi();
    }

    // ---------- Hiển thị tin nhắn ----------
    function setStatus(state, text) {
        const dot = $('cdeChatDot');
        if (dot) dot.className = 'cdechat-dot ' + state;
        const err = $('cdeChatError');
        if (!err) return;
        if (text) { err.textContent = text; err.hidden = false; } else { err.hidden = true; }
    }

    function renderMessage(m) {
        const body = $('cdeChatBody');
        const empty = body.querySelector('.cdechat-empty');
        if (empty) empty.remove();

        const prev = S.lastRendered;
        if (!prev || dayKey(prev.ts) !== dayKey(m.ts)) {
            const d = document.createElement('div');
            d.className = 'cdechat-day';
            d.textContent = dayLabel(m.ts);
            body.appendChild(d);
        }
        const mine = m.username === S.user.username;
        const sameSender = prev && prev.username === m.username && dayKey(prev.ts) === dayKey(m.ts) && (m.ts - prev.ts) < 5 * 60000;

        const el = document.createElement('div');
        el.className = 'cdechat-msg ' + (mine ? 'mine' : 'other') + (sameSender ? '' : ' first');
        let html = '';
        if (!mine && !sameSender) {
            html += `<div class="cdechat-sender" style="color:${hashColor(m.username)}">${esc(m.fullName || m.username)}</div>`;
        }
        html += `<div class="cdechat-bubble">${linkify(esc(m.text))}</div>`;
        html += `<div class="cdechat-time">${fmtTime(m.ts)}</div>`;
        el.innerHTML = html;
        body.appendChild(el);
        S.lastRendered = m;

        // Giới hạn số node hiển thị
        while (body.querySelectorAll('.cdechat-msg').length > MAX_RENDERED) {
            const first = body.querySelector('.cdechat-msg');
            if (first) first.remove(); else break;
        }
    }

    function renderEmptyIfNeeded() {
        const body = $('cdeChatBody');
        if (!S.messages.length && !body.children.length) {
            body.innerHTML = '<div class="cdechat-empty">Chưa có tin nhắn nào.<br>Hãy bắt đầu cuộc trò chuyện!</div>';
        }
    }

    function scrollToBottom() {
        const body = $('cdeChatBody');
        body.scrollTop = body.scrollHeight;
    }

    function renderPresence() {
        const btn = $('cdeChatOnlineBtn');
        const list = $('cdeChatOnlineList');
        if (!btn) return;
        btn.textContent = `${S.online.length} online`;
        list.innerHTML = S.online.map(u =>
            `<span class="cdechat-chip"><i></i>${esc(u.fullName || u.username)}${u.username === S.user.username ? ' (bạn)' : ''}</span>`
        ).join('') || '<span style="color:var(--text-muted)">Không có ai online</span>';
    }

    // ---------- Nhận tin ----------
    function onIncoming(msg, live) {
        if (!msg || !msg.id || S.seen.has(msg.id)) return;
        S.seen.add(msg.id);
        S.messages.push(msg);
        if (S.messages.length > 1000) S.messages.shift();

        const body = $('cdeChatBody');
        const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
        const mine = msg.username === S.user.username;
        renderMessage(msg);
        if (S.open && (nearBottom || mine)) scrollToBottom();

        if (!live) return;

        const viewing = S.open && !document.hidden;
        if (viewing) {
            markRead();
        } else if (!mine) {
            recomputeUnread();
            notify(msg);
        }
    }

    // ---------- Thông báo ----------
    function notify(msg) {
        if (isDnd()) return; // Đang bật Không làm phiền → chỉ tăng badge, không popup
        showPopup(msg);
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            try {
                const n = new Notification(msg.fullName || msg.username, {
                    body: msg.text.slice(0, 120),
                    tag: 'cde-chat'
                });
                n.onclick = () => { window.focus(); open(); n.close(); };
            } catch (e) { /* một số trình duyệt di động không hỗ trợ */ }
        }
    }

    function showPopup(msg) {
        const box = $('cdeChatPopups');
        while (box.children.length >= MAX_POPUPS) box.firstChild.remove();

        const name = msg.fullName || msg.username;
        const el = document.createElement('div');
        el.className = 'cdechat-popup';
        el.innerHTML = `
            <div class="cdechat-avatar" style="background:${hashColor(msg.username)}">${esc(initials(name))}</div>
            <div class="cdechat-pop-main">
                <div class="cdechat-pop-name">${esc(name)}</div>
                <div class="cdechat-pop-text">${esc(msg.text)}</div>
                <button class="cdechat-pop-dnd" type="button">🔕 Không làm phiền 1 giờ</button>
            </div>
            <button class="cdechat-pop-x" type="button" aria-label="Đóng">✕</button>`;

        const remove = () => { clearTimeout(timer); el.remove(); };
        const timer = setTimeout(remove, POPUP_MS);

        el.addEventListener('click', () => { remove(); open(); });
        el.querySelector('.cdechat-pop-x').addEventListener('click', (e) => { e.stopPropagation(); remove(); });
        el.querySelector('.cdechat-pop-dnd').addEventListener('click', (e) => {
            e.stopPropagation();
            setDnd('60');
            box.innerHTML = '';
        });
        box.appendChild(el);
    }

    // ---------- Kết nối ----------
    async function loadHistory() {
        const res = await fetch(`${S.apiBase()}/api/chat/history?limit=200&room=${encodeURIComponent(S.room)}&username=${encodeURIComponent(S.user.username)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { const err = new Error((data && data.message) || 'Không tải được lịch sử chat'); err.status = res.status; throw err; }
        if (data && Array.isArray(data.messages)) {
            data.messages.forEach(m => onIncoming(m, false));
        }
        renderEmptyIfNeeded();
        recomputeUnread();
    }

    function connect() {
        clearTimeout(S.retryTimer);
        if (S.es) { S.es.close(); S.es = null; }

        const url = `${S.apiBase()}/api/chat/stream?username=${encodeURIComponent(S.user.username)}&room=${encodeURIComponent(S.room)}`;
        const es = new EventSource(url);
        S.es = es;

        es.onopen = () => {
            setStatus('on', '');
            if (S.everConnected) loadHistory().catch(() => { }); // bù tin nhắn bị lỡ khi mất mạng
            S.everConnected = true;
        };
        es.addEventListener('chat', (e) => {
            try { onIncoming(JSON.parse(e.data), true); } catch (err) { /* bỏ qua */ }
        });
        es.addEventListener('presence', (e) => {
            try { S.online = JSON.parse(e.data); renderPresence(); } catch (err) { /* bỏ qua */ }
        });
        es.onerror = () => {
            setStatus('off', 'Mất kết nối chat, đang thử kết nối lại...');
            if (es.readyState === EventSource.CLOSED) {
                // Server từ chối hoặc không phản hồi → tự thử lại sau 10 giây
                S.retryTimer = setTimeout(connect, 10000);
            }
        };
    }

    // ---------- Gửi tin ----------
    async function send() {
        const input = $('cdeChatInput');
        const text = input.value.trim();
        if (!text || S.sending) return;

        S.sending = true;
        $('cdeChatSend').disabled = true;
        input.value = '';
        sessionStorage.removeItem(DRAFT_KEY);
        input.style.height = 'auto';

        try {
            const res = await fetch(`${S.apiBase()}/api/chat/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: S.user.username, text, room: S.room })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.message || 'Không gửi được tin nhắn');
            setStatus(S.es && S.es.readyState === EventSource.OPEN ? 'on' : 'off', '');
            onIncoming(data.message, true);
        } catch (err) {
            input.value = text; // trả lại nội dung để người dùng gửi lại
            sessionStorage.setItem(DRAFT_KEY, text);
            setStatus('off', err.message === 'Failed to fetch' ? 'Không kết nối được server chat' : err.message);
        } finally {
            S.sending = false;
            $('cdeChatSend').disabled = false;
            input.focus();
        }
    }

    // ---------- Bottom sheet (điện thoại / máy tính bảng) ----------
    function isMobile() { return window.matchMedia('(max-width: 1024px)').matches; }

    // Đo chiều cao thanh bottom-nav + bàn phím ảo để sheet luôn nằm gọn phía trên, không che nút nào
    function applyLayout() {
        const panel = $('cdeChatPanel');
        if (!panel) return;
        if (!isMobile()) {
            panel.style.removeProperty('--cc-bottom');
            panel.style.removeProperty('--cc-height');
            panel.style.transform = '';
            panel.classList.remove('flush');
            return;
        }
        const vv = window.visualViewport;
        const vh = vv ? vv.height : window.innerHeight;
        const kb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
        const keyboard = kb > 120;

        let bottom = 0;
        if (keyboard) {
            bottom = kb;                       // bàn phím đang mở: dính sát mép trên bàn phím
        } else {
            const nav = document.querySelector('.bottom-nav');
            if (nav) {
                const cs = getComputedStyle(nav);
                const r = nav.getBoundingClientRect();
                if (cs.display !== 'none' && cs.visibility !== 'hidden' && r.height > 0 && r.top < window.innerHeight) {
                    bottom = Math.max(0, Math.round(window.innerHeight - r.top));
                }
            }
        }
        const avail = Math.max(160, (keyboard ? vh : vh - bottom) - 8);
        const h = (S.sheet === 'full' || keyboard)
            ? avail
            : Math.min(avail, Math.max(Math.round(avail * 0.62), 340));
        panel.style.setProperty('--cc-bottom', bottom + 'px');
        panel.style.setProperty('--cc-height', h + 'px');
        panel.classList.toggle('flush', bottom === 0 && !keyboard);
    }

    function setSheet(state) {
        S.sheet = state;
        applyLayout();
    }

    // Vuốt xuống ở thanh tay nắm/tiêu đề: thu nhỏ hoặc đóng. Vuốt lên: mở rộng. Chạm tay nắm: đổi cỡ.
    function bindSheetDrag() {
        const panel = $('cdeChatPanel');
        const zones = [$('cdeChatGrab'), panel.querySelector('.cdechat-head')];
        let startY = 0, lastY = 0, lastT = 0, vel = 0, active = false;

        zones.forEach(zone => {
            zone.addEventListener('pointerdown', (e) => {
                if (!isMobile() || e.target.closest('button')) return;
                active = true;
                startY = lastY = e.clientY;
                lastT = performance.now();
                vel = 0;
                try { zone.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
                panel.classList.add('dragging');
            });
            zone.addEventListener('pointermove', (e) => {
                if (!active) return;
                const now = performance.now();
                vel = (e.clientY - lastY) / Math.max(1, now - lastT);
                lastY = e.clientY;
                lastT = now;
                const dy = e.clientY - startY;
                panel.style.transform = dy > 0 ? `translateY(${dy}px)` : '';
            });
            const end = (e) => {
                if (!active) return;
                active = false;
                panel.classList.remove('dragging');
                panel.style.transform = '';
                const dy = e.clientY - startY;
                if (Math.abs(dy) < 6 && zone.id === 'cdeChatGrab') {
                    setSheet(S.sheet === 'full' ? 'half' : 'full');
                } else if (dy > 80 || vel > 0.6) {
                    if (S.sheet === 'full' && dy < 220 && vel < 1.2) setSheet('half'); else close();
                } else if (dy < -50 || vel < -0.6) {
                    setSheet('full');
                }
            };
            zone.addEventListener('pointerup', end);
            zone.addEventListener('pointercancel', end);
        });
    }

    // Đồng bộ trạng thái "active" của thanh bottom-nav với việc mở/đóng chat
    function navMarkChat(on) {
        const nav = document.querySelector('.bottom-nav');
        if (!nav) return;
        if (on) {
            S.prevActive = Array.from(nav.querySelectorAll('.bottom-nav-item.active')).filter(el => !el.hasAttribute('data-chat-trigger'));
            S.prevActive.forEach(el => el.classList.remove('active'));
            nav.querySelectorAll('[data-chat-trigger]').forEach(el => el.classList.add('active'));
        } else {
            nav.querySelectorAll('[data-chat-trigger]').forEach(el => el.classList.remove('active'));
            if (S.prevActive && !nav.querySelector('.bottom-nav-item.active')) S.prevActive.forEach(el => el.classList.add('active'));
            S.prevActive = null;
        }
    }

    // ---------- Mở / đóng ----------
    function open(opts) {
        if (!S.user) return;
        const wasOpen = S.open;
        S.open = true;
        sessionStorage.setItem(OPEN_KEY, '1');
        const panel = $('cdeChatPanel');
        const mobile = isMobile();
        if (mobile && !wasOpen) S.sheet = 'half';
        applyLayout();
        if (panel) panel.classList.add('open');
        if (!wasOpen) navMarkChat(true);
        // Không khóa cuộn trang: phần phía trên sheet vẫn thao tác bình thường
        $('cdeChatPopups').innerHTML = '';
        markRead();
        scrollToBottom();
        if (!mobile) $('cdeChatInput').focus(); // trên điện thoại không tự bật bàn phím (tránh giật layout)
        if (!(opts && opts.silent) && 'Notification' in window && Notification.permission === 'default') {
            try { Notification.requestPermission(); } catch (e) { /* ignore */ }
        }
    }

    function close() {
        const wasOpen = S.open;
        S.open = false;
        sessionStorage.setItem(OPEN_KEY, '0');
        const panel = $('cdeChatPanel');
        if (panel) {
            panel.classList.remove('open', 'dragging');
            panel.style.transform = '';
            if (panel.contains(document.activeElement)) document.activeElement.blur(); // hạ bàn phím ảo
        }
        if (wasOpen) navMarkChat(false);
        document.querySelectorAll('[data-chat-trigger].active').forEach(el => el.classList.remove('active'));
    }

    function toggle() { S.open ? close() : open(); }

    // ---------- Khởi tạo ----------
    async function init(opts) {
        opts = opts || {};
        if (typeof opts.apiBase === 'function') S.apiBase = opts.apiBase;
        if (typeof opts.getUser === 'function') S.getUser = opts.getUser;

        if (opts.room) S.room = String(opts.room);
        if (opts.title) S.title = String(opts.title);
        if (S.room !== 'general') { OPEN_KEY += '_' + S.room; DRAFT_KEY += '_' + S.room; }

        const u = S.getUser() || {};
        if (!u.username) return; // chưa đăng nhập → không bật chat
        S.user = { username: u.username, fullName: u.fullName || u.username };
        S.baseTitle = document.title;

        if (!S.built) buildUi();
        $('cdeChatTitle').textContent = S.title;
        updateBadges();

        setInterval(() => { refreshDndUi(); updateBadges(); }, 20000); // tự hết hạn "Không làm phiền"

        try { await loadHistory(); } catch (e) {
            if (e && e.status === 403) S.denied = true; // không thuộc nhóm → không mở kênh realtime
            setStatus('off', e && e.message && e.message !== 'Failed to fetch' ? e.message : 'Không kết nối được server chat');
            renderEmptyIfNeeded();
        }
        if (!S.denied) connect();

        // Trang vừa tải lại (F5, Live Server reload...) mà khung chat đang mở → mở lại, giữ nguyên bản nháp
        // Chỉ khôi phục trên máy tính; điện thoại luôn khởi động với chat đóng (tránh bị chặn màn hình sau khi tải lại)
        if (sessionStorage.getItem(OPEN_KEY) === '1' && !isMobile()) {
            const draft = sessionStorage.getItem(DRAFT_KEY);
            if (draft) $('cdeChatInput').value = draft;
            open({ silent: true });
        }
    }

    window.CdeChat = { init, open, close, toggle, isDnd, setDnd };
})();