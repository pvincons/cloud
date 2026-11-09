let DATA_SERVER_API = localStorage.getItem('cde_api_url') || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://api.pvincons.cloud'
);

let currentRowElement = null;
let selectedFolderPathFilter = "";
let currentExt = "pdf";
let currentActiveFilePath = "";
let serverIssuesDB = {};
let serverRecallsDB = {};
let serverSignaturesDB = {};
let hideRecalledFilesFlag = false;
let attentionFilesOnly = false;

let currentUserRole = '';
let currentUserPermission = '';
let currentUserAssignedProjects = [];
let isUserAdmin = false;
let currentActiveUserFullName = 'TRẦN HOÀNG PHƯỚC';

let currentCredentialId = '';
let vnptSessionReady = false;
let fileTypeChartInstance = null;
let storageChartInstance = null;
let issueChartInstance = null;
let currentProjectDeadline = null;
let editingProjectDeadlineCompleted = false;
let projectDeadlineLoadedFor = '';
let projectDeadlineRequestId = 0;

function getCdeAuthHeaders(headers = {}) {
    const token = localStorage.getItem('access_token') || '';
    return { ...headers, Authorization: `Bearer ${token}` };
}

let virtualTreeData = {
    id: "ROOT",
    name: "database/bim-vdc",
    path: "database/bim-vdc",
    type: "folder",
    expanded: true,
    children: []
};

const ISO_CONTAINERS = ['01_WIP', '02_SHARED', '03_PUBLISHED', '04_ARCHIVE'];
const cdeSyncChannel = new BroadcastChannel('pvincons_cde_sync_channel');

cdeSyncChannel.onmessage = (event) => {
    if (event.data && event.data.type === 'REFRESH_CDE_DATA') {
        reloadDatabaseData();
        showToast("Dữ liệu đã được đồng bộ tự động từ hệ thống!");
    }
};

function openMobileSidebar() {
    document.getElementById('sidebar').classList.add('mobile-open');
    document.getElementById('sidebarOverlay').classList.add('active');
}

function closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

function closeAllModals() {
    const accountModal = document.getElementById('accountModal');
    if (accountModal && !accountModal.classList.contains('hidden')) {
        toggleAccountModal(false);
    }
    ['issuesModal', 'isoRenameModal', 'metadataModal', 'viewModal', 'documentPreviewModal', 'otpSignModal', 'gateModal', 'namingModal', 'uploadModal', 'projectDeadlineModal'].forEach(id => {
        closeModal(id);
    });
}

async function handleLogout() {
    if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?")) {
        let vnptSessionCleared = false;
        const cdeToken = localStorage.getItem('access_token') || '';
        if (cdeToken) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            try {
                const response = await fetch(`${DATA_SERVER_API}/api/vnpt/session/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${cdeToken}` },
                    signal: controller.signal
                });
                vnptSessionCleared = response.ok;
            } catch (error) {
                console.warn('Không thể xóa phiên VNPT trên server khi đăng xuất:', error);
            } finally {
                clearTimeout(timeout);
            }
        }
        localStorage.removeItem('currentUser');
        localStorage.removeItem('access_token');
        showToast(vnptSessionCleared ? "Đang đăng xuất..." : "Đang đăng xuất; phiên Ký số trên server chưa được xác nhận xóa.");
        setTimeout(() => {
            window.location.href = '../../../index.html';
        }, 1200);
    }
}

function navBottomAction(action, btn) {
    if (action === 'chat') {
        if (window.CdeChat) {
            CdeChat.toggle();
        } else {
            showToast("Chat chưa sẵn sàng, vui lòng tải lại trang!");
        }
        return;
    }

    if (window.CdeChat) CdeChat.close();

    if (action === 'tree') {
        openMobileSidebar();
    } else if (action === 'upload') {
        openModal('uploadModal');
    } else if (action === 'profile') {
        closeAllModals();
        toggleAccountModal(true);
    }
    syncBottomNavActive();
}

/* Trạng thái "active" của bottom bar luôn bám theo panel đang MỞ THẬT:
   - Thư mục   -> sidebar có class mobile-open
   - Tải lên   -> uploadModal có class active
   - Tài khoản -> accountModal đang hiển thị
   Không có panel nào mở thì không nút nào sáng (không còn tự chọn "Tài khoản"). */
function syncBottomNavActive() {
    const isShown = (id) => {
        const el = document.getElementById(id);
        return !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none';
    };
    const sidebar = document.getElementById('sidebar');
    const uploadModal = document.getElementById('uploadModal');
    const openState = {
        tree: !!(sidebar && sidebar.classList.contains('mobile-open')),
        upload: !!(uploadModal && uploadModal.classList.contains('active')),
        profile: isShown('accountModal')
    };
    document.querySelectorAll('.bottom-nav-item[data-nav]').forEach(el => {
        el.classList.toggle('active', !!openState[el.dataset.nav]);
    });
}

let bottomNavSyncQueued = false;
function queueBottomNavSync() {
    if (bottomNavSyncQueued) return;
    bottomNavSyncQueued = true;
    requestAnimationFrame(() => {
        bottomNavSyncQueued = false;
        syncBottomNavActive();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    syncBottomNavActive();
    // Mở/đóng sidebar, modal (kể cả accountModal do account-modal.js tạo) -> tự cập nhật lại bottom bar
    new MutationObserver(queueBottomNavSync).observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        subtree: true
    });
});

function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<svg class="svg-icon-sm" viewBox="0 0 24 24" style="color:var(--primary);"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

/* 1. HÀM QUY ĐỔI DUNG LƯỢNG FILE */
function formatFileSize(bytes) {
    const size = Number(bytes);
    if (!Number.isFinite(size) || size <= 0) return '0 MB';
    const megabyte = 1024 ** 2;
    const gigabyte = 1024 ** 3;
    if (size >= gigabyte) return `${(size / gigabyte).toFixed(1)} GB`;
    return `${(size / megabyte).toFixed(2)} MB`;
}

function formatMetadataDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : escapeAttr(date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }));
}

/* 2. NÚT ẨN / HIỆN CARD QUY CHUẨN ĐỊNH DANH ISO 19650-2 */
function toggleNamingCard() {
    const card = document.getElementById('namingRuleCard');
    const icon = document.getElementById('namingToggleIcon');
    const btn = document.querySelector('.btn-toggle-naming');
    if (!card) return;

    card.classList.toggle('collapsed');

    if (card.classList.contains('collapsed')) {
        if (icon) icon.className = 'fa-solid fa-chevron-down';
        if (btn) btn.innerHTML = `<i class="fa-solid fa-chevron-down" id="namingToggleIcon"></i> Hiện quy chuẩn`;
    } else {
        if (icon) icon.className = 'fa-solid fa-chevron-up';
        if (btn) btn.innerHTML = `<i class="fa-solid fa-chevron-up" id="namingToggleIcon"></i> Ẩn quy chuẩn`;
    }
}

async function loadUserPermissions() {
    const userSession = JSON.parse(localStorage.getItem('currentUser') || '{}');
    currentUserRole = (userSession.role || '').toUpperCase();
    currentUserPermission = (userSession.permission || currentUserRole).toUpperCase();
    isUserAdmin = currentUserRole === 'ADMIN' || currentUserPermission === 'ADMIN';

    if (userSession.fullName) {
        currentActiveUserFullName = userSession.fullName;
    }

    let projectsStr = userSession.projects || '';
    try {
        const response = await fetch(`${CONFIG.CDE_API}/auth/me`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` }
        });
        if (!response.ok) throw new Error(`Lỗi tải hồ sơ (${response.status})`);
        const result = await response.json();
        const profile = result.user;
        if (profile && profile.username === userSession.username) {
            if (profile.projects) projectsStr = profile.projects;
            if (profile.permission) currentUserPermission = profile.permission.toUpperCase();
            if (profile.role) currentUserRole = profile.role.toUpperCase();
            if (profile.fullName) currentActiveUserFullName = profile.fullName;
        }
    } catch (e) {
        console.warn('Không thể tải quyền dự án từ backend, sử dụng session hiện tại.', e);
    }

    isUserAdmin = currentUserRole === 'ADMIN' || currentUserPermission === 'ADMIN';
    currentUserAssignedProjects = projectsStr.split(/[,]+/).map(p => p.trim());
}

function normalizeProjectName(name) {
    return String(name || '').replace(/\s+/g, '_').toLowerCase();
}

function canUserAccessProject(projectName) {
    if (isUserAdmin) return true;
    const projectKey = normalizeProjectName(projectName);
    if (!projectKey) return false;
    return currentUserAssignedProjects.some(project => normalizeProjectName(project) === projectKey);
}

async function reloadDatabaseData() {
    try {
        await loadUserPermissions();

        const [filesRes, issuesRes, recallsRes, sigsRes] = await Promise.all([
            fetch(`${DATA_SERVER_API}/api/cde-files`, {
                headers: getCdeAuthHeaders()
            }),
            fetch(`${DATA_SERVER_API}/api/issues`, { headers: getCdeAuthHeaders() }),
            fetch(`${DATA_SERVER_API}/api/recalls`, { headers: getCdeAuthHeaders() }).catch(() => null),
            fetch(`${DATA_SERVER_API}/api/vnpt/signatures`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}` }
            }).catch(() => null)
        ]);

        if (!filesRes.ok) throw new Error("Không kết nối được server file");

        const flatItems = await filesRes.json();
        if (issuesRes.ok) serverIssuesDB = await issuesRes.json();
        if (recallsRes && recallsRes.ok) serverRecallsDB = await recallsRes.json();
        if (sigsRes && sigsRes.ok) serverSignaturesDB = await sigsRes.json();

        virtualTreeData = buildTreeFromFlatList(flatItems);

        const tbody = document.getElementById('tableBody');
        if (tbody) tbody.innerHTML = '';
        buildTableFromTree(virtualTreeData);
        populateProjectOptions();
        renderTreeUI();
        applyFilters();
    } catch (err) {
        console.error("Lỗi lấy dữ liệu từ Backend CDE:", err);
        showToast(`Không thể kết nối Server CDE (${DATA_SERVER_API}). Vui lòng kiểm tra Node.js server!`);
    }
}

function resetToCurrentProjectRoot() {
    const projectSelect = document.getElementById('projectSelect');
    const selectedProject = projectSelect ? projectSelect.value : 'ALL';
    const stateFilter = document.getElementById('stateFilter');

    if (!selectedProject || selectedProject === 'ALL') {
        selectedFolderPathFilter = '';
        if (stateFilter) stateFilter.value = 'ALL';
        renderTreeUI();
        applyFilters();
        return;
    }

    const projectNode = virtualTreeData.children.find(
        child => child.type === 'folder' && child.name === selectedProject
    );
    if (!projectNode) {
        showToast(`Không tìm thấy thư mục gốc của dự án "${selectedProject}".`);
        return;
    }

    let projectElement = Array.from(document.querySelectorAll('.tree-node-item'))
        .find(element => element.getAttribute('data-path') === projectNode.path);
    if (!projectElement) {
        renderTreeUI();
        projectElement = Array.from(document.querySelectorAll('.tree-node-item'))
            .find(element => element.getAttribute('data-path') === projectNode.path);
    }
    if (!projectElement) {
        showToast(`Không thể hiển thị thư mục gốc của dự án "${selectedProject}".`);
        return;
    }

    selectTreeNode(projectNode, projectElement);
}

function buildTreeFromFlatList(flatList) {
    let root = {
        id: "ROOT",
        name: "database/bim-vdc",
        path: "database/bim-vdc",
        type: "folder",
        expanded: true,
        children: []
    };

    if (!Array.isArray(flatList)) return root;

    flatList.forEach(item => {
        let rel = item.path || item.relPath || item.relativePath;
        if (!rel || rel === "database/bim-vdc") return;

        let cleanRel = rel.replace(/^database\/bim-vdc\/?/, "");
        if (!cleanRel) return;

        let parts = cleanRel.split('/').filter(Boolean);
        let current = root;
        let accumPath = "database/bim-vdc";

        parts.forEach((part, index) => {
            accumPath += "/" + part;
            let isLast = index === parts.length - 1;
            let isItemFile = isLast && item.type === "file";

            let existing = current.children.find(c => c.name === part);
            if (!existing) {
                let newNode = {
                    id: 'node_' + Math.random().toString(36).substr(2, 9),
                    name: part,
                    path: accumPath,
                    type: isItemFile ? 'file' : 'folder',
                    size: item.size || item.fileSize || 0,
                    metadata: isItemFile ? item.metadata : undefined,
                    expanded: true,
                    children: isItemFile ? undefined : []
                };
                current.children.push(newNode);
                existing = newNode;
            }
            if (isItemFile) {
                existing.metadata = item.metadata || {};
                existing.size = item.size || item.fileSize || 0;
            }
            if (!isItemFile) {
                current = existing;
            }
        });
    });

    return root;
}

async function populateProjectOptions() {
    const select = document.getElementById('projectSelect');
    if (!select) return;
    let currentVal = select.value;
    select.innerHTML = '';

    if (isUserAdmin) {
        let allOpt = document.createElement('option');
        allOpt.value = 'ALL';
        allOpt.innerText = 'Tất cả Dự án (All Projects)';
        select.appendChild(allOpt);
    }

    if (virtualTreeData.children) {
        virtualTreeData.children.forEach(child => {
            if (child.type === 'folder') {
                if (canUserAccessProject(child.name)) {
                    let opt = document.createElement('option');
                    opt.value = child.name;
                    opt.innerText = child.name;
                    select.appendChild(opt);
                }
            }
        });
    }

    if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
        select.value = currentVal;
    } else {
        if (select.options.length > 0) {
            select.selectedIndex = 0;
        }
    }

    onProjectSelectChange();
}

function onProjectSelectChange() {
    selectedFolderPathFilter = "";
    renderTreeUI();
    applyFilters();
    loadProjectDeadline();
    if (window.innerWidth <= 768) closeMobileSidebar();
}

function canEditProjectDeadline() {
    return ['ADMIN', 'MASTER'].includes(currentUserRole) ||
        ['ADMIN', 'MASTER'].includes(currentUserPermission);
}

