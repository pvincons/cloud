const express = require('express');
const router = express.Router();
const { askGemini } = require('../services/geminiService');

// POST /api/sop/check - Kiem tra quy chuan thiet ke QA/QC
router.post('/check', async (req, res) => {
    try {
        const { code, description } = req.body;
        const prompt = `Kiểm tra mã hồ sơ/bản vẽ "${code}" với thông tin: "${description}". Đối chiếu quy tắc đặt tên file ISO 19650 (Project-Originator-Volume-Level-Type-Role-Number) và đưa ra đánh giá ĐẠT hay KHÔNG ĐẠT kèm lý do.`;
        
        const evaluation = await askGemini(prompt);
        res.json({ evaluation });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;