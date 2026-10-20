const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.set('trust proxy', true);

app.use(cors());
app.use(express.json());

// Middleware ghi log request thời gian thực
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// ===============================================================
// PROXY CHO REVIT SERVER ADMINISTRATOR
// ===============================================================
app.use(
    '/RevitServerAdmin2027',
    createProxyMiddleware({
        target: 'https://localhost',
        changeOrigin: true,
        secure: false,
        pathRewrite: {
            '^/RevitServerAdmin2027': '/RevitServerAdmin2027',
        },
        onError: (err, req, res) => {
            res.status(500).send('Không thể kết nối tới Revit Server IIS service nội bộ!');
        }
    })
);

const BASE_DATABASE_DIR = path.join(__dirname, 'database');
const ROOT_DIR = path.join(BASE_DATABASE_DIR, 'bim-vdc');
const ISSUES_FILE_PATH = path.join(BASE_DATABASE_DIR, 'issues.json');

if (!fs.existsSync(ROOT_DIR)) {
    fs.mkdirSync(ROOT_DIR, { recursive: true });
}

// Hàm hỗ trợ đọc file issues.json an toàn
function readIssuesDB() {
    try {
        if (fs.existsSync(ISSUES_FILE_PATH)) {
            const data = fs.readFileSync(ISSUES_FILE_PATH, 'utf8');
            return JSON.parse(data || '{}');
        }
    } catch (err) {
        console.error('Lỗi đọc file issues.json:', err);
    }
    return {};
}

// Hàm hỗ trợ ghi file issues.json an toàn
function writeIssuesDB(dbData) {
    try {
        fs.writeFileSync(ISSUES_FILE_PATH, JSON.stringify(dbData, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Lỗi ghi file issues.json:', err);
        return false;
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const relPath = req.query.path || req.body.targetPath || '';
        const targetDir = path.join(ROOT_DIR, relPath.replace(/^database\/bim-vdc\/?/, ''));
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        cb(null, Buffer.from(file.originalname, 'latin1').toString('utf8'));
    }
});
const upload = multer({ storage: storage });

// ===============================================================
// API HEALTH CHECK
// ===============================================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'CDE Backend Server đang hoạt động ổn định!' });
});

