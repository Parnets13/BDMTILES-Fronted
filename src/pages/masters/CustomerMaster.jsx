import { useState, useEffect, useCallback, useRef } from 'react';
import { Table, Button, Input, Select, Tag, Space, Form, InputNumber, Modal, message, Tooltip, Row, Col, Card, Statistic, DatePicker, Checkbox, Typography } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, EyeOutlined, UserOutlined, TeamOutlined, ShopOutlined, ToolOutlined, EnvironmentOutlined, StarOutlined, WhatsAppOutlined, MessageOutlined } from '@ant-design/icons';
import api from '../../config/api.js';
import ModuleRecycleBin from '../../components/ModuleRecycleBin.jsx';
import DoubleConfirmDelete from '../../components/DoubleConfirmDelete.jsx';
import { gstinFormRule, normalizeGstinInput } from '../../utils/gstin.js';
import GoogleMapPicker from '../../components/GoogleMapPicker.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { validateBranchSelected } from '../../utils/branchValidation.js';

const { Option } = Select;
const { TextArea } = Input;
const { Text, Link } = Typography;

const CUSTOMER_TYPES = [
  { value: 'retail', label: 'Retail', color: 'green' },
  { value: 'builder', label: 'Builder', color: 'orange' },
  { value: 'architect', label: 'Architect', color: 'purple' },
  { value: 'contractor', label: 'Contractor', color: 'blue' },
  { value: 'interior_designer', label: 'Interior Designer', color: 'magenta' },
  { value: 'other', label: 'Other', color: 'default' },
];

const CUSTOMER_CATEGORIES = [
  { value: 'silver', label: 'Silver', color: 'default' },
  { value: 'gold', label: 'Gold', color: 'gold' },
  { value: 'platinum', label: 'Platinum', color: 'purple' },
];

const SOURCE_OPTIONS = [
  { value: 'walk_in', label: 'Walk In' },
  { value: 'referral', label: 'Referral' },
  { value: 'online', label: 'Online' },
  { value: 'phone', label: 'Phone' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'exhibition', label: 'Exhibition' },
  { value: 'architect_referral', label: 'Architect Referral' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'inactive', label: 'Inactive', color: 'orange' },
  { value: 'blocked', label: 'Blocked', color: 'red' },
];

const getTypeColor = (type) => {
  const found = CUSTOMER_TYPES.find(t => t.value === type);
  return found ? found.color : 'default';
};

const getCategoryColor = (category) => {
  const found = CUSTOMER_CATEGORIES.find(c => c.value === category);
  return found ? found.color : 'default';
};

