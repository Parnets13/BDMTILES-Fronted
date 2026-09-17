import { Tag } from 'antd';
import ContentManager, { statusColumn } from './ContentManager.jsx';
import webManagementService from '../../services/webManagementService.js';

const service = {
  get: webManagementService.getPincodes,
  create: webManagementService.createPincode,
  update: webManagementService.updatePincode,
  delete: webManagementService.deletePincode,
};

const fields = [
  { name: 'pincode', label: 'Pincode', type: 'text', required: true, placeholder: 'e.g. 560001' },
  { name: 'area', label: 'Area', type: 'text', placeholder: 'e.g. Whitefield' },
  { name: 'city', label: 'City', type: 'text', placeholder: 'e.g. Bangalore' },
  { name: 'deliveryDays', label: 'Delivery Days (estimate)', type: 'number' },
  { name: 'codAvailable', label: 'Cash on Delivery Available', type: 'boolean' },
  { name: 'sortOrder', label: 'Sort Order', type: 'number', help: 'Lower shows first' },
  { name: 'status', label: 'Status', type: 'status' },
];

const columns = [
  { title: 'Pincode', dataIndex: 'pincode', width: 110, render: (v) => <span className="font-mono font-semibold">{v}</span> },
  { title: 'Area / City', key: 'area', render: (_, r) => (
    <div><div className="text-sm">{r.area || '—'}</div><div className="text-xs text-gray-400">{r.city}</div></div>
  ) },
  { title: 'Delivery', dataIndex: 'deliveryDays', width: 100, render: (v) => (v != null ? `${v} day(s)` : '—') },
  { title: 'COD', dataIndex: 'codAvailable', width: 80, render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag> },
  statusColumn,
];

const DeliveryPincodePage = () => (
  <ContentManager
    title="Delivery Pincodes"
    subtitle="Pincodes the website delivers to — customers can check serviceability at checkout"
    service={service}
    fields={fields}
    columns={columns}
  />
);

export default DeliveryPincodePage;