// ===============================================================
// API QUẢN LÝ ISSUES / QA-QC TẬP TRUNG TRÊN SERVER
// ===============================================================
app.get('/api/issues', (req, res) => {
    try {
        const issues = readIssuesDB();
        res.json(issues);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/issues/add', (req, res) => {
    try {
        const { filePath, text, author } = req.body;
        if (!filePath || !text) {
            return res.status(400).json({ success: false, error: 'Thiếu đường dẫn file hoặc nội dung issue!' });
        }

        const db = readIssuesDB();
        if (!db[filePath]) {
            db[filePath] = [];
        }

        const newIssue = {
            text: text.trim(),
            time: new Date().toLocaleString('vi-VN'),
            author: author || 'Phương Vy'
        };

        db[filePath].push(newIssue);

        if (writeIssuesDB(db)) {
            res.json({ success: true, message: 'Đã lưu Issue thành công!', issues: db[filePath] });
        } else {
            res.status(500).json({ success: false, error: 'Không thể ghi file issues.json trên server' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/issues/delete', (req, res) => {
    try {
        const { filePath, index } = req.body;
        const db = readIssuesDB();

        if (db[filePath] && typeof db[filePath][index] !== 'undefined') {
            db[filePath].splice(index, 1);
            if (db[filePath].length === 0) {
                delete db[filePath];
            }
            writeIssuesDB(db);
            return res.json({ success: true, message: 'Đã xóa Issue thành công!', issues: db[filePath] || [] });
        }

        res.status(404).json({ success: false, error: 'Không tìm thấy Issue cần xóa!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===============================================================
// API QUẢN LÝ TẬP TIN & CDE (FILE SYSTEM & ISO 19650 GATES)
// ===============================================================
app.get('/api/files', (req, res) => {
    try {
        const subPath = req.query.path || '';
        const cleanSubPath = subPath.replace(/^database\/bim-vdc\/?/, '');
        const targetDir = path.join(ROOT_DIR, cleanSubPath);

        if (!fs.existsSync(targetDir)) {
            return res.status(404).json({ error: 'Thư mục không tồn tại' });
        }

        const items = fs.readdirSync(targetDir, { withFileTypes: true });
        const result = items.map(item => {
            const itemRelPath = path.join(cleanSubPath, item.name);
            return {
                name: item.name,
                isDirectory: item.isDirectory(),
                type: item.isDirectory() ? 'folder' : 'file',
                path: 'database/bim-vdc/' + itemRelPath.replace(/\\/g, '/')
            };
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/cde-files', (req, res) => {
    try {
        function walkDir(dir, fileList = []) {
            const files = fs.readdirSync(dir, { withFileTypes: true });
            files.forEach(file => {
                const fullPath = path.join(dir, file.name);
                const relPath = path.relative(BASE_DATABASE_DIR, fullPath);
                if (file.isDirectory()) {
                    fileList.push({
                        name: file.name,
                        path: 'database/' + relPath.replace(/\\/g, '/'),
                        type: 'folder'
                    });
                    walkDir(fullPath, fileList);
                } else {
                    fileList.push({
                        name: file.name,
                        path: 'database/' + relPath.replace(/\\/g, '/'),
                        type: 'file'
                    });
                }
            });
            return fileList;
        }
        const allItems = walkDir(ROOT_DIR);
        res.json(allItems);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        res.json({ success: true, message: 'Tải lên tập tin thành công!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/create-folder', (req, res) => {
    try {
        const { parentPath, folderName } = req.body;
        const cleanParent = (parentPath || 'database/bim-vdc').replace(/^database\/bim-vdc\/?/, '');
        const targetDir = path.join(ROOT_DIR, cleanParent, folderName);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
            res.json({ success: true, message: 'Tạo thư mục thành công!' });
        } else {
            res.status(400).json({ success: false, error: 'Thư mục đã tồn tại!' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/rename', (req, res) => {
    try {
        const { path: itemPath, newName } = req.body;
        const cleanPath = itemPath.replace(/^database\/bim-vdc\/?/, '');
        const oldFullPath = path.join(ROOT_DIR, cleanPath);
        const parentDir = path.dirname(oldFullPath);
        const newFullPath = path.join(parentDir, newName);

        if (fs.existsSync(oldFullPath)) {
            fs.renameSync(oldFullPath, newFullPath);
            res.json({ success: true, message: 'Đổi tên thành công!' });
        } else {
            res.status(404).json({ success: false, error: 'Đường dẫn không tồn tại!' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/delete', (req, res) => {
    try {
        const { path: itemPath } = req.body;
        const cleanPath = itemPath.replace(/^database\/bim-vdc\/?/, '');
        const fullPath = path.join(ROOT_DIR, cleanPath);

        if (fs.existsSync(fullPath)) {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(fullPath);
            }
            res.json({ success: true, message: 'Xóa thành công!' });
        } else {
            res.status(404).json({ success: false, error: 'Đường dẫn không tồn tại!' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/move', (req, res) => {
    try {
        const { sourcePath, targetDir } = req.body;
        const cleanSource = sourcePath.replace(/^database\/bim-vdc\/?/, '');
        const cleanTarget = targetDir.replace(/^database\/bim-vdc\/?/, '');
        
        const srcFullPath = path.join(ROOT_DIR, cleanSource);
        const fileName = path.basename(srcFullPath);
        const targetParentDir = path.join(ROOT_DIR, cleanTarget);
        const destFullPath = path.join(targetParentDir, fileName);

        if (!fs.existsSync(srcFullPath)) {
            return res.status(404).json({ success: false, error: 'Đường dẫn nguồn không tồn tại!' });
        }

        if (!fs.existsSync(targetParentDir)) {
            fs.mkdirSync(targetParentDir, { recursive: true });
        }

        fs.renameSync(srcFullPath, destFullPath);
        console.log(`[REAL-TIME SYNC] Đã di chuyển file: ${cleanSource} ➔ ${cleanTarget}`);
        res.json({ success: true, message: 'Di chuyển file thành công!' });
    } catch (error) {
        console.error('Lỗi di chuyển file:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/copy', (req, res) => {
    try {
        const { sourcePath, targetDir } = req.body;
        const cleanSource = sourcePath.replace(/^database\/bim-vdc\/?/, '');
        const cleanTarget = targetDir.replace(/^database\/bim-vdc\/?/, '');
        
        const srcFullPath = path.join(ROOT_DIR, cleanSource);
        const fileName = path.basename(srcFullPath);
        const targetParentDir = path.join(ROOT_DIR, cleanTarget);
        const destFullPath = path.join(targetParentDir, fileName);

        if (!fs.existsSync(srcFullPath)) {
            return res.status(404).json({ success: false, error: 'Đường dẫn nguồn không tồn tại!' });
        }

        if (!fs.existsSync(targetParentDir)) {
            fs.mkdirSync(targetParentDir, { recursive: true });
        }

        const stat = fs.statSync(srcFullPath);
        if (stat.isDirectory()) {
            fs.cpSync(srcFullPath, destFullPath, { recursive: true });
        } else {
            fs.copyFileSync(srcFullPath, destFullPath);
        }
        res.json({ success: true, message: 'Sao chép file thành công!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Static serve thư mục chứa database file để client có thể truy cập trực tiếp khi cần
app.use('/files', express.static(ROOT_DIR));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 CDE Server (Tối ưu Backend Tác Vụ) đang chạy qua HTTP tại cổng ${PORT}`);
});