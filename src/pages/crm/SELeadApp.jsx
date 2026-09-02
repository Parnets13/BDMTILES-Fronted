import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, DatePicker, Empty, Form, Input, Modal, Select, Spin, Tag, message } from 'antd';
import { EnvironmentOutlined, PhoneOutlined, ReloadOutlined, WhatsAppOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import crmService from '../../services/crmService.js';
import { subscribeToLeadEvents } from '../../services/leadEventStream.js';
import { useAuth } from '../../context/AuthContext.jsx';

const availabilityOptions = ['available', 'busy', 'attending', 'travelling', 'on_break', 'offline']
  .map((value) => ({ value, label: value.replace('_', ' ') }));
const visitNext = {
  scheduled: ['travelling', 'cancelled', 'no_show'],
  travelling: ['arrived', 'cancelled'],
  arrived: ['attending', 'cancelled', 'no_show'],
  attending: ['completed', 'cancelled'],
};

const SELeadApp = () => {
  const { hasPermission, activeBranchId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkId = searchParams.get('lead');
  const [inbox, setInbox] = useState({ pendingAcceptance: [], active: [], total: 0 });
  const [availability, setAvailability] = useState({ status: 'offline', reason: '' });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [streamState, setStreamState] = useState('connecting');
  const [declineLead, setDeclineLead] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [followupLead, setFollowupLead] = useState(null);
  const [visitLead, setVisitLead] = useState(null);
  const [followupForm] = Form.useForm();
  const [visitForm] = Form.useForm();
  const canRespond = hasPermission('lead.respond');
  const canFollowup = hasPermission('lead.followup');
  const canConvert = hasPermission('lead.convert');

  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      const response = await crmService.getLead(id);
      if (response.success) {
        setSelected(response.data);
        if (new URLSearchParams(window.location.search).get('lead') !== String(id)) {
          setSearchParams({ lead: id }, { replace: true });
        }
      }
    } catch (error) { message.error(error.message); }
  }, [setSearchParams]);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const [leadResponse, availabilityResponse] = await Promise.all([
        crmService.getMyLeads(),
        crmService.getMyLeadAvailability(),
      ]);
      if (leadResponse.success) setInbox(leadResponse.data);
      if (availabilityResponse.success) setAvailability(availabilityResponse.data);
      if (deepLinkId) await loadDetail(deepLinkId);
    } catch (error) {
      if (!quiet) message.error(error.message);
    } finally { if (!quiet) setLoading(false); }
  }, [deepLinkId, loadDetail]);

  useEffect(() => { refresh(); }, [activeBranchId, refresh]);
  useEffect(() => subscribeToLeadEvents({
    onStateChange: setStreamState,
    onEvent: ({ event, data }) => {
      if (event === 'ready') return;
      refresh({ quiet: true });
      if (selected?._id && (!data?.leadId || String(data.leadId) === String(selected._id))) loadDetail(selected._id);
    },
  }), [activeBranchId, loadDetail, refresh, selected?._id]);
  useEffect(() => {
    if (streamState === 'connected') return undefined;
    const timer = setInterval(() => refresh({ quiet: true }), 20000);
    return () => clearInterval(timer);
  }, [refresh, streamState]);

  const respond = async (lead, accepted) => {
    try {
      if (accepted) await crmService.acceptLead(lead._id, { expectedVersion: lead.assignmentVersion || 0 });
      else await crmService.declineLead(lead._id, { reason: declineReason, expectedVersion: lead.assignmentVersion || 0 });
      message.success(accepted ? 'Lead accepted' : 'Lead declined');
      setDeclineLead(null); setDeclineReason('');
      await refresh({ quiet: true });
      if (selected?._id === lead._id) setSelected(null);
    } catch (error) { message.error(error.message); }
  };

  const updateAvailability = async (status) => {
    try {
      const response = await crmService.updateMyLeadAvailability({ status, reason: availability.reason || '' });
      if (response.success) setAvailability(response.data);
    } catch (error) { message.error(error.message); }
  };

  const saveFollowup = async () => {
    try {
      const values = await followupForm.validateFields();
      if (values.nextFollowupDate) values.nextFollowupDate = values.nextFollowupDate.toISOString();
      await crmService.addFollowup(followupLead._id, values);
      message.success('Follow-up saved');
      setFollowupLead(null); followupForm.resetFields();
      await refresh({ quiet: true });
      if (selected?._id === followupLead._id) await loadDetail(followupLead._id);
    } catch (error) { if (!error.errorFields) message.error(error.message); }
  };

  const saveVisit = async () => {
    try {
      const values = await visitForm.validateFields();
      values.scheduledAt = values.scheduledAt.toISOString();
      values.location = { address: values.address || '' };
      delete values.address;
      await crmService.createLeadVisit(visitLead._id, values);
      message.success('Visit scheduled');
      setVisitLead(null); visitForm.resetFields();
      await loadDetail(visitLead._id);
    } catch (error) { if (!error.errorFields) message.error(error.message); }
  };

  const transitionVisit = async (visit, status) => {
    try {
      await crmService.updateLeadVisitStatus(selected._id, visit._id, { status });
      await loadDetail(selected._id);
    } catch (error) { message.error(error.message); }
  };

  if (loading) return <div className="min-h-[60vh] grid place-items-center"><Spin size="large" /></div>;

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur py-3 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold">My Leads</h1><div className="text-xs text-gray-500">{inbox.total || 0} active · {streamState === 'connected' ? 'Live' : 'Polling fallback'}</div></div>
        <div className="flex gap-2">
          <Select value={availability.status} options={availabilityOptions} onChange={updateAvailability} className="w-36" />
          <Button icon={<ReloadOutlined />} onClick={() => refresh()} />
        </div>
      </div>

      <section className="mb-5">
        <h2 className="text-sm font-semibold text-orange-700 mb-2">Pending acceptance ({inbox.pendingAcceptance?.length || 0})</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {(inbox.pendingAcceptance || []).map((lead) => (
            <Card key={lead._id} size="small" className="border-orange-300" onClick={() => loadDetail(lead._id)}>
              <div className="flex justify-between"><strong>{lead.name}</strong><Tag color="orange">{lead.priority}</Tag></div>
              <div className="text-xs text-gray-500">{lead.leadNumber} · {lead.phone} · {lead.city || 'No city'}</div>
              {lead.acceptanceDeadlineAt && <div className="text-xs text-red-600 mt-1">Respond by {dayjs(lead.acceptanceDeadlineAt).format('DD MMM, hh:mm A')}</div>}
              {canRespond && <div className="flex gap-2 mt-3" onClick={(event) => event.stopPropagation()}>
                <Button type="primary" size="small" onClick={() => respond(lead, true)}>Accept</Button>
                <Button danger size="small" onClick={() => setDeclineLead(lead)}>Decline</Button>
              </div>}
            </Card>
          ))}
          {!inbox.pendingAcceptance?.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No pending leads" />}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Active leads</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(inbox.active || []).map((lead) => (
            <Card key={lead._id} size="small" onClick={() => loadDetail(lead._id)} className="cursor-pointer">
              <div className="flex justify-between"><strong>{lead.name}</strong><Tag color={lead.priority === 'hot' ? 'red' : 'blue'}>{lead.priority}</Tag></div>
              <div className="text-xs text-gray-500">{lead.leadNumber} · {lead.status?.replaceAll('_', ' ')}</div>
              <div className="flex gap-1 mt-3" onClick={(event) => event.stopPropagation()}>
                <Button size="small" icon={<PhoneOutlined />} href={`tel:${lead.phone}`} />
                <Button size="small" icon={<WhatsAppOutlined />} href={`https://wa.me/${String(lead.phone).replace(/\D/g, '')}`} target="_blank" />
                <Button size="small" icon={<EnvironmentOutlined />} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.city || lead.name)}`} target="_blank" />
                {canFollowup && <Button size="small" onClick={() => setFollowupLead(lead)}>Follow-up</Button>}
                {canFollowup && <Button size="small" onClick={() => setVisitLead(lead)}>Visit</Button>}
              </div>
            </Card>
          ))}
          {!inbox.active?.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No active leads" />}
        </div>
      </section>

      <Modal open={!!selected} title={selected ? `${selected.leadNumber} · ${selected.name}` : ''} onCancel={() => { setSelected(null); setSearchParams({}, { replace: true }); }} footer={null} width={720}>
        {selected && <div className="space-y-4">
          <div className="flex flex-wrap gap-2"><Tag>{selected.status}</Tag><Tag color="blue">{selected.leadChannel || selected.customerType}</Tag><Tag color="purple">{selected.leadSource || '—'}</Tag></div>
          <div className="grid grid-cols-2 gap-2 text-sm"><div>Phone: {selected.phone}</div><div>City: {selected.city || '—'}</div><div>Campaign: {selected.campaign || '—'}</div><div>Next follow-up: {selected.nextFollowupDate ? dayjs(selected.nextFollowupDate).format('DD MMM') : '—'}</div></div>
          <div className="flex gap-2"><Button href={`tel:${selected.phone}`} icon={<PhoneOutlined />}>Call</Button><Button href={`https://wa.me/${String(selected.phone).replace(/\D/g, '')}`} target="_blank" icon={<WhatsAppOutlined />}>WhatsApp</Button></div>
          <div><h3 className="font-semibold mb-2">Visits</h3>{(selected.visits || []).map((visit) => <div key={visit._id} className="border rounded p-2 mb-2 text-sm"><div className="flex justify-between"><span>{dayjs(visit.scheduledAt).format('DD MMM, hh:mm A')}</span><Tag>{visit.status}</Tag></div><div className="text-xs text-gray-500">{visit.location?.address || visit.remarks || 'No location details'}</div><div className="flex gap-1 mt-2">{(visitNext[visit.status] || []).map((status) => <Button size="small" key={status} onClick={() => transitionVisit(visit, status)}>{status.replace('_', ' ')}</Button>)}</div></div>)}</div>
          <div><h3 className="font-semibold mb-2">Activity</h3><div className="max-h-48 overflow-auto space-y-2">{(selected.activities || []).map((activity) => <div key={activity._id} className="border-l-2 pl-2 text-xs"><div>{activity.summary}</div><div className="text-gray-400">{dayjs(activity.createdAt).format('DD MMM, hh:mm A')} · {activity.actorName || 'System'}</div></div>)}</div></div>
        </div>}
      </Modal>

      <Modal open={!!declineLead} title="Decline lead" onCancel={() => setDeclineLead(null)} onOk={() => respond(declineLead, false)} okButtonProps={{ danger: true, disabled: !declineReason.trim() }}>
        <Input.TextArea value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} placeholder="Reason is required" />
      </Modal>
      <Modal open={!!followupLead} title="Record follow-up" onCancel={() => setFollowupLead(null)} onOk={saveFollowup}>
        <Form form={followupForm} layout="vertical"><Form.Item name="outcome" label="Outcome" rules={[{ required: true }]}><Select options={['interested', 'not_interested', 'callback', ...(canConvert ? ['converted'] : []), 'no_response', 'visit_scheduled', 'quotation_sent'].map((value) => ({ value, label: value.replaceAll('_', ' ') }))} /></Form.Item><Form.Item name="notes" label="Notes"><Input.TextArea /></Form.Item><Form.Item name="nextFollowupDate" label="Next follow-up"><DatePicker showTime className="w-full" /></Form.Item></Form>
      </Modal>
      <Modal open={!!visitLead} title="Schedule visit" onCancel={() => setVisitLead(null)} onOk={saveVisit}>
        <Form form={visitForm} layout="vertical"><Form.Item name="scheduledAt" label="Schedule" rules={[{ required: true }]}><DatePicker showTime className="w-full" /></Form.Item><Form.Item name="address" label="Location"><Input /></Form.Item><Form.Item name="remarks" label="Remarks"><Input.TextArea /></Form.Item></Form>
      </Modal>
    </div>
  );
};

export default SELeadApp;
