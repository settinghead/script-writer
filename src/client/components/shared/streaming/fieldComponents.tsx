import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Tag, Input, Row, Col, Spin, Button, Select, InputNumber } from 'antd';
import { FieldProps } from './types';
import TextareaAutosize from 'react-textarea-autosize';
import { debounce } from "lodash";
// Local type definitions for key points structure
interface RelationshipDevelopment {
  characters: string[];
  content: string;
}

interface EmotionArcDevelopment {
  characters: string[];
  content: string;
}

interface KeyPointObject {
  event: string;
  relationshipDevelopment: RelationshipDevelopment[];
  emotionArcDevelopment: EmotionArcDevelopment[];
}

const { Text, Title } = Typography;
const { Option } = Select;

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

  .dark-select-dropdown .ant-select-item {
    background-color: #1f1f1f !important;
    color: #fff !important;
    border: none !important;
  }

  .dark-select-dropdown .ant-select-item:hover {
    background-color: #434343 !important;
  }

  .dark-select-dropdown .ant-select-item-option-selected {
    background-color: #1890ff !important;
    color: #fff !important;
  }

  .ant-select-selector {
    background-color: #1f1f1f !important;
    border-color: #404040 !important;
    color: #fff !important;
  }

  .ant-select-selection-placeholder {
    color: #8c8c8c !important;
  }

  .ant-select-arrow {
    color: #fff !important;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

// Character type options with user-friendly Mandarin labels
const CHARACTER_TYPE_OPTIONS = [
  { value: 'protagonist', label: '主角' },
  { value: 'male_lead', label: '男主角' },
  { value: 'female_lead', label: '女主角' },
  { value: 'antagonist', label: '反派' },
  { value: 'supporting', label: '配角' },
  { value: 'mentor', label: '导师' },
  { value: 'love_interest', label: '恋人' },
  { value: 'comic_relief', label: '搞笑角色' },
  { value: 'sidekick', label: '助手' },
  { value: 'villain', label: '反面角色' },
  { value: 'neutral', label: '中性角色' },
  { value: 'other', label: '其他' }
];

// Extended field props for auto-save components
interface ExtendedFieldProps extends FieldProps {
  disabled?: boolean;
  style?: React.CSSProperties;
  placeholder?: string;
}

// Auto-save select field for character type
export const AutoSaveSelectField: React.FC<ExtendedFieldProps & {
  label?: string;
  onSave?: (value: string) => Promise<void>;
  debounceMs?: number;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}> = ({
  value,
  onSave,
  debounceMs = 1000,
  label,
  options,
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

    // Find the display label for the current value
    const getDisplayLabel = (val: string) => {
      const option = options.find(opt => opt.value === val);
      return option ? option.label : val;
    };

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

        <Select
          value={localValue}
          onChange={setLocalValue}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: '100%'
          }}
          dropdownStyle={{
            backgroundColor: '#1f1f1f',
            border: '1px solid #404040'
          }}
          dropdownClassName="dark-select-dropdown"
          optionLabelProp="label"
        >
          {options.map(option => (
            <Option
              key={option.value}
              value={option.value}
              label={option.label}
            >
              {option.label}
            </Option>
          ))}
        </Select>
      </div>
    );
  };

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

