import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { useSearchParams } from 'react-router-dom';

interface ProjectSettingsModalProps {
  projectId: string;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ projectId }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // Open/close via URL (?projectSettings=1)
  useEffect(() => {
    setOpen(searchParams.get('projectSettings') === '1');
  }, [searchParams]);

  const handleCancel = () => {
    searchParams.delete('projectSettings');
    setSearchParams(searchParams, { replace: true });
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await fetch(`/api/projects/${projectId}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: values.title })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      message.success('项目标题已保存');
      handleCancel();
    } catch (err: any) {
      message.error(`保存失败: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="项目设置"
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="项目标题"
          name="title"
          rules={[{ required: true, message: '请输入项目标题' }]}
        >
          <Input placeholder="例如：城市奇缘·救赎与成长" maxLength={120} />
        </Form.Item>
      </Form>
    </Modal>
  );
};