const CustomerMaster = () => {
  const { activeBranch } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ customerType: undefined, status: undefined });
  const [stats, setStats] = useState({ total: 0, retail: 0, builder: 0, architect: 0, contractor: 0 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form] = Form.useForm();
  const [customerType, setCustomerType] = useState('retail');
  const [viewCustomer, setViewCustomer] = useState(null);
  const [useContactAsWhatsapp, setUseContactAsWhatsapp] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [branches, setBranches] = useState([]);
  const [salesExecutives, setSalesExecutives] = useState([]);
  const [sameAsBinding, setSameAsBinding] = useState(false);
  const [billingLocation, setBillingLocation] = useState(null);
  const [deliveryLocation, setDeliveryLocation] = useState(null);
  const [billingMapModalOpen, setBillingMapModalOpen] = useState(false);
  const [deliveryMapModalOpen, setDeliveryMapModalOpen] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/customers/stats');
      if (res.success) setStats(res.data);
    } catch { /* ignore */ }
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        search: search || undefined,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
      };
      const res = await api.get('/customers', { params });
      if (res.success) {
        setCustomers(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search, filters]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Initialize Google Places Autocomplete for addresses
  // Handle "Same as Billing" checkbox
  useEffect(() => {
    if (sameAsBinding && billingLocation) {
      setDeliveryLocation({ ...billingLocation });
      form.setFieldsValue({ 
        deliveryAddress: form.getFieldValue('billingAddress'),
        deliveryCity: form.getFieldValue('billingCity'),
        deliveryState: form.getFieldValue('billingState'),
        deliveryPinCode: form.getFieldValue('billingPinCode'),
      });
    }
  }, [sameAsBinding, billingLocation, form]);

  // Fetch branches for Google Review link selection
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await api.get('/masters/branches', { params: { limit: 100, status: 'active' } });
        if (res.success) setBranches(res.data || []);
      } catch { /* ignore */ }
    };
    fetchBranches();
  }, []);

  // Fetch sales executives for assignment
  useEffect(() => {
    const fetchSalesExecutives = async () => {
      try {
        const res = await api.get('/users', { params: { role: 'sales_executive', status: 'active', limit: 200 } });
        if (res.success) setSalesExecutives(res.data || []);
      } catch { /* ignore */ }
    };
    fetchSalesExecutives();
  }, []);

  const openModal = (customer = null) => {
    // Validate branch selection before opening modal
    if (!validateBranchSelected(activeBranch, customer ? 'edit customers' : 'add customers')) {
      return;
    }

    setEditingCustomer(customer);
    if (customer) {
      form.setFieldsValue({
        ...customer,
        locationLat: customer.location?.coordinates?.[1],
        locationLng: customer.location?.coordinates?.[0],
        locationAddress: customer.location?.address,
        googleReviewLink: customer.googleReviewLink || activeBranch?.googleReviewLink || '',
      });
      setCustomerType(customer.customerType || 'retail');
      setUseContactAsWhatsapp(customer.useContactAsWhatsapp || false);
      
      // Set billing location
      if (customer.billingLocation?.coordinates) {
        setBillingLocation({
          lat: customer.billingLocation.coordinates[1],
          lng: customer.billingLocation.coordinates[0],
          address: customer.billingAddress || '',
        });
      } else {
        setBillingLocation(null);
      }
      
      // Set delivery location
      if (customer.deliveryLocation?.coordinates) {
        setDeliveryLocation({
          lat: customer.deliveryLocation.coordinates[1],
          lng: customer.deliveryLocation.coordinates[0],
          address: customer.deliveryAddress || '',
        });
      } else {
        setDeliveryLocation(null);
      }
      
      // Check if addresses are same
      setSameAsBinding(
        customer.billingAddress === customer.deliveryAddress && 
        !!customer.billingAddress &&
        customer.billingLocation?.coordinates?.[0] === customer.deliveryLocation?.coordinates?.[0] &&
        customer.billingLocation?.coordinates?.[1] === customer.deliveryLocation?.coordinates?.[1]
      );
      
      setSelectedLocation(customer.location?.coordinates ? {
        lat: customer.location.coordinates[1],
        lng: customer.location.coordinates[0],
        address: customer.location.address || ''
      } : null);
    } else {
      form.resetFields();
      form.setFieldsValue({ 
        customerType: 'retail', 
        customerCategory: 'silver',
        status: 'active',
        isVisitor: false,
        useContactAsWhatsapp: false,
        googleReviewLink: activeBranch?.googleReviewLink || '',
      });
      setCustomerType('retail');
      setUseContactAsWhatsapp(false);
      setSameAsBinding(false);
      setSelectedLocation(null);
      setBillingLocation(null);
      setDeliveryLocation(null);
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      // Build location object if coordinates are provided
      const payload = { ...values };
      if (selectedLocation && selectedLocation.lat && selectedLocation.lng) {
        payload.location = {
          type: 'Point',
          coordinates: [selectedLocation.lng, selectedLocation.lat],
          address: selectedLocation.address || ''
        };
      }
      
      // Build billing location
      if (billingLocation && billingLocation.lat && billingLocation.lng) {
        payload.billingLocation = {
          type: 'Point',
          coordinates: [billingLocation.lng, billingLocation.lat],
        };
        payload.billingAddress = billingLocation.address || values.billingAddress || '';
      }
      
      // Build delivery location
      if (deliveryLocation && deliveryLocation.lat && deliveryLocation.lng) {
        payload.deliveryLocation = {
          type: 'Point',
          coordinates: [deliveryLocation.lng, deliveryLocation.lat],
        };
        payload.deliveryAddress = deliveryLocation.address || values.deliveryAddress || '';
      }
      
      // Auto-fill WhatsApp from contact if checkbox is selected
      if (payload.useContactAsWhatsapp && payload.contactNumber) {
        payload.whatsappNumber = payload.contactNumber;
      }
      
      // Add branch's review link automatically
      if (activeBranch?.googleReviewLink) {
        payload.googleReviewLink = activeBranch.googleReviewLink;
      }
      
      // Clean up form-only fields
      delete payload.locationLat;
      delete payload.locationLng;
      delete payload.locationAddress;
      
      const res = editingCustomer
        ? await api.put(`/customers/${editingCustomer._id}`, payload)
        : await api.post('/customers', payload);
      if (res.success) {
        message.success(editingCustomer ? 'Customer updated' : 'Customer created');
        setModalOpen(false);
        form.resetFields();
        setEditingCustomer(null);
        setSelectedLocation(null);
        setBillingLocation(null);
        setDeliveryLocation(null);
        setSameAsBinding(false);
        fetchCustomers();
        fetchStats();
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  // Send WhatsApp message with review link (from form)
  const sendReviewViaWhatsApp = (phoneNumber, customerName) => {
    if (!phoneNumber) {
      message.error('No phone number available');
      return;
    }
    
    const phone = phoneNumber.replace(/[^0-9]/g, '');
    const reviewLink = activeBranch?.googleReviewLink || '';
    
    if (!reviewLink) {
      message.warning('Please set up Google Review link for your branch first');
      return;
    }
    
    const branchName = activeBranch?.name || 'our branch';
    
    const messageText = `Hi ${customerName},\n\nThank you for choosing BDM Tiles! 🎉\n\nWe'd love to hear about your experience at ${branchName}. Could you please take a moment to leave us a review on Google?\n\n${reviewLink}\n\nYour feedback helps us serve you better!\n\nThank you,\nBDM Tiles Team`;
    
    const encodedMessage = encodeURIComponent(messageText);
    const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
    message.success('WhatsApp opened with review request');
  };

  // Send SMS with review link (from form)
  const sendReviewViaSMS = (phoneNumber, customerName) => {
    if (!phoneNumber) {
      message.error('No phone number available');
      return;
    }
    
    const phone = phoneNumber.replace(/[^0-9]/g, '');
    const reviewLink = activeBranch?.googleReviewLink || '';
    
    if (!reviewLink) {
      message.warning('Please set up Google Review link for your branch first');
      return;
    }
    
    const branchName = activeBranch?.name || 'BDM Tiles';
    
    const messageText = `Hi ${customerName}, Thank you for choosing ${branchName}! Please review us: ${reviewLink}`;
    
    const encodedMessage = encodeURIComponent(messageText);
    // For iOS
    const smsUrl = `sms:${phone}&body=${encodedMessage}`;
    window.open(smsUrl, '_blank');
    message.success('SMS app opened with review request');
  };

  // Send WhatsApp message with review link (from table/view)
  const sendWhatsApp = (customer) => {
    if (!customer.whatsappNumber && !customer.contactNumber) {
      message.error('No WhatsApp number available');
      return;
    }
    
    const phone = (customer.whatsappNumber || customer.contactNumber).replace(/[^0-9]/g, '');
    const reviewLink = activeBranch?.googleReviewLink || customer.googleReviewLink || '';
    
    if (!reviewLink) {
      message.warning('Review link not configured');
      return;
    }
    
    const branchName = activeBranch?.name || 'our branch';
    
    const messageText = `Hi ${customer.name},\n\nThank you for choosing BDM Tiles! 🎉\n\nWe'd love to hear about your experience at ${branchName}. Could you please take a moment to leave us a review on Google?\n\n${reviewLink}\n\nYour feedback helps us serve you better!\n\nThank you,\nBDM Tiles Team`;
    
    const encodedMessage = encodeURIComponent(messageText);
    const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  // Send SMS with review link (from table/view)
  const sendSMS = (customer) => {
    if (!customer.contactNumber) {
      message.error('No contact number available');
      return;
    }
    
    const phone = customer.contactNumber.replace(/[^0-9]/g, '');
    const reviewLink = activeBranch?.googleReviewLink || customer.googleReviewLink || '';
    
    if (!reviewLink) {
      message.warning('Review link not configured');
      return;
    }
    
    const branchName = activeBranch?.name || 'BDM Tiles';
    
    const messageText = `Hi ${customer.name}, Thank you for choosing ${branchName}! Please review us: ${reviewLink}`;
    
    const encodedMessage = encodeURIComponent(messageText);
    // For iOS
    const smsUrl = `sms:${phone}&body=${encodedMessage}`;
    window.open(smsUrl, '_blank');
  };

  const handleDelete = async (id) => {
    try {
      const res = await api.delete(`/customers/${id}`);
      if (res.success) {
        message.success(res.message || 'Customer deleted');
        fetchCustomers();
        fetchStats();
      }
    } catch (err) {
      message.error(err.message || 'Delete failed');
    }
  };

  const isNonRetail = customerType && customerType !== 'retail';
  const isProjectType = ['builder', 'architect', 'contractor'].includes(customerType);

  const columns = [
    {
      title: 'Code', dataIndex: 'customerCode', key: 'code', width: 100,
      render: v => <span className="text-xs font-mono text-blue-600">{v}</span>,
    },
    {
      title: 'Name', dataIndex: 'name', key: 'name', width: 160,
      render: (v, record) => (
        <div>
          <span className="text-sm font-medium">{v}</span>
          {record.companyName && <div className="text-xs text-gray-500">{record.companyName}</div>}
        </div>
      ),
    },
    {
      title: 'Type', dataIndex: 'customerType', key: 'type', width: 110,
      render: v => <Tag color={getTypeColor(v)}>{v?.replace('_', ' ')}</Tag>,
    },
    {
      title: 'Category', dataIndex: 'customerCategory', key: 'category', width: 90,
      render: v => {
        const cat = CUSTOMER_CATEGORIES.find(c => c.value === v);
        return cat ? <Tag color={cat.color}>{cat.label}</Tag> : <Tag>{v || 'Silver'}</Tag>;
      },
    },
    { title: 'Contact', dataIndex: 'contactNumber', key: 'contact', width: 120 },
    { 
      title: 'WhatsApp', 
      dataIndex: 'whatsappNumber', 
      key: 'whatsapp', 
      width: 120,
      render: (v, record) => (
        <span className="text-xs">
          {v || record.contactNumber || '-'}
          {record.useContactAsWhatsapp && <Tag color="green" className="ml-1" style={{ fontSize: 10 }}>Auto</Tag>}
        </span>
      ),
    },
    { title: 'City', dataIndex: 'city', key: 'city', width: 100 },
    {
      title: 'Location', key: 'location', width: 80,
      render: (_, record) => record.location?.coordinates ? (
        <Tooltip title={`${record.location.coordinates[1].toFixed(4)}, ${record.location.coordinates[0].toFixed(4)}`}>
          <Tag color="blue" icon={<EnvironmentOutlined />}>Set</Tag>
        </Tooltip>
      ) : <span className="text-gray-400">-</span>,
    },
    {
      title: 'Visitor', dataIndex: 'isVisitor', key: 'visitor', width: 70,
      render: v => v ? <Tag color="purple">Yes</Tag> : <span className="text-gray-400">-</span>,
    },
    {
      title: 'Review', key: 'review', width: 120,
      render: (_, record) => {
        if (!record.googleReviewLink) return <span className="text-gray-400">-</span>;
        
        return (
          <Space size="small">
            {record.googleReviewSubmitted ? (
              <Tooltip title={`Collected by ${record.reviewCollectedBy?.name || 'Staff'}`}>
                <Tag color="gold" icon={<StarOutlined />}>Done</Tag>
              </Tooltip>
            ) : (
              <>
                <Tag color="orange">Pending</Tag>
                <Tooltip title="Send via WhatsApp">
                  <Button 
                    type="text" 
                    size="small" 
                    icon={<WhatsAppOutlined style={{ color: '#25D366' }} />}
                    onClick={() => sendWhatsApp(record)}
                  />
                </Tooltip>
                <Tooltip title="Send via SMS">
                  <Button 
                    type="text" 
                    size="small" 
                    icon={<MessageOutlined style={{ color: '#1890ff' }} />}
                    onClick={() => sendSMS(record)}
                  />
                </Tooltip>
              </>
            )}
          </Space>
        );
      },
    },
    { title: 'Assigned SE', key: 'se', width: 120, render: (_, r) => r.assignedSalesExecutive?.name || '-' },
    {
      title: 'Outstanding', dataIndex: 'currentOutstanding', key: 'outstanding', width: 110,
      render: v => <span className={`text-sm font-medium ${(v || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{(v || 0).toLocaleString()}</span>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 80,
      render: s => <Tag color={s === 'active' ? 'green' : s === 'blocked' ? 'red' : 'orange'}>{s}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 100, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setViewCustomer(record)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openModal(record)} />
          </Tooltip>
          <DoubleConfirmDelete
            title="Delete Customer"
            recordName={record.name}
            onConfirm={() => handleDelete(record._id)}
            trigger={<Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>}
          />
        </Space>
      ),
    },
  ];


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Customer Master</h1>
        <Space>
          <ModuleRecycleBin module="customer" title="Deleted Customers" onRestore={fetchCustomers} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Add Customer</Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="text-center"><Statistic title="Total" value={stats.total} prefix={<TeamOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="text-center"><Statistic title="Retail" value={stats.retail} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="text-center"><Statistic title="Builder" value={stats.builder} valueStyle={{ color: '#fa8c16' }} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="text-center"><Statistic title="Architect" value={stats.architect} valueStyle={{ color: '#722ed1' }} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="text-center"><Statistic title="Contractor" value={stats.contractor} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search name, phone, code..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
          className="w-64"
          allowClear
        />
        <Select
          placeholder="Customer Type"
          value={filters.customerType}
          onChange={v => { setFilters(f => ({ ...f, customerType: v })); setPagination(p => ({ ...p, current: 1 })); }}
          allowClear
          className="w-40"
        >
          {CUSTOMER_TYPES.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
        </Select>
        <Select
          placeholder="Status"
          value={filters.status}
          onChange={v => { setFilters(f => ({ ...f, status: v })); setPagination(p => ({ ...p, current: 1 })); }}
          allowClear
          className="w-32"
        >
          {STATUS_OPTIONS.map(s => <Option key={s.value} value={s.value}>{s.label}</Option>)}
        </Select>
        <Button onClick={() => { setSearch(''); setFilters({ customerType: undefined, status: undefined }); }}>Reset</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { fetchCustomers(); fetchStats(); }}>Refresh</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { fetchCustomers(); fetchStats(); }} loading={loading}>Refresh</Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <Table
          dataSource={customers}
          columns={columns}
          rowKey="_id"
          loading={loading}
          size="small"
          scroll={{ x: 1800 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} customers`,
            onChange: (page, pageSize) => setPagination(p => ({ ...p, current: page, pageSize })),
          }}
        />
      </div>

      {/* View Modal — read-only, so a look doesn't risk becoming an accidental edit */}
      <Modal
        title={viewCustomer ? `Customer: ${viewCustomer.name}` : 'Customer'}
        open={Boolean(viewCustomer)}
        onCancel={() => setViewCustomer(null)}
        footer={[
          viewCustomer && viewCustomer.googleReviewLink && !viewCustomer.googleReviewSubmitted && (
            <Button 
              key="whatsapp" 
              icon={<WhatsAppOutlined />} 
              style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: 'white' }}
              onClick={() => sendWhatsApp(viewCustomer)}
            >
              Send via WhatsApp
            </Button>
          ),
          viewCustomer && viewCustomer.googleReviewLink && !viewCustomer.googleReviewSubmitted && (
            <Button 
              key="sms" 
              icon={<MessageOutlined />} 
              onClick={() => sendSMS(viewCustomer)}
            >
              Send via SMS
            </Button>
          ),
          <Button key="edit" type="primary" icon={<EditOutlined />} onClick={() => { const record = viewCustomer; setViewCustomer(null); openModal(record); }}>Edit</Button>,
          <Button key="close" onClick={() => setViewCustomer(null)}>Close</Button>,
        ].filter(Boolean)}
        width={760}
      >
        {viewCustomer ? (
          <div className="mt-3 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded border border-gray-100 bg-gray-50 p-3">
              <div><span className="text-gray-400">Code: </span><span className="font-mono">{viewCustomer.customerCode || '—'}</span></div>
              <div><span className="text-gray-400">Type: </span><Tag color={getTypeColor(viewCustomer.customerType)}>{viewCustomer.customerType?.replace('_', ' ')}</Tag></div>
              <div>
                <span className="text-gray-400">Category: </span>
                {(() => {
                  const cat = CUSTOMER_CATEGORIES.find(c => c.value === viewCustomer.customerCategory);
                  return cat ? <Tag color={cat.color}>{cat.label}</Tag> : <Tag>Silver</Tag>;
                })()}
              </div>
              <div><span className="text-gray-400">Status: </span><Tag color={viewCustomer.status === 'active' ? 'green' : viewCustomer.status === 'blocked' ? 'red' : 'orange'}>{viewCustomer.status}</Tag></div>
              <div><span className="text-gray-400">Source: </span>{viewCustomer.source ? <Tag>{viewCustomer.source.replace('_', ' ')}</Tag> : '—'}</div>
              {viewCustomer.isVisitor && (
                <div><span className="text-gray-400">Visitor: </span><Tag color="purple">Yes</Tag></div>
              )}
            </div>

            {(viewCustomer.companyName || viewCustomer.companyRegistrationNumber) && (
              <div className="rounded border border-gray-100 bg-blue-50 p-3">
                <div className="mb-1 text-xs font-medium text-blue-700">Company Details</div>
                <div><span className="text-gray-400">Name: </span>{viewCustomer.companyName || '—'}</div>
                <div><span className="text-gray-400">Registration: </span>{viewCustomer.companyRegistrationNumber || '—'}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-gray-400">Contact: </span>{viewCustomer.contactNumber || '—'}</div>
              <div>
                <span className="text-gray-400">WhatsApp: </span>{viewCustomer.whatsappNumber || '—'}
                {viewCustomer.useContactAsWhatsapp && <Tag color="green" className="ml-2" style={{ fontSize: 10 }}>Auto-filled</Tag>}
              </div>
              <div className="col-span-2"><span className="text-gray-400">Email: </span>{viewCustomer.email || '—'}</div>
              {(viewCustomer.gstin || viewCustomer.pan) ? <>
                <div><span className="text-gray-400">GSTIN: </span>{viewCustomer.gstin || '—'}</div>
                <div><span className="text-gray-400">PAN: </span>{viewCustomer.pan || '—'}</div>
              </> : null}
            </div>

            {viewCustomer.location?.coordinates && (
              <div className="rounded border border-blue-100 bg-blue-50 p-3">
                <div className="mb-1 text-xs font-medium text-blue-700 flex items-center gap-1">
                  <EnvironmentOutlined /> Customer Location
                </div>
                <div className="text-xs">
                  <span className="text-gray-400">Coordinates: </span>
                  <span className="font-mono">
                    {viewCustomer.location.coordinates[1].toFixed(6)}, {viewCustomer.location.coordinates[0].toFixed(6)}
                  </span>
                </div>
                {viewCustomer.location.address && (
                  <div className="mt-1"><span className="text-gray-400">Address: </span>{viewCustomer.location.address}</div>
                )}
                <div className="mt-2">
                  <Link 
                    href={`https://www.google.com/maps?q=${viewCustomer.location.coordinates[1]},${viewCustomer.location.coordinates[0]}`}
                    target="_blank"
                  >
                    <Button size="small" type="link" icon={<EnvironmentOutlined />}>View on Google Maps</Button>
                  </Link>
                </div>
              </div>
            )}

            <div><span className="text-gray-400">Billing address: </span>{viewCustomer.billingAddress || '—'}</div>
            <div><span className="text-gray-400">Delivery address: </span>{viewCustomer.deliveryAddress || '—'}</div>
            <div className="grid grid-cols-3 gap-3">
              <div><span className="text-gray-400">City: </span>{viewCustomer.city || '—'}</div>
              <div><span className="text-gray-400">State: </span>{viewCustomer.state || '—'}</div>
              <div><span className="text-gray-400">Pin: </span>{viewCustomer.pinCode || '—'}</div>
            </div>

            {(viewCustomer.googleReviewLink || viewCustomer.googleReviewSubmitted) && (
              <div className="rounded border border-yellow-100 bg-yellow-50 p-3">
                <div className="mb-1 text-xs font-medium text-yellow-700 flex items-center gap-1">
                  <StarOutlined /> Google Review Status
                </div>
                {viewCustomer.googleReviewLink && (
                  <div className="mb-2">
                    <span className="text-gray-400">Review Link: </span>
                    <Link href={viewCustomer.googleReviewLink} target="_blank">
                      <Button size="small" type="link" icon={<StarOutlined />}>Open Review Link</Button>
                    </Link>
                  </div>
                )}
                <div>
                  <span className="text-gray-400">Status: </span>
                  {viewCustomer.googleReviewSubmitted ? (
                    <Tag color="gold" icon={<StarOutlined />}>Review Submitted</Tag>
                  ) : (
                    <Tag color="orange">Pending</Tag>
                  )}
                </div>
                {viewCustomer.googleReviewSubmittedDate && (
                  <div><span className="text-gray-400">Submitted: </span>{new Date(viewCustomer.googleReviewSubmittedDate).toLocaleDateString()}</div>
                )}
                {viewCustomer.reviewCollectedBy && (
                  <div><span className="text-gray-400">Collected by: </span>{viewCustomer.reviewCollectedBy.name || '—'}</div>
                )}
              </div>
            )}

            {viewCustomer.isVisitor && (
              <div className="rounded border border-purple-100 bg-purple-50 p-3">
                <div className="mb-1 text-xs font-medium text-purple-700">Visitor Information</div>
                {viewCustomer.visitDate && (
                  <div><span className="text-gray-400">Visit Date: </span>{new Date(viewCustomer.visitDate).toLocaleString()}</div>
                )}
                {viewCustomer.visitNotes && (
                  <div><span className="text-gray-400">Notes: </span>{viewCustomer.visitNotes}</div>
                )}
              </div>
            )}

            {viewCustomer.customerType !== 'retail' ? (
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-400">Credit limit: </span>₹{Number(viewCustomer.creditLimit || 0).toLocaleString()}</div>
                <div><span className="text-gray-400">Credit days: </span>{viewCustomer.creditDays ?? '—'}</div>
              </div>
            ) : null}
            <div><span className="text-gray-400">Outstanding: </span><span className={Number(viewCustomer.currentOutstanding || 0) > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>₹{Number(viewCustomer.currentOutstanding || 0).toLocaleString()}</span></div>
            {(viewCustomer.projectName || viewCustomer.projectLocation || viewCustomer.projectDetails) ? (
              <div className="rounded border border-gray-100 bg-gray-50 p-3">
                <div className="mb-1 text-xs text-gray-400">Project</div>
                <div><span className="text-gray-400">Name: </span>{viewCustomer.projectName || '—'}</div>
                <div><span className="text-gray-400">Location: </span>{viewCustomer.projectLocation || '—'}</div>
                <div><span className="text-gray-400">Details: </span>{viewCustomer.projectDetails || '—'}</div>
              </div>
            ) : null}
            <div><span className="text-gray-400">Assigned Sales Executive: </span>{viewCustomer.assignedSalesExecutive?.name || viewCustomer.assignedSalesExecutive || '—'}</div>
            {viewCustomer.remarks ? <div><span className="text-gray-400">Remarks: </span>{viewCustomer.remarks}</div> : null}
          </div>
        ) : null}
      </Modal>

      {/* Add/Edit Modal */}
      <Modal
        title={editingCustomer ? 'Edit Customer' : 'Add Customer'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditingCustomer(null); }}
        onOk={handleSave}
        okText={editingCustomer ? 'Update' : 'Create'}
        width={900}
        confirmLoading={loading}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="customerType" label="Customer Type" rules={[{ required: true }]}>
                <Select onChange={v => setCustomerType(v)}>
                  {CUSTOMER_TYPES.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="customerCategory" label="Customer Category" rules={[{ required: true }]} tooltip="Silver/Gold/Platinum tier for loyalty and incentives">
                <Select>
                  {CUSTOMER_CATEGORIES.map(c => <Option key={c.value} value={c.value}><Tag color={c.color}>{c.label}</Tag></Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>

          {/* Company Details (Optional) */}
          <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-4">
            <div className="text-sm font-medium text-gray-600 mb-3">Company Details (Optional)</div>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="companyName" label="Company Name">
                  <Input placeholder="Optional for business customers" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="companyRegistrationNumber" label="Company Registration Number">
                  <Input placeholder="Optional" />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="contactNumber" label="Contact Number" rules={[{ required: true, message: 'Contact is required' }]}>
                <Input onChange={e => {
                  if (useContactAsWhatsapp) {
                    form.setFieldsValue({ whatsappNumber: e.target.value });
                  }
                }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="whatsappNumber" label="WhatsApp Number">
                <Input disabled={useContactAsWhatsapp} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="useContactAsWhatsapp" valuePropName="checked" className="mt-7">
                <Checkbox onChange={e => {
                  setUseContactAsWhatsapp(e.target.checked);
                  if (e.target.checked) {
                    const contact = form.getFieldValue('contactNumber');
                    form.setFieldsValue({ whatsappNumber: contact });
                  }
                }}>Same as contact number</Checkbox>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input type="email" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="isVisitor" valuePropName="checked" className="mt-7">
                <Checkbox>Mark as Visitor (Walk-in customer)</Checkbox>
              </Form.Item>
            </Col>
          </Row>

          {isNonRetail && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="gstin"
                  label="GSTIN"
                  normalize={normalizeGstinInput}
                  rules={[gstinFormRule()]}
                >
                  <Input placeholder="e.g. 29ABCDE1234F1Z5" maxLength={15} className="font-mono uppercase" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="pan" label="PAN">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
          )}
          
          {/* Addresses - Compact Card Layout */}
          <Card 
            size="small" 
            className="mb-4"
            title={
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  <EnvironmentOutlined /> Addresses
                </span>
                <Checkbox 
                  checked={sameAsBinding}
                  onChange={(e) => {
                    setSameAsBinding(e.target.checked);
                    if (e.target.checked && billingLocation) {
                      setDeliveryLocation({ ...billingLocation });
                      form.setFieldsValue({ deliveryAddress: form.getFieldValue('billingAddress') });
                    }
                  }}
                >
                  <span className="text-xs font-normal">Same delivery & billing</span>
                </Checkbox>
              </div>
            }
          >
            <Row gutter={16}>
              {/* Billing Address */}
              <Col span={12}>
                <div className="text-xs font-medium text-gray-600 mb-2">Billing Address</div>
                {billingLocation && billingLocation.lat ? (
                  <div className="mb-2 p-2 bg-gray-50 rounded text-xs">
                    <div className="font-medium text-gray-700 truncate">{billingLocation.address || 'Location set'}</div>
                    <div className="text-gray-400 text-[10px] font-mono">{billingLocation.lat.toFixed(4)}, {billingLocation.lng.toFixed(4)}</div>
                  </div>
                ) : (
                  <div className="mb-2 p-2 bg-gray-50 rounded text-xs text-gray-400 text-center">No location</div>
                )}
                <Button 
                  size="small"
                  icon={<EnvironmentOutlined />} 
                  onClick={() => setBillingMapModalOpen(true)}
                  block
                >
                  {billingLocation?.lat ? 'Change' : 'Set Location'}
                </Button>
                <Form.Item name="billingAddress" className="mt-2 mb-0">
                  <TextArea rows={2} placeholder="Additional details..." size="small" />
                </Form.Item>
              </Col>

              {/* Delivery Address */}
              <Col span={12}>
                <div className="text-xs font-medium text-gray-600 mb-2">Delivery Address</div>
                {deliveryLocation && deliveryLocation.lat ? (
                  <div className="mb-2 p-2 bg-gray-50 rounded text-xs">
                    <div className="font-medium text-gray-700 truncate">{deliveryLocation.address || 'Location set'}</div>
                    <div className="text-gray-400 text-[10px] font-mono">{deliveryLocation.lat.toFixed(4)}, {deliveryLocation.lng.toFixed(4)}</div>
                  </div>
                ) : (
                  <div className="mb-2 p-2 bg-gray-50 rounded text-xs text-gray-400 text-center">
                    {sameAsBinding ? 'Same as billing' : 'No location'}
                  </div>
                )}
                <Button 
                  size="small"
                  icon={<EnvironmentOutlined />} 
                  onClick={() => setDeliveryMapModalOpen(true)}
                  block
                  disabled={sameAsBinding}
                >
                  {deliveryLocation?.lat ? 'Change' : 'Set Location'}
                </Button>
                <Form.Item name="deliveryAddress" className="mt-2 mb-0">
                  <TextArea rows={2} placeholder="Additional details..." size="small" disabled={sameAsBinding} />
                </Form.Item>
              </Col>
            </Row>
          </Card>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="city" label="City">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="state" label="State">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="pinCode" label="Pin Code">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="source" label="Source">
                <Select allowClear placeholder="Select source">
                  {SOURCE_OPTIONS.map(s => <Option key={s.value} value={s.value}>{s.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assignedSalesExecutive" label="Assigned Sales Executive" tooltip="Sales executive responsible for this customer">
                <Select 
                  allowClear 
                  showSearch 
                  placeholder="Select sales executive"
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {salesExecutives.map(se => <Option key={se._id} value={se._id}>{se.name} ({se.email || se.phone})</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* Customer Location - Compact */}
          <Card size="small" className="mb-4" title={<span className="text-sm font-medium flex items-center gap-2"><EnvironmentOutlined /> Customer Location</span>}>
            {selectedLocation && selectedLocation.lat ? (
              <div className="mb-2 p-2 bg-gray-50 rounded text-xs">
                <div className="font-medium text-gray-700 truncate">{selectedLocation.address || 'Location set'}</div>
                <div className="text-gray-400 text-[10px] font-mono">{selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}</div>
              </div>
            ) : (
              <div className="mb-2 p-2 bg-gray-50 rounded text-xs text-gray-400 text-center">No location set</div>
            )}
            <Button 
              size="small"
              icon={<EnvironmentOutlined />} 
              onClick={() => setLocationModalOpen(true)}
              block
            >
              {selectedLocation?.lat ? 'Change Location' : 'Set Location on Map'}
            </Button>
          </Card>

          {/* Google Review Tracking */}
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
            <div className="text-sm font-medium text-yellow-700 mb-3 flex items-center gap-2">
              <StarOutlined /> Google Review Request
            </div>
            
            {/* Show current branch info */}
            <div className="mb-3 p-2 bg-white rounded border border-yellow-100">
              <div className="text-xs text-gray-500 mb-1">Review will be requested for:</div>
              <div className="text-sm font-medium text-gray-700">
                {activeBranch?.name || 'Current Branch'}
              </div>
              {activeBranch?.googleReviewLink ? (
                <div className="text-xs text-green-600 mt-1">✓ Review link configured</div>
              ) : (
                <div className="text-xs text-orange-600 mt-1">⚠️ Review link not set for this branch</div>
              )}
            </div>

            {/* Review Link Display */}
            <Form.Item label="Google Review Link">
              <Input 
                value={activeBranch?.googleReviewLink || 'Not configured for current branch'}
                readOnly
                disabled
                className="bg-gray-50"
              />
            </Form.Item>

            {/* Send Buttons */}
            <div className="mb-3">
              <div className="text-xs text-gray-600 mb-2">Send review request to customer:</div>
              <Space size="middle">
                <Button
                  icon={<WhatsAppOutlined />}
                  style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: 'white' }}
                  onClick={() => {
                    const contact = form.getFieldValue('contactNumber') || form.getFieldValue('whatsappNumber');
                    if (!contact) {
                      message.warning('Please enter customer contact number first');
                      return;
                    }
                    const customerName = form.getFieldValue('name') || 'Customer';
                    sendReviewViaWhatsApp(contact, customerName);
                  }}
                  disabled={!form.getFieldValue('contactNumber') && !form.getFieldValue('whatsappNumber')}
                >
                  Send via WhatsApp
                </Button>
                
                <Button
                  icon={<MessageOutlined />}
                  type="primary"
                  onClick={() => {
                    const contact = form.getFieldValue('contactNumber');
                    if (!contact) {
                      message.warning('Please enter customer contact number first');
                      return;
                    }
                    const customerName = form.getFieldValue('name') || 'Customer';
                    sendReviewViaSMS(contact, customerName);
                  }}
                  disabled={!form.getFieldValue('contactNumber')}
                >
                  Send via SMS
                </Button>
              </Space>
              <div className="text-xs text-gray-500 mt-2">
                💡 Review link will be sent using the contact number entered above
              </div>
            </div>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="reviewCollectedBy" label="Review Collected By" tooltip="SE/Staff member who collected the review (for incentive)">
                  <Select 
                    allowClear 
                    showSearch 
                    placeholder="Select staff member"
                    optionFilterProp="children"
                  >
                    {salesExecutives.map(se => <Option key={se._id} value={se._id}>{se.name}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="googleReviewSubmittedDate" label="Review Submitted Date">
                  <DatePicker className="w-full" />
                </Form.Item>
              </Col>
            </Row>
            
            <Form.Item name="googleReviewSubmitted" valuePropName="checked">
              <Checkbox>Google Review Submitted (check after customer reviews)</Checkbox>
            </Form.Item>
          </div>
          {isNonRetail && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="creditLimit" label="Credit Limit (₹)">
                  <InputNumber min={0} className="w-full" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="creditDays" label="Credit Days">
                  <InputNumber min={0} max={365} className="w-full" />
                </Form.Item>
              </Col>
            </Row>
          )}
          {isProjectType && (
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="projectName" label="Project Name">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="projectLocation" label="Project Location">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="projectDetails" label="Project Details">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
          )}

          {/* Visitor Details */}
          {form.getFieldValue('isVisitor') && (
            <div className="bg-purple-50 border border-purple-200 rounded p-3 mb-4">
              <div className="text-sm font-medium text-purple-700 mb-3">Visitor Details</div>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="visitDate" label="Visit Date">
                    <DatePicker className="w-full" showTime />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="visitNotes" label="Visit Notes">
                    <TextArea rows={2} placeholder="Notes about the visit" />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          )}

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="remarks" label="Remarks">
                <TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                <Select>
                  {STATUS_OPTIONS.map(s => <Option key={s.value} value={s.value}>{s.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>

        {/* Google Maps Location Picker Modal - Customer Location */}
        <GoogleMapPicker
          open={locationModalOpen}
          onCancel={() => setLocationModalOpen(false)}
          initialLocation={selectedLocation}
          onSelect={(location) => {
            setSelectedLocation(location);
            form.setFieldsValue({
              locationLat: location.lat,
              locationLng: location.lng,
              locationAddress: location.address,
            });
            setLocationModalOpen(false);
            message.success('Location updated');
          }}
          title="Select Customer Location"
        />
        
        {/* Google Maps Billing Address Picker Modal */}
        <GoogleMapPicker
          open={billingMapModalOpen}
          onCancel={() => setBillingMapModalOpen(false)}
          initialLocation={billingLocation}
          onSelect={(location) => {
            setBillingLocation(location);
            if (location.address) {
              form.setFieldsValue({ billingAddress: location.address });
            }
            if (sameAsBinding) {
              setDeliveryLocation({ ...location });
              form.setFieldsValue({ deliveryAddress: location.address });
            }
            setBillingMapModalOpen(false);
            message.success('Billing location updated');
          }}
          title="Select Billing Address Location"
        />
        
        {/* Google Maps Delivery Address Picker Modal */}
        <GoogleMapPicker
          open={deliveryMapModalOpen}
          onCancel={() => setDeliveryMapModalOpen(false)}
          initialLocation={deliveryLocation}
          onSelect={(location) => {
            setDeliveryLocation(location);
            if (location.address) {
              form.setFieldsValue({ deliveryAddress: location.address });
            }
            setDeliveryMapModalOpen(false);
            message.success('Delivery location updated');
          }}
          title="Select Delivery Address Location"
        />
      </Modal>
    </div>
  );
};

export default CustomerMaster;
