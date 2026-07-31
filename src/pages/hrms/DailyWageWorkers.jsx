import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, Switch, Checkbox, Tabs
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  SaveOutlined, PrinterOutlined, UserOutlined
} from '@ant-design/icons';
import { HardHat } from 'lucide-react';
import api from '../../config/api.js';

const dwService = {
  getWorkers:    (p) => api.get('/daily-wages/workers', { params: p }),
  createWorker:  (d) => api.post('/daily-wages/workers', d),
  updateWorker:  (id, d) => api.put(`/daily-wages/workers/${id}`, d),
  getAttendance: (p) => api.get('/daily-wages/attendance', { params: p }),
  markAttendance:(d) => api.post('/daily-wages/attendance', d),
  getSummary:    (p) => api.get('/daily-wages/summary', { params: p }),
};

const CATEGORIES = ['general', 'loader', 'helper', 'carpenter', 'electrician', 'cleaner', 'security', 'other'];

const emptyWorker = () => ({ workerName: '', workerPhone: '', category: 'general', wagePerDay: 0, department: '', isActive: true });

const today = new Date().toISOString().split('T')[0];
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

const DailyWageWorkers = () => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Attendance tab
  const [attDate, setAttDate] = useState(today);
  const [attRecords, setAttRecords] = useState([]); // { workerId, present, hoursWorked, remarks }
  const [attLoading, setAttLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Summary tab
  const [summaryFrom, setSummaryFrom] = useState(firstOfMonth);
  const [summaryTo, setSummaryTo]     = useState(today);
  const [summary, setSummary] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [totalWage, setTotalWage] = useState(0);

  // Worker modal
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [workerForm, setWorkerForm] = useState(emptyWorker());
  const [workerSaveLoading, setWorkerSaveLoading] = useState(false);

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dwService.getWorkers({ isActive: true });
      if (res.success) setWorkers(res.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadWorkers(); }, [loadWorkers]);

  // Load today's existing attendance when date changes
  const loadAttendance = useCallback(async () => {
    setAttLoading(true);
    try {
      const res = await dwService.getAttendance({ date: attDate });
      const existing = res.success ? (res.data || []) : [];

      // Build attendance rows — one per active worker
      const rows = workers.map(w => {
        const ex = existing.find(r => (r.worker?._id || r.worker) === w._id);
        return {
          workerId:   w._id,
          workerName: w.workerName,
          category:   w.category,
          wagePerDay: w.wagePerDay,
          present:    ex ? ex.present : true,
          hoursWorked: ex ? ex.hoursWorked : 8,
          wageEarned: ex ? ex.wageEarned : w.wagePerDay,
          remarks:    ex ? ex.remarks : '',
          saved:      !!ex,
        };
      });
      setAttRecords(rows);
    } catch { /* silent */ }
    finally { setAttLoading(false); }
  }, [attDate, workers]);

  useEffect(() => { if (workers.length) loadAttendance(); }, [loadAttendance]);

  const updateAtt = (workerId, field, value) => {
    setAttRecords(prev => prev.map(r => {
      if (r.workerId !== workerId) return r;
      const updated = { ...r, [field]: value };
      if (field === 'present' && !value) updated.hoursWorked = 0;
      if (field === 'hoursWorked' || field === 'present') {
        updated.wageEarned = Math.round((updated.wagePerDay / 8) * (updated.present ? (updated.hoursWorked || 0) : 0));
      }
      return updated;
    }));
  };

  const saveAttendance = async () => {
    setSaveLoading(true);
    try {
      const records = attRecords.map(r => ({
        worker:      r.workerId,
        date:        attDate,
        present:     r.present,
        hoursWorked: r.hoursWorked,
        remarks:     r.remarks,
      }));
      const res = await dwService.markAttendance({ records });
      if (res.success) {
        message.success(`Attendance saved for ${attDate}`);
        loadAttendance();
      }
    } catch (err) { message.error(err.message || 'Save failed'); }
    finally { setSaveLoading(false); }
  };

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await dwService.getSummary({ dateFrom: summaryFrom, dateTo: summaryTo });
      if (res.success) { setSummary(res.data || []); setTotalWage(res.totalWage || 0); }
    } catch { /* silent */ }
    finally { setSummaryLoading(false); }
  }, [summaryFrom, summaryTo]);

  // Worker form save
  const saveWorker = async () => {
    if (!workerForm.workerName.trim()) { message.error('Worker name required'); return; }
    setWorkerSaveLoading(true);
    try {
      const res = editingWorker
        ? await dwService.updateWorker(editingWorker._id, workerForm)
        : await dwService.createWorker(workerForm);
      if (res.success) {
        message.success(editingWorker ? 'Updated' : 'Worker added');
        setShowWorkerModal(false);
        loadWorkers();
      }
    } catch (err) { message.error(err.message || 'Failed'); }
    finally { setWorkerSaveLoading(false); }
  };

  const wset = (k, v) => setWorkerForm(f => ({ ...f, [k]: v }));

  const totalPresent = attRecords.filter(r => r.present).length;
  const totalWageToday = attRecords.reduce((s, r) => s + (r.wageEarned || 0), 0);

  const attColumns = [
    {
      title: 'Worker',
      key: 'worker',
      render: (_, r) => (
        <div>
          <div className="font-medium text-sm">{r.workerName}</div>
          <div className="text-xs text-gray-400 capitalize">{r.category} · ₹{r.wagePerDay}/day</div>
        </div>
      ),
    },
    {
      title: 'Present',
      key: 'present',
      width: 80,
      render: (_, r) => (
        <Switch
          checked={r.present}
          onChange={v => updateAtt(r.workerId, 'present', v)}
          checkedChildren="✓" unCheckedChildren="✗"
          style={{ background: r.present ? '#52c41a' : undefined }}
        />
      ),
    },
    {
      title: 'Hours',
      key: 'hours',
      width: 110,
      render: (_, r) => (
        <Input
          type="number"
          value={r.hoursWorked}
          onChange={e => updateAtt(r.workerId, 'hoursWorked', parseFloat(e.target.value) || 0)}
          disabled={!r.present}
          min={0} max={24} step={0.5}
          size="small"
          className="w-20"
        />
      ),
    },
    {
      title: 'Wage (₹)',
      key: 'wage',
      width: 90,
      render: (_, r) => (
        <span className={`font-bold ${r.present ? 'text-green-700' : 'text-gray-400'}`}>
          ₹{(r.wageEarned || 0).toLocaleString()}
        </span>
      ),
    },
    {
      title: 'Remarks',
      key: 'remarks',
      render: (_, r) => (
        <Input
          value={r.remarks}
          onChange={e => updateAtt(r.workerId, 'remarks', e.target.value)}
          size="small"
          placeholder="Optional…"
        />
      ),
    },
    {
      title: 'Saved',
      key: 'saved',
      width: 70,
      render: (_, r) => r.saved ? <Tag color="green">✓</Tag> : <Tag color="orange">Draft</Tag>,
    },
  ];

  const summaryColumns = [
    { title: 'Worker', dataIndex: 'workerName', render: v => <span className="font-semibold">{v}</span> },
    { title: 'Days Present', dataIndex: 'daysPresent', width: 110 },
    { title: 'Total Hours', dataIndex: 'totalHours', width: 110, render: v => `${v} hrs` },
    { title: 'Total Wage (₹)', dataIndex: 'totalWage', width: 130, render: v => <span className="font-bold text-green-700">₹{v.toLocaleString()}</span> },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <HardHat size={22} className="text-orange-500" />
            Daily Wage Workers
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage casual / contract labour attendance and wages
          </p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadWorkers} loading={loading} />
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => { setEditingWorker(null); setWorkerForm(emptyWorker()); setShowWorkerModal(true); }}
            style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            Add Worker
          </Button>
        </Space>
      </div>

      <Tabs items={[
        {
          key: 'attendance',
          label: `Daily Attendance`,
          children: (
            <div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <div className="flex gap-3 items-end flex-wrap">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Date</label>
                    <Input type="date" value={attDate} onChange={e => setAttDate(e.target.value)} className="w-40" />
                  </div>
                  <Button icon={<ReloadOutlined />} onClick={loadAttendance} loading={attLoading}>Load</Button>
                  <Button type="primary" icon={<SaveOutlined />} onClick={saveAttendance}
                    loading={saveLoading} disabled={!attRecords.length}
                    style={{ background: '#52c41a', borderColor: '#52c41a' }}>
                    Save Attendance
                  </Button>
                </div>
              </div>

              <Row gutter={16} className="mb-4">
                {[
                  ['Total Workers', workers.length, '#1890ff'],
                  ['Present Today', totalPresent, '#52c41a'],
                  ['Absent', workers.length - totalPresent, '#f5222d'],
                  ['Wage Today (₹)', `₹${totalWageToday.toLocaleString()}`, '#FF5F03'],
                ].map(([t, v, c]) => (
                  <Col span={6} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
                    <Statistic title={t} value={v} valueStyle={{ color: c }} />
                  </Card></Col>
                ))}
              </Row>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <Table
                  columns={attColumns}
                  dataSource={attRecords}
                  rowKey="workerId"
                  loading={attLoading}
                  size="small"
                  pagination={false}
                  rowClassName={r => !r.present ? 'bg-red-50' : ''}
                  locale={{ emptyText: 'No workers. Add workers first.' }}
                />
              </div>
            </div>
          ),
        },
        {
          key: 'workers',
          label: `Workers (${workers.length})`,
          children: (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <Table
                columns={[
                  { title: 'Name', dataIndex: 'workerName', render: (v, r) => <div><div className="font-semibold">{v}</div><div className="text-xs text-gray-400">{r.phone || r.workerPhone}</div></div> },
                  { title: 'Category', dataIndex: 'category', render: v => <Tag color="blue" className="capitalize">{v}</Tag> },
                  { title: 'Wage/Day (₹)', dataIndex: 'wagePerDay', render: v => `₹${v}` },
                  { title: 'Department', dataIndex: 'department', render: v => v || '—' },
                  { title: 'Active', dataIndex: 'isActive', render: v => <Tag color={v !== false ? 'green' : 'default'}>{v !== false ? 'Active' : 'Inactive'}</Tag> },
                  { title: '', width: 80, render: (_, r) => <Button size="small" onClick={() => { setEditingWorker(r); setWorkerForm({ ...r }); setShowWorkerModal(true); }}>Edit</Button> },
                ]}
                dataSource={workers}
                rowKey="_id"
                loading={loading}
                size="small"
                pagination={{ pageSize: 20 }}
              />
            </div>
          ),
        },
        {
          key: 'summary',
          label: 'Monthly Summary',
          children: (
            <div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <div className="flex gap-3 items-end flex-wrap">
                  <div><label className="text-xs text-gray-500 block mb-1">From</label>
                    <Input type="date" value={summaryFrom} onChange={e => setSummaryFrom(e.target.value)} className="w-36" /></div>
                  <div><label className="text-xs text-gray-500 block mb-1">To</label>
                    <Input type="date" value={summaryTo} onChange={e => setSummaryTo(e.target.value)} className="w-36" /></div>
                  <Button type="primary" onClick={loadSummary} loading={summaryLoading}
                    icon={<SearchOutlined />}
                    style={{ background: '#1890ff', borderColor: '#1890ff' }}>
                    Generate
                  </Button>
                </div>
              </div>
              {summary.length > 0 && (
                <div className="mb-3">
                  <div className="inline-block bg-orange-50 border border-orange-200 rounded px-4 py-2 text-sm font-semibold text-orange-700">
                    Total Wages Payable: ₹{totalWage.toLocaleString()}
                  </div>
                </div>
              )}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <Table
                  columns={summaryColumns}
                  dataSource={summary}
                  rowKey="_id"
                  loading={summaryLoading}
                  size="small"
                  pagination={false}
                  locale={{ emptyText: 'Set date range and click Generate.' }}
                />
              </div>
            </div>
          ),
        },
      ]} />

      {/* Worker Modal */}
      <Modal
        title={editingWorker ? 'Edit Worker' : 'Add Worker'}
        open={showWorkerModal}
        onCancel={() => setShowWorkerModal(false)}
        onOk={saveWorker}
        confirmLoading={workerSaveLoading}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        destroyOnHidden
      >
        <Divider />
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-500 block mb-1">Worker Name *</label>
            <Input value={workerForm.workerName} onChange={e => wset('workerName', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Phone</label>
            <Input value={workerForm.workerPhone} onChange={e => wset('workerPhone', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Category</label>
            <Select value={workerForm.category} onChange={v => wset('category', v)} className="w-full"
              options={CATEGORIES.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Wage Per Day (₹)</label>
            <Input type="number" value={workerForm.wagePerDay}
              onChange={e => wset('wagePerDay', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Department</label>
            <Input value={workerForm.department} onChange={e => wset('department', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Status</label>
            <Select value={workerForm.isActive} onChange={v => wset('isActive', v)} className="w-full"
              options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DailyWageWorkers;