function renderProjectDeadline() {
    const projectSelect = document.getElementById('projectSelect');
    const projectName = projectSelect ? projectSelect.value : 'ALL';
    const editButton = document.getElementById('deadlineEditButton');
    const startLabel = document.getElementById('deadlineStartLabel');
    const endLabel = document.getElementById('deadlineEndLabel');
    const status = document.getElementById('deadlineStatus');
    const progressTrack = document.getElementById('deadlineProgressTrack');
    const progressFill = document.getElementById('deadlineProgressFill');
    const progressPercentLabel = document.getElementById('deadlineProgressPercent');
    const canEdit = canEditProjectDeadline() &&
        projectName && projectName !== 'ALL' &&
        projectDeadlineLoadedFor === projectName;
    if (editButton) editButton.style.display = canEdit ? 'inline-flex' : 'none';

    if (startLabel) startLabel.textContent = currentProjectDeadline ? formatDeadlineDate(currentProjectDeadline.startDate) : '—';
    if (endLabel) endLabel.textContent = currentProjectDeadline ? formatDeadlineDate(currentProjectDeadline.endDate) : '—';

    const setProgress = (percent, color, label, statusColor) => {
        if (progressFill) {
            progressFill.style.width = `${percent}%`;
            progressFill.style.backgroundColor = color;
        }
        if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(percent));
        if (progressPercentLabel) progressPercentLabel.textContent = label || `${percent}%`;
        if (status) status.style.color = statusColor || '';
    };

    if (!projectName || projectName === 'ALL') {
        if (status) status.textContent = 'Chọn một dự án';
        setProgress(0, '#334155', '—');
        return;
    }

    if (!currentProjectDeadline) {
        if (status) status.textContent = projectDeadlineLoadedFor === projectName ? 'Chưa nhập ngày' : 'Đang tải...';
        setProgress(0, '#334155', '—');
        return;
    }

    const startTime = Date.parse(`${currentProjectDeadline.startDate}T00:00:00`);
    const endDateStart = Date.parse(`${currentProjectDeadline.endDate}T00:00:00`);
    const dayMs = 24 * 60 * 60 * 1000;
    const endTime = endDateStart + dayMs;
    const now = Date.now();
    if (!Number.isFinite(startTime) || !Number.isFinite(endDateStart) || endDateStart < startTime) {
        if (status) status.textContent = 'Ngày deadline không hợp lệ';
        setProgress(0, '#334155', '—');
        return;
    }

    if (currentProjectDeadline.completed === true) {
        if (status) status.textContent = 'Hoàn thành';
        setProgress(100, '#3b82f6', '100%', '#3b82f6');
        return;
    }

    const progress = Math.max(0, Math.min(1, (now - startTime) / (endTime - startTime)));
    const progressPercent = Math.round(progress * 100);
    let deadlineStatus;
    if (now < startTime) {
        deadlineStatus = `Bắt đầu sau ${Math.ceil((startTime - now) / dayMs)} ngày`;
    } else if (now >= endTime) {
        deadlineStatus = `Quá hạn ${Math.ceil((now - endTime) / dayMs)} ngày`;
    } else if (now >= endDateStart) {
        deadlineStatus = 'Hạn hôm nay';
    } else {
        deadlineStatus = `Còn ${Math.ceil((endDateStart - now) / dayMs)} ngày`;
    }
    if (status) status.textContent = deadlineStatus;
    const progressColor = progressPercent >= 85
        ? '#ef4444'
        : progressPercent >= 70
            ? '#fbbf24'
            : '#22c55e';
    setProgress(progressPercent, progressColor, undefined, progressColor);
}

function formatDeadlineDate(value) {
    if (!value) return '—';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN');
}

async function loadProjectDeadline() {
    const projectSelect = document.getElementById('projectSelect');
    const projectName = projectSelect ? projectSelect.value : 'ALL';
    const requestId = ++projectDeadlineRequestId;
    currentProjectDeadline = null;
    projectDeadlineLoadedFor = '';
    renderProjectDeadline();
    if (!projectName || projectName === 'ALL') return;

    try {
        const response = await fetch(
            `${DATA_SERVER_API}/api/project-deadline?projectName=${encodeURIComponent(projectName)}`,
            { headers: getCdeAuthHeaders() }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Lỗi tải deadline (${response.status})`);
        if (requestId !== projectDeadlineRequestId) return;
        currentProjectDeadline = result.deadline || null;
        projectDeadlineLoadedFor = projectName;
        renderProjectDeadline();
    } catch (error) {
        if (requestId !== projectDeadlineRequestId) return;
        renderProjectDeadline();
        showToast(`Không thể tải deadline dự án: ${error.message}`);
    }
}

function openProjectDeadlineModal() {
    const projectSelect = document.getElementById('projectSelect');
    const projectName = projectSelect ? projectSelect.value : 'ALL';
    if (!canEditProjectDeadline()) {
        showToast('Chỉ Admin hoặc Master mới được nhập ngày deadline.');
        return;
    }
    if (!projectName || projectName === 'ALL' || projectDeadlineLoadedFor !== projectName) {
        showToast('Hãy chọn một dự án cụ thể và đợi tải dữ liệu deadline.');
        return;
    }

    document.getElementById('deadlineModalProjectName').textContent = projectName;
    document.getElementById('projectDeadlineStartInput').value = currentProjectDeadline ? currentProjectDeadline.startDate : '';
    document.getElementById('projectDeadlineEndInput').value = currentProjectDeadline ? currentProjectDeadline.endDate : '';
    editingProjectDeadlineCompleted = !!(currentProjectDeadline && currentProjectDeadline.completed === true);
    renderProjectDeadlineCompletionToggle();
    openModal('projectDeadlineModal');
}

function toggleProjectDeadlineCompletion() {
    editingProjectDeadlineCompleted = !editingProjectDeadlineCompleted;
    renderProjectDeadlineCompletionToggle();
}

function renderProjectDeadlineCompletionToggle() {
    const button = document.getElementById('projectDeadlineCompleteToggle');
    if (!button) return;
    button.classList.toggle('is-completed', editingProjectDeadlineCompleted);
    button.setAttribute('aria-pressed', String(editingProjectDeadlineCompleted));
    button.innerHTML = editingProjectDeadlineCompleted
        ? '<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Hủy hoàn thành'
        : '<i class="fa-solid fa-check" aria-hidden="true"></i> Đánh dấu hoàn thành';
}

async function saveProjectDeadline(event) {
    event.preventDefault();
    const projectSelect = document.getElementById('projectSelect');
    const projectName = projectSelect ? projectSelect.value : 'ALL';
    const startDate = document.getElementById('projectDeadlineStartInput').value;
    const endDate = document.getElementById('projectDeadlineEndInput').value;
    const saveButton = document.getElementById('saveProjectDeadlineButton');
    if (!canEditProjectDeadline() || !projectName || projectName === 'ALL') {
        showToast('Chỉ Admin hoặc Master mới được nhập ngày cho một dự án cụ thể.');
        return;
    }
    if (endDate < startDate) {
        showToast('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.');
        return;
    }

    saveButton.disabled = true;
    try {
        const response = await fetch(`${DATA_SERVER_API}/api/project-deadline`, {
            method: 'PUT',
            headers: getCdeAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ projectName, startDate, endDate, completed: editingProjectDeadlineCompleted })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Lỗi lưu deadline (${response.status})`);
        currentProjectDeadline = result.deadline;
        projectDeadlineLoadedFor = projectName;
        renderProjectDeadline();
        closeModal('projectDeadlineModal');
        showToast('Đã lưu deadline và trạng thái dự án.');
    } catch (error) {
        showToast(`Không thể lưu deadline dự án: ${error.message}`);
    } finally {
        saveButton.disabled = false;
    }
}

function open3DViewer(itemPath) {
    if (!itemPath) return;
    const { url, fileName } = buildFileUrl(itemPath);
    const viewerUrl = `viewer-ifc.html?file=${encodeURIComponent(url)}&name=${encodeURIComponent(fileName)}`;
    const win = window.open(viewerUrl, '_blank');
    if (!win) showToast("⚠️ Trình duyệt chặn popup. Hãy cho phép mở tab mới cho trang này!");
}

function buildFileUrl(itemPath) {
    let relFromBim = String(itemPath).replace(/^database\/bim-vdc\/?/, '');
    let parts = relFromBim.split('/');
    return {
        url: `${DATA_SERVER_API}/files/${parts.map(p => encodeURIComponent(p)).join('/')}`,
        fileName: parts[parts.length - 1] || 'file'
    };
}

async function openCdeFileInNewTab(itemPath) {
    const popup = window.open('about:blank', '_blank');
    if (!popup) {
        showToast("⚠️ Trình duyệt chặn popup. Hãy cho phép mở tab mới cho trang này!");
        return;
    }
    popup.opener = null;
    try {
        const { url, fileName } = buildFileUrl(itemPath);
        const response = await fetch(url, { headers: getCdeAuthHeaders() });
        if (!response.ok) throw new Error(`Máy chủ trả về lỗi ${response.status}.`);
        const objectUrl = URL.createObjectURL(await response.blob());
        popup.location.replace(objectUrl);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        showToast(`Đã mở tệp "${fileName}" ở tab mới.`);
    } catch (error) {
        popup.close();
        showToast(`Không thể mở tệp: ${error.message}`);
    }
}

async function downloadCdeFile(itemPath, fileName) {
    try {
        const { url } = buildFileUrl(itemPath);
        const response = await fetch(url, { headers: getCdeAuthHeaders() });
        if (!response.ok) throw new Error(`Máy chủ trả về lỗi ${response.status}.`);
        const objectUrl = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
        showToast(`Không thể tải tệp: ${error.message}`);
    }
}

function sanitizeDocumentPreview(html) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const allowedTags = new Set([
        'A', 'B', 'BLOCKQUOTE', 'BR', 'CAPTION', 'CODE', 'DD', 'DIV', 'DL', 'DT',
        'EM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'I', 'IMG', 'LI',
        'OL', 'P', 'PRE', 'S', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TABLE', 'TBODY',
        'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'U', 'UL'
    ]);
    const blockedTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH']);

    function cleanNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || '');
        if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
        if (blockedTags.has(node.tagName)) return document.createDocumentFragment();

        const fragment = document.createDocumentFragment();
        if (!allowedTags.has(node.tagName)) {
            node.childNodes.forEach(child => fragment.appendChild(cleanNode(child)));
            return fragment;
        }

        const cleanElement = document.createElement(node.tagName.toLowerCase());
        if (node.tagName === 'A') {
            const href = node.getAttribute('href') || '';
            try {
                const safeUrl = new URL(href, window.location.origin);
                if (['http:', 'https:', 'mailto:'].includes(safeUrl.protocol)) {
                    cleanElement.href = safeUrl.href;
                    cleanElement.rel = 'noopener noreferrer';
                    cleanElement.target = '_blank';
                }
            } catch (error) {
                // Ignore invalid links in the document.
            }
        } else if (node.tagName === 'IMG') {
            const source = node.getAttribute('src') || '';
            if (!/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(source) || source.length > 4_000_000) {
                return fragment;
            }
            cleanElement.src = source;
            cleanElement.alt = node.getAttribute('alt') || '';
        }
        node.childNodes.forEach(child => cleanElement.appendChild(cleanNode(child)));
        fragment.appendChild(cleanElement);
        return fragment;
    }

    const result = document.createDocumentFragment();
    parsed.body.childNodes.forEach(node => result.appendChild(cleanNode(node)));
    return result;
}

function renderSpreadsheetPreview(workbook, sheetName) {
    const content = document.getElementById('documentPreviewContent');
    const message = document.getElementById('documentPreviewMessage');
    const worksheet = workbook.Sheets[sheetName];
    if (!content || !message || !worksheet || !worksheet['!ref']) {
        if (content) content.replaceChildren();
        if (message) message.textContent = 'Trang tính này không có dữ liệu để hiển thị.';
        return;
    }

    const fullRange = XLSX.utils.decode_range(worksheet['!ref']);
    const rowLimit = 500;
    const columnLimit = 50;
    const range = {
        s: { r: 0, c: 0 },
        e: { r: Math.min(fullRange.e.r, rowLimit - 1), c: Math.min(fullRange.e.c, columnLimit - 1) }
    };
    const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        defval: '',
        range
    });
    const table = document.createElement('table');
    table.className = 'document-preview-table';
    const body = document.createElement('tbody');

    rows.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        const rowNumber = document.createElement('th');
        rowNumber.textContent = String(rowIndex + 1);
        tr.appendChild(rowNumber);
        row.forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = String(value);
            tr.appendChild(cell);
        });
        body.appendChild(tr);
    });

    table.appendChild(body);
    content.replaceChildren(table);
    const truncated = fullRange.e.r + 1 > rowLimit || fullRange.e.c + 1 > columnLimit;
    message.textContent = truncated
        ? `Đang hiển thị tối đa ${rowLimit} dòng và ${columnLimit} cột đầu tiên của trang tính.`
        : 'Xem trước bảng tính (chỉ đọc).';
}

