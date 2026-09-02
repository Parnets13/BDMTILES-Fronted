import { useCallback, useEffect, useState } from 'react';
import { Button, Empty, List, Pagination, Spin, Tag, message } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import notificationService from '../../services/notificationService.js';

const NotificationInboxPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await notificationService.getInbox({ page: pagination.current, limit: pagination.pageSize });
      setItems(response.data || []);
      setPagination((previous) => ({ ...previous, total: response.pagination?.totalItems || 0 }));
    } catch (error) {
      message.error(error.message || 'Unable to load notifications');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => { load(); }, [load]);

  const openItem = async (item) => {
    try {
      if (!item.readAt) await notificationService.markRead(item._id);
      if (item.deepLink) navigate(item.deepLink);
      else load();
    } catch (error) {
      message.error(error.message || 'Unable to update notification');
    }
  };

  const markAllRead = async () => {
    try {
      await notificationService.markAllRead();
      message.success('All notifications marked as read');
      load();
    } catch (error) {
      message.error(error.message || 'Unable to mark notifications');
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
          <p className="mt-0.5 text-sm text-gray-500">Your selected-branch notification inbox</p>
        </div>
        <Button icon={<CheckOutlined />} onClick={markAllRead}>Mark all read</Button>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white">
        <Spin spinning={loading}>
          {items.length ? (
            <List
              dataSource={items}
              renderItem={(item) => (
                <List.Item className={`cursor-pointer px-5 hover:bg-gray-50 ${item.readAt ? '' : 'bg-orange-50/50'}`} onClick={() => openItem(item)}>
                  <List.Item.Meta
                    title={<div className="flex items-center gap-2"><span>{item.title}</span>{!item.readAt && <Tag color="orange">New</Tag>}</div>}
                    description={<><div className="text-sm text-gray-600">{item.body}</div><div className="mt-1 text-xs text-gray-400">{new Date(item.createdAt).toLocaleString('en-IN')} · {item.module?.replace(/_/g, ' ')}</div></>}
                  />
                </List.Item>
              )}
            />
          ) : <div className="py-16"><Empty description="No notifications" /></div>}
        </Spin>
      </div>
      {pagination.total > pagination.pageSize && (
        <div className="mt-4 flex justify-end">
          <Pagination current={pagination.current} pageSize={pagination.pageSize} total={pagination.total} onChange={(current, pageSize) => setPagination({ current, pageSize, total: pagination.total })} />
        </div>
      )}
    </div>
  );
};

export default NotificationInboxPage;
