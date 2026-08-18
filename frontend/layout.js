/* ==========================================================================
   PV INCONS - CDE COMMAND CENTER v3.0 PRO LOGIC & LOCAL CDE TREE INTEGRATION
   ========================================================================== */

// --- CẤU HÌNH GOOGLE DRIVE API ---
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'YOUR_GOOGLE_API_KEY';
const SHARED_FOLDER_ID = 'YOUR_SHARED_DRIVE_FOLDER_ID';

let tokenClient;
let gdriveAccessToken = null;

// 1. Khởi tạo Google APIs Client & OAuth 2.0 Identity Client
function initGoogleDriveSDK() {
    if (window.gapi) {
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    apiKey: GOOGLE_API_KEY,
                    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
                });
                console.log("Google API Client đã sẵn sàng.");
            } catch (err) {
                console.error("Lỗi khởi tạo Google API Client:", err);
            }
        });
    }

    if (window.google && google.accounts && google.accounts.oauth2) {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.readonly',
            callback: (response) => {
                if (response.error) {
                    console.error("Xác thực Google OAuth2 lỗi:", response);
                    return;
                }
                gdriveAccessToken = response.access_token;
                onGoogleDriveConnected();
            },
        });
    }
}

// 2. Kích hoạt Xác thực OAuth 2.0 khi người dùng click "Kết nối Google Drive Shared"
function handleGoogleDriveAuth() {
    if (!tokenClient) {
        alert("Đang tải Google SDK Library, vui lòng thử lại sau 3 giây...");
        return;
    }
    if (!gdriveAccessToken) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        fetchGoogleDriveFiles(SHARED_FOLDER_ID);
    }
}

// 3. Xử lý UI khi Kết nối Thành Công
function onGoogleDriveConnected() {
    const statusDot = document.getElementById('gdriveStatusDot');
    const storageName = document.getElementById('gdriveStorageName');
    const lastSync = document.getElementById('gdriveLastSync');
    const btnConnect = document.getElementById('btnConnectGDrive');

    if (statusDot) statusDot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
    if (storageName) storageName.innerText = 'Shared Drive: Active';
    if (lastSync) lastSync.innerText = 'Cập nhật: ' + new Date().toLocaleTimeString('vi-VN');
    
    if (btnConnect) {
        btnConnect.className = 'bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-blue-600/20 cursor-pointer';
        btnConnect.innerHTML = `<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i><span class="hidden lg:inline">Đồng bộ Drive</span>`;
        if (window.lucide) lucide.createIcons();
    }

    appendLiveFeedSystem('Google Drive API', 'Đã kết nối thành công với bộ nhớ dùng chung Cloud CDE!', 'Vừa xong');
    fetchGoogleDriveFiles(SHARED_FOLDER_ID);
}

// 4. Gọi Google Drive REST API v3 để truy vấn danh sách bản vẽ / file
async function fetchGoogleDriveFiles(folderId) {
    if (!gapi.client.drive) {
        console.warn("Chưa cấu hình API Key hoặc Client ID hợp lệ.");
        return;
    }
    try {
        const response = await gapi.client.drive.files.list({
            'q': `'${folderId}' in parents and trashed = false`,
            'fields': 'files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink)',
            'supportsAllDrives': true,
            'includeItemsFromAllDrives': true
        });

        const files = response.result.files;
        renderDriveFilesToCDETree(files);
    } catch (err) {
        console.error('Lỗi khi tải file từ Google Drive:', err);
    }
}

