import { useState } from 'react';
import { Upload, Button, message, Image, Input, Space } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import webManagementService from '../../services/webManagementService.js';
import { resolveUploadUrl } from '../../config/api.js';

/**
 * Image field for Web Management forms.
 * Uploads via /web-management/upload-images and stores the returned relative URL.
 * Also accepts a pasted external URL. Controlled via `value` / `onChange` so it
 * plugs straight into antd Form.Item.
 */
const WebImageUpload = ({ value, onChange }) => {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const res = await webManagementService.uploadImages([file]);
      if (res.success && res.data?.[0]) {
        onChange?.(res.data[0]);
        message.success('Image uploaded.');
      }
    } catch (err) {
      message.error(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
    return false; // prevent antd's default upload
  };

  return (
    <div>
      {value ? (
        <div className="mb-2 flex items-start gap-3">
          <Image src={resolveUploadUrl(value)} alt="preview" width={120} className="rounded border border-gray-200" />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onChange?.('')}>Remove</Button>
        </div>
      ) : null}
      <Space.Compact className="w-full">
        <Input
          placeholder="Image URL (or upload)"
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
        />
        <Upload accept="image/*" showUploadList={false} beforeUpload={handleUpload}>
          <Button icon={<UploadOutlined />} loading={uploading}>Upload</Button>
        </Upload>
      </Space.Compact>
    </div>
  );
};

export default WebImageUpload;