async function openDocumentPreview(itemPath) {
    const modal = document.getElementById('documentPreviewModal');
    const title = document.getElementById('documentPreviewTitle');
    const message = document.getElementById('documentPreviewMessage');
    const content = document.getElementById('documentPreviewContent');
    const sheetSelect = document.getElementById('documentPreviewSheet');
    const sheetLabel = document.getElementById('documentPreviewSheetLabel');
    if (!modal || !title || !message || !content || !sheetSelect || !sheetLabel) return;

    const { url, fileName } = buildFileUrl(itemPath);
    const extension = fileName.split('.').pop().toLowerCase();
    title.textContent = fileName;
    message.textContent = 'Đang tải tài liệu...';
    content.replaceChildren();
    sheetSelect.replaceChildren();
    sheetSelect.hidden = true;
    sheetLabel.hidden = true;
    openModal('documentPreviewModal');

    if (extension === 'gdoc' || extension === 'gsheet') {
        message.textContent = 'Tệp Google Docs/Sheets dạng liên kết không có nội dung tài liệu trong CDE. Hãy tải lên bản xuất .docx hoặc .xlsx để xem trước.';
        return;
    }
    if (extension === 'doc') {
        message.textContent = 'Chưa hỗ trợ định dạng Word .doc cũ. Hãy chuyển đổi và tải lên dưới dạng .docx.';
        return;
    }

    try {
        const response = await fetch(url, { headers: getCdeAuthHeaders() });
        if (!response.ok) throw new Error(`Máy chủ trả về lỗi ${response.status}.`);
        const buffer = await response.arrayBuffer();

        if (extension === 'xlsx' || extension === 'xls') {
            if (!window.XLSX) throw new Error('Thư viện xem bảng tính chưa được tải.');
            const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
            if (!workbook.SheetNames.length) throw new Error('Không tìm thấy trang tính trong tệp.');
            workbook.SheetNames.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                sheetSelect.appendChild(option);
            });
            sheetSelect.hidden = false;
            sheetLabel.hidden = false;
            sheetSelect.onchange = () => renderSpreadsheetPreview(workbook, sheetSelect.value);
            renderSpreadsheetPreview(workbook, workbook.SheetNames[0]);
            return;
        }

        if (extension === 'docx') {
            if (!window.mammoth) throw new Error('Thư viện xem tài liệu chưa được tải.');
            const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
            const wordContent = document.createElement('div');
            wordContent.className = 'document-preview-word';
            wordContent.appendChild(sanitizeDocumentPreview(result.value));
            content.replaceChildren(wordContent);
            message.textContent = result.messages.length
                ? 'Đã mở bản xem trước. Một số định dạng nâng cao có thể không được thể hiện đầy đủ.'
                : 'Xem trước tài liệu (chỉ đọc).';
            return;
        }

        message.textContent = 'Định dạng này chưa được hỗ trợ xem trước.';
    } catch (error) {
        message.textContent = `Không thể xem trước tài liệu: ${error.message}`;
    }
}

function openWithLocalApp(itemPath) {
    if (!itemPath) return;
    if (/\.ifc$/i.test(String(itemPath))) {
        open3DViewer(itemPath);
        return;
    }

    const { url, fileName } = buildFileUrl(itemPath);
    if (/\.(xlsx?|docx?|gdoc|gsheet)$/i.test(fileName)) {
        openDocumentPreview(itemPath);
        return;
    }
    openCdeFileInNewTab(itemPath);
}

function countFilesInFolder(node) {
    if (node.type === 'file') return 1;
    if (!node.children || node.children.length === 0) return 0;
    return node.children.reduce((total, child) => total + countFilesInFolder(child), 0);
}

async function submitGateTransition() {
    if (!currentRowElement) return;

    let action = document.getElementById('gateActionSelect').value;
    let oldPath = currentRowElement.getAttribute('data-path');
    let currentContainer = currentRowElement.getAttribute('data-state');
    let gateNoteText = document.getElementById('gateNote').value.trim();
    let shouldSyncToIssue = document.getElementById('gateSyncToIssue').checked;

    if (typeof checkActionPermission === 'function' && !checkActionPermission('GATE_APPROVAL', currentContainer)) {
        showToast("⚠️ Vai trò của bạn không có quyền duyệt Gate trên phân vùng này!");
        return;
    }

    let targetContainer = "01_WIP";
    let gateNameLabel = "GATE 1";
    if (action === "GATE1") { targetContainer = "02_SHARED"; gateNameLabel = "GATE 1 (WIP ➔ SHARED)"; }
    else if (action === "GATE2") { targetContainer = "03_PUBLISHED"; gateNameLabel = "GATE 2 (SHARED ➔ PUBLISHED)"; }
    else if (action === "GATE3") { targetContainer = "04_ARCHIVE"; gateNameLabel = "GATE 3 (PUBLISHED ➔ ARCHIVE)"; }

    let pathParts = oldPath.split('/');
    let projectFolder = pathParts[2] || 'Project_01';
    let targetDir = `database/bim-vdc/${projectFolder}/${targetContainer}`;
    let fileName = pathParts[pathParts.length - 1];
    let newPathAfterMove = `${targetDir}/${fileName}`;

    try {
        const res = await fetch(`${DATA_SERVER_API}/api/move`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
            },
            body: JSON.stringify({ sourcePath: oldPath, targetDir: targetDir })
        });
        const data = await res.json();

        if (!data.success) {
            showToast("Lỗi chuyển Gate: " + (data.error || "Thất bại"));
            return;
        }

        if (shouldSyncToIssue && gateNoteText) {
            let issueContent = `[${gateNameLabel}] ${gateNoteText}`;
            try {
                await fetch(`${DATA_SERVER_API}/api/issues/add`, {
                    method: 'POST',
                    headers: getCdeAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        filePath: newPathAfterMove,
                        text: issueContent,
                        author: currentActiveUserFullName
                    })
                });
            } catch (e) {
                console.error("Lỗi đồng bộ Issue từ Gate Note:", e);
            }
        }

        showToast("Đã phê duyệt Gate & di chuyển file thành công!");
        document.getElementById('gateNote').value = '';
        closeModal('gateModal');
        cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
        reloadDatabaseData();

    } catch (err) {
        console.error("Lỗi kết nối CDE Server:", err);
        showToast(`Không thể kết nối tới CDE Server tại (${DATA_SERVER_API})!`);
    }
}

function renderTreeUI() {
    const container = document.getElementById('dynamicTreeContainer');
    if (!container) return;
    container.innerHTML = '';
    if (!virtualTreeData.children || virtualTreeData.children.length === 0) {
        container.innerHTML = `<div style="font-size:0.72rem; color:var(--text-muted); padding:6px;">Chưa có dữ liệu.</div>`;
        return;
    }

    const normalizedAssigned = currentUserAssignedProjects.map(p => p.replace(/\s+/g, '_').toLowerCase());

    let prjVal = document.getElementById('projectSelect') ? document.getElementById('projectSelect').value : "ALL";
    let nodesToRender = virtualTreeData.children.filter(child => canUserAccessProject(child.name));

    if (prjVal && prjVal !== "ALL") {
        nodesToRender = nodesToRender.filter(child => child.name === prjVal);
    }

    if (nodesToRender.length === 0) {
        container.innerHTML = `<div style="font-size:0.72rem; color:var(--text-muted); padding:6px;">Không có thư mục phù hợp.</div>`;
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'tree-branch';
    ul.style.paddingLeft = '0';
    ul.style.borderLeft = 'none';

    nodesToRender.forEach(childNode => {
        ul.appendChild(createTreeNodeElement(childNode));
    });

    container.appendChild(ul);
}

function isFolderLocked(node) {
    if (isUserAdmin) return false;

    let pathUpper = node.path.toUpperCase();
    let targetContainer = "";

    for (let container of ISO_CONTAINERS) {
        if (node.name.toUpperCase() === container || pathUpper.includes('/' + container)) {
            targetContainer = container;
            break;
        }
    }

    if (!targetContainer) return false;

    if (typeof getIso19650Permissions === 'function') {
        let perm = getIso19650Permissions(targetContainer);
        if (perm && perm.toUpperCase() === 'NO ACCESS') {
            return true;
        }
    }
    return false;
}

function isPathLocked(path) {
    if (isUserAdmin) return false;

    let pathUpper = (path || '').toUpperCase();
    let targetContainer = "";

    for (let container of ISO_CONTAINERS) {
        if (nodeNameEqualsOrContains(pathUpper, container)) {
            targetContainer = container;
            break;
        }
    }

    if (!targetContainer) return false;

    if (typeof getIso19650Permissions === 'function') {
        let perm = getIso19650Permissions(targetContainer);
        if (perm && perm.toUpperCase() === 'NO ACCESS') {
            return true;
        }
    }
    return false;
}

function getManageableContainer(path) {
    const segments = String(path || '').replace(/\\/g, '/').split('/');
    if (!canUserAccessProject(segments[2])) return null;
    const containerIndex = segments.findIndex((segment, index) => index >= 3 &&
        ISO_CONTAINERS.includes(segment.toUpperCase()));
    if (containerIndex < 3) return null;
    const container = segments[containerIndex].toUpperCase();
    const permission = isUserAdmin
        ? 'FULL CONTROL'
        : (typeof getIso19650Permissions === 'function' ? getIso19650Permissions(container) : '').toUpperCase();
    if (permission !== 'FULL CONTROL') return null;
    return { container, isContainer: containerIndex === segments.length - 1 };
}

function nodeNameEqualsOrContains(pathUpper, container) {
    return pathUpper === container || pathUpper.includes('/' + container + '/') || pathUpper.endsWith('/' + container);
}

function getFileTypeIcon(fileName) {
    const extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
    const iconByExtension = {
        pdf: { icon: 'fa-file-pdf', color: '#ef4444', label: 'PDF' },
        ifc: { icon: 'fa-cube', color: '#34d399', label: 'IFC' },
        xml: { icon: 'fa-file-code', color: '#f97316', label: 'XML' },
        xls: { icon: 'fa-file-excel', color: '#22c55e', label: 'Excel' },
        xlsx: { icon: 'fa-file-excel', color: '#22c55e', label: 'Excel' },
        csv: { icon: 'fa-file-csv', color: '#22c55e', label: 'CSV' },
        doc: { icon: 'fa-file-word', color: '#3b82f6', label: 'Word' },
        docx: { icon: 'fa-file-word', color: '#3b82f6', label: 'Word' },
        dwg: { icon: 'fa-compass-drafting', color: '#a78bfa', label: 'DWG' },
        dxf: { icon: 'fa-compass-drafting', color: '#a78bfa', label: 'DXF' },
        rvt: { icon: 'fa-cubes', color: '#f97316', label: 'Revit' },
        jpg: { icon: 'fa-file-image', color: '#e879f9', label: 'Ảnh' },
        jpeg: { icon: 'fa-file-image', color: '#e879f9', label: 'Ảnh' },
        png: { icon: 'fa-file-image', color: '#e879f9', label: 'Ảnh' },
        zip: { icon: 'fa-file-zipper', color: '#fbbf24', label: 'Tệp nén' },
        rar: { icon: 'fa-file-zipper', color: '#fbbf24', label: 'Tệp nén' },
        txt: { icon: 'fa-file-lines', color: '#94a3b8', label: 'Văn bản' },
        json: { icon: 'fa-file-code', color: '#fbbf24', label: 'JSON' }
    };
    const fileType = iconByExtension[extension] || { icon: 'fa-file', color: '#94a3b8', label: 'Tệp' };
    return `<span class="icon-file" title="${fileType.label}" aria-label="${fileType.label}" style="display:inline-flex; align-items:center; justify-content:center; width:18px; color:${fileType.color};"><i class="fa-solid ${fileType.icon}" aria-hidden="true"></i></span>`;
}

function createTreeNodeElement(node) {
    const li = document.createElement('li');
    li.style.listStyle = 'none';

    const isFolder = node.type === 'folder';
    const hasChildren = isFolder && node.children && node.children.length > 0;
    const fileCount = isFolder ? countFilesInFolder(node) : 0;
    const locked = isFolder && isFolderLocked(node);

    const itemDiv = document.createElement('div');
    itemDiv.className = 'tree-node-item';
    itemDiv.setAttribute('data-path', node.path);
    if (locked) {
        itemDiv.classList.add('folder-locked');
        itemDiv.style.opacity = '0.55';
    }
    if (selectedFolderPathFilter === node.path) itemDiv.classList.add('active');

    itemDiv.onclick = (e) => {
        e.stopPropagation();
        if (isFolder) {
            if (locked) {
                showToast("🔒 Thư mục này bị khóa (No Access) theo phân quyền tài khoản!");
                return;
            }
            selectTreeNode(node, itemDiv);
        } else {
            selectFileTreeNode(node, itemDiv);
        }
    };

    let iconHtml = '';
    if (isFolder) {
        if (locked) {
            iconHtml = `<span class="icon-lock" style="color:#eab308; display:inline-flex; align-items:center;" title="No Access"><svg viewBox="0 0 24 24" fill="currentColor" style="width:18px; height:18px;"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg></span>`;
        } else {
            // Icon thư mục màu vàng đặc (Solid Yellow) phóng to hơn một chút (18x18px)
            if (node.expanded) {
                iconHtml = `<span class="icon-folder" style="color:#eab308; display:inline-flex; align-items:center;">
                    <svg viewBox="0 0 24 24" fill="currentColor" style="width:18px; height:18px;">
                        <path d="M19 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l2 2h9a2 2 0 0 1 2 2v1H4v11l2.4-8h16.2l-2.8 9.3a2 2 0 0 1-1.8 1.4z"/>
                    </svg>
                </span>`;
            } else {
                iconHtml = `<span class="icon-folder" style="color:#eab308; display:inline-flex; align-items:center;">
                    <svg viewBox="0 0 24 24" fill="currentColor" style="width:18px; height:18px;">
                        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                    </svg>
                </span>`;
            }
        }
    } else {
        iconHtml = getFileTypeIcon(node.name);
    }

    // Icon mũi tên Chevron đóng/mở phóng to hơn (16x16px)
    const toggleIconSymbol = `<svg viewBox="0 0 24 24" style="width:16px; height:16px;" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>`;

    let toggleHtml = isFolder
        ? `<span class="toggle-icon ${node.expanded ? '' : 'collapsed'}" onclick="toggleFolderExpand(event, '${node.id}')" style="display:inline-flex; align-items:center; justify-content:center; width:18px;">${hasChildren ? toggleIconSymbol : '•'}</span>`
        : `<span class="toggle-icon" style="opacity:0; width:18px;">•</span>`;

    let countBadgeHtml = isFolder && !locked ? `<span class="folder-file-count">${fileCount}</span>` : '';

    itemDiv.innerHTML = `
        <div class="node-title" style="display:flex; align-items:center; gap:6px;">
            ${toggleHtml}
            ${iconHtml}
            <span>${node.name}</span>
            ${countBadgeHtml}
        </div>
    `;

    const manageableContainer = isFolder ? getManageableContainer(node.path) : null;
    if (manageableContainer) {
        const actions = document.createElement('span');
        actions.style.cssText = 'display:inline-flex; gap:4px; margin-left:auto;';
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.title = 'Tạo thư mục con';
        addButton.setAttribute('aria-label', `Tạo thư mục con trong ${node.name}`);
        addButton.innerHTML = '<i class="fa-solid fa-folder-plus"></i>';
        addButton.onclick = (event) => addNewFolder(node.id, event);
        actions.appendChild(addButton);

        if (!manageableContainer.isContainer) {
            const renameButton = document.createElement('button');
            renameButton.type = 'button';
            renameButton.title = 'Đổi tên thư mục';
            renameButton.setAttribute('aria-label', `Đổi tên ${node.name}`);
            renameButton.innerHTML = '<i class="fa-solid fa-pen"></i>';
            renameButton.onclick = (event) => renameFolder(node.id, event);
            actions.appendChild(renameButton);

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.title = 'Xóa thư mục';
            deleteButton.setAttribute('aria-label', `Xóa ${node.name}`);
            deleteButton.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deleteButton.onclick = (event) => deleteFolder(node.id, event);
            actions.appendChild(deleteButton);
        }

        actions.querySelectorAll('button').forEach(button => {
            button.className = 'w-6 h-6 inline-flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-700';
            button.onclick = ((handler) => (event) => {
                event.stopPropagation();
                handler(event);
            })(button.onclick);
        });
        itemDiv.querySelector('.node-title').appendChild(actions);
    }

    li.appendChild(itemDiv);

    if (isFolder && hasChildren && node.expanded && !locked) {
        const subUl = document.createElement('ul');
        subUl.className = 'tree-branch';
        node.children.forEach(childNode => {
            subUl.appendChild(createTreeNodeElement(childNode));
        });
        li.appendChild(subUl);
    }

    return li;
}

function toggleFolderExpand(e, nodeId) {
    e.stopPropagation();
    const node = findNodeById(virtualTreeData, nodeId);
    if (node) {
        node.expanded = !node.expanded;
        renderTreeUI();
    }
}

function selectTreeNode(node, element) {
    document.querySelectorAll('.tree-node-item').forEach(el => el.classList.remove('active', 'highlighted'));
    element.classList.add('active');
    selectedFolderPathFilter = node.path;

    if (ISO_CONTAINERS.includes(node.name)) {
        const stateFilter = document.getElementById('stateFilter');
        if (stateFilter) stateFilter.value = node.name;
    } else {
        const stateFilter = document.getElementById('stateFilter');
        if (stateFilter) stateFilter.value = "ALL";
    }
    applyFilters();
    if (window.innerWidth <= 768) closeMobileSidebar();
}

function selectFileTreeNode(node, element) {
    document.querySelectorAll('.tree-node-item').forEach(el => el.classList.remove('active', 'highlighted'));
    element.classList.add('active', 'highlighted');

    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
        row.classList.remove('highlight-row');
        if (row.getAttribute('data-path') === node.path) {
            row.classList.add('highlight-row');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
}

async function addNewFolder(parentId, e) {
    if (e) e.stopPropagation();
    const folderName = prompt("Nhập tên thư mục mới cần tạo:");
    if (!folderName || !folderName.trim()) return;

    const parentNode = findNodeById(virtualTreeData, parentId) || virtualTreeData;

    try {
        const res = await fetch(`${DATA_SERVER_API}/api/create-folder`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
            },
            body: JSON.stringify({ parentPath: parentNode.path, folderName: folderName.trim() })
        });
        const data = await res.json();
        if (data.success) {
            cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
            reloadDatabaseData();
            showToast(`Tạo thư mục thành công: ${folderName.trim()}`);
        } else {
            showToast("Lỗi: " + (data.error || "Không thể tạo thư mục"));
        }
    } catch (err) {
        showToast("Không kết nối được server CDE!");
    }
}