// 5. Render danh sách file Google Drive trực tiếp vào Cây Thư Mục CDE
function renderDriveFilesToCDETree(files) {
    const treeContainer = document.getElementById('cdeTreeContainer');
    if (!treeContainer) return;

    if (!files || files.length === 0) {
        treeContainer.innerHTML = `<div class="p-4 text-xs text-slate-500 font-mono">Không tìm thấy file nào trong thư mục Shared Drive.</div>`;
        return;
    }

    let filesListHTML = files.map(file => {
        const fileSizeMB = file.size ? (file.size / (1024 * 1024)).toFixed(1) + ' MB' : 'Folder';
        let iconName = 'file';
        let badgeStyle = 'bg-slate-800 text-slate-300';

        if (file.name.endsWith('.rvt')) { iconName = 'box'; badgeStyle = 'bg-blue-500/10 text-blue-400 border border-blue-500/20'; }
        else if (file.name.endsWith('.dwg')) { iconName = 'file-code'; badgeStyle = 'bg-amber-500/10 text-amber-400 border border-amber-500/20'; }
        else if (file.name.endsWith('.pdf')) { iconName = 'file-text'; badgeStyle = 'bg-rose-500/10 text-rose-400 border border-rose-500/20'; }

        return `
            <li onclick="window.open('${file.webViewLink || '#'}', '_blank')" class="cde-file-item p-2 hover:bg-slate-800/80 rounded-lg cursor-pointer flex items-center justify-between group transition">
                <div class="flex items-center gap-2 min-w-0">
                    <i data-lucide="${iconName}" class="w-4 h-4 text-emerald-400 shrink-0"></i>
                    <span class="text-slate-200 group-hover:text-emerald-400 transition font-mono truncate text-xs">${file.name}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">Google Drive</span>
                    <span class="text-[10px] ${badgeStyle} px-2 py-0.5 rounded">${fileSizeMB}</span>
                </div>
            </li>
        `;
    }).join('');

    treeContainer.innerHTML = `
        <div class="text-xs space-y-1 select-none">
            <div onclick="toggleFolder(this)" class="flex items-center gap-2 p-2 hover:bg-slate-800/60 rounded-xl cursor-pointer text-emerald-400 font-semibold transition">
                <i data-lucide="chevron-down" class="w-4 h-4 transform transition-transform"></i>
                <i data-lucide="cloud" class="w-4 h-4"></i>
                <span>Drive Shared (Đã đồng bộ Live)</span>
            </div>
            <ul class="pl-6 space-y-1 border-l border-emerald-800/40 ml-4 text-slate-400">
                ${filesListHTML}
            </ul>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
}

/* ==========================================================================
   6. XỬ LÝ ĐỌC & BUILD CÂY THƯ MỤC CỤC BỘ (LOCAL CDE TREE HIERARCHY)
   ========================================================================== */

// 6.1. Kích hoạt chọn thư mục từ máy tính
async function selectLocalCDEFolder() {
    try {
        if ('showDirectoryPicker' in window) {
            const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
            const files = [];
            
            await readDirectoryRecursive(dirHandle, '', files);
            
            if (files.length === 0) {
                alert("Thư mục đã chọn không chứa tệp khả dụng hoặc không thể truy cập.");
                return;
            }
            renderLocalFilesToCDETree(dirHandle.name, files);
        } else {
            triggerInputFolderSelect();
        }
    } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn("Chuyển sang phương thức HTML5 Folder Input:", err);
        triggerInputFolderSelect();
    }
}

// 6.2. Đọc đệ quy an toàn tất cả các thư mục con
async function readDirectoryRecursive(dirHandle, currentPath, fileList) {
    try {
        for await (const entry of dirHandle.values()) {
            if (entry.name.startsWith('.') || entry.name.startsWith('$')) continue;

            const relativePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

            if (entry.kind === 'file') {
                try {
                    const file = await entry.getFile();
                    fileList.push({
                        name: entry.name,
                        path: relativePath,
                        size: file.size,
                        type: file.type,
                        lastModified: new Date(file.lastModified).toLocaleDateString('vi-VN')
                    });
                } catch (fileErr) {
                    console.warn(`Bỏ qua tệp không thể truy cập: ${relativePath}`, fileErr);
                }
            } else if (entry.kind === 'directory') {
                try {
                    const subDirHandle = await dirHandle.getDirectoryHandle(entry.name);
                    await readDirectoryRecursive(subDirHandle, relativePath, fileList);
                } catch (dirErr) {
                    console.warn(`Bỏ qua thư mục bị hạn chế quyền: ${relativePath}`, dirErr);
                }
            }
        }
    } catch (err) {
        console.warn(`Lỗi khi quét thư mục: ${dirHandle.name}`, err);
    }
}

// 6.3. Fallback HTML5 Folder Input
function triggerInputFolderSelect() {
    let input = document.getElementById('localFolderInput');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'localFolderInput';
        input.webkitdirectory = true;
        input.multiple = true;
        input.style.display = 'none';
        document.body.appendChild(input);

        input.addEventListener('change', (e) => {
            const rawFiles = Array.from(e.target.files);
            if (rawFiles.length === 0) return;

            const validFiles = rawFiles.filter(f => !f.name.startsWith('.') && !f.name.startsWith('$'));

            const files = validFiles.map(f => ({
                name: f.name,
                path: f.webkitRelativePath,
                size: f.size,
                lastModified: new Date(f.lastModified).toLocaleDateString('vi-VN')
            }));
            
            const rootFolderName = files[0]?.path.split('/')[0] || 'Local_CDE';
            renderLocalFilesToCDETree(rootFolderName, files);
        });
    }
    input.click();
}

// 6.4. Thuật toán Xây dựng Cấu trúc Cây Thư Mục (Tree Building Algorithm)
function buildDirectoryTree(files) {
    const root = { name: 'root', type: 'directory', children: {} };

    files.forEach(file => {
        const parts = file.path.split('/');
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;

            if (isFile) {
                current.children[part] = {
                    ...file,
                    type: 'file'
                };
            } else {
                if (!current.children[part]) {
                    current.children[part] = {
                        name: part,
                        type: 'directory',
                        children: {}
                    };
                }
                current = current.children[part];
            }
        }
    });

    return root;
}

// 6.5. Render Cây Thư Mục Lồng Nhau Đệ Quy (Recursive HTML Renderer)
function generateTreeHTML(node) {
    if (!node.children) return '';

    let html = '<ul class="pl-4 space-y-1 border-l border-slate-800 ml-2 text-slate-400">';

    const entries = Object.values(node.children);
    
    // Sắp xếp: Thư mục lên trước, Tệp tin ra sau
    entries.sort((a, b) => (b.type === 'directory') - (a.type === 'directory'));

    entries.forEach(item => {
        if (item.type === 'directory') {
            html += `
                <li class="my-0.5">
                    <div onclick="toggleLocalFolder(this)" class="flex items-center gap-2 p-1.5 hover:bg-slate-800/60 rounded-lg cursor-pointer text-slate-300 hover:text-white font-medium transition text-xs select-none">
                        <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-500 transform transition-transform duration-200"></i>
                        <i data-lucide="folder" class="w-4 h-4 text-amber-400/90 shrink-0"></i>
                        <span>${item.name}</span>
                    </div>
                    <div class="folder-content transition-all duration-200">
                        ${generateTreeHTML(item)}
                    </div>
                </li>
            `;
        } else {
            const fileSizeMB = (item.size / (1024 * 1024)).toFixed(1) + ' MB';
            let iconName = 'file';
            let badgeStyle = 'bg-slate-800 text-slate-300';

            const nameLower = item.name.toLowerCase();
            if (nameLower.endsWith('.rvt')) { 
                iconName = 'box'; 
                badgeStyle = 'bg-blue-500/10 text-blue-400 border border-blue-500/20'; 
            } else if (nameLower.endsWith('.dwg')) { 
                iconName = 'file-code'; 
                badgeStyle = 'bg-amber-500/10 text-amber-400 border border-amber-500/20'; 
            } else if (nameLower.endsWith('.pdf')) { 
                iconName = 'file-text'; 
                badgeStyle = 'bg-rose-500/10 text-rose-400 border border-rose-500/20'; 
            }

            html += `
                <li onclick="openFilePreview('${item.name}', '${fileSizeMB}', 'Local File', 'Máy tính cục bộ', '${item.lastModified}', 'NATIVE')" class="cde-file-item p-1.5 hover:bg-slate-800/80 rounded-lg cursor-pointer flex items-center justify-between group transition">
                    <div class="flex items-center gap-2 min-w-0">
                        <i data-lucide="${iconName}" class="w-4 h-4 text-blue-400 shrink-0"></i>
                        <span class="text-slate-300 group-hover:text-blue-400 transition font-mono truncate text-xs">${item.name}</span>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[10px] ${badgeStyle} px-1.5 py-0.5 rounded font-mono">${fileSizeMB}</span>
                    </div>
                </li>
            `;
        }
    });

    html += '</ul>';
    return html;
}

// 6.6. Xử lý Đóng / Mở Thư Mục Con
function toggleLocalFolder(element) {
    const folderContent = element.nextElementSibling;
    const chevronIcon = element.querySelector('[data-lucide="chevron-down"]');
    const folderIcon = element.querySelector('[data-lucide="folder"], [data-lucide="folder-open"]');

    if (folderContent) {
        if (folderContent.classList.contains('hidden')) {
            folderContent.classList.remove('hidden');
            if (chevronIcon) chevronIcon.style.transform = 'rotate(0deg)';
            if (folderIcon) folderIcon.setAttribute('data-lucide', 'folder-open');
        } else {
            folderContent.classList.add('hidden');
            if (chevronIcon) chevronIcon.style.transform = 'rotate(-90deg)';
            if (folderIcon) folderIcon.setAttribute('data-lucide', 'folder');
        }
        if (window.lucide) lucide.createIcons();
    }
}

// 6.7. Render Cây Thư Mục Ra Giao Diện CDE
function renderLocalFilesToCDETree(folderName, files) {
    if (typeof switchTab === 'function') {
        switchTab('cde');
    }

    const breadcrumb = document.getElementById('cdeBreadcrumb');
    if (breadcrumb) {
        breadcrumb.innerText = `Local > ${folderName} (${files.length} files)`;
    }

    const storageName = document.getElementById('gdriveStorageName');
    const lastSync = document.getElementById('gdriveLastSync');
    const statusDot = document.getElementById('gdriveStatusDot');

    if (statusDot) statusDot.className = 'w-2 h-2 rounded-full bg-blue-500 animate-pulse';
    if (storageName) storageName.innerText = `Local: ${folderName}`;
    if (lastSync) lastSync.innerText = `Đã nạp ${files.length} tệp`;

    const treeContainer = document.getElementById('cdeTreeContainer');
    if (!treeContainer) return;

    if (files.length === 0) {
        treeContainer.innerHTML = `<div class="p-4 text-xs text-slate-500 font-mono">Thư mục đã chọn không chứa tệp nào.</div>`;
        return;
    }

    // Xây dựng Cấu trúc Cây
    const treeData = buildDirectoryTree(files);
    const treeHTML = generateTreeHTML(treeData);

    treeContainer.innerHTML = `
        <div class="text-xs space-y-1 select-none">
            <div onclick="toggleLocalFolder(this)" class="flex items-center gap-2 p-2 hover:bg-slate-800/60 rounded-xl cursor-pointer text-blue-400 font-semibold transition">
                <i data-lucide="chevron-down" class="w-4 h-4 transform transition-transform"></i>
                <i data-lucide="hard-drive" class="w-4 h-4"></i>
                <span>Thư mục Local gốc: ${folderName}</span>
            </div>
            <div class="folder-content">
                ${treeHTML}
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
    appendLiveFeedSystem('Local CDE', `Đã đồng bộ ${files.length} tệp từ thư mục [${folderName}]`, 'Vừa xong');
}

// 7. Mở Preview Chi tiết File
function openFilePreview(fileName, size, type, author, date, rev) {
    alert(`Thông tin Chi tiết CDE File:\nTên file: ${fileName}\nDung lượng: ${size}\nLoại file: ${type}\nNgười tải: ${author}\nNgày cập nhật: ${date}\nPhiên bản: ${rev}`);
}

// 8. Cập nhật Nhật ký Hệ thống (Activity Feed)
function appendLiveFeedSystem(user, message, time) {
    const feedContainer = document.getElementById('activityFeedList');
    if (!feedContainer) return;

    const newItem = document.createElement('div');
    newItem.className = 'flex items-start gap-2.5 text-xs bg-emerald-950/30 p-2 rounded-xl border border-emerald-500/30 animate-fade-in';
    newItem.innerHTML = `
        <div class="w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">
            CDE
        </div>
        <div class="min-w-0">
            <p class="text-slate-200 text-[11px]"><span class="font-semibold text-emerald-400">${user}:</span> ${message}</p>
            <span class="text-[9px] text-slate-500">${time}</span>
        </div>
    `;
    feedContainer.prepend(newItem);
}

// DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();
    setTimeout(initGoogleDriveSDK, 1000);
});