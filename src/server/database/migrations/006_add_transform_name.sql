-- Add transform_name column to human_transforms
ALTER TABLE human_transforms ADD COLUMN transform_name TEXT;

-- Create index for transform definitions  
CREATE INDEX idx_human_transforms_name ON human_transforms(transform_name); 