async function renameFolder(nodeId, e) {
    if (e) e.stopPropagation();
    const node = findNodeById(virtualTreeData, nodeId);
    if (!node) return;
    const newName = prompt("Nhập tên mới:", node.name);
    if (!newName || !newName.trim() || newName === node.name) return;

    try {
        const res = await fetch(`${DATA_SERVER_API}/api/rename`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
            },
            body: JSON.stringify({ path: node.path, newName: newName.trim() })
        });
        const data = await res.json();
        if (data.success) {
            cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
            reloadDatabaseData();
            showToast(`Đổi tên thư mục thành công: ${newName.trim()}`);
        } else {
            showToast("Lỗi: " + (data.error || "Không thể đổi tên"));
        }
    } catch (err) {
        showToast("Không kết nối được server CDE!");
    }
}

async function deleteFolder(nodeId, e) {
    if (e) e.stopPropagation();
    const node = findNodeById(virtualTreeData, nodeId);
    if (!node) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa thư mục "${node.name}" và toàn bộ nội dung bên trong khỏi hệ thống CDE?`)) return;

    try {
        const res = await fetch(`${DATA_SERVER_API}/api/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
            },
            body: JSON.stringify({ path: node.path })
        });
        const data = await res.json();
        if (data.success) {
            cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
            reloadDatabaseData();
            showToast("Đã xóa thư mục khỏi kho CDE!");
        } else {
            showToast("Lỗi: " + (data.error || "Không thể xóa"));
        }
    } catch (err) {
        showToast("Không kết nối được server CDE!");
    }
}

function findNodeById(parent, id) {
    if (parent.id === id) return parent;
    if (parent.children) {
        for (let child of parent.children) {
            let found = findNodeById(child, id);
            if (found) return found;
        }
    }
    return null;
}

function getRecalledDB() {
    return serverRecallsDB || {};
}

function escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatRecallTime(iso) {
    try { return new Date(iso).toLocaleString('vi-VN'); } catch (e) { return iso; }
}

function refreshRowActions(row) {
    if (!row) return;
    const path = row.getAttribute('data-path');
    const state = row.getAttribute('data-state');
    const controls = row.querySelector('.action-controls');
    if (controls) controls.innerHTML = getActionButtons(state, path);
    row.classList.toggle('is-recalled', !!getRecalledDB()[path]);
}

async function recallFile(btn) {
    const row = btn.closest('tr');
    const path = row.getAttribute('data-path');
    const state = row.getAttribute('data-state');
    const fileName = row.querySelector('.file-code').innerText;

    if (typeof checkActionPermission !== 'function' || !checkActionPermission('UPLOAD', state)) {
        showToast("⚠️ Chỉ người có quyền tải file lên (Read & Write) mới được thu hồi tệp tin này!");
        return;
    }

    const reason = prompt(`Lý do thu hồi file:\n${fileName}`, '');
    if (reason === null) return;
    if (!reason.trim()) {
        showToast("⚠️ Vui lòng nhập lý do thu hồi!");
        return;
    }

    try {
        const res = await fetch(`${DATA_SERVER_API}/api/recalls/recall`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}` },
            body: JSON.stringify({ filePath: path, reason: reason.trim() })
        });
        const data = await res.json();
        if (!data.success) {
            showToast("Lỗi thu hồi: " + (data.error || "Thất bại"));
            return;
        }
        serverRecallsDB[path] = data.recall;
        refreshRowActions(row);
        applyFilters();
        cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
        showToast(`Đã thu hồi tệp "${fileName}".`);
    } catch (err) {
        showToast("Không kết nối được server CDE!");
    }
}

async function restoreRecalledFile(btn) {
    const row = btn.closest('tr');
    const path = row.getAttribute('data-path');
    const fileName = row.querySelector('.file-code').innerText;

    if (typeof checkActionPermission !== 'function' || !checkActionPermission('UPLOAD', row.getAttribute('data-state'))) {
        showToast("⚠️ Chỉ người có quyền tải file lên (Read & Write) mới được hủy thu hồi tệp tin này!");
        return;
    }

    if (!confirm(`Hủy thu hồi và cho phép sử dụng lại tệp này?\n${fileName}`)) return;

    try {
        const res = await fetch(`${DATA_SERVER_API}/api/recalls/restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}` },
            body: JSON.stringify({ filePath: path })
        });
        const data = await res.json();
        if (!data.success) {
            showToast("Lỗi hủy thu hồi: " + (data.error || "Thất bại"));
            return;
        }
        delete serverRecallsDB[path];
        refreshRowActions(row);
        applyFilters();
        cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
        showToast(`Đã hủy thu hồi tệp "${fileName}".`);
    } catch (err) {
        showToast("Không kết nối được server CDE!");
    }
}

function toggleHideRecalledFiles() {
    hideRecalledFilesFlag = !hideRecalledFilesFlag;
    const btn = document.getElementById('toggleRecallFilterBtn');
    const icon = document.getElementById('recallFilterIcon');

    if (hideRecalledFilesFlag) {
        btn.classList.add('active');
        btn.title = "Đang ẨN file thu hồi (Bấm để HIỆN lại)";
        icon.innerHTML = `<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.17c0-1.66-1.34-3-3-3l-.17.02z"/>`;
        showToast("Đã ẩn các file bị thu hồi khỏi bảng!");
    } else {
        btn.classList.remove('active');
        btn.title = "Đang HIỆN tất cả file (Bấm để ẨN file thu hồi)";
        icon.innerHTML = `<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3 z"/>`;
        showToast("Đã hiện tất cả file!");
    }
    applyFilters();
}

function canUserSign(state) {
    if (isUserAdmin) return true;
    let perm = '';
    if (typeof getIso19650Permissions === 'function') {
        perm = (getIso19650Permissions(state) || '').toUpperCase();
    } else {
        const roleMatrix = {
            'ADMIN': { '01_WIP': 'Full Control', '02_SHARED': 'Full Control', '03_PUBLISHED': 'Full Control', '04_ARCHIVE': 'Full Control' },
            'MASTER': { '01_WIP': 'Full Control', '02_SHARED': 'Full Control', '03_PUBLISHED': 'Full Control', '04_ARCHIVE': 'Full Control' },
            'MANAGEMENT': { '01_WIP': 'No Access', '02_SHARED': 'Full Control', '03_PUBLISHED': 'Full Control', '04_ARCHIVE': 'Read & Write' },
            'DESIGNER': { '01_WIP': 'Full Control', '02_SHARED': 'Read & Write', '03_PUBLISHED': 'Read-Only', '04_ARCHIVE': 'No Access' },
            'CONTRACTOR': { '01_WIP': 'No Access', '02_SHARED': 'Read-Only', '03_PUBLISHED': 'Read & Write', '04_ARCHIVE': 'No Access' },
            'INTERNAL': { '01_WIP': 'No Access', '02_SHARED': 'Read-Only', '03_PUBLISHED': 'Read-Only', '04_ARCHIVE': 'No Access' }
        };
        let pKey = currentUserPermission || currentUserRole;
        let rolePerms = roleMatrix[pKey] || roleMatrix[currentUserRole] || {};
        perm = (rolePerms[state] || '').toUpperCase();
    }
    return perm === 'FULL CONTROL' || perm === 'READ & WRITE';
}

function safeCheckActionPermission(action, state) {
    if (typeof checkActionPermission === 'function') {
        return checkActionPermission(action, state);
    }
    if (isUserAdmin) return true;
    const perm = canUserSign(state);
    if (action === 'DELETE' || action === 'RENAME' || action === 'UPLOAD') {
        return perm;
    }
    return true;
}

