-- Kích hoạt extension hỗ trợ tìm kiếm Vector cho Gemini RAG
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Bảng Dự án (Projects)
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    project_code VARCHAR(20) UNIQUE NOT NULL, -- Mã dự án (VD: NP2601, BT2602)
    project_name VARCHAR(255) NOT NULL,       -- Tên công trình
    location VARCHAR(255),                    -- Địa điểm (VD: Ninh Kiều, Cần Thơ)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Tài liệu / Bản vẽ CDE chuẩn ISO 19650
CREATE TYPE cde_state_enum AS ENUM ('WIP', 'SHARED', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE IF NOT EXISTS cde_files (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    file_code VARCHAR(100) NOT NULL,          -- Mã file chuẩn (VD: PVI-NP2601-ZZ-01-DR-A-0001)
    file_name VARCHAR(255) NOT NULL,          -- Tên file hiển thị
    cde_state cde_state_enum DEFAULT 'WIP',  -- Thư mục CDE
    version VARCHAR(10) DEFAULT 'P01.01',     -- Phiên bản (P01, C01)
    suitability VARCHAR(10) DEFAULT 'S0',      -- Mục đích sử dụng (S0: Dùng chung, A1: Báo cáo)
    file_path TEXT NOT NULL,                  -- Đường dẫn lưu trên máy chủ
    file_type VARCHAR(20),                    -- Ext: pdf, dwg, rvt, xlsx
    uploaded_by VARCHAR(50) DEFAULT 'System',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng Lưu trữ Embeddings văn bản cho Gemini RAG Search
CREATE TABLE IF NOT EXISTS document_chunks (
    id SERIAL PRIMARY KEY,
    file_id INT REFERENCES cde_files(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content_text TEXT NOT NULL,               -- Đoạn văn bản bóc tách từ PDF/Excel
    embedding vector(768)                     -- Vector 768 chiều từ Gemini Embedding API
);

-- Index giúp tăng tốc tìm kiếm Vector
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
ON document_chunks USING ivfflat (embedding vector_cosine_ops);

-- 4. Bảng Nhật ký Công trường (Site Reports)
CREATE TABLE IF NOT EXISTS site_reports (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    reporter_name VARCHAR(50),
    media_url TEXT,                           -- File ảnh hoặc audio gửi lên
    ai_summary TEXT NOT NULL,                 -- Nội dung Gemini tóm tắt
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Bảng Nhật ký Hoạt động (Live Feed)
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_name VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL,         -- UPLOAD, SEARCH_AI, SOP_CHECK
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Thêm dữ liệu mẫu ban đầu
INSERT INTO projects (project_code, project_name, location) 
VALUES ('NP2601', 'Biệt thự Ninh Kiều', 'Ninh Kiều, Cần Thơ')
ON CONFLICT (project_code) DO NOTHING;