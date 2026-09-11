import { useState } from 'react';
import { Upload, Button, Progress, Input, Space, message } from 'antd';
import { VideoCameraOutlined, DeleteOutlined, LinkOutlined } from '@ant-design/icons';
import webManagementService from '../../services/webManagementService.js';
import { resolveUploadUrl } from '../../config/api.js';

/**
 * Video field for Web Management forms.
 * Staff can either:
 *   1. Upload a video file (MP4 / WEBM / MOV, max 100 MB) — stored under /uploads/web-videos/
 *   2. Paste an external URL (YouTube, Vimeo, direct link)
 * Controlled via `value` / `onChange` so it plugs into antd Form.Item.
 */
const VideoUpload = ({ value, onChange }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tab, setTab] = useState(value && !value.startsWith('/uploads') ? 'url' : 'upload');

  const isUploaded = value && value.startsWith('/uploads');
  const isExternal = value && !value.startsWith('/uploads');

  const handleUpload = async (file) => {
    // Basic client-side size check (100 MB).
    if (file.size > 100 * 1024 * 1024) {
      message.error('Video file must be under 100 MB.');
      return false;
    }
    setUploading(true);
    setProgress(10);
    try {
      // Simulate progress during upload.
      const interval = setInterval(() => setProgress((p) => Math.min(p + 10, 85)), 400);
      const res = await webManagementService.uploadVideo(file);
      clearInterval(interval);
      setProgress(100);
      if (res.success && res.data) {
        onChange?.(res.data);
        message.success('Video uploaded.');
      }
    } catch (err) {
      message.error(err.message || 'Video upload failed.');
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1200);
    }
    return false; // prevent antd default upload
  };

  const clear = () => { onChange?.(''); };

  return (
    <div className="space-y-3">
      {/* Tab toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('upload')}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${tab === 'upload' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400'}`}
        >
          <VideoCameraOutlined className="mr-1" /> Upload File
        </button>
        <button
          type="button"
          onClick={() => setTab('url')}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${tab === 'url' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400'}`}
        >
          <LinkOutlined className="mr-1" /> Paste URL
        </button>
      </div>

      {/* Current value preview */}
      {value && (
        <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
          {isUploaded ? (
            <video
              src={resolveUploadUrl(value)}
              className="w-28 h-16 rounded object-cover bg-black"
              controls
              muted
            />
          ) : (
            <div className="w-28 h-16 rounded bg-gray-200 flex items-center justify-center">
              <LinkOutlined className="text-gray-400 text-xl" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 truncate">{value}</p>
            {isUploaded && (
              <a href={resolveUploadUrl(value)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline">
                Preview video ↗
              </a>
            )}
            {isExternal && (
              <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline">
                Open link ↗
              </a>
            )}
          </div>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={clear}>Remove</Button>
        </div>
      )}

      {/* Upload file tab */}
      {tab === 'upload' && (
        <div>
          <Upload
            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
            showUploadList={false}
            beforeUpload={handleUpload}
            disabled={uploading}
          >
            <Button icon={<VideoCameraOutlined />} loading={uploading} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Choose video file'}
            </Button>
          </Upload>
          {uploading && <Progress percent={progress} size="small" className="mt-2 max-w-xs" />}
          <p className="text-xs text-gray-400 mt-1">MP4 / WEBM / MOV — max 100 MB</p>
        </div>
      )}

      {/* Paste URL tab */}
      {tab === 'url' && (
        <div>
          <Space.Compact className="w-full">
            <Input
              prefix={<LinkOutlined className="text-gray-400" />}
              placeholder="https://youtube.com/watch?v=... or direct .mp4 URL"
              value={value || ''}
              onChange={(e) => onChange?.(e.target.value)}
              allowClear
            />
          </Space.Compact>
          <p className="text-xs text-gray-400 mt-1">YouTube, Vimeo, or any direct video URL.</p>
        </div>
      )}
    </div>
  );
};

export default VideoUpload;
