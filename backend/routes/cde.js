const express = require('express');
const router = express.Router();
const { askGemini } = require('../services/geminiService');
const { searchCDEContext } = require('../services/ragService');

// POST /api/cde/search - Tra cuu du lieu CDE
router.post('/search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Nội dung tìm kiếm không được để trống' });
        }

        const context = searchCDEContext(query);
        const systemPrompt = `Bạn là Trợ lý CDE ISO 19650 của PV INCONS. Sử dụng dữ liệu CDE bên dưới để trả lời câu hỏi của kỹ sư/KTS một cách ngắn gọn, chính xác:
\n--- DỮ LIỆU CDE LIÊN QUAN ---\n${context}`;

        const answer = await askGemini(query, systemPrompt);
        res.json({ query, answer, contextFound: context !== '' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;