// Editable array of text items (like satisfaction points, key scenes, synopsis stages)
export const EditableTextListField: React.FC<ExtendedFieldProps & {
  label?: string;
  onSave?: (value: string[]) => Promise<void>;
  debounceMs?: number;
  placeholder?: string;
}> = ({
  value,
  onSave,
  debounceMs = 1000,
  label,
  placeholder = "添加新项目...",
  disabled = false,
  style,
  ...props
}) => {
    const [localItems, setLocalItems] = useState<string[]>(() => {
      return Array.isArray(value) ? value : [];
    });
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Update local value when prop changes
    useEffect(() => {
      const newItems = Array.isArray(value) ? value : [];
      setLocalItems(newItems);
      setHasUnsavedChanges(false);
    }, [value]);

    // Debounced save function
    const debouncedSave = useMemo(
      () => debounce(async (newItems: string[]) => {
        if (onSave && JSON.stringify(newItems) !== JSON.stringify(value)) {
          setIsSaving(true);
          setSaveError(null);
          try {
            await onSave(newItems);
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

    // Auto-save on items change
    useEffect(() => {
      if (JSON.stringify(localItems) !== JSON.stringify(value)) {
        setHasUnsavedChanges(true);
        debouncedSave(localItems);
      }
    }, [localItems, debouncedSave, value]);

    // Cleanup debounce on unmount
    useEffect(() => {
      return () => {
        debouncedSave.cancel();
      };
    }, [debouncedSave]);

    const updateItem = (index: number, newValue: string) => {
      const newItems = [...localItems];
      newItems[index] = newValue;
      setLocalItems(newItems);
    };

    const addItem = () => {
      setLocalItems([...localItems, '']);
    };

    const removeItem = (index: number) => {
      const newItems = localItems.filter((_, i) => i !== index);
      setLocalItems(newItems);
    };

    return (
      <div style={{ marginBottom: '8px', ...style }}>
        {label && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
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

        <div>
          {localItems.map((item, index) => (
            <div key={index} style={{ display: 'flex', marginBottom: '8px', alignItems: 'flex-start' }}>
              <TextareaAutosize
                value={item}
                onChange={(e) => updateItem(index, e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                minRows={2}
                maxRows={6}
                style={{
                  flex: 1,
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
              <Button
                type="text"
                danger
                size="small"
                onClick={() => removeItem(index)}
                disabled={disabled}
                style={{
                  marginLeft: '8px',
                  color: '#ff4d4f',
                  minWidth: '32px'
                }}
              >
                ×
              </Button>
            </div>
          ))}

          <Button
            type="dashed"
            onClick={addItem}
            disabled={disabled}
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              borderColor: '#404040',
              color: '#d9d9d9',
              borderStyle: 'dashed'
            }}
          >
            + 添加项目
          </Button>
        </div>
      </div>
    );
  };

// Editable tag list (for core themes)
export const EditableTagListField: React.FC<ExtendedFieldProps & {
  label?: string;
  onSave?: (value: string[]) => Promise<void>;
  debounceMs?: number;
  placeholder?: string;
}> = ({
  value,
  onSave,
  debounceMs = 1000,
  label,
  placeholder = "添加标签...",
  disabled = false,
  style,
  ...props
}) => {
    const [localTags, setLocalTags] = useState<string[]>(() => {
      return Array.isArray(value) ? value : [];
    });
    const [inputValue, setInputValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Update local value when prop changes
    useEffect(() => {
      const newTags = Array.isArray(value) ? value : [];
      setLocalTags(newTags);
      setHasUnsavedChanges(false);
    }, [value]);

    // Debounced save function
    const debouncedSave = useMemo(
      () => debounce(async (newTags: string[]) => {
        if (onSave && JSON.stringify(newTags) !== JSON.stringify(value)) {
          setIsSaving(true);
          setSaveError(null);
          try {
            await onSave(newTags);
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

    // Auto-save on tags change
    useEffect(() => {
      if (JSON.stringify(localTags) !== JSON.stringify(value)) {
        setHasUnsavedChanges(true);
        debouncedSave(localTags);
      }
    }, [localTags, debouncedSave, value]);

    // Cleanup debounce on unmount
    useEffect(() => {
      return () => {
        debouncedSave.cancel();
      };
    }, [debouncedSave]);

    const addTag = () => {
      if (inputValue.trim() && !localTags.includes(inputValue.trim())) {
        setLocalTags([...localTags, inputValue.trim()]);
        setInputValue('');
      }
    };

    const removeTag = (tagToRemove: string) => {
      setLocalTags(localTags.filter(tag => tag !== tagToRemove));
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTag();
      }
    };

    return (
      <div style={{ marginBottom: '8px', ...style }}>
        {label && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
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

        <div style={{ marginBottom: '8px' }}>
          {localTags.map((tag, index) => (
            <Tag
              key={index}
              closable={!disabled}
              onClose={() => removeTag(tag)}
              style={{
                marginBottom: '4px',
                backgroundColor: '#434343',
                color: '#d9d9d9',
                border: 'none'
              }}
            >
              {tag}
            </Tag>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            style={{
              flex: 1,
              backgroundColor: '#1f1f1f',
              borderColor: '#404040',
              color: '#fff'
            }}
          />
          <Button
            type="primary"
            onClick={addTag}
            disabled={disabled || !inputValue.trim()}
            style={{
              backgroundColor: '#1890ff',
              borderColor: '#1890ff'
            }}
          >
            添加
          </Button>
        </div>
      </div>
    );
  };

// Editable character card component
export const EditableCharacterCard: React.FC<ExtendedFieldProps & {
  onSave?: (value: any) => Promise<void>;
  debounceMs?: number;
  onRemove?: () => void;
  path?: string;
}> = ({
  value,
  onSave,
  debounceMs = 1000,
  onRemove,
  disabled = false,
  path,
  ...props
}) => {
    const [localCharacter, setLocalCharacter] = useState(() => {
      return value || {
        name: '',
        type: '',
        description: '',
        age: '',
        gender: '',
        occupation: '',
        personality_traits: [],
        character_arc: '',
        relationships: {}
      };
    });
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Update local value when prop changes
    useEffect(() => {
      setLocalCharacter(value || {
        name: '',
        type: '',
        description: '',
        age: '',
        gender: '',
        occupation: '',
        personality_traits: [],
        character_arc: '',
        relationships: {}
      });
      setHasUnsavedChanges(false);
    }, [value]);

    // Debounced save function
    const debouncedSave = useMemo(
      () => debounce(async (newCharacter: any) => {
        if (onSave && JSON.stringify(newCharacter) !== JSON.stringify(value)) {
          setIsSaving(true);
          setSaveError(null);
          try {
            await onSave(newCharacter);
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

    // Auto-save on character change
    useEffect(() => {
      if (JSON.stringify(localCharacter) !== JSON.stringify(value)) {
        setHasUnsavedChanges(true);
        debouncedSave(localCharacter);
      }
    }, [localCharacter, debouncedSave, value]);

    // Cleanup debounce on unmount
    useEffect(() => {
      return () => {
        debouncedSave.cancel();
      };
    }, [debouncedSave]);

    const updateField = (field: string, newValue: any) => {
      setLocalCharacter((prev: any) => ({
        ...prev,
        [field]: newValue
      }));
    };

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
        extra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isSaving && <Spin size="small" />}
            {hasUnsavedChanges && !isSaving && (
              <Text type="secondary" style={{ fontSize: '12px' }}>未保存</Text>
            )}
            {saveError && (
              <Text type="danger" style={{ fontSize: '12px' }}>{saveError}</Text>
            )}
            {onRemove && (
              <Button
                type="text"
                danger
                size="small"
                onClick={onRemove}
                disabled={disabled}
                style={{ color: '#ff4d4f' }}
              >
                删除
              </Button>
            )}
          </div>
        }
      >
        {/* Header: Name and Type */}
        <Row gutter={8} style={{ marginBottom: '8px' }}>
          <Col span={14}>
            <AutoSaveTextField
              value={localCharacter.name}
              onSave={async (value) => updateField('name', value)}
              label="姓名"
              placeholder="角色姓名"
              disabled={disabled}
              path={path ? `${path}.name` : 'name'}
            />
          </Col>
          <Col span={10}>
            <AutoSaveSelectField
              value={localCharacter.type}
              onSave={async (value) => updateField('type', value)}
              label="类型"
              placeholder="主角/配角"
              disabled={disabled}
              path={path ? `${path}.type` : 'type'}
              options={CHARACTER_TYPE_OPTIONS}
            />
          </Col>
        </Row>

        {/* Basic Info Row */}
        <Row gutter={6} style={{ marginBottom: '8px' }}>
          <Col span={8}>
            <AutoSaveTextField
              value={localCharacter.age}
              onSave={async (value) => updateField('age', value)}
              label="年龄"
              placeholder="年龄"
              disabled={disabled}
              path={path ? `${path}.age` : 'age'}
            />
          </Col>
          <Col span={8}>
            <AutoSaveTextField
              value={localCharacter.gender}
              onSave={async (value) => updateField('gender', value)}
              label="性别"
              placeholder="性别"
              disabled={disabled}
              path={path ? `${path}.gender` : 'gender'}
            />
          </Col>
          <Col span={8}>
            <AutoSaveTextField
              value={localCharacter.occupation}
              onSave={async (value) => updateField('occupation', value)}
              label="职业"
              placeholder="职业"
              disabled={disabled}
              path={path ? `${path}.occupation` : 'occupation'}
            />
          </Col>
        </Row>

        {/* Description */}
        <div style={{ marginBottom: '8px' }}>
          <AutoSaveTextAreaField
            value={localCharacter.description}
            onSave={async (value) => updateField('description', value)}
            label="描述"
            placeholder="角色描述"
            disabled={disabled}
            path={path ? `${path}.description` : 'description'}
          />
        </div>

        {/* Personality Traits */}
        <div style={{ marginBottom: '8px' }}>
          <EditableTagListField
            value={localCharacter.personality_traits}
            onSave={async (value) => updateField('personality_traits', value)}
            label="性格特点"
            placeholder="添加性格特点"
            disabled={disabled}
            path={path ? `${path}.personality_traits` : 'personality_traits'}
          />
        </div>

        {/* Character Arc */}
        <div>
          <AutoSaveTextAreaField
            value={localCharacter.character_arc}
            onSave={async (value) => updateField('character_arc', value)}
            label="成长轨迹"
            placeholder="角色成长轨迹"
            disabled={disabled}
            path={path ? `${path}.character_arc` : 'character_arc'}
          />
        </div>
      </Card>
    );
  };

// Editable character array wrapper
export const EditableCharacterArrayField: React.FC<ExtendedFieldProps & {
  label?: string;
  onSave?: (value: any[]) => Promise<void>;
  debounceMs?: number;
}> = ({
  value,
  onSave,
  debounceMs = 1000,
  label,
  disabled = false,
  style,
  path,
  ...props
}) => {
    const [localCharacters, setLocalCharacters] = useState<any[]>(() => {
      return Array.isArray(value) ? value : [];
    });
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Update local value when prop changes
    useEffect(() => {
      const newCharacters = Array.isArray(value) ? value : [];
      setLocalCharacters(newCharacters);
      setHasUnsavedChanges(false);
    }, [value]);

    // Debounced save function
    const debouncedSave = useMemo(
      () => debounce(async (newCharacters: any[]) => {
        if (onSave && JSON.stringify(newCharacters) !== JSON.stringify(value)) {
          setIsSaving(true);
          setSaveError(null);
          try {
            await onSave(newCharacters);
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

    // Auto-save on characters change
    useEffect(() => {
      if (JSON.stringify(localCharacters) !== JSON.stringify(value)) {
        setHasUnsavedChanges(true);
        debouncedSave(localCharacters);
      }
    }, [localCharacters, debouncedSave, value]);

    // Cleanup debounce on unmount
    useEffect(() => {
      return () => {
        debouncedSave.cancel();
      };
    }, [debouncedSave]);

    const updateCharacter = (index: number, newCharacter: any) => {
      const newCharacters = [...localCharacters];
      newCharacters[index] = newCharacter;
      setLocalCharacters(newCharacters);
    };

    const addCharacter = () => {
      const newCharacter = {
        name: '',
        type: '',
        description: '',
        age: '',
        gender: '',
        occupation: '',
        personality_traits: [],
        character_arc: '',
        relationships: {}
      };
      setLocalCharacters([...localCharacters, newCharacter]);
    };

    const removeCharacter = (index: number) => {
      const newCharacters = localCharacters.filter((_, i) => i !== index);
      setLocalCharacters(newCharacters);
    };

    return (
      <div style={{ marginBottom: '16px', ...style }}>
        {label && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <Text strong style={{ color: '#fff', fontSize: '16px' }}>
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

        <Row gutter={[16, 16]}>
          {localCharacters.map((character, index) => (
            <Col key={index} xs={24} sm={24} md={12} lg={12} xl={12}>
              <EditableCharacterCard
                value={character}
                onSave={async (newCharacter) => {
                  updateCharacter(index, newCharacter);
                }}
                onRemove={() => removeCharacter(index)}
                disabled={disabled}
                debounceMs={500} // Faster save for individual character fields
                path={`${path ? `${path}.` : ''}characters[${index}]`}
              />
            </Col>
          ))}
        </Row>

        <Button
          type="dashed"
          onClick={addCharacter}
          disabled={disabled}
          style={{
            width: '100%',
            marginTop: '12px',
            backgroundColor: 'transparent',
            borderColor: '#404040',
            color: '#d9d9d9',
            borderStyle: 'dashed'
          }}
        >
          + 添加角色
        </Button>
      </div>
    );
  };

// Editable synopsis stages field with full enhanced structure
export const EditableSynopsisStagesField: React.FC<ExtendedFieldProps & {
  label?: string;
  onSave?: (value: Array<any>) => Promise<void>;
  debounceMs?: number;
  placeholder?: string;
}> = ({
  value,
  onSave,
  debounceMs = 1000,
  label,
  placeholder = "添加故事阶段...",
  disabled = false,
  style,
  ...props
}) => {
    const [localStages, setLocalStages] = useState<Array<any>>(() => {
      // Handle different value types during streaming
      if (Array.isArray(value)) {
        return value;
      } else if (value && typeof value === 'object') {
        // If value is an object, it might be streaming data
        console.log('[EditableSynopsisStagesField] Received object value:', value);
        return [];
      } else {
        return [];
      }
    });
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Update local value when prop changes
    useEffect(() => {
      // Handle different value types during streaming
      let newStages: Array<any> = [];

      if (Array.isArray(value)) {
        newStages = value;
      } else if (value && typeof value === 'object') {
        // If value is an object, it might be streaming data - log for debugging
        console.log('[EditableSynopsisStagesField] Received non-array value:', value);
        newStages = [];
      }

      setLocalStages(newStages);
      setHasUnsavedChanges(false);
    }, [value]);

    // Debounced save function
    const debouncedSave = useMemo(
      () => debounce(async (newStages: Array<any>) => {
        if (onSave && JSON.stringify(newStages) !== JSON.stringify(value)) {
          setIsSaving(true);
          setSaveError(null);
          try {
            await onSave(newStages);
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

    // Auto-save on stages change
    useEffect(() => {
      if (JSON.stringify(localStages) !== JSON.stringify(value)) {
        setHasUnsavedChanges(true);
        debouncedSave(localStages);
      }
    }, [localStages, debouncedSave, value]);

    // Cleanup debounce on unmount
    useEffect(() => {
      return () => {
        debouncedSave.cancel();
      };
    }, [debouncedSave]);

    const updateStage = (index: number, field: string, newValue: any) => {
      const newStages = [...localStages];
      if (field.includes('keyPoints[')) {
        // Handle enhanced key point fields like keyPoints[0].event or keyPoints[0].emotionArcs[0].content
        const match = field.match(/keyPoints\[(\d+)\]\.(.+)/);
        if (match) {
          const pointIndex = parseInt(match[1]);
          const pointField = match[2];
          if (!newStages[index].keyPoints) {
            newStages[index].keyPoints = [];
          }
          if (!newStages[index].keyPoints[pointIndex]) {
            newStages[index].keyPoints[pointIndex] = {
              event: '',
              emotionArcs: [],
              relationshipDevelopments: []
            };
          }

          // Handle nested fields like emotionArcs[0].content
          if (pointField.includes('[')) {
            const nestedMatch = pointField.match(/(\w+)\[(\d+)\]\.(\w+)/);
            if (nestedMatch) {
              const arrayField = nestedMatch[1];
              const arrayIndex = parseInt(nestedMatch[2]);
              const subField = nestedMatch[3];

              if (!newStages[index].keyPoints[pointIndex][arrayField]) {
                newStages[index].keyPoints[pointIndex][arrayField] = [];
              }
              if (!newStages[index].keyPoints[pointIndex][arrayField][arrayIndex]) {
                newStages[index].keyPoints[pointIndex][arrayField][arrayIndex] = { characters: [], content: '' };
              }
              newStages[index].keyPoints[pointIndex][arrayField][arrayIndex][subField] = newValue;
            }
          } else {
            newStages[index].keyPoints[pointIndex][pointField] = newValue;
          }
        }
      } else {
        newStages[index] = { ...newStages[index], [field]: newValue };
      }
      setLocalStages(newStages);
    };

    const addKeyPoint = (stageIndex: number) => {
      const newStages = [...localStages];
      if (!newStages[stageIndex].keyPoints) {
        newStages[stageIndex].keyPoints = [];
      }
      newStages[stageIndex].keyPoints.push({
        event: '',
        emotionArcs: [],
        relationshipDevelopments: []
      });
      setLocalStages(newStages);
    };

    const removeKeyPoint = (stageIndex: number, pointIndex: number) => {
      const newStages = [...localStages];
      if (newStages[stageIndex].keyPoints) {
        newStages[stageIndex].keyPoints.splice(pointIndex, 1);
      }
      setLocalStages(newStages);
    };

    const addEmotionArc = (stageIndex: number, pointIndex: number) => {
      const newStages = [...localStages];
      if (!newStages[stageIndex].keyPoints[pointIndex].emotionArcs) {
        newStages[stageIndex].keyPoints[pointIndex].emotionArcs = [];
      }
      newStages[stageIndex].keyPoints[pointIndex].emotionArcs.push({ characters: [], content: '' });
      setLocalStages(newStages);
    };

    const removeEmotionArc = (stageIndex: number, pointIndex: number, arcIndex: number) => {
      const newStages = [...localStages];
      if (newStages[stageIndex].keyPoints[pointIndex].emotionArcs) {
        newStages[stageIndex].keyPoints[pointIndex].emotionArcs.splice(arcIndex, 1);
      }
      setLocalStages(newStages);
    };

    const addRelationshipDevelopment = (stageIndex: number, pointIndex: number) => {
      const newStages = [...localStages];
      if (!newStages[stageIndex].keyPoints[pointIndex].relationshipDevelopments) {
        newStages[stageIndex].keyPoints[pointIndex].relationshipDevelopments = [];
      }
      newStages[stageIndex].keyPoints[pointIndex].relationshipDevelopments.push({ characters: [], content: '' });
      setLocalStages(newStages);
    };

    const removeRelationshipDevelopment = (stageIndex: number, pointIndex: number, devIndex: number) => {
      const newStages = [...localStages];
      if (newStages[stageIndex].keyPoints[pointIndex].relationshipDevelopments) {
        newStages[stageIndex].keyPoints[pointIndex].relationshipDevelopments.splice(devIndex, 1);
      }
      setLocalStages(newStages);
    };

    const addStage = () => {
      const newStage = {
        title: '',
        stageSynopsis: '',
        numberOfEpisodes: 1,
        startingCondition: '',
        endingCondition: '',
        stageStartEvent: '',
        stageEndEvent: '',
        keyPoints: [],
        externalPressure: ''
      };
      setLocalStages([...localStages, newStage]);
    };

    const removeStage = (index: number) => {
      const newStages = localStages.filter((_, i) => i !== index);
      setLocalStages(newStages);
    };

    // Calculate episode ranges and totals
    const calculateEpisodeRange = (stageIndex: number) => {
      let startEpisode = 1;
      for (let i = 0; i < stageIndex; i++) {
        startEpisode += (localStages[i].numberOfEpisodes || 1);
      }
      const endEpisode = startEpisode + (localStages[stageIndex].numberOfEpisodes || 1) - 1;
      return { start: startEpisode, end: endEpisode };
    };

    const totalEpisodes = localStages.reduce((sum, stage) => sum + (stage.numberOfEpisodes || 1), 0);

    return (
      <div style={{ marginBottom: '16px', ...style }}>
        {label && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <Text strong style={{ color: '#fff', fontSize: '16px' }}>
              {label}
            </Text>
            <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Text style={{ color: '#1890ff', fontSize: '14px' }}>
                总计: {totalEpisodes} 集
              </Text>
              {isSaving && (
                <Spin size="small" />
              )}
              {hasUnsavedChanges && !isSaving && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  未保存
                </Text>
              )}
              {saveError && (
                <Text type="danger" style={{ fontSize: '12px' }}>
                  {saveError}
                </Text>
              )}
            </div>
          </div>
        )}

        <div>
          {localStages.map((stage, index) => {
            const episodeRange = calculateEpisodeRange(index);
            return (
              <Card
                key={index}
                size="small"
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #303030',
                  marginBottom: '16px'
                }}
                bodyStyle={{ padding: '20px' }}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text strong style={{ color: '#fff' }}>
                      {stage.title || `第${index + 1}阶段`} (第{episodeRange.start}-{episodeRange.end}集)
                    </Text>
                    <Button
                      type="text"
                      danger
                      size="small"
                      onClick={() => removeStage(index)}
                      disabled={disabled}
                      style={{ color: '#ff4d4f' }}
                    >
                      删除
                    </Button>
                  </div>
                }
              >
                {/* Stage Title */}
                <div style={{ marginBottom: '16px' }}>
                  <Text strong style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>
                    阶段标题
                  </Text>
                  <Input
                    value={stage.title || ''}
                    onChange={(e) => updateStage(index, 'title', e.target.value)}
                    placeholder="阶段标题"
                    disabled={disabled}
                    style={{
                      backgroundColor: '#1f1f1f',
                      borderColor: '#404040',
                      color: '#fff'
                    }}
                  />
                </div>

                {/* Basic Info */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>
                        集数分配
                      </Text>
                      <InputNumber
                        value={stage.numberOfEpisodes}
                        onChange={(value) => updateStage(index, 'numberOfEpisodes', value || 1)}
                        min={1}
                        max={50}
                        disabled={disabled}
                        style={{
                          width: '100px',
                          backgroundColor: '#1f1f1f',
                          borderColor: '#404040',
                          color: '#fff'
                        }}
                      />
                      <Text style={{ color: '#8c8c8c', marginLeft: '8px' }}>集</Text>
                    </div>
                  </div>

                  <div>
                    <Text strong style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>
                      故事内容
                    </Text>
                    <TextareaAutosize
                      value={stage.stageSynopsis || ''}
                      onChange={(e) => updateStage(index, 'stageSynopsis', e.target.value)}
                      placeholder={placeholder}
                      disabled={disabled}
                      minRows={4}
                      maxRows={12}
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
                </div>

                {/* Temporal Constraints */}
                <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#0f1419', borderRadius: '8px', border: '1px solid #2a3441' }}>
                  <Text strong style={{ color: '#52c41a', display: 'block', marginBottom: '12px', fontSize: '14px' }}>
                    🟢 时间约束
                  </Text>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <Text style={{ color: '#d9d9d9', display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                        开始条件
                      </Text>
                      <Input
                        value={stage.startingCondition || ''}
                        onChange={(e) => updateStage(index, 'startingCondition', e.target.value)}
                        placeholder="阶段开始时的状态"
                        disabled={disabled}
                        style={{ backgroundColor: '#1f1f1f', borderColor: '#404040', color: '#fff' }}
                      />
                    </div>
                    <div>
                      <Text style={{ color: '#d9d9d9', display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                        结束条件
                      </Text>
                      <Input
                        value={stage.endingCondition || ''}
                        onChange={(e) => updateStage(index, 'endingCondition', e.target.value)}
                        placeholder="阶段结束时的状态"
                        disabled={disabled}
                        style={{ backgroundColor: '#1f1f1f', borderColor: '#404040', color: '#fff' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Event Boundaries */}
                <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#0a1220', borderRadius: '8px', border: '1px solid #1a365d' }}>
                  <Text strong style={{ color: '#1890ff', display: 'block', marginBottom: '12px', fontSize: '14px' }}>
                    🔵 事件边界
                  </Text>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <Text style={{ color: '#d9d9d9', display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                        开始事件
                      </Text>
                      <Input
                        value={stage.stageStartEvent || ''}
                        onChange={(e) => updateStage(index, 'stageStartEvent', e.target.value)}
                        placeholder="触发阶段开始的关键事件"
                        disabled={disabled}
                        style={{ backgroundColor: '#1f1f1f', borderColor: '#404040', color: '#fff' }}
                      />
                    </div>
                    <div>
                      <Text style={{ color: '#d9d9d9', display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                        结束事件
                      </Text>
                      <Input
                        value={stage.stageEndEvent || ''}
                        onChange={(e) => updateStage(index, 'stageEndEvent', e.target.value)}
                        placeholder="标志阶段结束的事件"
                        disabled={disabled}
                        style={{ backgroundColor: '#1f1f1f', borderColor: '#404040', color: '#fff' }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <Text style={{ color: '#d9d9d9', fontSize: '12px' }}>
                        关键节点
                      </Text>
                      <Button
                        type="text"
                        size="small"
                        onClick={() => addKeyPoint(index)}
                        disabled={disabled}
                        style={{ color: '#1890ff', fontSize: '12px' }}
                      >
                        + 添加
                      </Button>
                    </div>
                    {(stage.keyPoints || []).map((point: any, pIndex: number) => (
                      <div key={pIndex} style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#262626', borderRadius: '6px', border: '1px solid #404040' }}>
                        {/* Basic Event Info */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                          <Input
                            value={point.event || ''}
                            onChange={(e) => updateStage(index, `keyPoints[${pIndex}].event`, e.target.value)}
                            placeholder="关键事件节点"
                            disabled={disabled}
                            style={{
                              flex: 2,
                              backgroundColor: '#1f1f1f',
                              borderColor: '#404040',
                              color: '#fff',
                              fontSize: '12px'
                            }}
                          />

                          <Button
                            type="text"
                            size="small"
                            onClick={() => removeKeyPoint(index, pIndex)}
                            disabled={disabled}
                            style={{ color: '#ff4d4f' }}
                          >
                            ×
                          </Button>
                        </div>

                        {/* Emotion Arcs */}
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <Text style={{ color: '#52c41a', fontSize: '11px', fontWeight: 'bold' }}>
                              情感发展
                            </Text>
                            <Button
                              type="text"
                              size="small"
                              onClick={() => addEmotionArc(index, pIndex)}
                              disabled={disabled}
                              style={{ color: '#52c41a', fontSize: '10px' }}
                            >
                              + 添加
                            </Button>
                          </div>
                          {(point.emotionArcs || []).map((arc: any, aIndex: number) => (
                            <div key={aIndex} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                              <Input
                                value={(arc.characters || []).join(', ')}
                                onChange={(e) => updateStage(index, `keyPoints[${pIndex}].emotionArcs[${aIndex}].characters`, e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                                placeholder="角色名 (用逗号分隔)"
                                disabled={disabled}
                                style={{
                                  flex: 1,
                                  backgroundColor: '#1a1a1a',
                                  borderColor: '#303030',
                                  color: '#fff',
                                  fontSize: '11px'
                                }}
                              />
                              <Input
                                value={arc.content || ''}
                                onChange={(e) => updateStage(index, `keyPoints[${pIndex}].emotionArcs[${aIndex}].content`, e.target.value)}
                                placeholder="情感变化描述"
                                disabled={disabled}
                                style={{
                                  flex: 2,
                                  backgroundColor: '#1a1a1a',
                                  borderColor: '#303030',
                                  color: '#fff',
                                  fontSize: '11px'
                                }}
                              />
                              <Button
                                type="text"
                                size="small"
                                onClick={() => removeEmotionArc(index, pIndex, aIndex)}
                                disabled={disabled}
                                style={{ color: '#ff4d4f', fontSize: '10px' }}
                              >
                                ×
                              </Button>
                            </div>
                          ))}
                        </div>

                        {/* Relationship Developments */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <Text style={{ color: '#1890ff', fontSize: '11px', fontWeight: 'bold' }}>
                              关系发展
                            </Text>
                            <Button
                              type="text"
                              size="small"
                              onClick={() => addRelationshipDevelopment(index, pIndex)}
                              disabled={disabled}
                              style={{ color: '#1890ff', fontSize: '10px' }}
                            >
                              + 添加
                            </Button>
                          </div>
                          {(point.relationshipDevelopments || []).map((dev: any, dIndex: number) => (
                            <div key={dIndex} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                              <Input
                                value={(dev.characters || []).join(', ')}
                                onChange={(e) => updateStage(index, `keyPoints[${pIndex}].relationshipDevelopments[${dIndex}].characters`, e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                                placeholder="角色名 (用逗号分隔)"
                                disabled={disabled}
                                style={{
                                  flex: 1,
                                  backgroundColor: '#1a1a1a',
                                  borderColor: '#303030',
                                  color: '#fff',
                                  fontSize: '11px'
                                }}
                              />
                              <Input
                                value={dev.content || ''}
                                onChange={(e) => updateStage(index, `keyPoints[${pIndex}].relationshipDevelopments[${dIndex}].content`, e.target.value)}
                                placeholder="关系发展描述"
                                disabled={disabled}
                                style={{
                                  flex: 2,
                                  backgroundColor: '#1a1a1a',
                                  borderColor: '#303030',
                                  color: '#fff',
                                  fontSize: '11px'
                                }}
                              />
                              <Button
                                type="text"
                                size="small"
                                onClick={() => removeRelationshipDevelopment(index, pIndex, dIndex)}
                                disabled={disabled}
                                style={{ color: '#ff4d4f', fontSize: '10px' }}
                              >
                                ×
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* External Pressure */}
                <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#1a0d00', borderRadius: '8px', border: '1px solid #5a2d00' }}>
                  <Text strong style={{ color: '#fa8c16', display: 'block', marginBottom: '12px', fontSize: '14px' }}>
                    🟠 外部环境
                  </Text>
                  <div>
                    <Text style={{ color: '#d9d9d9', display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                      外部压力
                    </Text>
                    <Input
                      value={stage.externalPressure || ''}
                      onChange={(e) => updateStage(index, 'externalPressure', e.target.value)}
                      placeholder="外部环境压力"
                      disabled={disabled}
                      style={{ backgroundColor: '#1f1f1f', borderColor: '#404040', color: '#fff' }}
                    />
                  </div>
                </div>
              </Card>
            );
          })}

          <Button
            type="dashed"
            onClick={addStage}
            disabled={disabled}
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              borderColor: '#404040',
              color: '#d9d9d9',
              borderStyle: 'dashed'
            }}
          >
            + 添加故事阶段
          </Button>
        </div>
      </div>
    );
  };

// Editable emotion developments field for episodes
export const EditableEmotionDevelopmentsField: React.FC<ExtendedFieldProps & {
  label?: string;
  onSave?: (value: Array<any>) => Promise<void>;
  debounceMs?: number;
}> = ({
  value,
  onSave,
  debounceMs = 1000,
  label,
  disabled = false,
  style,
  ...props
}) => {
    const [localDevelopments, setLocalDevelopments] = useState<Array<any>>(() => {
      return Array.isArray(value) ? value : [];
    });
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Update local value when prop changes
    useEffect(() => {
      const newDevelopments = Array.isArray(value) ? value : [];
      setLocalDevelopments(newDevelopments);
      setHasUnsavedChanges(false);
    }, [value]);

    // Debounced save function
    const debouncedSave = useMemo(
      () => debounce(async (newDevelopments: Array<any>) => {
        if (onSave && JSON.stringify(newDevelopments) !== JSON.stringify(value)) {
          setIsSaving(true);
          setSaveError(null);
          try {
            await onSave(newDevelopments);
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

    // Auto-save on developments change
    useEffect(() => {
      if (JSON.stringify(localDevelopments) !== JSON.stringify(value)) {
        setHasUnsavedChanges(true);
        debouncedSave(localDevelopments);
      }
    }, [localDevelopments, debouncedSave, value]);

    // Cleanup debounce on unmount
    useEffect(() => {
      return () => {
        debouncedSave.cancel();
      };
    }, [debouncedSave]);

    const updateDevelopment = (index: number, field: string, newValue: any) => {
      const newDevelopments = [...localDevelopments];
      newDevelopments[index] = { ...newDevelopments[index], [field]: newValue };
      setLocalDevelopments(newDevelopments);
    };

    const addDevelopment = () => {
      const newDevelopment = {
        characters: [],
        content: ''
      };
      setLocalDevelopments([...localDevelopments, newDevelopment]);
    };

    const removeDevelopment = (index: number) => {
      const newDevelopments = localDevelopments.filter((_, i) => i !== index);
      setLocalDevelopments(newDevelopments);
    };

    return (
      <div style={{ marginBottom: '16px', ...style }}>
        {label && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <Text strong style={{ color: '#52c41a', fontSize: '14px' }}>
              💚 {label}
            </Text>
            <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isSaving && (
                <Spin size="small" />
              )}
              {hasUnsavedChanges && !isSaving && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  未保存
                </Text>
              )}
              {saveError && (
                <Text type="danger" style={{ fontSize: '12px' }}>
                  {saveError}
                </Text>
              )}
            </div>
          </div>
        )}

        <div>
          {localDevelopments.map((development, index) => (
            <Card
              key={index}
              size="small"
              style={{
                backgroundColor: '#0a2000',
                border: '1px solid #237a00',
                marginBottom: '12px'
              }}
              bodyStyle={{ padding: '12px' }}
              title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#52c41a', fontSize: '12px' }}>
                    情感发展 #{index + 1}
                  </Text>
                  <Button
                    type="text"
                    danger
                    size="small"
                    onClick={() => removeDevelopment(index)}
                    disabled={disabled}
                    style={{ color: '#ff4d4f' }}
                  >
                    删除
                  </Button>
                </div>
              }
            >
              {/* Characters */}
              <div style={{ marginBottom: '12px' }}>
                <Text style={{ color: '#d9d9d9', display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                  角色（用逗号分隔）
                </Text>
                <Input
                  value={(development.characters || []).join(', ')}
                  onChange={(e) => updateDevelopment(index, 'characters', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                  placeholder="如：林晚晴, 顾沉舟"
                  disabled={disabled}
                  style={{
                    backgroundColor: '#1f1f1f',
                    borderColor: '#404040',
                    color: '#fff'
                  }}
                />
              </div>

              {/* Content */}
              <div>
                <Text style={{ color: '#d9d9d9', display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                  情感变化描述
                </Text>
                <TextareaAutosize
                  value={development.content || ''}
                  onChange={(e) => updateDevelopment(index, 'content', e.target.value)}
                  placeholder="描述该集中角色的具体情感变化，比大纲层面更加细致..."
                  disabled={disabled}
                  minRows={2}
                  maxRows={6}
                  style={{
                    width: '100%',
                    backgroundColor: '#1f1f1f',
                    border: '1px solid #404040',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '8px 12px',
                    fontSize: '12px',
                    lineHeight: '1.5715',
                    resize: 'none',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </Card>
          ))}

          <Button
            type="dashed"
            onClick={addDevelopment}
            disabled={disabled}
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              borderColor: '#52c41a',
              color: '#52c41a',
              borderStyle: 'dashed'
            }}
          >
            + 添加情感发展
          </Button>
        </div>
      </div>
    );
  };

// Editable relationship developments field for episodes
export const EditableRelationshipDevelopmentsField: React.FC<ExtendedFieldProps & {
  label?: string;
  onSave?: (value: Array<any>) => Promise<void>;
  debounceMs?: number;
}> = ({
  value,
  onSave,
  debounceMs = 1000,
  label,
  disabled = false,
  style,
  ...props
}) => {
    const [localDevelopments, setLocalDevelopments] = useState<Array<any>>(() => {
      return Array.isArray(value) ? value : [];
    });
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Update local value when prop changes
    useEffect(() => {
      const newDevelopments = Array.isArray(value) ? value : [];
      setLocalDevelopments(newDevelopments);
      setHasUnsavedChanges(false);
    }, [value]);

    // Debounced save function
    const debouncedSave = useMemo(
      () => debounce(async (newDevelopments: Array<any>) => {
        if (onSave && JSON.stringify(newDevelopments) !== JSON.stringify(value)) {
          setIsSaving(true);
          setSaveError(null);
          try {
            await onSave(newDevelopments);
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

    // Auto-save on developments change
    useEffect(() => {
      if (JSON.stringify(localDevelopments) !== JSON.stringify(value)) {
        setHasUnsavedChanges(true);
        debouncedSave(localDevelopments);
      }
    }, [localDevelopments, debouncedSave, value]);

    // Cleanup debounce on unmount
    useEffect(() => {
      return () => {
        debouncedSave.cancel();
      };
    }, [debouncedSave]);

    const updateDevelopment = (index: number, field: string, newValue: any) => {
      const newDevelopments = [...localDevelopments];
      newDevelopments[index] = { ...newDevelopments[index], [field]: newValue };
      setLocalDevelopments(newDevelopments);
    };

    const addDevelopment = () => {
      const newDevelopment = {
        characters: [],
        content: ''
      };
      setLocalDevelopments([...localDevelopments, newDevelopment]);
    };

    const removeDevelopment = (index: number) => {
      const newDevelopments = localDevelopments.filter((_, i) => i !== index);
      setLocalDevelopments(newDevelopments);
    };

    return (
      <div style={{ marginBottom: '16px', ...style }}>
        {label && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <Text strong style={{ color: '#1890ff', fontSize: '14px' }}>
              💙 {label}
            </Text>
            <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isSaving && (
                <Spin size="small" />
              )}
              {hasUnsavedChanges && !isSaving && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  未保存
                </Text>
              )}
              {saveError && (
                <Text type="danger" style={{ fontSize: '12px' }}>
                  {saveError}
                </Text>
              )}
            </div>
          </div>
        )}

        <div>
          {localDevelopments.map((development, index) => (
            <Card
              key={index}
              size="small"
              style={{
                backgroundColor: '#001529',
                border: '1px solid #1890ff',
                marginBottom: '12px'
              }}
              bodyStyle={{ padding: '12px' }}
              title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#1890ff', fontSize: '12px' }}>
                    关系发展 #{index + 1}
                  </Text>
                  <Button
                    type="text"
                    danger
                    size="small"
                    onClick={() => removeDevelopment(index)}
                    disabled={disabled}
                    style={{ color: '#ff4d4f' }}
                  >
                    删除
                  </Button>
                </div>
              }
            >
              {/* Characters */}
              <div style={{ marginBottom: '12px' }}>
                <Text style={{ color: '#d9d9d9', display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                  角色（用逗号分隔）
                </Text>
                <Input
                  value={(development.characters || []).join(', ')}
                  onChange={(e) => updateDevelopment(index, 'characters', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                  placeholder="如：林晚晴, 顾沉舟"
                  disabled={disabled}
                  style={{
                    backgroundColor: '#1f1f1f',
                    borderColor: '#404040',
                    color: '#fff'
                  }}
                />
              </div>

              {/* Content */}
              <div>
                <Text style={{ color: '#d9d9d9', display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                  关系发展描述
                </Text>
                <TextareaAutosize
                  value={development.content || ''}
                  onChange={(e) => updateDevelopment(index, 'content', e.target.value)}
                  placeholder="描述该集中角色间关系的具体变化，比大纲层面更加细致..."
                  disabled={disabled}
                  minRows={2}
                  maxRows={6}
                  style={{
                    width: '100%',
                    backgroundColor: '#1f1f1f',
                    border: '1px solid #404040',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '8px 12px',
                    fontSize: '12px',
                    lineHeight: '1.5715',
                    resize: 'none',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </Card>
          ))}

          <Button
            type="dashed"
            onClick={addDevelopment}
            disabled={disabled}
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              borderColor: '#1890ff',
              color: '#1890ff',
              borderStyle: 'dashed'
            }}
          >
            + 添加关系发展
          </Button>
        </div>
      </div>
    );
  }; 