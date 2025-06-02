import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Tag, Input, Row, Col, Spin } from 'antd';
import { FieldProps } from './types';
import TextareaAutosize from 'react-textarea-autosize';
import { debounce } from 'lodash';

const { Text, Title } = Typography;

/**
 * Basic text field component
 */
export const TextField: React.FC<FieldProps & { label?: string; placeholder?: string }> = ({
  value,
  path,
  onEdit,
  label,
  placeholder
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(() => {
    if (typeof value === 'string') return value || '';
    if (typeof value === 'object' && value !== null) {
      if (value.core_setting_summary) {
        return value.core_setting_summary;
      }
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return '';
      }
    }
    return value || '';
  });

  React.useEffect(() => {
    if (typeof value === 'string') {
      setEditValue(value || '');
    } else if (typeof value === 'object' && value !== null) {
      if (value.core_setting_summary) {
        setEditValue(value.core_setting_summary);
      } else {
        try {
          setEditValue(JSON.stringify(value, null, 2));
        } catch {
          setEditValue('');
        }
      }
    } else {
      setEditValue(value || '');
    }
  }, [value]);

  const handleSave = () => {
    if (onEdit && editValue !== value) {
      onEdit(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div style={{ marginBottom: '8px' }}>
        {label && (
          <Text strong style={{ display: 'block', marginBottom: '4px', color: '#fff' }}>
            {label}
          </Text>
        )}
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onPressEnter={handleSave}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === 'Escape' && handleCancel()}
          placeholder={placeholder}
          autoFocus
          style={{
            backgroundColor: '#1f1f1f',
            borderColor: '#404040',
            color: '#fff'
          }}
        />
      </div>
    );
  }

  // Handle object values safely
  const displayValue = React.useMemo(() => {
    if (typeof value === 'string') {
      return value;
    } else if (typeof value === 'object' && value !== null) {
      // For TextField, convert objects to a simple string
      try {
        return JSON.stringify(value);
      } catch {
        return '[Object]';
      }
    }
    return value || placeholder || '';
  }, [value, placeholder]);

  return (
    <div style={{ marginBottom: '8px' }}>
      {label && (
        <Text strong style={{ display: 'block', marginBottom: '4px', color: '#fff' }}>
          {label}
        </Text>
      )}
      <div
        onClick={() => onEdit && setIsEditing(true)}
        style={{
          padding: '8px 12px',
          backgroundColor: '#262626',
          border: '1px solid #303030',
          borderRadius: '6px',
          cursor: onEdit ? 'pointer' : 'default',
          color: '#d9d9d9',
          minHeight: '32px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {displayValue}
      </div>
    </div>
  );
};

/**
 * Multi-line text area field
 */
export const TextAreaField: React.FC<FieldProps & { label?: string; placeholder?: string }> = ({
  value,
  path,
  onEdit,
  label,
  placeholder
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(() => {
    if (typeof value === 'string') return value || '';
    if (typeof value === 'object' && value !== null) {
      try {
        return JSON.stringify(value);
      } catch {
        return '';
      }
    }
    return value || '';
  });

  React.useEffect(() => {
    if (typeof value === 'string') {
      setEditValue(value || '');
    } else if (typeof value === 'object' && value !== null) {
      try {
        setEditValue(JSON.stringify(value));
      } catch {
        setEditValue('');
      }
    } else {
      setEditValue(value || '');
    }
  }, [value]);

  const handleSave = () => {
    if (onEdit && editValue !== value) {
      onEdit(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div style={{ marginBottom: '8px' }}>
        {label && (
          <Text strong style={{ display: 'block', marginBottom: '4px', color: '#fff' }}>
            {label}
          </Text>
        )}
        <TextareaAutosize
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleCancel();
            if (e.key === 'Enter' && e.ctrlKey) handleSave();
          }}
          placeholder={placeholder}
          autoFocus
          minRows={3}
          maxRows={10}
          style={{
            width: '100%',
            backgroundColor: '#1f1f1f',
            border: '1px solid #404040',
            borderRadius: '6px',
            color: '#fff',
            padding: '8px 12px',
            fontSize: '14px',
            lineHeight: '1.5715',
            resize: 'none',
            outline: 'none'
          }}
        />
        <Text type="secondary" style={{ fontSize: '12px', color: '#888' }}>
          按 Ctrl+Enter 保存，Esc 取消
        </Text>
      </div>
    );
  }

  // Handle object values safely
  const displayValue = React.useMemo(() => {
    if (typeof value === 'string') {
      return value;
    } else if (typeof value === 'object' && value !== null) {
      // If it's an object, try to extract a meaningful string representation
      if (value.core_setting_summary) {
        return value.core_setting_summary;
      }
      // For other objects, try to stringify them safely
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return '[Object]';
      }
    }
    return value || placeholder || '';
  }, [value, placeholder]);

  return (
    <div style={{ marginBottom: '8px' }}>
      {label && (
        <Text strong style={{ display: 'block', marginBottom: '4px', color: '#fff' }}>
          {label}
        </Text>
      )}
      <div
        onClick={() => onEdit && setIsEditing(true)}
        style={{
          padding: '8px 12px',
          backgroundColor: '#262626',
          border: '1px solid #303030',
          borderRadius: '6px',
          cursor: onEdit ? 'pointer' : 'default',
          color: '#d9d9d9',
          minHeight: '80px',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.5'
        }}
      >
        {displayValue}
      </div>
    </div>
  );
};

/**
 * Array of strings display
 */
export const TagListField: React.FC<FieldProps & { label?: string }> = ({
  value,
  label
}) => {
  const items = Array.isArray(value) ? value : [];

  return (
    <div style={{ marginBottom: '8px' }}>
      {label && (
        <Text strong style={{ display: 'block', marginBottom: '4px', color: '#fff' }}>
          {label}
        </Text>
      )}
      <div>
        {items.map((item, index) => (
          <Tag key={index} style={{ marginBottom: '4px', backgroundColor: '#434343', color: '#d9d9d9', border: 'none' }}>
            {item}
          </Tag>
        ))}
      </div>
    </div>
  );
};

/**
 * Array of text items (like selling points)
 */
export const TextListField: React.FC<FieldProps & { label?: string }> = ({
  value,
  label
}) => {
  const items = Array.isArray(value) ? value : [];

  return (
    <div style={{ marginBottom: '8px' }}>
      {label && (
        <Text strong style={{ display: 'block', marginBottom: '4px', color: '#fff' }}>
          {label}
        </Text>
      )}
      <div>
        {items.map((item, index) => (
          <div
            key={index}
            style={{
              padding: '6px 12px',
              backgroundColor: '#262626',
              border: '1px solid #303030',
              borderRadius: '4px',
              marginBottom: '4px',
              color: '#d9d9d9'
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Character card component for outline characters
 */
export const CharacterCard: React.FC<FieldProps> = ({ value }) => {
  const character = value || {};

  return (
    <Card
      size="small"
      style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #303030',
        marginBottom: '12px',
        height: '100%'
      }}
      bodyStyle={{ padding: '12px' }}
    >
      {/* Header: Name and Type */}
      <div style={{ marginBottom: '8px' }}>
        <Row gutter={8}>
          <Col span={14}>
            {character.name && (
              <TextField
                value={character.name}
                path="name"
                label="姓名"
              />
            )}
          </Col>
          <Col span={10}>
            {character.type && (
              <TextField
                value={character.type}
                path="type"
                label="类型"
              />
            )}
          </Col>
        </Row>
      </div>

      {/* Basic Info Row */}
      <div style={{ marginBottom: '8px' }}>
        <Row gutter={6}>
          <Col span={8}>
            {character.age && (
              <TextField
                value={character.age}
                path="age"
                label="年龄"
              />
            )}
          </Col>
          <Col span={8}>
            {character.gender && (
              <TextField
                value={character.gender}
                path="gender"
                label="性别"
              />
            )}
          </Col>
          <Col span={8}>
            {character.occupation && (
              <TextField
                value={character.occupation}
                path="occupation"
                label="职业"
              />
            )}
          </Col>
        </Row>
      </div>

      {/* Description */}
      {character.description && (
        <div style={{ marginBottom: '8px' }}>
          <TextAreaField
            value={character.description}
            path="description"
            label="描述"
          />
        </div>
      )}

      {/* Personality Traits */}
      {character.personality_traits && (
        <div style={{ marginBottom: '8px' }}>
          <TagListField
            value={character.personality_traits}
            path="personality_traits"
            label="性格特点"
          />
        </div>
      )}

      {/* Character Arc */}
      {character.character_arc && (
        <div>
          <TextAreaField
            value={character.character_arc}
            path="character_arc"
            label="成长轨迹"
          />
        </div>
      )}
    </Card>
  );
};

/**
 * Idea card component for brainstorming
 */
export const IdeaCard: React.FC<FieldProps & { onSelect?: () => void; isSelected?: boolean }> = ({
  value,
  onSelect,
  isSelected
}) => {
  const idea = value || {};

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '12px',
        backgroundColor: isSelected ? '#1f3a8a' : '#262626',
        border: isSelected ? '2px solid #1890ff' : '1px solid #303030',
        borderRadius: '8px',
        marginBottom: '8px',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
        animation: 'fadeIn 0.3s ease-out'
      }}
      onMouseEnter={(e) => {
        if (!isSelected && onSelect) {
          e.currentTarget.style.backgroundColor = '#333333';
          e.currentTarget.style.transform = 'scale(1.01)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected && onSelect) {
          e.currentTarget.style.backgroundColor = '#262626';
          e.currentTarget.style.transform = 'scale(1)';
        }
      }}
    >
      {idea.title && (
        <Text strong style={{ color: '#d9d9d9', display: 'block', marginBottom: '4px' }}>
          {idea.title}
        </Text>
      )}
      {idea.body && (
        <Text style={{ color: '#bfbfbf', fontSize: '13px', lineHeight: '1.4' }}>
          {idea.body}
        </Text>
      )}
    </div>
  );
};

/**
 * Section wrapper for grouping related fields
 */
export const SectionWrapper: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: '24px' }}>
    <Title level={4} style={{ color: '#fff', marginBottom: '12px' }}>
      {title}
    </Title>
    <div>{children}</div>
  </div>
);