function getActionButtons(state, relativePath) {
    const hasGatePermission = safeCheckActionPermission('GATE_APPROVAL', state);

    const recallInfo = getRecalledDB()[relativePath];
    const isRecalled = !!recallInfo;
    const isSignable = /\.(pdf|rvt|ifc|xml)$/i.test(relativePath);

    const signatureRecord = getSignatureRecord(relativePath);
    const isSigned = !!signatureRecord;

    const lockSvg = `<svg class="svg-icon-sm" viewBox="0 0 24 24" fill="currentColor" style="width:12px; height:12px; margin-left:3px;"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`;

    let signBtn = '';
    if (isSignable) {
        const canSign = canUserSign(state);
        if (isRecalled) {
            signBtn = `<button class="btn-icon sign-btn" disabled style="opacity:0.4; cursor:not-allowed;" title="File đã bị thu hồi">Ký số ${lockSvg}</button>`;
        } else if (canSign) {
            signBtn = `<button class="btn-icon sign-btn" onclick="openOtpSignModal(this)" title="Ký số từ xa VNPT SmartCA Cloud CA Production">Ký số</button>`;
        } else {
            signBtn = `<button class="btn-icon sign-btn" disabled style="opacity:0.4; cursor:not-allowed;" title="Chỉ tài khoản Full Control hoặc Read & Write mới được ký số">Ký số ${lockSvg}</button>`;
        }
    }

    let gateBtn = '';
    if (state === '04_ARCHIVE') {
        gateBtn = `<button class="btn-icon gate-btn" disabled style="opacity:0.55; cursor:not-allowed; display:inline-flex; align-items:center; justify-content:center;" title="Đã lưu trữ - hoàn tất các cổng phê duyệt">
            Gate ${lockSvg}
        </button>`;
    } else if (isRecalled) {
        gateBtn = `<button class="btn-icon gate-btn" disabled style="opacity:0.4; cursor:not-allowed; display:inline-flex; align-items:center; justify-content:center;" title="File đã bị thu hồi">
            Gate ${lockSvg}
        </button>`;
    } else if (state === '01_WIP' && hasGatePermission) {
        gateBtn = `<button class="btn-icon gate-btn" onclick="openGateModal(this)" title="Chuyển Gate 1">Gate 1</button>`;
    } else if (state === '02_SHARED' && hasGatePermission) {
        gateBtn = `<button class="btn-icon gate-btn" onclick="openGateModal(this)" title="Chuyển Gate 2">Gate 2</button>`;
    } else if (state === '03_PUBLISHED' && hasGatePermission) {
        gateBtn = `<button class="btn-icon gate-btn" onclick="openGateModal(this)" title="Chuyển Gate 3">Gate 3</button>`;
    } else {
        gateBtn = `<button class="btn-icon gate-btn" disabled style="opacity:0.4; cursor:not-allowed; display:inline-flex; align-items:center; justify-content:center;" title="Tài khoản không có quyền chuyển Gate">
            Gate ${lockSvg}
        </button>`;
    }

    const safePath = String(relativePath || '').replace(/'/g, "\\'");
    let fileIssues = serverIssuesDB[relativePath] || [];
    const shortText = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };
    const MAX_TIP_ISSUES = 5;
    const issueTip = fileIssues.slice(0, MAX_TIP_ISSUES)
        .map((it, i) => `${i + 1}. ${shortText(it.text, 100)}${(it.author || it.time) ? `\n    — ${[it.author, it.time].filter(Boolean).join(', ')}` : ''}`)
        .join('\n')
        + (fileIssues.length > MAX_TIP_ISSUES ? `\n… và ${fileIssues.length - MAX_TIP_ISSUES} issue khác` : '')
        + '\n(Bấm để xem chi tiết)';

    let issueBadge = fileIssues.length > 0
        ? `<span class="badge badge-issue" title="${escapeAttr(issueTip)}" onclick="openIssuesModal('${safePath}')">
            <svg class="svg-icon-sm" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg> 
            ${fileIssues.length} Issue</span>`
        : '';

    const canRename = safeCheckActionPermission('RENAME', state);
    const canUpload = safeCheckActionPermission('UPLOAD', state);
    const canHistory = safeCheckActionPermission('VERSION_HISTORY', state);
    const canMetadata = safeCheckActionPermission('EDIT_METADATA', state);
    const canShare = safeCheckActionPermission('SHARE_LINK', state);
    const canIssue = safeCheckActionPermission('CREATE_ISSUE', state);
    const canDelete = safeCheckActionPermission('DELETE', state);
    const canRecall = canUpload;

    let dropdownItemsHtml = `<button onclick="previewFile(this)">Chi tiết</button>`;

    if (isRecalled) {
        dropdownItemsHtml = `<button onclick="previewFile(this)">Chi tiết</button>`;
        if (canRecall) {
            dropdownItemsHtml += `<button class="recall-item" onclick="restoreRecalledFile(this)">Hủy thu hồi</button>`;
        }
        if (canDelete) {
            dropdownItemsHtml += `<button onclick="deleteRowFile(this)" style="color:#ef4444;">Xóa file</button>`;
        }
    } else {
        if (canRename) {
            dropdownItemsHtml += `<button onclick="openIsoRenameModal(this)">Đổi tên ISO 19650</button>`;
        }
        if (canUpload) {
            dropdownItemsHtml += `<button onclick="uploadNewRevision(this)">Up phiên bản mới</button>`;
        }
        if (canHistory) {
            dropdownItemsHtml += `<button onclick="viewVersionHistory(this)">Lịch sử Version</button>`;
        }
        if (canMetadata) {
            dropdownItemsHtml += `<button onclick="editMetadata(this)">Sửa Metadata</button>`;
        }
        if (canShare) {
            dropdownItemsHtml += `<button onclick="shareFile(this)">Chia sẻ Link</button>`;
        }
        if (canIssue) {
            dropdownItemsHtml += `<button onclick="createIssuePrompt('${safePath}')">Tạo Issue / QA-QC</button>`;
        }
        if (canRecall) {
            dropdownItemsHtml += `<button class="recall-item" onclick="recallFile(this)">Thu hồi</button>`;
        }
        if (canDelete) {
            dropdownItemsHtml += `<button onclick="deleteRowFile(this)" style="color:#ef4444;">Xóa file</button>`;
        }
    }

    let dropdownHtml = `
        <div class="dropdown">
            <button class="btn-icon icon-only" onclick="toggleActionDropdown(event, this)">⋮</button>
            <div class="dropdown-content">
                ${dropdownItemsHtml}
            </div>
        </div>
    `;

    let recallBadge = isRecalled
        ? `<span class="badge-recalled" title="${escapeAttr(`Thu hồi bởi ${recallInfo.by} lúc ${formatRecallTime(recallInfo.at)}\nLý do: ${recallInfo.reason}`)}">⟲ Thu hồi</span>`
        : '';

    let downloadBtnHtml = isRecalled
        ? `<button class="btn-icon icon-only" disabled style="opacity:0.4; cursor:not-allowed;" title="File bị thu hồi không thể tải về">
            <svg class="svg-icon-sm" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
           </button>`
        : `<button class="btn-icon icon-only" onclick="downloadFile(this)">
            <svg class="svg-icon-sm" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
           </button>`;

    let signedBadge = isSigned
        ? `<span class="badge-signed" title="${signatureRecord.signatureCount > 1 ? signatureRecord.signatureCount + ' chữ ký số. Gần nhất: ' : 'Đã ký số bởi '}${signatureRecord.signedBy || 'Hệ thống'} lúc ${new Date(signatureRecord.signedAt || Date.now()).toLocaleString('vi-VN')}">✓ Đã ký${signatureRecord.signatureCount > 1 ? ' (' + signatureRecord.signatureCount + ')' : ''}</span>`
        : '';

    return `
        <button class="btn-open-file" onclick="openWithLocalApp('${safePath}')">Mở</button>
        ${signBtn}
        ${gateBtn}
        ${downloadBtnHtml}
        ${signedBadge}
        ${issueBadge}
        ${recallBadge}
        ${dropdownHtml}
    `;
}

function getSignatureRecord(relativePath) {
    const normKey = relativePath.replace(/^database\/bim-vdc\/?/, '');
    return serverSignaturesDB[relativePath] || serverSignaturesDB['database/bim-vdc/' + normKey];
}

let signTargetRow = null;

function populateVnptCredentialList(credentialIds) {
    const credSelect = document.getElementById('vnptCredentialSelect');
    credSelect.innerHTML = '';
    credentialIds.forEach((credentialId, index) => {
        const option = document.createElement('option');
        option.value = credentialId;
        option.innerText = `Chứng thư số ${index + 1}: ${credentialId}`;
        credSelect.appendChild(option);
    });
    currentCredentialId = credentialIds[0] || '';
}

function toggleVnptLoginFields(show) {
    document.getElementById('vnptUsernameRow').style.display = show ? 'block' : 'none';
    document.getElementById('vnptPasswordRow').style.display = show ? 'block' : 'none';
}

async function setVnptSessionRetention(retainSession) {
    if (!vnptSessionReady) return;
    try {
        const response = await fetch(`${DATA_SERVER_API}/api/vnpt/session/retention`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
            },
            body: JSON.stringify({ retain_session: retainSession })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Không cập nhật được tùy chọn lưu phiên VNPT.');
        }
    } catch (error) {
        console.error('Lỗi cập nhật tùy chọn phiên VNPT:', error);
        showToast('Không cập nhật được tùy chọn lưu phiên VNPT: ' + error.message);
    }
}

function clearVnptSessionOnServer() {
    const cdeToken = localStorage.getItem('access_token') || '';
    if (!cdeToken) return;
    fetch(`${DATA_SERVER_API}/api/vnpt/session/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cdeToken}` }
    }).catch(error => console.warn('Không thể xóa phiên VNPT tạm:', error));
}

