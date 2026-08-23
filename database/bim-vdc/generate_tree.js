const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'database', 'bim-vdc');

function scanDir(dirPath, idPrefix = 'node') {
    const name = path.basename(dirPath);
    const relativePath = path.relative(__dirname, dirPath).replace(/\\/g, '/');
    const stats = fs.statSync(dirPath);

    if (stats.isDirectory()) {
        const items = fs.readdirSync(dirPath);
        const children = items.map((item, index) => 
            scanDir(path.join(dirPath, item), `${idPrefix}_${index}`)
        );
        return {
            id: idPrefix,
            name: name,
            path: relativePath,
            type: "folder",
            expanded: true,
            children: children
        };
    } else {
        return {
            id: idPrefix,
            name: name,
            path: relativePath,
            type: "file"
        };
    }
}

const treeData = scanDir(targetDir, 'ROOT');
fs.writeFileSync('treeData.json', JSON.stringify(treeData, null, 2));
console.log('✅ Đã cập nhật thành công treeData.json!');