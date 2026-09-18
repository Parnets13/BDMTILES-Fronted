import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Card, Row, Col, Input, List, Badge, Avatar, Typography, Space, Button, Tag, Empty,
  Spin, Alert, Tooltip, message,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, SendOutlined, ShopOutlined, UserOutlined,
  PhoneOutlined, CustomerServiceOutlined, WarningOutlined,
} from '@ant-design/icons';
import api from '../../config/api';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

const BRAND = '#FF5F03';
const POLL_MS = 20000;

/**
 * Admin support desk for the dealer <-> sales executive conversation (SOW 17.8).
 *
 * Reads and writes the same DealerMessage thread the dealer app uses. Opening a
 * thread here marks it read for the back office only — the assigned executive
 * keeps their own unread badge, so nothing is hidden from them.
 */
export default function DealerSupportChat() {
  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState('');
  const [search, setSearch] = useState('');

  const [activeDealer, setActiveDealer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const scrollRef = useRef(null);
  const activeIdRef = useRef(null);

  const loadThreads = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setThreadsLoading(true);
    try {
      const res = await api.get('/support-chat/threads');
      setThreads(res?.data || []);
      setThreadsError('');
    } catch (err) {
      if (!quiet) {
        setThreads([]);
        setThreadsError(err?.message || 'Could not load conversations.');
      }
    } finally {
      if (!quiet) setThreadsLoading(false);
    }
  }, []);

  const openThread = useCallback(async (dealerId, { quiet = false } = {}) => {
    if (!dealerId) return;
    activeIdRef.current = dealerId;
    if (!quiet) setMessagesLoading(true);
    try {
      const res = await api.get(`/support-chat/${dealerId}`);
      // A slow response for a thread the user has since navigated away from must
      // not overwrite what is on screen.
      if (activeIdRef.current !== dealerId) return;
      setMessages(res?.data || []);
      setActiveDealer(res?.dealer || null);
      if (!quiet) loadThreads({ quiet: true });
    } catch (err) {
      if (!quiet) {
        setMessages([]);
        message.error(err?.message || 'Could not open this conversation.');
      }
    } finally {
      if (!quiet) setMessagesLoading(false);
    }
  }, [loadThreads]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // Chat is pull-based — no socket layer is assumed anywhere in this stack.
  useEffect(() => {
    const timer = setInterval(() => {
      loadThreads({ quiet: true });
      if (activeIdRef.current) openThread(activeIdRef.current, { quiet: true });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [loadThreads, openThread]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  const filtered = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.trim().toLowerCase();
    return threads.filter((t) =>
      t.businessName?.toLowerCase().includes(q) ||
      t.dealerCode?.toLowerCase().includes(q) ||
      t.mobile?.includes(q) ||
      t.assignedExecutive?.name?.toLowerCase().includes(q));
  }, [threads, search]);

  const totalUnread = useMemo(
    () => threads.reduce((sum, t) => sum + (t.unread || 0), 0),
    [threads],
  );
  const totalAwaiting = useMemo(
    () => threads.filter((t) => (t.awaitingExecutive || 0) > 0).length,
    [threads],
  );

  const send = async () => {
    const body = draft.trim();
    if (!body || !activeDealer?._id) return;
    setSending(true);
    try {
      await api.post(`/support-chat/${activeDealer._id}`, { body });
      setDraft('');
      await openThread(activeDealer._id, { quiet: true });
      loadThreads({ quiet: true });
    } catch { /* reported by the interceptor */ } finally {
      setSending(false);
    }
  };

  const renderThread = (t) => {
    const active = activeDealer?._id === t.dealerId;
    return (
      <List.Item
        key={t.dealerId}
        onClick={() => openThread(t.dealerId)}
        style={{
          cursor: 'pointer',
          padding: '12px 14px',
          background: active ? '#fff7f0' : 'transparent',
          borderLeft: active ? `3px solid ${BRAND}` : '3px solid transparent',
        }}
      >
        <List.Item.Meta
          avatar={(
            <Badge count={t.unread || 0} size="small" offset={[-2, 2]}>
              <Avatar style={{ background: active ? BRAND : '#d9d9d9' }} icon={<ShopOutlined />} />
            </Badge>
          )}
          title={(
            <Space size={4} wrap>
              <Text strong style={{ fontSize: 13 }}>{t.businessName || 'Unnamed dealer'}</Text>
              {t.dealerCode && <Text type="secondary" style={{ fontSize: 11 }}>{t.dealerCode}</Text>}
            </Space>
          )}
          description={(
            <div>
              <Text type="secondary" ellipsis style={{ fontSize: 12, display: 'block' }}>
                {t.lastSenderRole === 'dealer' ? '' : 'You: '}{t.lastMessage}
              </Text>
              <Space size={6} style={{ marginTop: 2 }} wrap>
                <Text type="secondary" style={{ fontSize: 10 }}>
                  {t.lastAt ? dayjs(t.lastAt).format('DD MMM, HH:mm') : ''}
                </Text>
                {t.awaitingExecutive > 0 && (
                  <Tooltip title={`${t.awaitingExecutive} message(s) the assigned executive has not opened yet`}>
                    <Tag color="orange" style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}>
                      SE not seen
                    </Tag>
                  </Tooltip>
                )}
                {!t.assignedExecutive && (
                  <Tag icon={<WarningOutlined />} color="red" style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}>
                    Unassigned
                  </Tag>
                )}
              </Space>
            </div>
          )}
        />
      </List.Item>
    );
  };

  const renderBubble = (m) => {
    const fromDealer = m.senderRole === 'dealer';
    return (
      <div
        key={m._id}
        style={{
          display: 'flex',
          justifyContent: fromDealer ? 'flex-start' : 'flex-end',
          marginBottom: 10,
        }}
      >
        <div
          style={{
            maxWidth: '72%',
            background: fromDealer ? '#f5f5f5' : '#fff7f0',
            border: `1px solid ${fromDealer ? '#e8e8e8' : '#ffd8bf'}`,
            borderRadius: 10,
            padding: '8px 12px',
          }}
        >
          <Space size={6} style={{ marginBottom: 2 }}>
            <Text strong style={{ fontSize: 11, color: fromDealer ? '#555' : BRAND }}>
              {m.senderName || (fromDealer ? 'Dealer' : 'BDMTILES')}
            </Text>
            {m.sentFromSupportDesk && (
              <Tag icon={<CustomerServiceOutlined />} color="blue" style={{ fontSize: 9, lineHeight: '15px', margin: 0 }}>
                Support desk
              </Tag>
            )}
          </Space>
          <Paragraph style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{m.body}</Paragraph>
          <Text type="secondary" style={{ fontSize: 10 }}>
            {dayjs(m.createdAt).format('DD MMM YYYY, HH:mm')}
            {!fromDealer && m.readByDealerAt ? ' · read' : ''}
          </Text>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: BRAND }}>Dealer Support Chat</Title>
          <Text type="secondary">
            The same conversation dealers see in the app. Replies here are delivered to the dealer immediately.
          </Text>
        </div>
        <Space>
          <Badge count={totalUnread} showZero style={{ backgroundColor: totalUnread ? BRAND : '#bfbfbf' }} />
          {totalAwaiting > 0 && (
            <Tooltip title="Conversations where the assigned sales executive has unopened dealer messages">
              <Tag color="orange">{totalAwaiting} awaiting SE</Tag>
            </Tooltip>
          )}
          <Button icon={<ReloadOutlined />} onClick={() => loadThreads()} loading={threadsLoading}>Refresh</Button>
        </Space>
      </div>

      {threadsError && (
        <Alert
          type="error"
          showIcon
          message="Conversations could not be loaded"
          description={threadsError}
          action={<Button size="small" onClick={() => loadThreads()}>Retry</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={16}>
        <Col xs={24} md={9} lg={8}>
          <Card
            styles={{ body: { padding: 0 } }}
            title={(
              <Input
                prefix={<SearchOutlined />}
                placeholder="Search dealer, code, mobile or SE..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                allowClear
                variant="borderless"
              />
            )}
          >
            <div style={{ maxHeight: '62vh', overflowY: 'auto' }}>
              <Spin spinning={threadsLoading}>
                {filtered.length ? (
                  <List dataSource={filtered} renderItem={renderThread} split />
                ) : (
                  <Empty
                    style={{ padding: 32 }}
                    description={threads.length ? 'No dealer matches that search.' : 'No dealer has started a conversation yet.'}
                  />
                )}
              </Spin>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={15} lg={16}>
          <Card
            title={activeDealer ? (
              <Space wrap>
                <Avatar size="small" style={{ background: BRAND }} icon={<ShopOutlined />} />
                <Text strong>{activeDealer.businessName}</Text>
                {activeDealer.dealerCode && <Tag>{activeDealer.dealerCode}</Tag>}
                {activeDealer.mobile && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <PhoneOutlined /> {activeDealer.mobile}
                  </Text>
                )}
                {activeDealer.assignedExecutive ? (
                  <Tag icon={<UserOutlined />} color="blue">
                    SE: {activeDealer.assignedExecutive.name}
                  </Tag>
                ) : (
                  <Tag icon={<WarningOutlined />} color="red">No SE assigned</Tag>
                )}
              </Space>
            ) : 'Select a conversation'}
            styles={{ body: { padding: activeDealer ? 16 : 0 } }}
          >
            {!activeDealer ? (
              <Empty style={{ padding: 60 }} description="Pick a dealer on the left to read and reply to their thread." />
            ) : (
              <>
                {!activeDealer.assignedExecutive && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="This dealer has no assigned sales executive"
                    description="They cannot start new messages from the app until one is assigned. Assign an executive from SE Dealer Assignment."
                  />
                )}
                <div
                  ref={scrollRef}
                  style={{
                    height: '48vh',
                    overflowY: 'auto',
                    padding: '4px 8px',
                    background: '#fafafa',
                    borderRadius: 8,
                    border: '1px solid #f0f0f0',
                  }}
                >
                  <Spin spinning={messagesLoading}>
                    {messages.length
                      ? messages.map(renderBubble)
                      : <Empty style={{ padding: 40 }} description="No messages in this thread yet." />}
                  </Spin>
                </div>

                <Space.Compact style={{ width: '100%', marginTop: 12 }}>
                  <Input.TextArea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a reply... (Enter to send, Shift+Enter for a new line)"
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    maxLength={2000}
                    showCount
                    onPressEnter={(e) => {
                      if (!e.shiftKey) { e.preventDefault(); send(); }
                    }}
                  />
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={send}
                    loading={sending}
                    disabled={!draft.trim()}
                    style={{ background: BRAND, borderColor: BRAND }}
                  >
                    Send
                  </Button>
                </Space.Compact>
              </>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
