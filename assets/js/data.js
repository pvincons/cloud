//----------------------------------------------
// *** Script quản lý file dữ liệu CDE/data ***
//----------------------------------------------

const configuredCdeApi = typeof CONFIG !== 'undefined' && CONFIG.CDE_API
    ? CONFIG.CDE_API.replace(/\/api\/?$/, '')
    : 'https://api.pvincons.cloud';
const savedCdeApi = localStorage.getItem('cde_api_url') || '';
const isLocalAuthServer = typeof isLocal !== 'undefined' && isLocal;
let DATA_SERVER_API = isLocalAuthServer &&
    savedCdeApi.replace(/\/+$/, '') === 'https://api.pvincons.cloud'
    ? configuredCdeApi
    : savedCdeApi || configuredCdeApi;
if (isLocalAuthServer && DATA_SERVER_API === configuredCdeApi) {
    localStorage.setItem('cde_api_url', configuredCdeApi);
}
let currentPath = 'database/bim-vdc';
let fetchedItems = [];
let clipboard = null;
let xmlViewerRequestId = 0;
let editingMetadataPath = '';
let dataUserProjects = [];
let dataUserIsAdmin = false;

// Quản lý trạng thái mở rộng của cây thư mục (Set các path đang được mở)
const expandedFolders = new Set();
// Bộ nhớ tạm chứa con của các thư mục đã tải
const childItemsMap = new Map();

function canManageData() {
    try {
        const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
        return !!(user && user.username && localStorage.getItem('access_token'));
    } catch (error) {
        return false;
    }
}

function normalizeDataProjectName(name) {
    return String(name || '').replace(/\s+/g, '_').toLowerCase();
}

function canAccessDataPath(path) {
    if (dataUserIsAdmin) return true;
    const parts = String(path || '').replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts[0] !== 'database' || parts[1] !== 'bim-vdc' || !parts[2]) return false;
    const project = normalizeDataProjectName(parts[2]);
    return dataUserProjects.some(name => {
        const assigned = normalizeDataProjectName(name);
        return assigned !== 'all' && assigned !== normalizeDataProjectName('Tất cả dự án') && assigned === project;
    });
}

