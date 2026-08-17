const ai = require('../config/gemini');

/**
 * Xu ly truy van van ban hoac phan tich ngu canh CDE
 */
async function askGemini(prompt, systemInstruction = '') {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction || 'Bạn là trợ lý kỹ thuật AI của PV INCONS, am hiểu CDE ISO 19650, BIM, quy chuẩn xây dựng Việt Nam và quản lý dự án.'
            }
        });
        return response.text;
    } catch (error) {
        console.error('Gemini API Error:', error);
        throw new Error('Không thể kết nối tới dịch vụ AI');
    }
}

/**
 * Phut tich hinh anh hoac file da phuong thuc (Multimodal)
 */
async function analyzeMultimodal(prompt, fileBuffer, mimeType) {
    try {
        const imagePart = {
            inlineData: {
                data: fileBuffer.toString('base64'),
                mimeType: mimeType
            }
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [prompt, imagePart]
        });
        return response.text;
    } catch (error) {
        console.error('Gemini Multimodal Error:', error);
        throw error;
    }
}

module.exports = { askGemini, analyzeMultimodal };