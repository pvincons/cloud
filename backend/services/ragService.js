const db = require('../config/db');

/**
 * Tìm kiếm ngữ cảnh CDE từ CSDL PostgreSQL phục vụ Gemini RAG
 */
async function searchCDEContext(query) {
    try {
        const sql = `
            SELECT f.file_code, f.file_name, f.cde_state, f.version, f.suitability, p.project_name 
            FROM cde_files f
            JOIN projects p ON f.project_id = p.id
            WHERE LOWER(f.file_name) LIKE $1 
               OR LOWER(f.file_code) LIKE $1 
               OR LOWER(p.project_name) LIKE $1
            LIMIT 5;
        `;
        const searchPattern = `%${query.toLowerCase()}%`;
        const res = await db.query(sql, [searchPattern]);

        if (res.rows.length === 0) {
            return 'Không tìm thấy file trực tiếp trong CSDL, hãy phản hồi dựa trên kiến thức chung.';
        }

        return res.rows.map(f => 
            `Dự án: ${f.project_name} | Mã File: ${f.file_code} | Tên: ${f.file_name} | Thư mục CDE: ${f.cde_state} | Phiên bản: ${f.version}`
        ).join('\n');
    } catch (error) {
        console.error('Lỗi khi truy vấn CSDL CDE:', error);
        return '';
    }
}

module.exports = { searchCDEContext };