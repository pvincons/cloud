// account-modal.js - Xử lý Popup Thông Tin Tài Khoản và nạp dữ liệu từ users.json
(function() {
    let selectedAvatarFile = null;
    let pendingAvatarBase64 = null;

    // 1. Tự động chèn HTML của Popup vào cuối trang khi DOM sẵn sàng
    const accountModalHTML = `
    <div id="accountModal"
        class="fixed inset-0 bg-slate-950/80 backdrop-blur-md hidden flex-col justify-end sm:justify-center items-center z-[100] transition-all">
        <div
            class="bg-white dark:bg-slate-900 border-0 sm:border border-slate-200/80 dark:border-slate-800/80 w-full h-full sm:h-auto sm:max-w-lg p-6 sm:p-7 pb-24 sm:pb-7 rounded-none sm:rounded-3xl shadow-2xl relative flex flex-col justify-between transform translate-y-full ease-out overflow-y-auto no-scrollbar max-h-screen" id="accountModalContent">
            
            <div>
                <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
                    <h3 class="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-sm">
                            <i class="fa-solid fa-user-shield"></i>
                        </div>
                        Thông Tin Tài Khoản
                    </h3>
                </div>

                <div class="space-y-4 text-xs">
                    <!-- AVATAR & HỌ TÊN -->
                    <div class="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                        <div class="relative group cursor-pointer shrink-0" id="accAvatarWrapper" title="Nhấn để chọn ảnh đại diện (Tối đa 5MB)">
                            <div class="w-16 h-16 rounded-2xl bg-transparent border border-blue-500/30 text-blue-400 flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-500/10 overflow-hidden" id="accAvatar">
                                TP
                            </div>
                            <div class="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs">
                                <i class="fa-solid fa-camera"></i>
                            </div>
                            <input type="file" id="avatarFileInput" accept="image/*" class="hidden">
                        </div>
                        <div class="overflow-hidden">
                            <p class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Họ và tên / Full Name</p>
                            <p class="text-sm uppercase font-extrabold text-slate-900 dark:text-white mt-0.5 truncate" id="accFullName">TRẦN HOÀNG PHƯỚC</p>
                        </div>
                    </div>

                    <!-- THÔNG TIN CHI TIẾT -->
                    <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-3">
                        <div class="flex justify-between items-center text-slate-600 dark:text-slate-300">
                            <span class="font-medium">Tên đăng nhập (User):</span>
                            <span class="text-xs font-semibold text-slate-800 dark:text-slate-100 font-mono" id="accUsername">-vdc</span>
                        </div>
                        <div class="flex justify-between items-center text-slate-600 dark:text-slate-300">
                            <span class="font-medium">Số điện thoại:</span>
                            <span class="text-xs font-semibold text-slate-800 dark:text-slate-100 font-mono" id="accPhone">--</span>
                        </div>
                        <div class="flex justify-between items-center text-slate-600 dark:text-slate-300">
                            <span class="font-medium">Chức vụ:</span>
                            <span class="text-xs font-semibold text-slate-800 dark:text-slate-100" id="accPosition">Chief Executive Officer</span>
                        </div>
                        <div class="flex justify-between items-center text-slate-600 dark:text-slate-300">
                            <span class="font-medium">Chuyên môn:</span>
                            <span class="text-xs font-semibold text-slate-800 dark:text-slate-100" id="accSpecialty">Kỹ sư xây dựng</span>
                        </div>
                        <div class="flex justify-between items-center text-slate-600 dark:text-slate-300">
                            <span class="font-medium">Công ty:</span>
                            <span class="text-xs font-semibold text-slate-800 dark:text-slate-100" id="accCompany">PV INCONS Co., Ltd</span>
                        </div>
                        <div class="flex justify-between items-center text-slate-600 dark:text-slate-300">
                            <span class="font-medium">Dự án tham gia:</span>
                            <span class="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[200px]" id="accProjects">--</span>
                        </div>
                        <div class="flex justify-between items-center text-slate-600 dark:text-slate-300">
                            <span class="font-medium">Trạng thái dự án:</span>
                            <span class="text-xs font-semibold text-slate-800 dark:text-slate-100" id="accProjectStatus">Đang triển khai</span>
                        </div>
                        <div class="flex justify-between items-center text-slate-600 dark:text-slate-300">
                            <span class="font-medium">Phân quyền truy cập (ISO 19650):</span>
                            <span class="font-bold font-mono text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded border border-blue-500/20 text-xs uppercase" id="accRole">BIM_VDC</span>
                        </div>
                    </div>

                    <!-- MA TRẬN PHÂN QUYỀN ISO 19650 -->
                    <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2">
                        <p class="font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                            <i class="fa-solid fa-shield-halved text-blue-500"></i> Ma trận phân quyền CDE theo chuẩn ISO 19650:
                        </p>
                        <div class="grid grid-cols-2 gap-2 text-[11px]">
                            <div class="p-2 rounded bg-slate-200/60 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700">
                                <span class="block text-slate-400 font-mono text-[9px]">01_WIP</span>
                                <span class="font-bold" id="permWIP">-</span>
                            </div>
                            <div class="p-2 rounded bg-slate-200/60 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700">
                                <span class="block text-slate-400 font-mono text-[9px]">02_SHARED</span>
                                <span class="font-bold" id="permShared">-</span>
                            </div>
                            <div class="p-2 rounded bg-slate-200/60 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700">
                                <span class="block text-slate-400 font-mono text-[9px]">03_PUBLISHED</span>
                                <span class="font-bold" id="permPublished">-</span>
                            </div>
                            <div class="p-2 rounded bg-slate-200/80 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700">
                                <span class="block text-slate-400 font-mono text-[9px]">04_ARCHIVE</span>
                                <span class="font-bold" id="permArchive">-</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                <button onclick="toggleAccountModal(false)"
                    class="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white rounded-xl shadow-lg shadow-blue-500/25 transition-all">Đóng thông tin</button>
            </div>
        </div>
    </div>`;

    document.addEventListener("DOMContentLoaded", () => {
        const container = document.createElement('div');
        container.innerHTML = accountModalHTML;
        document.body.appendChild(container.firstElementChild);

        const avatarWrapper = document.getElementById('accAvatarWrapper');
        const fileInput = document.getElementById('avatarFileInput');

        if (avatarWrapper && fileInput) {
            avatarWrapper.addEventListener('click', () => fileInput.click());

            fileInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;

                // Giới hạn dung lượng ảnh < 5MB
                const maxSize = 5 * 1024 * 1024;
                if (file.size > maxSize) {
                    alert('⚠️ Kích thước ảnh vượt quá giới hạn 5MB. Vui lòng chọn file ảnh nhỏ hơn!');
                    fileInput.value = '';
                    return;
                }

                selectedAvatarFile = file;

                const reader = new FileReader();
                reader.onload = function(uploadEvent) {
                    pendingAvatarBase64 = uploadEvent.target.result;
                    
                    const avatarContainer = document.getElementById('accAvatar');
                    avatarContainer.innerHTML = `<img src="${pendingAvatarBase64}" class="w-full h-full object-cover rounded-2xl" alt="Avatar">`;
                };
                reader.readAsDataURL(file);
            });
        }
    });

    function setPermissionBadge(elementId, permissionText) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.innerText = permissionText;
        el.className = "font-bold text-xs ";

        if (permissionText === 'Full Control') {
            el.className += "text-blue-500";
        } else if (permissionText === 'Read & Write') {
            el.className += "text-emerald-500";
        } else if (permissionText === 'Read-Only') {
            el.className += "text-amber-500";
        } else {
            el.className += "text-rose-500";
        }
    }

    window.toggleAccountModal = async function(show) {
        const modal = document.getElementById('accountModal');
        const content = document.getElementById('accountModalContent');
        if (!modal || !content) return;
        
        if (show) {
            selectedAvatarFile = null;
            pendingAvatarBase64 = null;

            const userSession = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const currentUsername = userSession.username || 'admin';

            let userData = userSession;

            try {
                // Đã cập nhật kết hợp BASE_URL từ config để định vị chính xác file users.json từ mọi cấp thư mục
                const possiblePaths = [
                    (typeof CONFIG !== 'undefined' && CONFIG.BASE_URL) ? `${CONFIG.BASE_URL}/assets/data/users.json` : null,
                    '/assets/data/users.json',
                    './assets/data/users.json',
                    '../assets/data/users.json',
                    '../../assets/data/users.json',
                    '../../../../assets/data/users.json'
                ].filter(Boolean);

                for (const path of possiblePaths) {
                    try {
                        const response = await fetch(path);
                        if (response.ok) {
                            const users = await response.json();
                            const foundUser = users.find(u => u.username === currentUsername);
                            if (foundUser) {
                                userData = { ...userSession, ...foundUser };
                                break;
                            }
                        }
                    } catch (e) {}
                }
            } catch (error) {
                console.warn('Không thể đọc file users.json, đang dùng dữ liệu session hiện tại.', error);
            }

            document.getElementById('accUsername').innerText = userData.username || '-vdc';
            const fullName = userData.fullName || 'TRẦN HOÀNG PHƯỚC';
            document.getElementById('accFullName').innerText = fullName;

            document.getElementById('accPhone').innerText = userData.phone || '0903.xxx.xxx';
            document.getElementById('accProjects').innerText = userData.projects || 'PROJECT 01';
            document.getElementById('accProjectStatus').innerText = userData.status || userData.projectStatus || 'Đang triển khai';

            document.getElementById('accPosition').innerText = userData.position || 'Giám đốc';
            document.getElementById('accSpecialty').innerText = userData.discipline || userData.specialty || 'Kỹ sư';
            document.getElementById('accCompany').innerText = userData.company || 'PV INCONS CO.LTD';
            
            const role = (userData.role || 'MASTER').toUpperCase();
            document.getElementById('accRole').innerText = role;
            
            const avatarContainer = document.getElementById('accAvatar');
            if (userData.avatarLink) {
                avatarContainer.innerHTML = `<img src="${userData.avatarLink}" class="w-full h-full object-cover rounded-2xl" alt="Avatar">`;
            } else if (fullName) {
                const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                avatarContainer.innerText = initials;
            }

            const matrixMapping = {
                'MASTER':    { wip: 'Full Control', shared: 'Full Control', published: 'Full Control', archive: 'Full Control' },
                'ADMIN':     { wip: 'Full Control', shared: 'Full Control', published: 'Full Control', archive: 'Full Control' },
                'MANAGEMENT':{ wip: 'No Access',    shared: 'Full Control', published: 'Full Control', archive: 'Read & Write' },
                'DESIGNER':  { wip: 'Full Control', shared: 'Read & Write', published: 'Read-Only',  archive: 'No Access' },
                'CONTRACTOR':{ wip: 'No Access',    shared: 'Read-Only',  published: 'Read & Write',archive: 'No Access' },
            };

            const permissions = matrixMapping[role] || matrixMapping['MASTER'];
            setPermissionBadge('permWIP', permissions.wip);
            setPermissionBadge('permShared', permissions.shared);
            setPermissionBadge('permPublished', permissions.published);
            setPermissionBadge('permArchive', permissions.archive);

            content.style.transitionDuration = '400ms';
            content.classList.add('translate-y-full');
            content.classList.remove('translate-y-0');

            modal.classList.remove('hidden');
            modal.classList.add('flex');

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    content.classList.remove('translate-y-full');
                    content.classList.add('translate-y-0');
                });
            });
        } else {
            // Khi bấm nút "Đóng thông tin", nếu có chọn ảnh mới -> Gửi lên Server để lưu vào assets/data/avatar/
            if (selectedAvatarFile && pendingAvatarBase64) {
                const userSession = JSON.parse(localStorage.getItem('currentUser') || '{}');
                const currentUsername = userSession.username || 'admin';
                const fileExtension = selectedAvatarFile.name.split('.').pop();
                const fileName = `${currentUsername}_avatar.${fileExtension}`;
                const avatarPath = `assets/data/avatar/${fileName}`;

                try {
                    const response = await fetch('/api/upload-avatar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fileName: fileName,
                            image: pendingAvatarBase64
                        })
                    });

                    if (response.ok) {
                        const result = await response.json();
                        console.log(`✅ Đã lưu ảnh thành công vào server: ${result.path}`);
                        
                        userSession.avatarLink = pendingAvatarBase64;
                        userSession.avatarPath = avatarPath;
                        localStorage.setItem('currentUser', JSON.stringify(userSession));
                    } else {
                        console.error('Lỗi phản hồi từ server khi lưu ảnh.');
                    }
                } catch (error) {
                    console.error('Không thể kết nối đến server để lưu ảnh:', error);
                }
            }

            content.style.transitionDuration = '300ms';
            content.classList.remove('translate-y-0');
            content.classList.add('translate-y-full');
            
            setTimeout(() => {
                modal.classList.remove('flex');
                modal.classList.add('hidden');
            }, 300);
        }
    };
})();