import { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Select, Button, Space, message, Tooltip, Input } from 'antd';
import { ReloadOutlined, SearchOutlined, CheckCircleOutlined, PlusCircleOutlined } from '@ant-design/icons';
import webManagementService from '../../services/webManagementService.js';

const STATUS_COLOR = { pending: 'orange', acknowledged: 'blue', added: 'green' };
const STATUS_LABEL = { pending: 'Pending', acknowledged: 'Acknowledged', added: 'Added to Serviceable' };

export default function PincodeRequestsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState(undefined);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const res = await webManagementService.getPincodeRequests(params);
      if (res.success) {
        const data = res.data || [];
        setItems(search
          ? data.filter((r) =>
              r.pincode?.includes(search) ||
              r.name?.toLowerCase().includes(search.toLowerCase()) ||
              r.phone?.includes(search)
            )
          : data
        );
      }
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (id, status) => {
    try {
      const res = await webManagementService.updatePincodeRequest(id, { status });
      if (res.success) {
        message.success(res.message);
        fetchData();
      }
    } catch (err) {
      message.error(err.message);
    }
  };

  const columns = [
    {
      title: 'Pincode',
      dataIndex: 'pincode',
      width: 110,
      render: (v) => <span className="font-mono font-bold text-base text-gray-900">{v}</span>,
    },
    {
      title: 'Customer',
      key: 'customer',
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium text-gray-800">{r.name || <span className="text-gray-400 italic">Not provided</span>}</div>
          {r.phone && (
            <a href={`tel:${r.phone}`} className="text-xs text-orange-600 hover:underline">
              {r.phone}
            </a>
          )}
        </div>
      ),
    },
    {
      title: 'Requested On',
      dataIndex: 'createdAt',
      width: 140,
      render: (v) => (
        <span className="text-xs text-gray-500">
          {new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 170,
      render: (s) => (
        <Tag color={STATUS_COLOR[s]} className="font-semibold">
          {STATUS_LABEL[s] || s}
        </Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 220,
      render: (_, r) => (
        <Space size="small">
          {r.status === 'pending' && (
            <Tooltip title="Mark as Acknowledged">
              <Button
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => updateStatus(r._id, 'acknowledged')}
                className="text-blue-600 border-blue-300"
              >
                Acknowledge
              </Button>
            </Tooltip>
          )}
          {(r.status === 'pending' || r.status === 'acknowledged') && (
            <Tooltip title="Mark as Added to serviceable pincodes">
              <Button
                size="small"
                type="primary"
                icon={<PlusCircleOutlined />}
                onClick={() => updateStatus(r._id, 'added')}
              >
                Mark Added
              </Button>
            </Tooltip>
          )}
          {r.status === 'added' && (
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircleOutlined /> Delivery added
            </span>
          )}
        </Space>
      ),
    },
  ];

  const pendingCount = items.filter((i) => i.status === 'pending').length;

  return (
    <div>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            Pincode Delivery Requests
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center bg-orange-500 text-white text-xs font-bold w-6 h-6 rounded-full">
                {pendingCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Customers who requested delivery to an unserviceable pincode
          </p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh</Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Search pincode, name, phone…"
          prefix={<SearchOutlined className="text-gray-400" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          className="w-64"
        />
        <Select
          placeholder="All statuses"
          value={filterStatus}
          onChange={setFilterStatus}
          allowClear
          className="w-44"
          options={[
            { value: 'pending', label: '🟠 Pending' },
            { value: 'acknowledged', label: '🔵 Acknowledged' },
            { value: 'added', label: '🟢 Added' },
          ]}
        />
        {(search || filterStatus) && (
          <Button onClick={() => { setSearch(''); setFilterStatus(undefined); }}>
            Clear Filters
          </Button>
        )}
        <span className="ml-auto text-sm text-gray-400">{items.length} request{items.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table
          columns={columns}
          dataSource={items}
          rowKey="_id"
          loading={loading}
          size="middle"
          pagination={{ showTotal: (t) => `${t} total`, pageSize: 25 }}
          locale={{ emptyText: 'No pincode requests yet. Requests are submitted when a customer checks an unserviceable pincode on the website.' }}
          rowClassName={(r) => r.status === 'pending' ? 'bg-orange-50/40' : ''}
        />
      </div>
    </div>
  );
}
