const express = require('express');
const router = express.Router();
const multer = require('multer');
const { analyzeMultimodal } = require('../services/geminiService');

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/report/upload-log - Tao bao cao cong truong tu anh/audio
router.post('/upload-log', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Vui lòng gửi kèm file ảnh hoặc audio ghi âm' });
        }

        const prompt = 'Hãy phân tích hình ảnh/âm thanh công trường này và tóm tắt ngắn gọn (dưới 30 từ) thành một bản tin nhật ký công trình gồm: Hạng mục, Trạng thái thi công, Lưu ý QA/QC.';
        const result = await analyzeMultimodal(prompt, req.file.buffer, req.file.mimetype);

        res.json({
            success: true,
            summary: result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;