async function openOtpSignModal(btn) {
    signTargetRow = btn.closest('tr');
    currentCredentialId = '';
    vnptSessionReady = false;
    document.getElementById('rememberVnptSession').checked = true;
    const fileName = signTargetRow.querySelector('.file-code').innerText;
    document.getElementById('otpSignFileName').innerText = fileName;

    const statusInfo = document.getElementById('vnptSignStatusInfo');
    if (statusInfo) {
        statusInfo.style.display = 'none';
        statusInfo.innerText = '';
    }

    document.getElementById('vnptUsernameInput').value = '';

    const pwdInput = document.getElementById('vnptPasswordInput');
    const icon = document.getElementById('toggleVnptPasswordIcon');
    if (pwdInput) pwdInput.type = 'password';
    if (icon) {
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
    if (pwdInput) pwdInput.value = '';

    document.getElementById('vnptCredentialSelect').innerHTML = `<option value="">-- Vui lòng xác thực tài khoản trước --</option>`;
    toggleVnptLoginFields(true);

    openModal('otpSignModal');
    try {
        const response = await fetch(`${DATA_SERVER_API}/api/vnpt/session`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}` }
        });
        const data = await response.json();
        if (response.ok && data.success && Array.isArray(data.content) && data.content.length > 0) {
            populateVnptCredentialList(data.content);
            vnptSessionReady = true;
            toggleVnptLoginFields(false);
            if (statusInfo) {
                statusInfo.style.display = 'block';
                statusInfo.style.background = 'rgba(52, 211, 153, 0.15)';
                statusInfo.style.color = '#34d399';
                statusInfo.innerText = '✓ Phiên VNPT SmartCA đang hoạt động. Chứng thư số sẵn sàng cho lần ký tiếp theo.';
            }
        }
    } catch (error) {
        if (statusInfo) {
            statusInfo.style.display = 'block';
            statusInfo.innerText = 'Không kiểm tra được phiên VNPT. Bạn có thể xác thực lại tài khoản.';
        }
    }
}

async function fetchVnptTokenAndCredentials() {
    const usernameInput = document.getElementById('vnptUsernameInput').value.trim();
    const passwordInput = document.getElementById('vnptPasswordInput').value.trim();
    const statusInfo = document.getElementById('vnptSignStatusInfo');
    const cdeToken = localStorage.getItem('access_token') || '';

    if (!usernameInput || !passwordInput) {
        showToast("⚠️ Vui lòng nhập đầy đủ Tài khoản và Mật khẩu VNPT SmartCA!");
        return;
    }
    if (!cdeToken) {
        showToast("Phiên đăng nhập CDE đã hết hạn. Vui lòng đăng nhập lại.");
        return;
    }

    showToast("Đang kết nối VNPT SmartCA Production...");
    if (statusInfo) {
        statusInfo.style.display = 'block';
        statusInfo.style.background = 'rgba(59, 130, 246, 0.15)';
        statusInfo.style.color = '#60a5fa';
        statusInfo.innerText = "⏳ Đang xác thực thông tin tài khoản...";
    }

    try {
        const tokenRes = await fetch(`${DATA_SERVER_API}/api/vnpt/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cdeToken}`
            },
            body: JSON.stringify({
                username: usernameInput,
                password: passwordInput,
                retain_session: document.getElementById('rememberVnptSession').checked
            })
        });

        const tokenData = await tokenRes.json();
        if (!tokenData.success || !Array.isArray(tokenData.content) || tokenData.content.length === 0) {
            throw new Error(tokenData.error || "Xác thực tài khoản VNPT SmartCA thất bại");
        }
        populateVnptCredentialList(tokenData.content);
        vnptSessionReady = true;
        toggleVnptLoginFields(false);
        showToast("✓ Phiên VNPT đã sẵn sàng để ký nhiều lần!");
        if (statusInfo) {
            statusInfo.style.background = 'rgba(52, 211, 153, 0.15)';
            statusInfo.style.color = '#34d399';
            statusInfo.innerText = "✓ Đã xác thực và lưu phiên VNPT an toàn trên server.";
        }
        document.getElementById('vnptPasswordInput').value = '';
    } catch (err) {
        console.error("Lỗi VNPT SmartCA:", err);
        showToast("Lỗi: " + err.message);
        if (statusInfo) {
            statusInfo.style.background = 'rgba(239, 68, 68, 0.15)';
            statusInfo.style.color = '#ef4444';
            statusInfo.innerText = "✕ Lỗi: " + err.message;
        }
    }
}

async function executeVnptSignHash() {
    if (!signTargetRow) return;
    const filePath = signTargetRow.getAttribute('data-path');
    const credSelect = document.getElementById('vnptCredentialSelect');
    const statusInfo = document.getElementById('vnptSignStatusInfo');
    const cdeToken = localStorage.getItem('access_token') || '';

    if (credSelect && credSelect.value) {
        currentCredentialId = credSelect.value;
    }

    if (!cdeToken) {
        showToast("Phiên đăng nhập CDE đã hết hạn. Vui lòng đăng nhập lại.");
        return;
    }
    if (!vnptSessionReady || !currentCredentialId) {
        showToast("⚠️ Vui lòng xác thực phiên VNPT hoặc chọn Chứng thư số trước!");
        return;
    }
    if (!filePath) {
        showToast("⚠️ Không xác định được đường dẫn tệp cần ký!");
        return;
    }

    showToast("Đang gửi yêu cầu ký Hash tới VNPT SmartCA...");
    if (statusInfo) {
        statusInfo.style.display = 'block';
        statusInfo.style.background = 'rgba(59, 130, 246, 0.15)';
        statusInfo.style.color = '#60a5fa';
        statusInfo.innerText = "⏳ Đang gửi yêu cầu... Vui lòng mở ứng dụng VNPT SmartCA trên điện thoại để xác nhận giao dịch (QRCode / Smart OTP).";
    }

    try {
        const signRes = await fetch(`${DATA_SERVER_API}/api/vnpt/signature/signhash`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cdeToken}`
            },
            body: JSON.stringify({
                credentialId: currentCredentialId,
                retain_session: document.getElementById('rememberVnptSession').checked,
                filePath: filePath,
                description: `CDE PV Incons - Ký số tài liệu ${filePath} qua VNPT SmartCA Production`
            })
        });

        const signData = await signRes.json();
        if (!signData.success || !signData.content || !signData.content.tranId) {
            throw new Error(signData.error || "Không nhận được mã giao dịch (tranId) từ VNPT SmartCA");
        }

        const tranId = signData.content.tranId;
        if (statusInfo) {
            statusInfo.innerText = `⏳ Đã tạo giao dịch (ID: ${tranId}). Đang chờ xác nhận trên app VNPT SmartCA...`;
        }

        let finished = false;
        let pollCount = 0;
        const maxPolls = 20;
        const pollInterval = setInterval(async () => {
            pollCount++;
            try {
                const tranRes = await fetch(`${DATA_SERVER_API}/api/vnpt/credentials/gettraninfo`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${cdeToken}`
                    },
                    body: JSON.stringify({
                        tranId: tranId
                    })
                });
                const tranData = await tranRes.json();
                if (tranData.success && tranData.content) {
                    const status = tranData.content.tranStatus;
                    if (status === 1) {
                        finished = true;
                        clearInterval(pollInterval);
                        showToast("✓ Ký số VNPT SmartCA thành công!");
                        if (statusInfo) {
                            statusInfo.style.background = 'rgba(52, 211, 153, 0.15)';
                            statusInfo.style.color = '#34d399';
                            statusInfo.innerText = tranData.embedded
                                ? "✓ Ký số thành công! Chữ ký số đã được nhúng vào tệp PDF."
                                : "✓ Ký số thành công! Đã ghi nhận chữ ký vào hệ thống CDE (tệp không phải PDF nên chữ ký không nhúng vào tệp được).";
                        }
                        setTimeout(() => closeModal('otpSignModal'), 1500);
                        cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
                        reloadDatabaseData();
                    } else if (status === 4000) {
                    } else {
                        const failMsg = {
                            4001: 'Giao dịch đã hết hạn xác nhận.',
                            4002: 'Người ký đã từ chối giao dịch.',
                            4003: 'Xác thực khóa ký thất bại.',
                            4004: 'Ký số thất bại.'
                        }[status] || ('Giao dịch không thành công (mã ' + status + ').');
                        finished = true;
                        clearInterval(pollInterval);
                        showToast("✕ " + failMsg);
                        if (statusInfo) {
                            statusInfo.style.background = 'rgba(239, 68, 68, 0.15)';
                            statusInfo.style.color = '#ef4444';
                            statusInfo.innerText = "✕ " + failMsg;
                        }
                    }
                } else if (!tranData.retry && (
                    tranData.tranStatus === 1 ||
                    [401, 403, 404].includes(tranRes.status)
                )) {
                    finished = true;
                    clearInterval(pollInterval);
                    const pollError = tranData.error || 'Không thể xác thực hoặc tìm thấy giao dịch ký.';
                    showToast("✕ " + pollError);
                    if (statusInfo) {
                        statusInfo.style.background = 'rgba(239, 68, 68, 0.15)';
                        statusInfo.style.color = '#ef4444';
                        statusInfo.innerText = "✕ " + pollError;
                    }
                }
            } catch (pollErr) {
                console.warn("Lỗi kiểm tra trạng thái giao dịch:", pollErr);
            }

            if (!finished && pollCount >= maxPolls) {
                finished = true;
                clearInterval(pollInterval);
                if (statusInfo) {
                    statusInfo.style.background = 'rgba(245, 158, 11, 0.15)';
                    statusInfo.style.color = '#fbbf24';
                    statusInfo.innerText = "⏱ Trình duyệt đã dừng chờ. CDE vẫn tiếp tục kiểm tra giao dịch ở nền và sẽ cập nhật tệp khi VNPT xác nhận.";
                }
            }
        }, 3000);

    } catch (err) {
        console.error("Lỗi ký số VNPT SmartCA:", err);
        showToast("Lỗi: " + err.message);
        if (statusInfo) {
            statusInfo.style.background = 'rgba(239, 68, 68, 0.15)';
            statusInfo.style.color = '#ef4444';
            statusInfo.innerText = "✕ Lỗi: " + err.message;
        }
    }
}

function createIssuePrompt(filePath) {
    let note = prompt("Nhập nội dung ghi chú Issue / QA-QC:");
    if (!note || !note.trim()) return;

    fetch(`${DATA_SERVER_API}/api/issues/add`, {
        method: 'POST',
        headers: getCdeAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ filePath: filePath, text: note.trim(), author: currentActiveUserFullName })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast("Đã lưu Issue lên server thành công!");
                cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
                reloadDatabaseData();
            } else {
                showToast("Lỗi lưu Issue: " + data.error);
            }
        })
        .catch(err => showToast("Không kết nối được server CDE!"));
}

function openIssuesModal(filePath) {
    currentActiveFilePath = filePath;
    const issueFileNameEl = document.getElementById('issueFileName');
    if (issueFileNameEl) issueFileNameEl.innerText = filePath.split('/').pop();
    renderIssueListModal(filePath);
    openModal('issuesModal');
}

function renderIssueListModal(filePath) {
    const container = document.getElementById('issueListContainer');
    if (!container) return;
    container.innerHTML = '';
    let issues = serverIssuesDB[filePath] || [];

    if (issues.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted); font-size:0.75rem;">Chưa có issue nào cho file này trên server.</div>`;
        return;
    }

    issues.forEach((iss, index) => {
        let div = document.createElement('div');
        div.style.background = 'var(--bg-input)';
        div.style.padding = '6px 8px';
        div.style.borderRadius = '6px';
        div.style.border = '1px solid var(--border-color)';

        const canDeleteThisIssue = isUserAdmin || (iss.author && iss.author.trim().toLowerCase() === currentActiveUserFullName.trim().toLowerCase());
        const deleteBtnHtml = canDeleteThisIssue
            ? `<span style="cursor:pointer; color:#ef4444;" onclick="deleteIssueFromServer('${filePath}', ${index})">Xóa</span>`
            : ``;

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:0.65rem; color:var(--text-muted);">
                <span>👤 ${iss.author} • ${iss.time}</span>
                ${deleteBtnHtml}
            </div>
            <div style="margin-top:2px; font-weight:500; color:var(--text-heading);">${iss.text}</div>
        `;
        container.appendChild(div);
    });
}

function addIssueToServer() {
    let input = document.getElementById('newIssueInput');
    if (!input) return;
    let text = input.value.trim();
    if (!text || !currentActiveFilePath) return;

    fetch(`${DATA_SERVER_API}/api/issues/add`, {
        method: 'POST',
        headers: getCdeAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ filePath: currentActiveFilePath, text: text, author: currentActiveUserFullName })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                serverIssuesDB[currentActiveFilePath] = data.issues;
                input.value = '';
                renderIssueListModal(currentActiveFilePath);
                cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
                reloadDatabaseData();
                showToast("Đã thêm Issue lên server!");
            }
        })
        .catch(err => showToast("Không kết nối được server CDE!"));
}

function deleteIssueFromServer(filePath, index) {
    fetch(`${DATA_SERVER_API}/api/issues/delete`, {
        method: 'POST',
        headers: getCdeAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ filePath: filePath, index: index })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                if (data.issues.length > 0) {
                    serverIssuesDB[filePath] = data.issues;
                } else {
                    delete serverIssuesDB[filePath];
                }
                renderIssueListModal(filePath);
                cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
                reloadDatabaseData();
                showToast("Đã xóa Issue trên server!");
            }
        })
        .catch(err => showToast("Không kết nối được server CDE!"));
}

function toggleCustomInput(selectEl, customInputId) {
    const customInput = document.getElementById(customInputId);
    if (!customInput) return;

    if (selectEl.value === 'OTHER') {
        customInput.style.display = 'block';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.value = '';
    }
    updateIsoName();
}

function getIsoFieldValue(selectId, customInputId, defaultVal) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return defaultVal;

    if (selectEl.value === 'OTHER') {
        const customVal = document.getElementById(customInputId).value.trim();
        return customVal !== '' ? customVal.toUpperCase() : 'XXX';
    }
    return selectEl.value;
}

function openIsoRenameModal(btn) {
    currentRowElement = btn.closest('tr');
    let fullFileName = currentRowElement.querySelector('.file-code').innerText;

    let lastDotIndex = fullFileName.lastIndexOf('.');
    let baseName = lastDotIndex !== -1 ? fullFileName.substring(0, lastDotIndex) : fullFileName;
    currentExt = lastDotIndex !== -1 ? fullFileName.substring(lastDotIndex + 1) : "pdf";

    let parts = baseName.split('-');
    let prjCode = currentRowElement.getAttribute('data-project') || "Project_01";

    ['iso_originator', 'iso_volume', 'iso_level', 'iso_type', 'iso_role'].forEach(id => {
        const customInput = document.getElementById(id + '_custom');
        if (customInput) {
            customInput.style.display = 'none';
            customInput.value = '';
        }
    });

    if (parts.length === 7) {
        document.getElementById('iso_project').value = parts[0];
        setSelectValueWithCustom('iso_originator', 'iso_originator_custom', parts[1], 'PVI');
        setSelectValueWithCustom('iso_volume', 'iso_volume_custom', parts[2], 'ZZ');
        setSelectValueWithCustom('iso_level', 'iso_level_custom', parts[3], 'ZZ');
        setSelectValueWithCustom('iso_type', 'iso_type_custom', parts[4], 'DR');
        setSelectValueWithCustom('iso_role', 'iso_role_custom', parts[5], 'A');
        document.getElementById('iso_number').value = parts[6];
    } else {
        document.getElementById('iso_project').value = prjCode;
        document.getElementById('iso_originator').value = 'PVI';
        document.getElementById('iso_volume').value = 'ZZ';
        document.getElementById('iso_level').value = 'ZZ';
        document.getElementById('iso_type').value = (currentExt.toLowerCase() === 'rvt' || currentExt.toLowerCase() === 'ifc') ? 'M3' : 'DR';
        document.getElementById('iso_role').value = currentRowElement.getAttribute('data-discipline') === 'STR' ? 'S' : (currentRowElement.getAttribute('data-discipline') === 'MEP' ? 'M' : 'A');
        document.getElementById('iso_number').value = '0001';
    }

    updateIsoName();
    openModal('isoRenameModal');
}

function setSelectValueWithCustom(selectId, customInputId, val, defaultVal) {
    let sel = document.getElementById(selectId);
    if (!sel) return;
    let exists = Array.from(sel.options).some(opt => opt.value === val);
    if (exists) {
        sel.value = val;
    } else {
        sel.value = 'OTHER';
        let customInput = document.getElementById(customInputId);
        if (customInput) {
            customInput.style.display = 'block';
            customInput.value = val;
        }
    }
}

function formatNumberInput(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
}

function updateIsoName() {
    let prjInput = document.getElementById('iso_project');
    let prj = (prjInput ? prjInput.value.trim() : 'PRJ_001').toUpperCase().replace(/[^A-Z0-9_]/g, '');
    let orig = getIsoFieldValue('iso_originator', 'iso_originator_custom', 'PVI');
    let vol = getIsoFieldValue('iso_volume', 'iso_volume_custom', 'ZZ');
    let lvl = getIsoFieldValue('iso_level', 'iso_level_custom', 'ZZ');
    let type = getIsoFieldValue('iso_type', 'iso_type_custom', 'DR');
    let role = getIsoFieldValue('iso_role', 'iso_role_custom', 'A');

    let numInput = document.getElementById('iso_number');
    let num = numInput ? numInput.value.padStart(4, '0') : '0001';

    let newFullName = `${prj}-${orig}-${vol}-${lvl}-${type}-${role}-${num}.${currentExt}`;
    let livePreview = document.getElementById('isoLivePreview');
    if (livePreview) livePreview.innerText = newFullName;
}

async function saveIsoRename() {
    if (!currentRowElement) return;

    let livePreview = document.getElementById('isoLivePreview');
    let newFileName = livePreview ? livePreview.innerText : '';
    let oldPath = currentRowElement.getAttribute('data-path');

    try {
        const res = await fetch(`${DATA_SERVER_API}/api/rename`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
            },
            body: JSON.stringify({ path: oldPath, newName: newFileName })
        });
        const data = await res.json();
        if (data.success) {
            cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
            reloadDatabaseData();
            showToast(`Đổi tên file chuẩn ISO thành công: ${newFileName}`);
            closeModal('isoRenameModal');
        } else {
            showToast("Lỗi: " + (data.error || "Không thể đổi tên"));
        }
    } catch (err) {
        showToast("Không kết nối được server CDE!");
    }
}

function toggleActionDropdown(event, btn) {
    event.stopPropagation();
    document.querySelectorAll('.dropdown.show').forEach(d => {
        if (d !== btn.parentElement) d.classList.remove('show');
    });
    btn.parentElement.classList.toggle('show');
}

document.addEventListener('click', function () {
    document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'));
});

function previewFile(btn) {
    let row = btn.closest('tr');
    document.getElementById('viewFileName').innerText = row.querySelector('.file-code').innerText;
    document.getElementById('viewFilePath').innerText = row.getAttribute('data-path');
    document.getElementById('viewFileState').innerText = row.querySelector('.container-state').innerText;
    document.getElementById('viewFileRev').innerText = row.querySelector('.revision-value').innerText;
    const btn3d = document.getElementById('viewOpen3dBtn');
    if (btn3d) btn3d.style.display = /\.ifc$/i.test(row.getAttribute('data-path') || '') ? '' : 'none';
    const recallInfo = getRecalledDB()[row.getAttribute('data-path')];
    if (recallInfo) {
        document.getElementById('viewFileState').innerText += ` | ⟲ ĐÃ THU HỒI bởi ${recallInfo.by} (${formatRecallTime(recallInfo.at)}) - Lý do: ${recallInfo.reason}`;
    }
    openModal('viewModal');
}

function copyViewPath() {
    let pathText = document.getElementById('viewFilePath').innerText;
    navigator.clipboard.writeText(pathText);
    showToast("Đã sao chép đường dẫn file vào clipboard!");
}

function downloadFile(btn) {
    let row = btn.closest('tr');
    let filePath = row.getAttribute('data-path');
    let fileName = row.querySelector('.file-code').innerText;

    downloadCdeFile(filePath, fileName);
}

function uploadNewRevision(btn) {
    let row = btn.closest('tr');
    let newRev = prompt(`Nhập mã Revision mới:`, "P01.02");
    if (newRev && newRev.trim()) {
        row.querySelector('.rev-tag').innerText = newRev.trim();
        showToast(`Cập nhật phiên bản: ${newRev.trim()}`);
    }
}

function viewVersionHistory(btn) {
    let row = btn.closest('tr');
    showToast(`Phiên bản hiện tại của file: ${row.querySelector('.file-code').innerText}`);
}

let metadataEditingRow = null;

function editMetadata(btn) {
    const row = btn.closest('tr');
    metadataEditingRow = row;
    document.getElementById('metaFileName').innerText = row.querySelector('.file-code').innerText;
    document.getElementById('metaTitle').value = row.dataset.title || '';
    document.getElementById('metaDescription').value = row.dataset.description || '';
    document.getElementById('metaStatus').value = row.dataset.status || 'PENDING';
    document.getElementById('metaSuitability').value = row.getAttribute('data-suitability') || 'S0';
    const discipline = row.getAttribute('data-discipline') || 'ARC';
    const disciplineSelect = document.getElementById('metaDiscipline');
    const customDisciplineInput = document.getElementById('metaCustomDiscipline');
    const isCustomDiscipline = !Array.from(disciplineSelect.options).some(option => option.value === discipline);
    disciplineSelect.value = isCustomDiscipline ? 'CUSTOM' : discipline;
    customDisciplineInput.value = isCustomDiscipline ? discipline : '';
    customDisciplineInput.classList.toggle('hidden', !isCustomDiscipline);
    customDisciplineInput.required = isCustomDiscipline;
    openModal('metadataModal');
}

function toggleCustomDiscipline(select) {
    const input = document.getElementById('metaCustomDiscipline');
    const isCustom = select.value === 'CUSTOM';
    input.classList.toggle('hidden', !isCustom);
    input.required = isCustom;
    if (isCustom) input.focus();
}

async function saveMetadata() {
    if (!metadataEditingRow) return;
    const row = metadataEditingRow;
    const title = document.getElementById('metaTitle').value.trim().toLocaleUpperCase('vi-VN');
    const description = document.getElementById('metaDescription').value.trim();
    const status = document.getElementById('metaStatus').value;
    const suitability = document.getElementById('metaSuitability').value;
    const disciplineSelect = document.getElementById('metaDiscipline');
    const discipline = disciplineSelect.value === 'CUSTOM'
        ? document.getElementById('metaCustomDiscipline').value.trim()
        : disciplineSelect.value;
    if (!discipline) {
        showToast('Vui lòng nhập tên bộ môn.');
        return;
    }
    const saveButton = document.querySelector('#metadataModal .btn-primary');
    if (saveButton) saveButton.disabled = true;
    try {
        const response = await fetch(`${DATA_SERVER_API}/api/file-metadata`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
            },
            body: JSON.stringify({
                filePath: row.getAttribute('data-path'),
                title,
                description,
                status,
                suitability,
                discipline
            })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Không thể lưu metadata.');
        }

        const savedTitle = typeof result.metadata?.title === 'string' ? result.metadata.title : title;
        const filePath = row.getAttribute('data-path');
        closeModal('metadataModal');
        metadataEditingRow = null;
        await reloadDatabaseData();
        const refreshedRow = Array.from(document.querySelectorAll('#cdeMasterTable tbody tr'))
            .find(tableRow => tableRow.getAttribute('data-path') === filePath);
        if (refreshedRow) {
            refreshedRow.dataset.title = savedTitle;
            const titleLine = refreshedRow.querySelector('.document-title');
            if (titleLine) {
                titleLine.textContent = savedTitle || '—';
                titleLine.title = savedTitle;
            }
        }
        showToast(typeof result.metadata?.title === 'string'
            ? 'Đã cập nhật metadata file.'
            : 'Metadata đã lưu nhưng server chưa xác nhận Tiêu đề. Vui lòng tải lại server CDE.');
    } catch (error) {
        showToast(error.message || 'Không thể lưu metadata.');
    } finally {
        if (saveButton) saveButton.disabled = false;
    }
}

function shareFile(btn) {
    let row = btn.closest('tr');
    navigator.clipboard.writeText(window.location.href + "#" + row.querySelector('.file-code').innerText);
    showToast(`Đã sao chép liên kết tệp!`);
}

async function deleteRowFile(btn) {
    let row = btn.closest('tr');
    let filePath = row.getAttribute('data-path');
    let state = row.getAttribute('data-state');

    if (typeof checkActionPermission === 'function' && !checkActionPermission('DELETE', state)) {
        showToast("⚠️ Bạn không có quyền xóa tệp tin này!");
        return;
    }

    if (confirm(`Bạn có chắc chắn muốn xóa tệp tin này khỏi hệ thống CDE?`)) {
        try {
            const res = await fetch(`${DATA_SERVER_API}/api/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
                },
                body: JSON.stringify({ path: filePath })
            });
            const data = await res.json();
            if (data.success) {
                cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
                reloadDatabaseData();
                showToast(`Đã xóa tệp tin khỏi CDE thành công!`);
            } else {
                showToast("Lỗi: " + (data.error || "Không thể xóa"));
            }
        } catch (err) {
            showToast("Không kết nối được server CDE!");
        }
    }
}

