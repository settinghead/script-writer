-- Migration: Add transform_chunks table for persistent streaming storage
-- This eliminates the need for in-memory StreamingCache

CREATE TABLE IF NOT EXISTS transform_chunks (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    transform_id TEXT NOT NULL REFERENCES transforms(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure chunks are ordered properly
    UNIQUE (transform_id, chunk_index)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_transform_chunks_transform_id ON transform_chunks(transform_id);
CREATE INDEX IF NOT EXISTS idx_transform_chunks_transform_id_index ON transform_chunks(transform_id, chunk_index); 