async function loadDataProjectAccess() {
    let user;
    try {
        user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    } catch (error) {
        user = null;
    }
    if (!user || !user.username) return;
    dataUserIsAdmin = [user.role, user.permission]
        .some(value => String(value || '').toUpperCase() === 'ADMIN');
    let projects = typeof user.projects === 'string' ? user.projects : '';
    try {
        const response = await fetch(`${CONFIG.CDE_API}/auth/me`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` }
        });
        if (!response.ok) throw new Error(`Lỗi tải hồ sơ (${response.status})`);
        const result = await response.json();
        const profile = result.user;
        if (profile && profile.username === user.username) {
            if (typeof profile.projects === 'string') projects = profile.projects;
            dataUserIsAdmin = [profile.role, profile.permission]
                .some(value => String(value || '').toUpperCase() === 'ADMIN');
        }
    } catch (error) {
        console.warn('Không thể tải quyền dự án từ backend:', error);
    }
    dataUserProjects = projects.split(',').map(project => project.trim()).filter(Boolean);
}

function getCdeAuthHeaders(headers = {}) {
    if (!canManageData()) throw new Error('Vui lòng đăng nhập để thao tác trong trình duyệt dữ liệu CDE.');
    const token = localStorage.getItem('access_token') || '';
    if (!token) throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
    return { ...headers, Authorization: `Bearer ${token}` };
}

async function fetchCdeMutation(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: getCdeAuthHeaders(options.headers || {})
    });
    if (response.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('currentUser');
        alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        window.location.href = '../../index.html';
    }
    return response;
}

// KÊNH ĐỒNG BỘ THỜI GIAN THỰC (BROADCAST CHANNEL)
const cdeSyncChannel = new BroadcastChannel('pvincons_cde_sync_channel');

cdeSyncChannel.onmessage = (event) => {
    if (event.data && event.data.type === 'REFRESH_CDE_DATA') {
        loadCDEFiles(currentPath);
    }
};

document.addEventListener('DOMContentLoaded', function () {
    if (window.dataRouteAllowed !== true) return;
    loadDataProjectAccess().then(() => {
        if (!canManageData()) return;
        document.getElementById('apiServerUrlInput').value = DATA_SERVER_API;
        document.getElementById('fileMetadataForm').addEventListener('submit', saveFileMetadata);
        initThemeUI();
        loadCDEFiles(currentPath);
    });
});

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem(CDE_THEME_KEY, newTheme);
    initThemeUI();
}

function initThemeUI() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const desktopIcon = document.getElementById('desktopThemeIcon');
    const desktopText = document.getElementById('desktopThemeText');
    const mobileIcon = document.getElementById('mobileThemeIcon');

    if (currentTheme === 'light') {
        if (desktopIcon) desktopIcon.className = "fa-solid fa-moon text-blue-600";
        if (desktopText) desktopText.innerText = "Dark Mode";
        if (mobileIcon) mobileIcon.className = "fa-solid fa-moon text-blue-600";
    } else {
        if (desktopIcon) desktopIcon.className = "fa-solid fa-sun text-amber-400";
        if (desktopText) desktopText.innerText = "Light Mode";
        if (mobileIcon) mobileIcon.className = "fa-solid fa-sun text-amber-400";
    }
}

function toggleServerSettings() {
    document.getElementById('serverConfigPanel').classList.toggle('hidden');
}

function saveServerUrl() {
    const newUrl = document.getElementById('apiServerUrlInput').value.trim();
    if (newUrl) {
        DATA_SERVER_API = newUrl.replace(/\/$/, "");
        localStorage.setItem('cde_api_url', DATA_SERVER_API);
        alert('Đã cập nhật URL CDE Server: ' + DATA_SERVER_API);
        toggleServerSettings();
        loadCDEFiles(currentPath);
    }
}

function getFileUrl(itemPath) {
    if (!itemPath) return '#';
    const normalizedPath = String(itemPath).replace(/\\/g, '/');
    const rel = normalizedPath.replace(/^database\/bim-vdc\/?/, '');
    const parts = rel.split('/').filter(Boolean);
    const encodedParts = parts.map(p => encodeURIComponent(p));
    return `${DATA_SERVER_API}/files/${encodedParts.join('/')}`;
}

async function openProtectedCdeFile(filePath, fileName, download = false) {
    const popup = download ? null : window.open('about:blank', '_blank');
    if (!download && !popup) {
        alert('Trình duyệt đã chặn cửa sổ bật lên. Hãy cho phép mở tab mới.');
        return;
    }
    if (popup) popup.opener = null;
    try {
        const response = await fetch(getFileUrl(filePath), { headers: getCdeAuthHeaders() });
        if (!response.ok) throw new Error(`Không thể tải tệp (HTTP ${response.status}).`);
        const objectUrl = URL.createObjectURL(await response.blob());
        if (download) {
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } else {
            popup.location.replace(objectUrl);
        }
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
        if (popup) popup.close();
        alert(error.message || 'Không thể tải tệp.');
    }
}

async function openXmlViewer(filePath, fileName) {
    const modal = document.getElementById('xmlViewerModal');
    const title = document.getElementById('xmlViewerTitle');
    const status = document.getElementById('xmlViewerStatus');
    const content = document.querySelector('#xmlViewerContent code');
    const requestId = ++xmlViewerRequestId;

    title.textContent = fileName || 'Trình xem XML';
    status.textContent = 'Đang tải tệp XML...';
    status.className = 'mt-1 text-xs text-slate-400';
    content.textContent = '';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');

    try {
        const response = await fetch(getFileUrl(filePath), { headers: getCdeAuthHeaders() });
        if (!response.ok) throw new Error(`Không thể tải tệp (HTTP ${response.status}).`);

        const xmlText = await response.text();
        if (requestId !== xmlViewerRequestId) return;

        content.textContent = xmlText;
        const parsedXml = new DOMParser().parseFromString(xmlText, 'application/xml');
        const hasParseError = parsedXml.getElementsByTagName('parsererror').length > 0;
        status.textContent = hasParseError ? 'XML không hợp lệ; đang hiển thị nội dung gốc.' : 'XML hợp lệ';
        status.className = `mt-1 text-xs ${hasParseError ? 'text-amber-300' : 'text-emerald-400'}`;
    } catch (error) {
        if (requestId !== xmlViewerRequestId) return;
        status.textContent = error.message || 'Không thể tải tệp XML.';
        status.className = 'mt-1 text-xs text-rose-400';
    }
}

function closeXmlViewer() {
    xmlViewerRequestId++;
    const modal = document.getElementById('xmlViewerModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');
}

function formatMetadataDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
}

function openFileMetadataModal(filePath, fileName, metadata = {}) {
    editingMetadataPath = filePath;
    document.getElementById('fileMetadataName').textContent = fileName;
    document.getElementById('fileMetadataDescription').value = metadata.description || '';
    document.getElementById('fileMetadataStatus').value = metadata.status || 'PENDING';
    const error = document.getElementById('fileMetadataError');
    error.textContent = '';
    error.classList.add('hidden');
    const modal = document.getElementById('fileMetadataModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');
}

function closeFileMetadataModal() {
    editingMetadataPath = '';
    const modal = document.getElementById('fileMetadataModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');
}

async function saveFileMetadata(event) {
    event.preventDefault();
    if (!editingMetadataPath) return;

    const submit = document.getElementById('fileMetadataSubmit');
    const error = document.getElementById('fileMetadataError');
    submit.disabled = true;
    error.classList.add('hidden');
    try {
        if (!canAccessDataPath(editingMetadataPath)) {
            throw new Error('Bạn không được phân công tham gia dự án chứa tài liệu này.');
        }
        const response = await fetchCdeMutation(`${DATA_SERVER_API}/api/file-metadata`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
            },
            body: JSON.stringify({
                filePath: editingMetadataPath,
                description: document.getElementById('fileMetadataDescription').value,
                status: document.getElementById('fileMetadataStatus').value
            })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Không thể lưu thông tin tài liệu.');
        }
        closeFileMetadataModal();
        await loadCDEFiles(currentPath);
    } catch (saveError) {
        error.textContent = saveError.message || 'Không thể lưu thông tin tài liệu.';
        error.classList.remove('hidden');
    } finally {
        submit.disabled = false;
    }
}

async function fetchFolderContent(path) {
    const cleanPath = String(path).replace(/\\/g, '/');
    const response = await fetch(`${DATA_SERVER_API}/api/files?path=${encodeURIComponent(cleanPath)}`, {
        headers: getCdeAuthHeaders()
    });
    if (!response.ok) throw new Error(`Không thể đọc thư mục (HTTP ${response.status}).`);
    const rawItems = await response.json();
    const items = (rawItems || []).map(item => ({
        ...item,
        path: String(item.path || '').replace(/\\/g, '/')
    }));
    return cleanPath === 'database/bim-vdc'
        ? items.filter(item => canAccessDataPath(item.path))
        : items;
}

async function loadCDEFiles(path = 'database/bim-vdc') {
    if (!path || path === '' || path === '/') path = 'database/bim-vdc';

    const requestedPath = String(path).replace(/\\/g, '/');
    if (requestedPath !== 'database/bim-vdc' && !canAccessDataPath(requestedPath)) {
        alert('Bạn không được phân công tham gia dự án này.');
        return;
    }
    currentPath = requestedPath;

    document.getElementById('currentPathDisplay').textContent = currentPath;
    const loading = document.getElementById('cdeLoading');
    const errorState = document.getElementById('cdeErrorState');
    const emptyState = document.getElementById('cdeEmptyState');
    const fileList = document.getElementById('cdeFileList');
    const summaryText = document.getElementById('cdeSummaryText');

    loading.classList.remove('hidden');
    errorState.classList.add('hidden');
    emptyState.classList.add('hidden');
    fileList.innerHTML = '';

    renderBreadcrumbs(currentPath);

    try {
        fetchedItems = await fetchFolderContent(currentPath);
    } catch (error) {
        console.error('Không thể tải dữ liệu CDE:', error);
        errorState.classList.remove('hidden');
        loading.classList.add('hidden');
        summaryText.innerText = error.message;
        return;
    }
    loading.classList.add('hidden');

    if (!fetchedItems || fetchedItems.length === 0) {
        emptyState.classList.remove('hidden');
        summaryText.innerText = 'Thư mục trống';
        return;
    }

    summaryText.innerText = `Đã tải ${fetchedItems.length} mục trong ${currentPath}`;
    renderFileList(fetchedItems);
}

// Toggle Xổ/Thu gọn cây thư mục
async function toggleFolderExpand(path, event) {
    if (event) event.stopPropagation();
    const cleanPath = String(path).replace(/\\/g, '/');

    if (expandedFolders.has(cleanPath)) {
        expandedFolders.delete(cleanPath);
    } else {
        expandedFolders.add(cleanPath);
        if (!childItemsMap.has(cleanPath)) {
            const children = await fetchFolderContent(cleanPath);
            childItemsMap.set(cleanPath, children);
        }
    }
    renderFileList(fetchedItems);
}

// ===== MENU THAO TÁC XỔ XUỐNG (điện thoại) =====
function escAttr(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function closeRowMenu() {
    const m = document.getElementById('rowMenu');
    if (m) { m.classList.add('hidden'); m.dataset.owner = ''; }
}
function openRowMenu(btn, ev) {
    ev.stopPropagation();
    const m = document.getElementById('rowMenu');
    const owner = btn.dataset.path;
    if (!m.classList.contains('hidden') && m.dataset.owner === owner) { closeRowMenu(); return; }
    const { path, name, url } = btn.dataset, isDir = btn.dataset.dir === '1';
    let metadata = {};
    try { metadata = JSON.parse(btn.dataset.metadata || '{}'); } catch (error) { metadata = {}; }
    const entries = [
        isDir ? { i: 'fa-folder-open', t: 'Vào thư mục', f: () => navigateTo(path) }
            : { i: 'fa-eye', t: 'Xem', f: () => /\.xml$/i.test(name) ? openXmlViewer(path, name) : openProtectedCdeFile(path, name) },
        ...(!isDir ? [{ i: 'fa-circle-info', t: 'Thông tin tài liệu', f: () => openFileMetadataModal(path, name, metadata) }] : []),
        ...(isDir ? [] : [{
            i: 'fa-download', t: 'Tải về', f: () => openProtectedCdeFile(path, name, true)
        }]),
        { i: 'fa-link', t: 'Copy link', f: () => copyLink(url, name) },
        { i: 'fa-pen-to-square', t: 'Đổi tên', f: () => renameItem(path, name) },
        { i: 'fa-copy', t: 'Copy', f: () => copyToClipboard(path, name, 'copy') },
        { i: 'fa-scissors', t: 'Cut (di chuyển)', f: () => copyToClipboard(path, name, 'move') },
        'sep',
        { i: 'fa-trash-can', t: 'Xóa', danger: true, f: () => deleteItem(path, name) }
    ];
    m.innerHTML = '';
    entries.forEach(en => {
        if (en === 'sep') { const d = document.createElement('div'); d.className = 'row-menu-sep'; m.appendChild(d); return; }
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'row-menu-item' + (en.danger ? ' danger' : ''); b.setAttribute('role', 'menuitem');
        b.innerHTML = `<i class="fa-solid ${en.i}"></i><span>${en.t}</span>`;
        b.addEventListener('click', e => { e.stopPropagation(); closeRowMenu(); en.f(); });
        m.appendChild(b);
    });
    m.dataset.owner = owner;
    m.style.visibility = 'hidden'; m.classList.remove('hidden');
    const r = btn.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
    const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
    const top = (r.bottom + 4 + h > window.innerHeight - 8) ? Math.max(8, r.top - h - 4) : r.bottom + 4;
    m.style.left = left + 'px'; m.style.top = top + 'px'; m.style.visibility = '';
}
document.addEventListener('click', e => { if (!e.target.closest('#rowMenu')) closeRowMenu(); });
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeRowMenu();
        const xmlViewer = document.getElementById('xmlViewerModal');
        if (xmlViewer && !xmlViewer.classList.contains('hidden')) closeXmlViewer();
        const metadataModal = document.getElementById('fileMetadataModal');
        if (metadataModal && !metadataModal.classList.contains('hidden')) closeFileMetadataModal();
    }
});
window.addEventListener('resize', closeRowMenu);
window.addEventListener('scroll', closeRowMenu, true);

function renderFileList(items) {
    closeRowMenu();
    const fileList = document.getElementById('cdeFileList');
    fileList.innerHTML = '';

    // Render từng dòng theo dạng cây lồng nhau
    renderTreeItems(items, fileList, 0);
}

function renderTreeItems(items, container, depth = 0) {
    items.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-800/40 transition-colors group border-b border-white/5";

        const isDir = item.type === 'folder';
        const isXml = !isDir && /\.xml$/i.test(String(item.name || ''));
        const cleanPath = String(item.path || '').replace(/\\/g, '/');
        const isExpanded = expandedFolders.has(cleanPath);
        const iconHtml = getItemIcon(item.name, isDir, isExpanded);
        const fileUrl = getFileUrl(cleanPath);
        const metadata = item.metadata || {};
        const status = ['PENDING', 'APPROVED', 'REJECTED'].includes(metadata.status) ? metadata.status : 'PENDING';
        const statusLabel = { PENDING: 'Đang chờ', APPROVED: 'Phê duyệt', REJECTED: 'Từ chối' }[status];
        const statusClass = { PENDING: 'bg-amber-500/15 text-amber-300 border-amber-500/30', APPROVED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', REJECTED: 'bg-rose-500/15 text-rose-300 border-rose-500/30' }[status];

        const safePath = cleanPath.replace(/'/g, "\\'");
        const safePathArg = escAttr(JSON.stringify(cleanPath));
        const safeNameArg = escAttr(JSON.stringify(String(item.name || '')));
        const safeMetadata = escAttr(JSON.stringify(metadata));

        const paddingLeft = depth * 24 + 12; // Tính toán thụt lề cho từng cấp độ cây

        const clickHandler = isDir
            ? `toggleFolderExpand('${safePath}', event)`
            : isXml
                ? `openXmlViewer(${safePathArg}, ${safeNameArg})`
            : `openProtectedCdeFile(${safePathArg}, ${safeNameArg})`;

        tr.innerHTML = `
                    <td class="py-2.5 px-3">
                        <div class="flex items-center gap-2 cursor-pointer select-none" style="padding-left: ${paddingLeft}px" onclick="${clickHandler}">
                            ${isDir ? `
                                <button onclick="toggleFolderExpand('${safePath}', event)" class="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-amber-400 transition-colors shrink-0">
                                    <i class="fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-[11px]"></i>
                                </button>
                            ` : `<span class="w-5 shrink-0"></span>`}
                            <span class="text-base shrink-0">${iconHtml}</span>
                            <span class="font-medium group-hover:text-blue-400 transition-colors break-all text-xs">${escAttr(item.name)}</span>
                        </div>
                    </td>
                    <td class="max-w-xs px-3 py-2.5 text-slate-300">${isDir ? '<span class="text-slate-500">—</span>' : `<div class="text-slate-200 uppercase not-italic font-normal">${escAttr(metadata.title || '—')}</div><div class="mt-1">Mô tả: ${escAttr(metadata.description || '—')}</div>`}</td>
                    <td class="whitespace-nowrap px-3 py-2.5 text-right text-slate-400">${isDir ? '<span class="text-slate-500">—</span>' : `<div class="text-slate-300">Tác giả: ${escAttr(metadata.author || '—')}</div><div class="mt-1">Khởi tạo: ${escAttr(formatMetadataDate(metadata.createdAt))}<br>Cập nhật: ${escAttr(formatMetadataDate(metadata.updatedAt))}</div>`}</td>
                    <td class="px-3 py-2.5 text-center">${isDir ? '<span class="text-slate-500">—</span>' : `<span class="inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass}">${statusLabel}</span>`}</td>
                    <td class="py-2 px-3 text-right" onclick="event.stopPropagation()">
                        <button type="button" class="row-menu-btn w-9 h-9 inline-flex items-center justify-center rounded-lg bg-slate-800/80 border border-white/10 text-slate-300"
                            aria-label="Thao tác" aria-haspopup="menu"
                            data-path="${escAttr(cleanPath)}" data-name="${escAttr(item.name)}" data-url="${escAttr(fileUrl)}" data-dir="${isDir ? '1' : '0'}" data-metadata="${safeMetadata}"
                            onclick="openRowMenu(this, event)">
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                        </button>
                    </td>
                `;
        container.appendChild(tr);

        // Nếu thư mục đang được mở rộng, render tiếp các mục con lồng vào bên dưới
        if (isDir && isExpanded) {
            const children = childItemsMap.get(cleanPath) || [];
            if (children.length > 0) {
                renderTreeItems(children, container, depth + 1);
            } else {
                // Thư mục trống bên trong cây
                const emptyTr = document.createElement('tr');
                emptyTr.innerHTML = `
                            <td colspan="6" class="py-1.5 text-xs text-slate-500 italic" style="padding-left: ${(depth + 1) * 24 + 40}px">
                                (Thư mục trống)
                            </td>
                        `;
                container.appendChild(emptyTr);
            }
        }
    });
}

function getItemIcon(filename, isDirectory, isExpanded = false) {
    if (isDirectory) {
        return isExpanded
            ? '<i class="fa-solid fa-folder-open text-amber-400"></i>'
            : '<i class="fa-solid fa-folder text-amber-400"></i>';
    }
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'ifc') return '<i class="fa-solid fa-cube text-emerald-400"></i>';
    if (['rvt', 'rfa', 'rte'].includes(ext)) return '<i class="fa-solid fa-cube text-blue-400"></i>';
    if (['dwg', 'dxf'].includes(ext)) return '<i class="fa-solid fa-drafting-compass text-amber-400"></i>';
    if (ext === 'pdf') return '<i class="fa-solid fa-file-pdf text-rose-400"></i>';
    if (['doc', 'docx'].includes(ext)) return '<i class="fa-solid fa-file-word text-blue-500"></i>';
    if (['xls', 'xlsx'].includes(ext)) return '<i class="fa-solid fa-file-excel text-emerald-500"></i>';
    return '<i class="fa-solid fa-file text-slate-400"></i>';
}

function navigateTo(path) {
    const cleanPath = String(path).replace(/\\/g, '/');
    loadCDEFiles(cleanPath);
}

function renderBreadcrumbs(path) {
    const breadcrumbs = document.getElementById('cdeBreadcrumbs');
    let cleanPath = String(path || '').replace(/\\/g, '/');

    let html = `
                <button onclick="navigateTo('database/bim-vdc')" class="hover:text-blue-400 flex items-center gap-1 font-bold shrink-0">
                    <i class="fa-solid fa-database text-blue-400"></i> database/bim-vdc
                </button>
            `;

    if (cleanPath && cleanPath !== 'database/bim-vdc') {
        let relPath = cleanPath.replace(/^database\/bim-vdc\/?/, '');
        const parts = relPath.split('/').filter(Boolean);
        let accum = 'database/bim-vdc';

        parts.forEach((part, index) => {
            accum += '/' + part;
            const target = accum.replace(/'/g, "\\'");
            html += ` <span class="text-slate-500 shrink-0">/</span> `;
            if (index === parts.length - 1) {
                html += `<span class="text-blue-400 font-semibold shrink-0">${part}</span>`;
            } else {
                html += `<button onclick="navigateTo('${target}')" class="hover:text-blue-400 shrink-0">${part}</button>`;
            }
        });
    }
    breadcrumbs.innerHTML = html;
}

function filterCDEItems() {
    const query = document.getElementById('cdeSearchInput').value.toLowerCase().trim();
    if (!query) {
        renderFileList(fetchedItems);
        return;
    }
    const filtered = fetchedItems.filter(item => item.name.toLowerCase().includes(query));
    renderFileList(filtered);
}

function copyLink(url, name) {
    navigator.clipboard.writeText(url).then(() => {
        alert(`Đã sao chép đường dẫn của "${name}" vào bộ nhớ tạm!`);
    }).catch(err => {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            alert(`Đã sao chép đường dẫn của "${name}"!`);
        } catch (e) {
            alert("Không thể sao chép đường dẫn.");
        }
        document.body.removeChild(textArea);
    });
}

function copyToClipboard(sourcePath, name, action) {
    const cleanSourcePath = String(sourcePath).replace(/\\/g, '/');
    clipboard = { sourcePath: cleanSourcePath, name, action };
    updatePasteButtonState();
    const actionText = action === 'copy' ? 'Sao chép' : 'Cắt (Di chuyển)';
    alert(`Đã chọn ${actionText} "${name}". Hãy di chuyển tới thư mục đích và bấm nút "Dán"!`);
}

function updatePasteButtonState() {
    const btn = document.getElementById('btnPaste');
    const textEl = document.getElementById('pasteBtnText');
    if (!btn) return;

    if (clipboard) {
        btn.disabled = false;
        btn.className = "p-2 text-cyan-300 hover:text-white bg-cyan-600/40 hover:bg-cyan-600 rounded-lg text-xs transition-all border border-cyan-500/40 flex items-center gap-1.5 cursor-pointer shadow-lg animate-pulse";
        textEl.innerText = `Dán (${clipboard.action === 'copy' ? 'Sao chép' : 'Chuyển'}: ${clipboard.name})`;
    } else {
        btn.disabled = true;
        btn.className = "p-2 text-slate-500 bg-slate-800/50 rounded-lg text-xs border border-[var(--border-color)] flex items-center gap-1.5 cursor-not-allowed opacity-50";
        textEl.innerText = "Dán";
    }
}

async function pasteItem() {
    if (!clipboard) return;
    const targetPath = String(currentPath).replace(/\\/g, '/');
    if (!canAccessDataPath(clipboard.sourcePath) || !canAccessDataPath(targetPath)) {
        alert('Bạn chỉ được thao tác trong các dự án được phân công.');
        return;
    }
    const endpoint = clipboard.action === 'copy' ? `${DATA_SERVER_API}/api/copy` : `${DATA_SERVER_API}/api/move`;

    try {
        const res = await fetchCdeMutation(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourcePath: clipboard.sourcePath, targetDir: targetPath })
        });
        const data = await res.json();
        if (data.success) {
            if (clipboard.action === 'move') {
                clipboard = null;
                updatePasteButtonState();
            }
            cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
            await loadCDEFiles(targetPath);
        } else {
            alert("Lỗi: " + (data.error || "Thất bại"));
        }
    } catch (e) {
        alert(e.message || 'Không thể thực hiện thao tác trên CDE.');
    }
}

async function createNewFolder() {
    const folderName = prompt("Nhập tên thư mục mới cần tạo:");
    if (!folderName || !folderName.trim()) return;
    const targetPath = String(currentPath).replace(/\\/g, '/');
    if (!canAccessDataPath(targetPath)) {
        alert('Bạn chỉ được tạo thư mục trong dự án được phân công.');
        return;
    }

    try {
        const res = await fetchCdeMutation(`${DATA_SERVER_API}/api/create-folder`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
            },
            body: JSON.stringify({ parentPath: targetPath, folderName: folderName.trim() })
        });
        const data = await res.json();
        if (data.success) {
            cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
            await loadCDEFiles(targetPath);
        } else alert("Lỗi: " + (data.error || "Không thể tạo thư mục"));
    } catch (e) {
        alert(e.message || 'Không thể tạo thư mục trên CDE.');
    }
}

async function uploadSelectedFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const targetPath = String(currentPath).replace(/\\/g, '/');
    if (!canAccessDataPath(targetPath)) {
        alert('Bạn chỉ được tải tệp lên dự án được phân công.');
        event.target.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('targetPath', targetPath);
    formData.append('file', file);

    try {
        const res = await fetchCdeMutation(`${DATA_SERVER_API}/api/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}` },
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            event.target.value = '';
            cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
            await loadCDEFiles(targetPath);
        } else alert("Lỗi upload: " + (data.error || "Thất bại"));
    } catch (e) {
        alert("Không thể kết nối đến CDE Server!");
    }
}

async function renameItem(itemPath, currentName) {
    const newName = prompt("Nhập tên mới:", currentName);
    if (!newName || newName.trim() === '' || newName === currentName) return;
    const targetPath = String(currentPath).replace(/\\/g, '/');
    const cleanItemPath = String(itemPath).replace(/\\/g, '/');
    if (!canAccessDataPath(cleanItemPath)) {
        alert('Bạn không được phân công tham gia dự án chứa mục này.');
        return;
    }
    const projectSegments = cleanItemPath.replace(/^database\/bim-vdc\/?/, '').split('/').filter(Boolean);

    try {
        const res = await fetchCdeMutation(`${DATA_SERVER_API}/api/rename`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: cleanItemPath, newName: newName.trim() })
        });
        const data = await res.json();
        if (data.success) {
            if (projectSegments.length === 1) {
                dataUserProjects = dataUserProjects.map(project =>
                    normalizeDataProjectName(project) === normalizeDataProjectName(currentName)
                        ? newName.trim()
                        : project
                );
            }
            cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
            await loadCDEFiles(targetPath);
        } else alert("Lỗi: " + (data.error || "Không thể đổi tên"));
    } catch (e) {
        alert("Không thể kết nối đến CDE Server!");
    }
}

async function deleteItem(itemPath, itemName) {
    const cleanItemPath = String(itemPath).replace(/\\/g, '/');
    if (!canAccessDataPath(cleanItemPath)) {
        alert('Bạn không được phân công tham gia dự án chứa mục này.');
        return;
    }
    if (!confirm(`Bạn có chắc chắn muốn xóa "${itemName}" không?`)) return;
    const targetPath = String(currentPath).replace(/\\/g, '/');

    try {
        const res = await fetchCdeMutation(`${DATA_SERVER_API}/api/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: cleanItemPath })
        });
        const data = await res.json();
        if (data.success) {
            cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
            await loadCDEFiles(targetPath);
        } else alert("Lỗi: " + (data.error || "Không thể xóa"));
    } catch (e) {
        alert("Không thể kết nối đến CDE Server!");
    }
}

async function createNewProject() {
    if (!dataUserIsAdmin) {
        alert('Chỉ Admin mới được tạo dự án mới.');
        return;
    }
    const projectName = prompt("Nhập tên dự án mới cần khởi tạo (Ví dụ: Example_Project...):");
    if (!projectName || !projectName.trim()) return;
    const targetPath = String(currentPath).replace(/\\/g, '/');

    try {
        const res = await fetchCdeMutation(`${DATA_SERVER_API}/api/create-project`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentPath: targetPath, projectName: projectName.trim() })
        });
        const data = await res.json();

        if (data.success) {
            cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
            await loadCDEFiles(targetPath);
        } else {
            alert("Lỗi: " + (data.error || "Không thể tạo dự án"));
        }
    } catch (e) {
        alert("Không thể kết nối đến CDE Server!");
    }
}