function buildTableFromTree(node) {
    if (!node) return;

    if (node.type === 'folder' && isFolderLocked(node)) {
        return;
    }

    if (node.type === 'file') {
        if (isPathLocked(node.path)) return;
        appendFileToTable(node.name, node.path, node.size || 0, node.metadata || {});
    } else if (node.children) {
        node.children.forEach(child => buildTableFromTree(child));
    }
}

function appendFileToTable(fileName, relativePath, fileSize = 0, metadata = {}) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    const upperPath = relativePath.toUpperCase();
    const pathParts = relativePath.split('/');

    let prjCode = 'Gốc';
    if (pathParts.length > 3) {
        prjCode = pathParts[2];
    } else if (pathParts.length === 3 && !pathParts[2].includes('.')) {
        prjCode = pathParts[2];
    }

    let state = '01_WIP';
    let suit = 'S0';
    let suitText = 'S0 - Draft';
    let badgeClass = 'badge-wip';
    let revText = 'P01.01';

    if (upperPath.includes('02_SHARED')) {
        state = '02_SHARED'; suit = 'S1'; suitText = 'S1 - Coordination'; badgeClass = 'badge-shared'; revText = 'P01.00';
    } else if (upperPath.includes('03_PUBLISHED')) {
        state = '03_PUBLISHED'; suit = 'A1'; suitText = 'A1 - Construction'; badgeClass = 'badge-published'; revText = 'C01.00';
    } else if (upperPath.includes('04_ARCHIVE')) {
        state = '04_ARCHIVE'; suit = 'S0'; suitText = 'S0 - Archive'; badgeClass = 'badge-archive'; revText = 'P00.00';
    }

    let disc = 'ARC';
    if (fileName.includes('STR') || fileName.includes('KETCAU')) disc = 'STR';
    else if (fileName.includes('MEP') || fileName.includes('CODIEN')) disc = 'MEP';
    else if (fileName.includes('N/A') || fileName.includes('KHAC')) disc = 'N/A';

    const validSuitabilities = ['S0', 'S1', 'S2', 'S3', 'S4', 'A1', 'A2'];
    const validDisciplines = ['ARC', 'STR', 'MEP', 'N/A'];
    if (validSuitabilities.includes(metadata.suitability)) suit = metadata.suitability;
    if (typeof metadata.discipline === 'string' && metadata.discipline.trim()) {
        disc = metadata.discipline.trim().slice(0, 100);
    } else if (validDisciplines.includes(metadata.discipline)) {
        disc = metadata.discipline;
    }
    const suitLabels = {
        S0: 'S0 - Draft', S1: 'S1 - Coordination', S2: 'S2 - Reference',
        S3: 'S3 - Review', S4: 'S4 - Approval', A1: 'A1 - Construction',
        A2: 'A2 - As-Built'
    };
    suitText = suitLabels[suit];

    const formattedSize = formatFileSize(fileSize);
    const status = ['PENDING', 'APPROVED', 'REJECTED'].includes(metadata.status) ? metadata.status : 'PENDING';
    const statusLabels = { PENDING: 'Đang chờ', APPROVED: 'Phê duyệt', REJECTED: 'Từ chối' };
    const statusClasses = { PENDING: 'badge-pending', APPROVED: 'badge-approved', REJECTED: 'badge-rejected' };
    const createdAt = formatMetadataDate(metadata.createdAt);
    const updatedAt = formatMetadataDate(metadata.updatedAt);

    const tr = document.createElement('tr');
    tr.setAttribute('data-project', prjCode);
    tr.setAttribute('data-state', state);
    tr.setAttribute('data-suitability', suit);
    tr.setAttribute('data-discipline', disc);
    tr.setAttribute('data-path', relativePath);
    tr.setAttribute('data-size', Number(fileSize) || 0);
    tr.dataset.title = metadata.title || '';
    tr.dataset.description = metadata.description || '';
    tr.dataset.author = metadata.author || '';
    tr.dataset.status = status;
    if (getRecalledDB()[relativePath]) tr.classList.add('is-recalled');

    tr.onclick = (e) => {
        if (e.target.closest('button') || e.target.closest('.dropdown')) return;

        document.querySelectorAll('#cdeMasterTable tbody tr').forEach(r => r.classList.remove('highlight-row'));
        tr.classList.add('highlight-row');

        document.querySelectorAll('.tree-node-item').forEach(el => el.classList.remove('highlighted'));
        const targetTreeItem = document.querySelector(`.tree-node-item[data-path="${CSS.escape(relativePath)}"]`);
        if (targetTreeItem) {
            targetTreeItem.classList.add('highlighted');
            targetTreeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    };

    tr.innerHTML = `
        <td><span class="badge badge-prj">${prjCode}</span></td>
        <td class="file-details">
            <span class="file-code" title="${escapeAttr(relativePath)}">${escapeAttr(fileName)}</span>
            <span class="document-title" title="${escapeAttr(metadata.title || '')}">${escapeAttr(metadata.title || '—')}</span>
            <span class="document-description" title="${escapeAttr(metadata.description || '')}">Mô tả: ${escapeAttr(metadata.description || '—')}</span>
        </td>
        <td class="metadata-dates align-right"><span class="file-author">${escapeAttr(metadata.author || '—')}</span><span>Khởi tạo: ${createdAt}</span><span>Cập nhật: ${updatedAt}</span></td>
        <td class="file-size align-right">${formattedSize}</td>
        <td><span class="badge ${badgeClass} container-state">${state}</span></td>
        <td class="align-right"><span class="badge ${statusClasses[status]} approval-status">${statusLabels[status]}</span></td>
        <td><span class="badge badge-${suit.toLowerCase()} suitability-value">${suitText}</span></td>
        <td class="align-center"><span class="rev-tag revision-value">${revText}</span></td>
        <td class="discipline-value align-center"><b>${escapeAttr(disc)}</b></td>
        <td class="action-btns"><div class="action-controls">${getActionButtons(state, relativePath)}</div></td>
    `;
    tbody.appendChild(tr);
}

const doughnutCenterText = {
    id: 'centerText',
    afterDraw(chart, args, options) {
        if (!options || !options.main) return;
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const x = (chartArea.left + chartArea.right) / 2;
        const y = (chartArea.top + chartArea.bottom) / 2;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = options.color || '#f1f5f9';
        ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(options.main, x, y, chartArea.width * 0.9);
        ctx.restore();
    }
};

function updateDoughnutChart(instance, canvasId, labels, values, colors, centerMain, tooltipLabel, showLegend = false) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return instance;

    const hasData = values.some(value => value > 0);
    const displayValues = hasData ? values : [1];
    const displayLabels = hasData ? labels : ['Chưa có dữ liệu'];
    const displayColors = hasData ? colors : ['#334155'];
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-heading').trim() || '#f1f5f9';
    const data = {
        labels: displayLabels,
        datasets: [{
            data: displayValues,
            backgroundColor: displayColors,
            borderWidth: 0,
            hoverOffset: hasData ? 3 : 0
        }]
    };

    if (instance) {
        instance.data = data;
        instance.options.plugins.centerText = { main: centerMain, color: textColor };
        instance.options.plugins.legend.display = showLegend && hasData;
        instance.options.plugins.legend.labels.color = textColor;
        instance.options.plugins.tooltip.enabled = hasData;
        instance.options.plugins.tooltip.callbacks.label = tooltipLabel;
        instance.update();
        return instance;
    }

    return new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data,
        plugins: [doughnutCenterText],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 450 },
            layout: { padding: 1 },
            plugins: {
                centerText: { main: centerMain, color: textColor },
                legend: {
                    display: showLegend && hasData,
                    position: 'right',
                    labels: {
                        color: textColor,
                        font: { family: '"Plus Jakarta Sans", sans-serif', size: 8, weight: '600' },
                        boxWidth: 7,
                        boxHeight: 7,
                        padding: 3,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    enabled: hasData,
                    callbacks: { label: tooltipLabel }
                }
            },
            cutout: '72%'
        }
    });
}

function formatCompactStorageParts(bytes) {
    if (!bytes) return { value: '0', unit: 'KB' };
    const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, index);
    return {
        value: String(parseFloat(value.toFixed(index >= 2 ? 1 : 0))),
        unit: units[index]
    };
}

function formatCompactStorage(bytes) {
    const parts = formatCompactStorageParts(bytes);
    return `${parts.value} ${parts.unit}`;
}

function updateStorageChart(storageByState, totalBytes) {
    const states = ['01_WIP', '02_SHARED', '03_PUBLISHED', '04_ARCHIVE'];
    const values = states.map(state => storageByState[state] || 0);
    const colors = ['#38bdf8', '#fbbf24', '#34d399', '#94a3b8'];
    const parts = formatCompactStorageParts(totalBytes);
    const unitEl = document.getElementById('storageChartUnit');
    if (unitEl) unitEl.textContent = parts.unit;
    storageChartInstance = updateDoughnutChart(
        storageChartInstance,
        'storageChart',
        states,
        values,
        colors,
        parts.value,
        context => ` ${context.label}: ${formatFileSize(context.raw)}`,
        true
    );
}