// CSS animations
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

// Extended field props for auto-save components
interface ExtendedFieldProps extends FieldProps {
  disabled?: boolean;
  style?: React.CSSProperties;
  placeholder?: string;
}

// Auto-save textarea field with resize
export const AutoSaveTextAreaField: React.FC<ExtendedFieldProps & {
  label?: string;
  onSave?: (value: string) => Promise<void>;
  debounceMs?: number;
}> = ({
  value,
  onSave,
  debounceMs = 1000,
  label,
  placeholder,
  disabled = false,
  style,
  ...props
}) => {
    const [localValue, setLocalValue] = useState(value || '');
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Update local value when prop changes
    useEffect(() => {
      setLocalValue(value || '');
      setHasUnsavedChanges(false);
    }, [value]);

    // Debounced save function
    const debouncedSave = useMemo(
      () => debounce(async (newValue: string) => {
        if (onSave && newValue !== value) {
          setIsSaving(true);
          setSaveError(null);
          try {
            await onSave(newValue);
            setHasUnsavedChanges(false);
          } catch (error) {
            console.error('Auto-save failed:', error);
            setSaveError('保存失败');
          } finally {
            setIsSaving(false);
          }
        }
      }, debounceMs),
      [onSave, value, debounceMs]
    );

    // Auto-save on value change
    useEffect(() => {
      if (localValue !== value) {
        setHasUnsavedChanges(true);
        debouncedSave(localValue);
      }
    }, [localValue, debouncedSave, value]);

    // Cleanup debounce on unmount
    useEffect(() => {
      return () => {
        debouncedSave.cancel();
      };
    }, [debouncedSave]);

    return (
      <div style={{ marginBottom: '8px', ...style }}>
        {label && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <Text strong style={{ color: '#fff' }}>
              {label}
            </Text>
            {isSaving && (
              <Spin size="small" style={{ marginLeft: '8px' }} />
            )}
            {hasUnsavedChanges && !isSaving && (
              <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>
                未保存
              </Text>
            )}
            {saveError && (
              <Text type="danger" style={{ marginLeft: '8px', fontSize: '12px' }}>
                {saveError}
              </Text>
            )}
          </div>
        )}

        <TextareaAutosize
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          minRows={3}
          maxRows={20}
          style={{
            width: '100%',
            backgroundColor: '#1f1f1f',
            border: '1px solid #404040',
            borderRadius: '6px',
            color: '#fff',
            padding: '8px 12px',
            fontSize: '14px',
            lineHeight: '1.5715',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit'
          }}
        />
      </div>
    );
  };

