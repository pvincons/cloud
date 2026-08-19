const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Phục vụ tất cả các file tĩnh từ thư mục gốc
app.use(express.static(__dirname));

// Điều hướng mặc định nếu không tìm thấy route
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`PV INCONS Local Workspace đang chạy tại:`);
    console.log(`-> http://localhost:${PORT}`);
    console.log(`==================================================`);
});