function updateIssueChart(filesWithIssues, recalledFiles, recalledWithIssues, signedFiles, signedOnlyFiles) {
    const recalledWithoutIssues = Math.max(recalledFiles - recalledWithIssues, 0);
    const note = document.getElementById('issueChartNote');
    const card = document.getElementById('issueAnalyticsCard');
    const attentionCount = filesWithIssues + recalledWithoutIssues + signedOnlyFiles;
    if (note) {
        note.textContent = attentionFilesOnly
            ? `Đang lọc\n${filesWithIssues} tệp có ghi chú\n${recalledFiles} tệp bị thu hồi\n${signedFiles} tệp được ký số`
            : `${filesWithIssues} tệp có ghi chú\n${recalledFiles} tệp bị thu hồi\n${signedFiles} tệp được ký số`;
    }
    if (card) {
        card.classList.toggle('is-active', attentionFilesOnly);
        card.setAttribute('aria-pressed', String(attentionFilesOnly));
    }
    issueChartInstance = updateDoughnutChart(
        issueChartInstance,
        'issueChart',
        ['Issues', 'Thu hồi', 'Ký số'],
        [filesWithIssues, recalledWithoutIssues, signedOnlyFiles],
        ['#fb7185', '#f59e0b', '#22c55e'],
        String(attentionCount),
        context => ` ${context.label}: ${context.raw} tệp`
    );
}

function initOrUpdateFileTypeChart(typeCounts, totalFiles) {
    const labels = ['PDF', 'RVT', 'IFC', 'DWG', 'XML', 'Excel', 'Word', 'Khác'];
    const values = [
        typeCounts.pdf || 0, typeCounts.rvt || 0, typeCounts.ifc || 0, typeCounts.dwg || 0,
        typeCounts.xml || 0, typeCounts.excel || 0, typeCounts.word || 0, typeCounts.other || 0
    ];
    const colors = ['#ef4444', '#38bdf8', '#34d399', '#f59e0b', '#a855f7', '#10b981', '#2563eb', '#64748b'];
    fileTypeChartInstance = updateDoughnutChart(
        fileTypeChartInstance,
        'fileTypeChart',
        labels,
        values,
        colors,
        String(totalFiles),
        context => ` ${context.label}: ${context.raw} tệp`,
        true
    );
}

function applyFilters() {
    const searchInput = document.getElementById('searchInput');
    const stateFilter = document.getElementById('stateFilter');
    const suitFilter = document.getElementById('suitFilter');
    const projectSelect = document.getElementById('projectSelect');

    const query = searchInput ? searchInput.value.toLowerCase() : '';
    const stateVal = stateFilter ? stateFilter.value : 'ALL';
    const suitVal = suitFilter ? suitFilter.value : 'ALL';
    const projVal = projectSelect ? projectSelect.value : 'ALL';

    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');

    let wipCount = 0, sharedCount = 0, pubCount = 0, arcCount = 0;
    let typeCounts = { pdf: 0, rvt: 0, ifc: 0, dwg: 0, xml: 0, excel: 0, word: 0, other: 0 };
    const storageByState = { '01_WIP': 0, '02_SHARED': 0, '03_PUBLISHED': 0, '04_ARCHIVE': 0 };
    let totalVisibleFiles = 0;
    let totalStorageBytes = 0;
    let filesWithIssues = 0;
    let recalledFiles = 0;
    let recalledWithIssues = 0;
    let signedFiles = 0;
    let signedOnlyFiles = 0;

    rows.forEach(row => {
        const prj = row.getAttribute('data-project') || '';
        const state = row.getAttribute('data-state') || '';
        const suit = row.getAttribute('data-suitability') || '';
        const filePath = row.getAttribute('data-path') || '';
        const isRecalled = row.classList.contains('is-recalled');
        const text = row.innerText.toLowerCase();
        const fileName = (row.querySelector('.file-code') ? row.querySelector('.file-code').innerText : '').toLowerCase();

        let matchesProj = canUserAccessProject(prj) && (projVal === 'ALL' || prj === projVal);
        let matchesFolder = !selectedFolderPathFilter ||
            filePath.startsWith(`${selectedFolderPathFilter.replace(/\/+$/, '')}/`);
        let matchesState = (stateVal === 'ALL' || state === stateVal);
        let matchesSuit = (suitVal === 'ALL' || suit === suitVal);
        let matchesSearch = (!query || text.includes(query));
        let matchesRecall = (!hideRecalledFilesFlag || !isRecalled || attentionFilesOnly);
        const fileIssues = serverIssuesDB[row.getAttribute('data-path')] || [];
        const hasIssues = Array.isArray(fileIssues) && fileIssues.length > 0;
        const isSigned = !!getSignatureRecord(filePath);
        let matchesAttention = (!attentionFilesOnly || hasIssues || isRecalled || isSigned);

        if (matchesProj && matchesFolder && matchesState && matchesSuit && matchesSearch && matchesRecall && matchesAttention) {
            row.style.display = '';
            if (state === '01_WIP') wipCount++;
            else if (state === '02_SHARED') sharedCount++;
            else if (state === '03_PUBLISHED') pubCount++;
            else if (state === '04_ARCHIVE') arcCount++;
            totalVisibleFiles++;
            const fileSize = Number(row.getAttribute('data-size')) || 0;
            totalStorageBytes += fileSize;
            if (Object.prototype.hasOwnProperty.call(storageByState, state)) storageByState[state] += fileSize;

            if (isSigned) {
                signedFiles++;
                if (!hasIssues && !isRecalled) signedOnlyFiles++;
            }
            if (isRecalled) recalledFiles++;
            if (hasIssues) {
                filesWithIssues++;
                if (isRecalled) recalledWithIssues++;
            }

            // Phân loại đếm định dạng tệp tin
            if (fileName.endsWith('.pdf')) typeCounts.pdf++;
            else if (fileName.endsWith('.rvt')) typeCounts.rvt++;
            else if (fileName.endsWith('.ifc')) typeCounts.ifc++;
            else if (fileName.endsWith('.dwg') || fileName.endsWith('.dxf')) typeCounts.dwg++;
            else if (fileName.endsWith('.xml')) typeCounts.xml++;
            else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) typeCounts.excel++;
            else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) typeCounts.word++;
            else typeCounts.other++;
        } else {
            row.style.display = 'none';
        }
    });

    const wipEl = document.getElementById('card-wip');
    const sharedEl = document.getElementById('card-shared');
    const pubEl = document.getElementById('card-pub');
    const arcEl = document.getElementById('card-arc');

    if (wipEl) wipEl.innerText = `${wipCount} Files`;
    if (sharedEl) sharedEl.innerText = `${sharedCount} Files`;
    if (pubEl) pubEl.innerText = `${pubCount} Files`;
    if (arcEl) arcEl.innerText = `${arcCount} Files`;

    // Cập nhật biểu đồ trực quan Chart.js
    initOrUpdateFileTypeChart(typeCounts, totalVisibleFiles);
    updateStorageChart(storageByState, totalStorageBytes);
    updateIssueChart(filesWithIssues, recalledFiles, recalledWithIssues, signedFiles, signedOnlyFiles);
}

function toggleAttentionFiles() {
    attentionFilesOnly = !attentionFilesOnly;
    applyFilters();
    showToast(attentionFilesOnly
        ? "Đang lọc các tệp có ghi chú QA/QC, đã thu hồi hoặc ký số."
        : "Đã bỏ lọc ghi chú, tệp thu hồi và tệp ký số.");
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('cde_theme', newTheme);
    updateThemeUI(newTheme);
    applyFilters();
}

function resetSearchInput() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    const hadValue = !!searchInput.value;
    searchInput.value = '';
    if (hadValue) applyFilters();
}

function updateThemeUI(theme) {
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    if (themeIcon && themeText) {
        themeIcon.innerHTML = theme === 'dark'
            ? `<svg class="svg-icon-sm" viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1z"/></svg>`
            : `<svg class="svg-icon-sm" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>`;
        themeText.innerText = theme === 'dark' ? 'Light' : 'Dark';
    }
}

function openModal(id) {
    if (window.CdeChat && window.innerWidth <= 1024) CdeChat.close();
    if (id === 'uploadModal') populateUploadFolderOptions();
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
    const rememberSession = document.getElementById('rememberVnptSession');
    if (id === 'otpSignModal' && rememberSession && !rememberSession.checked) {
        clearVnptSessionOnServer();
        vnptSessionReady = false;
        currentCredentialId = '';
    }
}

function openGateModal(btnBtn) {
    currentRowElement = btnBtn.closest('tr');
    const gateFileName = document.getElementById('gateFileName');
    if (gateFileName) gateFileName.innerText = currentRowElement.querySelector('.file-code').innerText;
    openModal('gateModal');
}

function validateISOFileName() {
    let inputEl = document.getElementById('testFileNameInput');
    let input = inputEl ? inputEl.value.trim() : '';
    if (!input && inputEl) input = inputEl.placeholder;
    let regex = /^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[0-9]{4}\.[a-z0-9]+$/i;

    const resSuccess = document.getElementById('valResultSuccess');
    const resError = document.getElementById('valResultError');
    if (resSuccess) resSuccess.style.display = 'none';
    if (resError) resError.style.display = 'none';

    if (regex.test(input)) {
        if (resSuccess) resSuccess.style.display = 'block';
    } else {
        if (resError) resError.style.display = 'block';
    }
}

function populateUploadFolderOptions() {
    const select = document.getElementById('uploadTargetFolderSelect');
    if (!select) return;
    select.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Chọn thư mục đích —';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    function addFolders(parent, depth = 0) {
        if (parent.type === 'folder') {
            if (depth === 1) {
                let isAssigned = canUserAccessProject(parent.name);
                if (!isAssigned) {
                    return;
                }
            }

            if (depth > 0) {
                let opt = document.createElement('option');
                opt.value = parent.path;
                let indent = '—'.repeat(Math.max(0, depth - 1));
                opt.innerText = indent ? `${indent} ${parent.name}` : parent.name;
                select.appendChild(opt);
            }

            if (parent.children) {
                parent.children.forEach(child => addFolders(child, depth + 1));
            }
        }
    }
    if (virtualTreeData) {
        addFolders(virtualTreeData, 0);
    }
}

async function executeUploadFiles() {
    const fileInput = document.getElementById('fileUploadInput');
    const targetFolderSelect = document.getElementById('uploadTargetFolderSelect');
    if (!targetFolderSelect || !targetFolderSelect.value) {
        showToast("Vui lòng chọn thư mục đích CDE!");
        return;
    }
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showToast("Vui lòng chọn ít nhất một tệp để tải lên!");
        return;
    }

    const targetFolder = targetFolderSelect.value;
    const formData = new FormData();
    formData.append('targetFolder', targetFolder);
    formData.append('title', document.getElementById('uploadMetadataTitle').value.trim());
    formData.append('description', document.getElementById('uploadMetadataDescription').value.trim());
    formData.append('status', document.getElementById('uploadMetadataStatus').value);
    formData.append('suitability', document.getElementById('uploadMetadataSuitability').value);
    formData.append('discipline', document.getElementById('uploadMetadataDiscipline').value);
    for (let i = 0; i < fileInput.files.length; i++) {
        formData.append('files', fileInput.files[i]);
    }

    showToast("Đang tải lên tệp vào CDE...");
    try {
        const res = await fetch(`${DATA_SERVER_API}/api/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}` },
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            showToast("Tải lên tệp thành công!");
            closeModal('uploadModal');
            fileInput.value = '';
            document.getElementById('uploadMetadataTitle').value = '';
            document.getElementById('uploadMetadataDescription').value = '';
            document.getElementById('uploadMetadataStatus').value = 'PENDING';
            document.getElementById('uploadMetadataSuitability').value = 'S0';
            document.getElementById('uploadMetadataDiscipline').value = 'ARC';
            cdeSyncChannel.postMessage({ type: 'REFRESH_CDE_DATA' });
            reloadDatabaseData();
        } else {
            showToast("Lỗi tải lên: " + (data.error || "Không rõ nguyên nhân"));
        }
    } catch (err) {
        showToast("Không kết nối được server CDE khi tải lên!");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.metadata-title-input').forEach(input => {
        input.addEventListener('input', () => {
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const upperValue = input.value.toLocaleUpperCase('vi-VN');
            if (input.value !== upperValue) {
                input.value = upperValue;
                input.setSelectionRange(start, end);
            }
        });
    });

    const savedTheme = localStorage.getItem('cde_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeUI(savedTheme);

    resetSearchInput();

    const issueCard = document.getElementById('issueAnalyticsCard');
    if (issueCard) {
        issueCard.addEventListener('click', toggleAttentionFiles);
        issueCard.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleAttentionFiles();
            }
        });
    }

    const dropZone = document.getElementById('dropZone');
    const fileUploadInput = document.getElementById('fileUploadInput');
    if (dropZone && fileUploadInput) {
        dropZone.onclick = () => fileUploadInput.click();
        dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; };
        dropZone.ondragleave = () => { dropZone.style.borderColor = 'var(--border-color)'; };
        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--border-color)';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                fileUploadInput.files = e.dataTransfer.files;
                showToast(`Đã chọn ${e.dataTransfer.files.length} tệp.`);
            }
        };
        fileUploadInput.onchange = () => {
            if (fileUploadInput.files && fileUploadInput.files.length > 0) {
                showToast(`Đã chọn ${fileUploadInput.files.length} tệp.`);
            }
        };
    }

    reloadDatabaseData();

    if (window.CdeChat) {
        window.CdeChat.init({
            apiBase: () => DATA_SERVER_API,
            getUser: () => JSON.parse(localStorage.getItem('currentUser') || '{}')
        });
    }
});

window.addEventListener('pageshow', () => {
    resetSearchInput();
    window.setTimeout(resetSearchInput, 0);
});
window.addEventListener('load', resetSearchInput);
window.setInterval(() => {
    if (currentProjectDeadline) renderProjectDeadline();
}, 60_000);

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    searchInput.addEventListener('focus', () => {
        searchInput.removeAttribute('readonly');
    }, { once: true });
    searchInput.addEventListener('pointerdown', () => {
        searchInput.removeAttribute('readonly');
    }, { once: true });
});

function toggleVnptPasswordVisibility() {
    const pwdInput = document.getElementById('vnptPasswordInput');
    const icon = document.getElementById('toggleVnptPasswordIcon');
    if (!pwdInput || !icon) return;

    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        pwdInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}