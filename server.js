const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

const ROOT_DIR = path.join(__dirname, 'database', 'bim-vdc');

// Hàm đọc phân tích bộ môn từ tên file chuẩn ISO 19650
function parseDiscipline(fileName) {
    const parts = fileName.split('-');
    if (parts.length >= 2) {
        const originator = parts[1].toUpperCase();
        if (['ARC', 'STR', 'MEP'].includes(originator)) return originator;
    }
    return 'ARC'; // Mặc định
}

// API 1: Lấy danh sách tất cả Dự án trong database/bim-vdc
app.get('/api/projects', (req, res) => {
    if (!fs.existsSync(ROOT_DIR)) {
        return res.status(404).json({ error: 'Không tìm thấy đường dẫn vào database' });
    }
    try {
        const items = fs.readdirSync(ROOT_DIR, { withFileTypes: true });
        const projects = items
            .filter(item => item.isDirectory())
            .map(item => ({ id: item.name, name: item.name }));
        res.json(projects);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API 2: Quét toàn bộ tệp trong các Container ISO 19650 của từng Dự án
app.get('/api/cde-files', (req, res) => {
    if (!fs.existsSync(ROOT_DIR)) return res.json([]);

    const cdeData = [];
    const containers = ['01_WIP', '02_SHARED', '03_PUBLISHED', '04_ARCHIVE'];

    try {
        const projects = fs.readdirSync(ROOT_DIR, { withFileTypes: true })
            .filter(item => item.isDirectory());

        projects.forEach(prj => {
            containers.forEach(container => {
                const containerPath = path.join(ROOT_DIR, prj.name, container);
                if (fs.existsSync(containerPath)) {
                    const scanFolder = (dir) => {
                        const files = fs.readdirSync(dir, { withFileTypes: true });
                        files.forEach(file => {
                            const fullPath = path.join(dir, file.name);
                            if (file.isDirectory()) {
                                scanFolder(fullPath);
                            } else {
                                let suit = 'S0', rev = 'P01.01';
                                if (container === '02_SHARED') { suit = 'S1'; rev = 'P01.00'; }
                                if (container === '03_PUBLISHED') { suit = 'A1'; rev = 'C01.00'; }
                                if (container === '04_ARCHIVE') { suit = 'S0'; rev = 'P00.01'; }

                                cdeData.push({
                                    project: prj.name,
                                    fileName: file.name,
                                    container: container,
                                    suitability: suit,
                                    revision: rev,
                                    discipline: parseDiscipline(file.name),
                                    description: `Hồ sơ tự động load từ ${file.name}`
                                });
                            }
                        });
                    };
                    scanFolder(containerPath);
                }
            });
        });

        res.json(cdeData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use('/files', express.static(ROOT_DIR));
app.listen(3000, () => console.log(`CDE Server đang kết nối thư mục ${ROOT_DIR} tại http://localhost:3000`));