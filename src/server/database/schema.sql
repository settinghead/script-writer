-- Script Writer Database Schema
-- PostgreSQL with Electric Sync support

-- Users and Authentication
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active'
);

CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    project_type TEXT DEFAULT 'script',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects_users (
    id SERIAL PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'owner', -- owner, collaborator, viewer
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id)
);

-- Authentication
CREATE TABLE auth_providers (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    provider_type TEXT NOT NULL,
    provider_user_id TEXT,
    provider_data TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_type, provider_user_id)
);

CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced Artifacts with Electric Streaming Support
CREATE TABLE artifacts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    type_version TEXT NOT NULL DEFAULT 'v1',
    data TEXT NOT NULL,
    metadata TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Electric streaming fields
    streaming_status TEXT DEFAULT 'completed' CHECK (streaming_status IN ('streaming', 'completed', 'failed', 'cancelled')),
    streaming_progress DECIMAL(5,2) DEFAULT 100.00, -- 0.00 to 100.00
    partial_data JSONB -- Store partial results during streaming
);

-- Enhanced Transforms with Electric Streaming Support
CREATE TABLE transforms (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    type_version TEXT NOT NULL DEFAULT 'v1',
    status TEXT DEFAULT 'running',
    execution_context TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Electric streaming fields
    streaming_status TEXT DEFAULT 'pending' CHECK (streaming_status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 2
);

-- Transform relationships (maintain graph structure)
CREATE TABLE transform_inputs (
    id SERIAL PRIMARY KEY,
    transform_id TEXT NOT NULL REFERENCES transforms(id) ON DELETE CASCADE,
    artifact_id TEXT NOT NULL REFERENCES artifacts(id),
    input_role TEXT,
    UNIQUE(transform_id, artifact_id, input_role)
);

CREATE TABLE transform_outputs (
    id SERIAL PRIMARY KEY,
    transform_id TEXT NOT NULL REFERENCES transforms(id) ON DELETE CASCADE,
    artifact_id TEXT NOT NULL REFERENCES artifacts(id),
    output_role TEXT,
    UNIQUE(transform_id, artifact_id, output_role)
);

-- LLM-specific tables (for graph completeness)
CREATE TABLE llm_prompts (
    id TEXT PRIMARY KEY,
    transform_id TEXT NOT NULL REFERENCES transforms(id) ON DELETE CASCADE,
    prompt_text TEXT NOT NULL,
    prompt_role TEXT DEFAULT 'primary'
);

CREATE TABLE llm_transforms (
    transform_id TEXT PRIMARY KEY REFERENCES transforms(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    model_parameters TEXT,
    raw_response TEXT,
    token_usage TEXT
);

CREATE TABLE human_transforms (
    transform_id TEXT PRIMARY KEY REFERENCES transforms(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    interface_context TEXT,
    change_description TEXT,
    
    -- Path-based artifact derivation fields
    source_artifact_id TEXT REFERENCES artifacts(id),
    derivation_path TEXT DEFAULT '',
    derived_artifact_id TEXT REFERENCES artifacts(id)
);

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_artifacts_updated_at BEFORE UPDATE ON artifacts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transforms_updated_at BEFORE UPDATE ON transforms
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_artifacts_project_type ON artifacts(project_id, type);
CREATE INDEX idx_artifacts_project_created ON artifacts(project_id, created_at);
CREATE INDEX idx_artifacts_streaming ON artifacts(streaming_status) WHERE streaming_status != 'completed';
CREATE INDEX idx_transforms_project_created ON transforms(project_id, created_at);
CREATE INDEX idx_transforms_streaming ON transforms(streaming_status) WHERE streaming_status IN ('running', 'pending');
CREATE INDEX idx_projects_users_user_id ON projects_users(user_id);
CREATE INDEX idx_projects_users_project_id ON projects_users(project_id);

-- Index for path-based artifact derivation lookups
CREATE INDEX idx_human_transforms_derivation ON human_transforms(source_artifact_id, derivation_path);

-- Electric-optimized view for brainstorming flows
CREATE VIEW brainstorm_flows AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    t.id as transform_id,
    t.streaming_status as transform_status,
    t.progress_percentage,
    t.error_message,
    t.created_at as transform_created_at,
    t.updated_at as transform_updated_at,
    a.id as artifact_id,
    a.type as artifact_type,
    a.streaming_status as artifact_status,
    a.streaming_progress,
    a.data as artifact_data,
    a.partial_data as artifact_partial_data,
    a.created_at as artifact_created_at,
    a.updated_at as artifact_updated_at
FROM projects p
JOIN transforms t ON t.project_id = p.id
LEFT JOIN transform_outputs tro ON tro.transform_id = t.id
LEFT JOIN artifacts a ON a.id = tro.artifact_id
WHERE t.type = 'llm' 
  AND (a.type IS NULL OR a.type IN ('brainstorm_ideas', 'brainstorm_params'))
ORDER BY t.created_at DESC;

-- Insert test data for development
INSERT INTO users (id, username, display_name, status) VALUES 
('test-user-1', 'testuser', 'Test User', 'active')
ON CONFLICT (id) DO NOTHING; 