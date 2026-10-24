/**
 * permission.js - Quản lý phân quyền truy cập phân hệ Workflow / MIR (ISO 19650)
 * PV INCONS Enterprise CDE Workspace
 * Cập nhật: Chuẩn hóa phân vùng và phân quyền chi tiết theo thao tác/trường permission/role
 */

/**
 * Kiểm tra quyền truy cập vào tab MIR / Workflow dựa trên Role của tài khoản
 * @param {Array<string>} customAllowedRoles - Danh sách các role được phép truy cập (Tùy chọn)
 */
function protectMirRoute(customAllowedRoles = ['ADMIN', 'MASTER', 'MANAGEMENT', 'DESIGNER', 'CONTRACTOR', 'INTERNAL']) {
    try {
        const userSession = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const userRole = (userSession.role || '').toUpperCase();
        const userPerm = (userSession.permission || userRole).toUpperCase();

        // 1. Kiểm tra nếu chưa đăng nhập hoặc thiếu thông tin phiên làm việc
        if (!userSession.username || (!userRole && !userPerm)) {
            console.warn('Phiên làm việc không hợp lệ hoặc chưa đăng nhập.');
            alert('Phiên đăng nhập đã hết hạn hoặc không tồn tại. Vui lòng đăng nhập lại!');
            window.location.href = '../../index.html'; // Điều hướng về trang đăng nhập gốc
            return false;
        }

        // 2. Kiểm tra role/permission hiện tại có nằm trong danh sách cho phép hay không
        if (!customAllowedRoles.includes(userRole) && !customAllowedRoles.includes(userPerm)) {
            alert(`Tài khoản [${userSession.username}] với vai trò [${userRole}] không có quyền truy cập phân hệ Phối hợp & Phê duyệt (Workflow) theo chuẩn ISO 19650!`);
            window.location.href = '../workspace/index.html'; // Quay lại trang workspace chính
            return false;
        }

        console.info(`Xác thực quyền thành công cho User: ${userSession.username} (${userRole})`);
        return true;

    } catch (error) {
        console.error('Lỗi xác thực phân quyền:', error);
        window.location.href = '../../index.html';
        return false;
    }
}

/**
 * Hàm kiểm tra mức tổng quan quyền hạn trên từng phân vùng dữ liệu ISO 19650 (WIP, Shared, Published, Archive)
 * @param {string} zone - Tên phân vùng ('01_WIP', 'WIP', '02_SHARED', 'SHARED', v.v.)
 * @returns {string} - Trạng thái quyền ('Full Control', 'Read & Write', 'Read-Only', 'No Access')
 */
function getIso19650Permissions(zone) {
    const userSession = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const role = (userSession.role || '').toUpperCase();
    const permission = (userSession.permission || role).toUpperCase();

    // ADMIN và MASTER luôn có toàn quyền tổng quan
    if (permission === 'ADMIN' || permission === 'MASTER' || role === 'ADMIN' || role === 'MASTER') return 'Full Control';

    // Chuẩn hóa tên phân vùng (ví dụ: '01_WIP' -> 'WIP')
    const cleanZone = (zone || '').replace(/^\d+_/, '').toUpperCase();

    const permissionsMatrix = {
        'MANAGEMENT': {
            'WIP': 'No Access',
            'SHARED': 'Full Control',
            'PUBLISHED': 'Full Control',
            'ARCHIVE': 'Read & Write'
        },
        'DESIGNER': {
            'WIP': 'Full Control',
            'SHARED': 'Read & Write',
            'PUBLISHED': 'Read-Only',
            'ARCHIVE': 'No Access'
        },
        'CONTRACTOR': {
            'WIP': 'No Access',
            'SHARED': 'Read-Only',
            'PUBLISHED': 'Read & Write',
            'ARCHIVE': 'No Access'
        },
        'INTERNAL': {
            'WIP': 'No Access',
            'SHARED': 'Read-Only',
            'PUBLISHED': 'Read-Only',
            'ARCHIVE': 'No Access'
        }
    };

    const rolePerms = permissionsMatrix[permission] || permissionsMatrix[role];
    if (rolePerms && rolePerms[cleanZone]) {
        return rolePerms[cleanZone];
    }

    return 'No Access';
}

/**
 * Kiểm tra quyền thực hiện một thao tác cụ thể trên giao diện MIR dựa theo Role/Permission và Container Zone
 * @param {string} action - Tên thao tác
 * @param {string} fileZone - Phân vùng chứa file ('01_WIP', '02_SHARED', '03_PUBLISHED', '04_ARCHIVE')
 * @returns {boolean} - true nếu được phép thực hiện, ngược lại false
 */
function checkActionPermission(action, fileZone) {
    const userSession = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const role = (userSession.role || '').toUpperCase();
    const permission = (userSession.permission || role).toUpperCase();

    // Chuẩn hóa tên zone (bỏ tiền tố số nếu có, ví dụ '01_WIP' -> 'WIP')
    const zone = (fileZone || '').replace(/^\d+_/, '').toUpperCase();

    // 1. ADMIN có toàn quyền mọi thao tác trên mọi zone
    if (permission === 'ADMIN' || role === 'ADMIN') return true;

    // 2. MASTER có toàn quyền ngoại trừ thao tác Xóa file (DELETE)
    if (permission === 'MASTER' || role === 'MASTER') {
        if (action === 'DELETE') return false;
        return true;
    }

    // Nếu phân vùng mang trạng thái No Access thì từ chối mọi thao tác
    if (getIso19650Permissions(zone) === 'No Access') {
        return false;
    }

    // 3. Định nghĩa ma trận chi tiết thao tác theo Role & Zone chuẩn ISO 19650
    const actionMatrix = {
        'DESIGNER': {
            'WIP': ['VIEW', 'RENAME', 'UPLOAD', 'VERSION_HISTORY', 'EDIT_METADATA', 'SHARE_LINK', 'CREATE_ISSUE'],
            'SHARED': ['VIEW', 'VERSION_HISTORY', 'SHARE_LINK', 'CREATE_ISSUE'],
            'PUBLISHED': ['VIEW', 'VERSION_HISTORY', 'SHARE_LINK'],
            'ARCHIVE': []
        },
        'MANAGEMENT': {
            'WIP': [],
            'SHARED': ['VIEW', 'VERSION_HISTORY', 'SHARE_LINK', 'CREATE_ISSUE', 'GATE_APPROVAL'],
            'PUBLISHED': ['VIEW', 'VERSION_HISTORY', 'SHARE_LINK', 'CREATE_ISSUE', 'GATE_APPROVAL'],
            'ARCHIVE': ['VIEW', 'VERSION_HISTORY', 'SHARE_LINK']
        },
        'CONTRACTOR': {
            'WIP': [],
            'SHARED': ['VIEW', 'VERSION_HISTORY', 'SHARE_LINK', 'CREATE_ISSUE'],
            'PUBLISHED': ['VIEW', 'VERSION_HISTORY', 'SHARE_LINK', 'CREATE_ISSUE', 'UPLOAD', 'EDIT_METADATA'],
            'ARCHIVE': []
        },
        'INTERNAL': {
            'WIP': [],
            'SHARED': ['VIEW', 'VERSION_HISTORY', 'SHARE_LINK'],
            'PUBLISHED': ['VIEW', 'VERSION_HISTORY', 'SHARE_LINK'],
            'ARCHIVE': []
        }
    };

    const rolePermissions = actionMatrix[permission] || actionMatrix[role];
    if (!rolePermissions || !rolePermissions[zone]) {
        return false;
    }

    return rolePermissions[zone].includes(action);
}