// Single-line auto-save field
export const AutoSaveTextField: React.FC<ExtendedFieldProps & {
  label?: string;
  onSave?: (value: string) => Promise<void>;
  debounceMs?: number;
}> = ({
  value,
  onSave,
  debounceMs = 1000,
  label,
  placeholder,
  disabled = false,
  style,
  ...props
}) => {
    const [localValue, setLocalValue] = useState(value || '');
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Update local value when prop changes
    useEffect(() => {
      setLocalValue(value || '');
      setHasUnsavedChanges(false);
    }, [value]);

    // Debounced save function
    const debouncedSave = useMemo(
      () => debounce(async (newValue: string) => {
        if (onSave && newValue !== value) {
          setIsSaving(true);
          setSaveError(null);
          try {
            await onSave(newValue);
            setHasUnsavedChanges(false);
          } catch (error) {
            console.error('Auto-save failed:', error);
            setSaveError('保存失败');
          } finally {
            setIsSaving(false);
          }
        }
      }, debounceMs),
      [onSave, value, debounceMs]
    );

    // Auto-save on value change
    useEffect(() => {
      if (localValue !== value) {
        setHasUnsavedChanges(true);
        debouncedSave(localValue);
      }
    }, [localValue, debouncedSave, value]);

    // Cleanup debounce on unmount
    useEffect(() => {
      return () => {
        debouncedSave.cancel();
      };
    }, [debouncedSave]);

    return (
      <div style={{ marginBottom: '8px', ...style }}>
        {label && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <Text strong style={{ color: '#fff' }}>
              {label}
            </Text>
            {isSaving && (
              <Spin size="small" style={{ marginLeft: '8px' }} />
            )}
            {hasUnsavedChanges && !isSaving && (
              <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>
                未保存
              </Text>
            )}
            {saveError && (
              <Text type="danger" style={{ marginLeft: '8px', fontSize: '12px' }}>
                {saveError}
              </Text>
            )}
          </div>
        )}

        <Input
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            backgroundColor: '#1f1f1f',
            borderColor: '#404040',
            color: '#fff'
          }}
        />
      </div>
    );
  }; 