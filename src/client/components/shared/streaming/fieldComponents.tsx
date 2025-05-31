import React from 'react';
import { Card, Typography, Tag, Input } from 'antd';
import { FieldProps } from './types';
import TextareaAutosize from 'react-textarea-autosize';

const { Text, Title } = Typography;

/**
 * Basic text field component
 */
export const TextField: React.FC<FieldProps & { label?: string; placeholder?: string }> = ({
  value,
  path,
  onEdit,
  isPartial,
  label,
  placeholder
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(value || '');

  React.useEffect(() => {
    setEditValue(value || '');
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
          alignItems: 'center',
          opacity: isPartial ? 0.7 : 1,
          transition: 'opacity 0.3s ease'
        }}
      >
        {value || placeholder || ''}
        {isPartial && (
          <span style={{ marginLeft: '8px', animation: 'blink 1s infinite' }}>▋</span>
        )}
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
  isPartial,
  label,
  placeholder
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(value || '');

  React.useEffect(() => {
    setEditValue(value || '');
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
          lineHeight: '1.5',
          opacity: isPartial ? 0.7 : 1,
          transition: 'opacity 0.3s ease'
        }}
      >
        {value || placeholder || ''}
        {isPartial && (
          <span style={{ marginLeft: '8px', animation: 'blink 1s infinite' }}>▋</span>
        )}
      </div>
    </div>
  );
};

/**
 * Array of strings display
 */
export const TagListField: React.FC<FieldProps & { label?: string }> = ({
  value,
  isPartial,
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
      <div style={{ opacity: isPartial ? 0.7 : 1, transition: 'opacity 0.3s ease' }}>
        {items.map((item, index) => (
          <Tag key={index} style={{ marginBottom: '4px', backgroundColor: '#434343', color: '#d9d9d9', border: 'none' }}>
            {item}
          </Tag>
        ))}
        {isPartial && items.length > 0 && (
          <span style={{ marginLeft: '8px', animation: 'blink 1s infinite' }}>▋</span>
        )}
      </div>
    </div>
  );
};

/**
 * Array of text items (like selling points)
 */
export const TextListField: React.FC<FieldProps & { label?: string }> = ({
  value,
  isPartial,
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
      <div style={{ opacity: isPartial ? 0.7 : 1, transition: 'opacity 0.3s ease' }}>
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
        {isPartial && items.length > 0 && (
          <span style={{ marginLeft: '8px', animation: 'blink 1s infinite' }}>▋</span>
        )}
      </div>
    </div>
  );
};

/**
 * Character card component for outline characters
 */
export const CharacterCard: React.FC<FieldProps> = ({ value, isPartial }) => {
  const character = value || {};

  return (
    <Card
      style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #303030',
        marginBottom: '12px',
        opacity: isPartial ? 0.7 : 1,
        transition: 'opacity 0.3s ease'
      }}
      bodyStyle={{ padding: '12px' }}
    >
      {character.name && (
        <TextField 
          value={character.name} 
          path="name" 
          label="姓名"
          isPartial={isPartial && !character.type}
        />
      )}
      {character.type && (
        <TextField 
          value={character.type} 
          path="type" 
          label="角色类型"
          isPartial={isPartial && !character.description}
        />
      )}
      {character.description && (
        <TextAreaField 
          value={character.description} 
          path="description" 
          label="角色描述"
          isPartial={isPartial && !character.age}
        />
      )}
      {character.age && (
        <TextField 
          value={character.age} 
          path="age" 
          label="年龄"
          isPartial={isPartial && !character.gender}
        />
      )}
      {character.gender && (
        <TextField 
          value={character.gender} 
          path="gender" 
          label="性别"
          isPartial={isPartial && !character.occupation}
        />
      )}
      {character.occupation && (
        <TextField 
          value={character.occupation} 
          path="occupation" 
          label="职业"
          isPartial={isPartial && !character.personality_traits}
        />
      )}
      {character.personality_traits && (
        <TagListField 
          value={character.personality_traits} 
          path="personality_traits" 
          label="性格特点"
          isPartial={isPartial && !character.character_arc}
        />
      )}
      {character.character_arc && (
        <TextAreaField 
          value={character.character_arc} 
          path="character_arc" 
          label="人物成长轨迹"
          isPartial={isPartial}
        />
      )}
      {isPartial && (
        <div style={{ textAlign: 'center', color: '#666', fontSize: '12px', marginTop: '8px' }}>
          <span style={{ animation: 'blink 1s infinite' }}>正在生成...</span>
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
  isPartial, 
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
        opacity: isPartial ? 0.7 : 1,
        animation: isPartial ? 'none' : 'fadeIn 0.3s ease-out'
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
      {isPartial && (
        <span style={{ marginLeft: '8px', animation: 'blink 1s infinite' }}>▋</span>
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
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
} 