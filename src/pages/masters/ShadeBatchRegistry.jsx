import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, Empty, Input, Row, Space, Statistic, Table, Tabs,
  Tag, Tooltip, Typography, message,
} from 'antd';
import {
  ExclamationCircleOutlined, ReloadOutlined, SearchOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../config/api';

const { Text, Title, Paragraph } = Typography;

const BRAND = '#FF5F03';
const URGENT = '#cf1322';
const CAUTION = '#d46b08';
const POSITIVE = '#389e0d';

const fmtDate = (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—');
const fmtQty = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const ShadeBatchRegistry = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/stock/attribute-registry');
      if (res.success) setData(res.data);
    } catch (error) { message.error(error.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const entryColumns = (label) => [
    {
      title: label,
      dataIndex: 'value',
      render: (value, r) => (r.unspecified
        ? <Text type="secondary" italic>(not specified)</Text>
        : (
          <Space size={4}>
            {/* Rendered in a code style so trailing spaces are actually visible. */}
            <Text code>{value}</Text>
            {r.hasPaddingIssue && (
              <Tooltip title="This value has leading or trailing whitespace. It is a different stock bucket from the trimmed spelling even though they look identical.">
                <Tag color="red" icon={<WarningOutlined />}>padded</Tag>
              </Tooltip>
            )}
          </Space>
        )),
    },
    {
      title: 'Stock Rows',
      dataIndex: 'stockRows',
      width: 110,
      sorter: (a, b) => a.stockRows - b.stockRows,
    },
    { title: 'Products', dataIndex: 'productCount', width: 100, sorter: (a, b) => a.productCount - b.productCount },
    { title: 'Warehouses', dataIndex: 'warehouseCount', width: 110 },
    {
      title: 'Total Qty',
      dataIndex: 'totalQty',
      width: 120,
      sorter: (a, b) => a.totalQty - b.totalQty,
      render: fmtQty,
    },
    {
      title: 'Available',
      dataIndex: 'availableQty',
      width: 120,
      render: (v) => <Text style={{ color: v > 0 ? POSITIVE : undefined }}>{fmtQty(v)}</Text>,
    },
    { title: 'Last Received', dataIndex: 'lastGRNDate', width: 130, render: fmtDate },
    { title: 'Last Sold', dataIndex: 'lastSaleDate', width: 130, render: fmtDate },
  ];

  const renderSection = (key, label) => {
    const section = data?.[key];
    if (!section) return <Card loading={loading}><Empty description="No data loaded." /></Card>;

    const filterText = search.trim().toLowerCase();
    const rows = filterText
      ? section.entries.filter((entry) => entry.value.toLowerCase().includes(filterText))
      : section.entries;

    return (
      <>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title={`Distinct ${label}s In Use`} value={section.distinctValues} valueStyle={{ color: BRAND }} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Tooltip title={`Stock rows with no ${label.toLowerCase()} recorded. This is normal for material that is not tracked by ${label.toLowerCase()}.`}>
                <Statistic title={`Rows Without A ${label}`} value={section.unspecifiedRows} valueStyle={{ color: '#8c8c8c' }} />
              </Tooltip>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="Possible Duplicates"
                value={section.variantGroups.length}
                valueStyle={{ color: section.variantGroups.length ? URGENT : POSITIVE }}
                prefix={section.variantGroups.length ? <ExclamationCircleOutlined /> : null}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="Whitespace Problems"
                value={section.paddingIssues.length}
                valueStyle={{ color: section.paddingIssues.length ? URGENT : POSITIVE }}
              />
            </Card>
          </Col>
        </Row>

        {section.variantGroups.length > 0 && (
          <Card
            size="small"
            title={<Space><WarningOutlined style={{ color: URGENT }} />Values that look like the same {label.toLowerCase()}</Space>}
            style={{ marginBottom: 16 }}
          >
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              These spellings differ only by case, spacing, hyphens or underscores. Each one holds stock in a separate
              bucket, so the same physical material is split across them — which makes availability look lower than it is
              and can block an order that the warehouse could actually fulfil.
            </Paragraph>
            <Table
              size="small"
              rowKey="normalized"
              pagination={false}
              dataSource={section.variantGroups}
              columns={[
                {
                  title: 'Spellings found',
                  key: 'variants',
                  render: (_, group) => (
                    <Space wrap>
                      {group.variants.map((variant) => (
                        <Tooltip
                          key={variant.value}
                          title={`${variant.stockRows} stock row(s), ${fmtQty(variant.totalQty)} total qty`}
                        >
                          <Tag color={variant.hasPaddingIssue ? 'red' : 'orange'}>
                            "{variant.value}" ({variant.stockRows})
                          </Tag>
                        </Tooltip>
                      ))}
                    </Space>
                  ),
                },
                { title: 'Buckets', dataIndex: 'totalRows', width: 90 },
                { title: 'Combined Qty', dataIndex: 'totalQty', width: 130, render: fmtQty },
              ]}
            />
          </Card>
        )}

        {section.paddingIssues.length > 0 && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message={`${section.paddingIssues.length} ${label.toLowerCase()} value(s) have hidden leading or trailing spaces`}
            description={
              <Space wrap>
                {section.paddingIssues.map((entry) => (
                  <Tag key={entry.value} color="red">"{entry.value}" ({entry.stockRows} row(s))</Tag>
                ))}
              </Space>
            }
          />
        )}

        <Card size="small" title={`${label} Values In Stock`}>
          <Table
            size="small"
            rowKey={(r) => r.value || '__unspecified__'}
            loading={loading}
            dataSource={rows}
            columns={entryColumns(label)}
            scroll={{ x: 1000 }}
            pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t) => `${t} value(s)` }}
            locale={{ emptyText: `No ${label.toLowerCase()} values match your search.` }}
          />
        </Card>
      </>
    );
  };

  const totalProblems = (data?.shade?.variantGroups.length || 0)
    + (data?.shade?.paddingIssues.length || 0)
    + (data?.batch?.variantGroups.length || 0)
    + (data?.batch?.paddingIssues.length || 0);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: BRAND }}>Shade & Batch Registry</Title>
          <Text type="secondary">The shade and batch vocabulary actually in use, and where spellings have split your stock</Text>
        </div>
        <Space>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Filter values"
            style={{ width: 220 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>Refresh</Button>
        </Space>
      </div>

      <Alert
        type={totalProblems > 0 ? 'warning' : 'info'}
        showIcon
        style={{ marginBottom: 20 }}
        message={totalProblems > 0
          ? `${totalProblems} possible data-entry problem(s) found across shade and batch values`
          : 'No duplicate or padded shade/batch values found'}
        description={data?.note
          || 'Shade and batch are free text and have no master list. Each distinct spelling is a separate stock bucket.'}
      />

      <Tabs
        items={[
          {
            key: 'shade',
            label: (
              <Space size={4}>
                Shade
                {(data?.shade?.variantGroups.length || 0) + (data?.shade?.paddingIssues.length || 0) > 0 && (
                  <Tag color={CAUTION} style={{ marginInlineEnd: 0 }}>
                    {(data.shade.variantGroups.length + data.shade.paddingIssues.length)}
                  </Tag>
                )}
              </Space>
            ),
            children: renderSection('shade', 'Shade'),
          },
          {
            key: 'batch',
            label: (
              <Space size={4}>
                Batch
                {(data?.batch?.variantGroups.length || 0) + (data?.batch?.paddingIssues.length || 0) > 0 && (
                  <Tag color={CAUTION} style={{ marginInlineEnd: 0 }}>
                    {(data.batch.variantGroups.length + data.batch.paddingIssues.length)}
                  </Tag>
                )}
              </Space>
            ),
            children: renderSection('batch', 'Batch'),
          },
        ]}
      />
    </div>
  );
};

export default ShadeBatchRegistry;
