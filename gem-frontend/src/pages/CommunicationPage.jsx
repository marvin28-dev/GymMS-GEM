import { useState, useRef, useEffect } from 'react';
import {
  Eye, RefreshCw, Trash2, Send, FileText, Clock, X,
  Mail, MessageSquare, Bell, Megaphone, Calendar,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import ConfirmModal from '../components/ui/ConfirmModal';
import { useLanguage } from '../contexts/LanguageContext';
import { getAll as getMembers } from '../services/members.service';
import { getAll as getPackages } from '../services/packages.service';
import { getAll as getCommunications, create as createCommunication, remove as removeCommunication } from '../services/communications.service';

// ─── Shared styles ───────────────────────────────────────────────────────────
const cardStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-card)',
};

const primaryBtn = {
  background: 'linear-gradient(135deg, #c9a96e, #b08d4a)',
  color: '#0a0a0f',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  padding: '8px 16px',
  cursor: 'pointer',
  fontFamily: 'DM Sans, sans-serif',
};

const secondaryBtn = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  padding: '8px 16px',
  cursor: 'pointer',
  fontFamily: 'DM Sans, sans-serif',
};

const inputStyle = {
  width: '100%',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 10,
  padding: '9px 14px',
  fontSize: 13,
  color: 'var(--text-primary)',
  fontFamily: 'DM Sans, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const labelStyle = {
  fontSize: 12,
  color: 'var(--text-secondary)',
  marginBottom: 6,
  display: 'block',
  fontFamily: 'DM Sans, sans-serif',
  fontWeight: 500,
};

// ─── Data ────────────────────────────────────────────────────────────────────
const RECIPIENT_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'multiple', label: 'Multiple Selected' },
  { value: 'all', label: 'All Members' },
  { value: 'package', label: 'By Package' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'expiring', label: 'Expiring' },
  { value: 'former', label: 'Former Members' },
];

const COMM_TYPES = [
  { value: 'email', label: 'Email Only', icon: Mail },
  { value: 'sms', label: 'SMS Only', icon: MessageSquare },
  { value: 'email_sms', label: 'Email + SMS', icon: Mail },
  { value: 'notification', label: 'Notification', icon: Bell },
  { value: 'announcement', label: 'Announcement', icon: Megaphone },
];


const TYPE_FILTERS = ['All', 'Email', 'SMS', 'Notification', 'Announcement'];
const STATUS_FILTERS = ['All', 'Sent', 'Draft', 'Scheduled', 'Failed'];

function getStatusBadge(status) {
  const map = {
    Sent: { bg: 'var(--accent-green-dim)', color: 'var(--accent-green)' },
    Draft: { bg: 'var(--accent-yellow-dim)', color: 'var(--accent-yellow)' },
    Scheduled: { bg: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' },
    Failed: { bg: 'var(--accent-red-dim)', color: 'var(--accent-red)' },
  };
  const c = map[status] || { bg: 'rgba(90,90,106,0.15)', color: 'var(--text-muted)' };
  return (
    <span style={{ ...c, display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
      {status}
    </span>
  );
}

function getTypeBadge(type) {
  const map = {
    Email: { bg: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' },
    SMS: { bg: 'var(--accent-gold-dim)', color: 'var(--accent-gold)' },
    Notification: { bg: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' },
    Announcement: { bg: 'var(--accent-green-dim)', color: 'var(--accent-green)' },
  };
  const c = map[type] || { bg: 'rgba(90,90,106,0.15)', color: 'var(--text-muted)' };
  return (
    <span style={{ ...c, display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>
      {type}
    </span>
  );
}

function formatTypeLabel(commTypeValue) {
  const found = COMM_TYPES.find(ct => ct.value === commTypeValue);
  if (!found) return commTypeValue;
  // Normalize to a display-friendly key for the badge
  if (commTypeValue === 'email' || commTypeValue === 'email_sms') return 'Email';
  if (commTypeValue === 'sms') return 'SMS';
  if (commTypeValue === 'notification') return 'Notification';
  if (commTypeValue === 'announcement') return 'Announcement';
  return found.label;
}

function buildRecipientsSummary(recipientType, selectedMembers, selectedPackage) {
  if (recipientType === 'individual') {
    return selectedMembers.length > 0
      ? `Individual (${selectedMembers.length})`
      : 'Individual (0)';
  }
  if (recipientType === 'multiple') {
    return `Selected (${selectedMembers.length})`;
  }
  if (recipientType === 'all') return 'All Members';
  if (recipientType === 'package') return selectedPackage ? `Package: ${selectedPackage}` : 'By Package';
  if (recipientType === 'inactive') return 'Inactive Members';
  if (recipientType === 'expiring') return 'Expiring Members';
  if (recipientType === 'former') return 'Former Members';
  return recipientType;
}

function formatCurrentDate() {
  const d = new Date();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ActionBtn({ title, color, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: 'var(--text-muted)',
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = color; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function CommunicationPage() {
  const { t } = useLanguage();
  const [membersList, setMembersList] = useState([]);
  const [packagesList, setPackagesList] = useState([]);
  const [recipientType, setRecipientType] = useState('all');
  const [selectedPackage, setSelectedPackage] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [commType, setCommType] = useState('email');
  const [scheduleSend, setScheduleSend] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [history, setHistory] = useState([]);
  const [historyTypeFilter, setHistoryTypeFilter] = useState('All');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('All');
  const [viewItem, setViewItem] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    Promise.all([getMembers(), getPackages(), getCommunications()])
      .then(([mRes, pRes, cRes]) => {
        setMembersList(mRes.data || []);
        setPackagesList(pRes.data || []);
        setHistory((cRes.data || []).map(c => ({
          id: c.id,
          date: new Date(c.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          subject: c.subject,
          message: c.message,
          recipients: c.recipients || '',
          type: c.type || 'Email',
          status: c.status || 'Sent',
        })));
      })
      .catch(console.error);
  }, []);

  const showMemberSearch = recipientType === 'individual' || recipientType === 'multiple';

  const filteredMembers = memberSearch.trim().length > 0
    ? membersList.filter(m => {
        const full = `${m.firstName} ${m.lastName}`.toLowerCase();
        return full.includes(memberSearch.toLowerCase()) && !selectedMembers.find(s => s.id === m.id);
      })
    : [];

  const filteredHistory = history.filter(row => {
    const typeMatch = historyTypeFilter === 'All' || row.type === historyTypeFilter;
    const statusMatch = historyStatusFilter === 'All' || row.status === historyStatusFilter;
    return typeMatch && statusMatch;
  });

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function addMember(m) {
    setSelectedMembers(prev => {
      if (recipientType === 'individual') return [m];
      return [...prev, m];
    });
    setMemberSearch('');
    setShowDropdown(false);
  }

  function removeMember(id) {
    setSelectedMembers(prev => prev.filter(m => m.id !== id));
  }

  async function handleSend() {
    if (!subject.trim() || !message.trim()) return;
    const typeLabel = formatTypeLabel(commType);
    const recipientsSummary = buildRecipientsSummary(recipientType, selectedMembers, selectedPackage);
    try {
      const res = await createCommunication({ subject: subject.trim(), message: message.trim(), recipients: recipientsSummary, type: typeLabel, status: 'Sent' });
      const c = res.data;
      setHistory(prev => [{ id: c.id, date: formatCurrentDate(), subject: c.subject, message: c.message, recipients: c.recipients || recipientsSummary, type: c.type || typeLabel, status: c.status || 'Sent' }, ...prev]);
    } catch (err) { console.error(err); }
    setSubject(''); setMessage(''); setSelectedMembers([]); setSelectedPackage('');
    setScheduleSend(false); setScheduleDate(''); setScheduleTime('');
  }

  async function handleSchedule() {
    if (!subject.trim() || !message.trim() || !scheduleDate || !scheduleTime) return;
    const typeLabel = formatTypeLabel(commType);
    const recipientsSummary = buildRecipientsSummary(recipientType, selectedMembers, selectedPackage);
    try {
      const res = await createCommunication({ subject: subject.trim(), message: message.trim(), recipients: recipientsSummary, type: typeLabel, status: 'Scheduled' });
      const c = res.data;
      setHistory(prev => [{ id: c.id, date: formatCurrentDate(), subject: c.subject, message: c.message, recipients: c.recipients || recipientsSummary, type: c.type || typeLabel, status: c.status || 'Scheduled' }, ...prev]);
    } catch (err) { console.error(err); }
    setSubject(''); setMessage(''); setSelectedMembers([]); setSelectedPackage('');
    setScheduleSend(false); setScheduleDate(''); setScheduleTime('');
  }

  async function handleResend(row) {
    try {
      const res = await createCommunication({ subject: row.subject, message: row.message, recipients: row.recipients, type: row.type, status: 'Sent' });
      const c = res.data;
      setHistory(prev => [{ id: c.id, date: formatCurrentDate(), subject: c.subject, message: c.message, recipients: c.recipients || row.recipients, type: c.type || row.type, status: 'Sent' }, ...prev]);
    } catch (err) { console.error(err); }
  }

  async function handleDeleteHistory(id) {
    try { await removeCommunication(id); } catch (err) { console.error(err); }
    setHistory(prev => prev.filter(h => h.id !== id));
  }

  async function handleSaveDraft() {
    if (!subject.trim() && !message.trim()) return;
    const typeLabel = formatTypeLabel(commType);
    const recipientsSummary = buildRecipientsSummary(recipientType, selectedMembers, selectedPackage);
    try {
      const res = await createCommunication({ subject: subject.trim() || '(No Subject)', message: message.trim() || '', recipients: recipientsSummary, type: typeLabel, status: 'Draft' });
      const c = res.data;
      setHistory(prev => [{ id: c.id, date: formatCurrentDate(), subject: c.subject, message: c.message, recipients: c.recipients || recipientsSummary, type: c.type || typeLabel, status: 'Draft' }, ...prev]);
    } catch (err) { console.error(err); }
    setSubject(''); setMessage(''); setSelectedMembers([]); setSelectedPackage('');
    setScheduleSend(false); setScheduleDate(''); setScheduleTime('');
  }

  const thStyle = {
    padding: '10px 14px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    fontFamily: 'DM Sans, sans-serif',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border-subtle)',
    whiteSpace: 'nowrap',
  };

  const tdStyle = {
    padding: '12px 14px',
    fontSize: 12,
    color: 'var(--text-primary)',
    fontFamily: 'DM Sans, sans-serif',
    borderBottom: '1px solid var(--border-subtle)',
    verticalAlign: 'middle',
  };

  const filterPillStyle = (active) => ({
    padding: '4px 12px',
    borderRadius: 20,
    border: active ? '1px solid var(--accent-gold)' : '1px solid var(--border)',
    background: active ? 'var(--accent-gold-glow)' : 'var(--bg-elevated)',
    color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <PageHeader title={t('communication.title')} subtitle={t('communication.subtitle')} />

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── LEFT: Send Communication ─────────────────────────────────────── */}
        <div style={{ ...cardStyle, width: 560, flexShrink: 0, minWidth: 0 }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('communication.newCommunication')}
            </span>
          </div>
          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Recipient Type */}
            <div>
              <label style={labelStyle}>{t('communication.recipientType')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {RECIPIENT_TYPES.map(rt => {
                  const active = recipientType === rt.value;
                  const labelKey = { individual: 'individual', multiple: 'multipleSelected', all: 'allMembersRecip', package: 'byPackage', inactive: 'inactiveRecip', expiring: 'expiringRecip', former: 'formerMembers' }[rt.value] || rt.value;
                  return (
                    <button
                      key={rt.value}
                      onClick={() => { setRecipientType(rt.value); setSelectedMembers([]); setSelectedPackage(''); }}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 20,
                        border: active ? '1px solid var(--accent-gold)' : '1px solid var(--border)',
                        background: active ? 'var(--accent-gold-glow)' : 'var(--bg-elevated)',
                        color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
                        fontSize: 12,
                        fontWeight: active ? 600 : 400,
                        cursor: 'pointer',
                        fontFamily: 'DM Sans, sans-serif',
                        transition: 'all 0.15s',
                      }}
                    >
                      {t(`communication.${labelKey}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Package Selector */}
            {recipientType === 'package' && (
              <div>
                <label style={labelStyle}>{t('communication.selectPackage')}</label>
                <select
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  value={selectedPackage}
                  onChange={e => setSelectedPackage(e.target.value)}
                >
                  <option value="">{t('communication.choosePkg')}</option>
                  {packagesList.map(pkg => (
                    <option key={pkg.id} value={pkg.name}>{pkg.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Former Members info */}
            {recipientType === 'former' && (
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 12,
                color: 'var(--text-secondary)',
                fontFamily: 'DM Sans, sans-serif',
              }}>
                {t('communication.formerMembersInfo')}
              </div>
            )}

            {/* Member Search */}
            {showMemberSearch && (
              <div>
                <label style={labelStyle}>{t('communication.selectMembers')}</label>
                {/* Selected chips */}
                {selectedMembers.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {selectedMembers.map(m => (
                      <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
                        {m.firstName} {m.lastName}
                        <button onClick={() => removeMember(m.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                          <X size={12} strokeWidth={2.5} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ position: 'relative' }} ref={dropdownRef}>
                  <input
                    style={inputStyle}
                    placeholder={t('communication.searchMembersPlaceholder')}
                    value={memberSearch}
                    onChange={e => { setMemberSearch(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                  />
                  {showDropdown && filteredMembers.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
                      boxShadow: 'var(--shadow-elevated)', marginTop: 4, maxHeight: 200, overflowY: 'auto',
                    }}>
                      {filteredMembers.map(m => (
                        <div
                          key={m.id}
                          onClick={() => addMember(m)}
                          style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-subtle)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                            {m.firstName[0]}{m.lastName[0]}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{m.firstName} {m.lastName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.memberCode || m.id}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Subject */}
            <div>
              <label style={labelStyle}>{t('communication.subjectRequired')}</label>
              <input
                style={inputStyle}
                placeholder={t('communication.enterSubjectPlaceholder')}
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </div>

            {/* Message */}
            <div>
              <label style={labelStyle}>{t('communication.messageRequired')}</label>
              <textarea
                style={{ ...inputStyle, minHeight: 120, resize: 'vertical', lineHeight: 1.5 }}
                placeholder={t('communication.writeMessagePlaceholder')}
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>

            {/* Communication Type */}
            <div>
              <label style={labelStyle}>{t('communication.commType')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {COMM_TYPES.map(ct => {
                  const active = commType === ct.value;
                  const Icon = ct.icon;
                  const commLabelKey = { email: 'emailOnly', sms: 'smsOnly', email_sms: 'emailSms', notification: 'notificationLabel', announcement: 'announcementLabel' }[ct.value] || ct.value;
                  return (
                    <button
                      key={ct.value}
                      onClick={() => setCommType(ct.value)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        border: active ? '1px solid var(--accent-gold)' : '1px solid var(--border)',
                        background: active ? 'var(--accent-gold-glow)' : 'var(--bg-elevated)',
                        color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
                        fontSize: 12,
                        fontWeight: active ? 600 : 400,
                        cursor: 'pointer',
                        fontFamily: 'DM Sans, sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        transition: 'all 0.15s',
                      }}
                    >
                      <Icon size={12} strokeWidth={2} />
                      {t(`communication.${commLabelKey}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Schedule Send toggle */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setScheduleSend(p => !p)}>
                <div style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: scheduleSend ? 'var(--accent-gold)' : 'var(--border)',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute', top: 3, left: scheduleSend ? 21 : 3,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }} />
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} strokeWidth={2} color="var(--text-secondary)" />
                  {t('communication.scheduleSend')}
                </span>
              </div>
              {scheduleSend && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <div>
                    <label style={labelStyle}>{t('communication.scheduleDate')}</label>
                    <input type="date" style={inputStyle} value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('communication.scheduleTime')}</label>
                    <input type="time" style={inputStyle} value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
              <button style={primaryBtn} onClick={scheduleSend ? handleSchedule : handleSend}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {scheduleSend ? <Calendar size={13} strokeWidth={2} /> : <Send size={13} strokeWidth={2} />}
                  {scheduleSend ? t('communication.scheduleSend') : t('communication.sendNow')}
                </span>
              </button>
              <button style={secondaryBtn} onClick={handleSaveDraft}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={13} strokeWidth={2} /> {t('communication.saveDraft')}</span>
              </button>
              <button
                style={{ ...secondaryBtn, marginLeft: 'auto' }}
                onClick={() => { setSubject(''); setMessage(''); setSelectedMembers([]); setSelectedPackage(''); setScheduleSend(false); setScheduleDate(''); setScheduleTime(''); }}
              >
                {t('common.cancel')}
              </button>
            </div>

          </div>
        </div>

        {/* ── RIGHT: History ──────────────────────────────────────────────── */}
        <div style={{ ...cardStyle, flex: 1, minWidth: 0 }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('communication.history')}
            </span>
          </div>

          {/* Filter pills */}
          <div style={{ padding: '12px 22px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--border-subtle)' }}>
            {/* Row 1: Type filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif', marginRight: 4, minWidth: 40 }}>{t('communication.typeFilters')}</span>
              {TYPE_FILTERS.map(f => (
                <button key={f} style={filterPillStyle(historyTypeFilter === f)} onClick={() => setHistoryTypeFilter(f)}>
                  {f}
                </button>
              ))}
            </div>
            {/* Row 2: Status filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif', marginRight: 4, minWidth: 40 }}>{t('communication.statusFilters')}</span>
              {STATUS_FILTERS.map(f => (
                <button key={f} style={filterPillStyle(historyStatusFilter === f)} onClick={() => setHistoryStatusFilter(f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[t('communication.dateLabel'), t('communication.subject'), t('communication.recipients'), t('communication.typeLabel'), t('communication.statusLabel'), t('common.actions')].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map(row => (
                  <tr key={row.id} style={{ transition: 'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 11 }}>{row.date}</td>
                    <td style={{ ...tdStyle, maxWidth: 180 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.subject}</span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: 11 }}>{row.recipients}</td>
                    <td style={tdStyle}>{getTypeBadge(row.type)}</td>
                    <td style={tdStyle}>{getStatusBadge(row.status)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <ActionBtn title="View" color="var(--accent-blue)" onClick={() => setViewItem(row)}>
                          <Eye size={14} strokeWidth={2} />
                        </ActionBtn>
                        <ActionBtn title="Delete" color="var(--accent-red)" onClick={() => setConfirmDeleteId(row.id)}>
                          <Trash2 size={14} strokeWidth={2} />
                        </ActionBtn>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '24px 14px' }}>
                      {t('communication.noMatch')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => { handleDeleteHistory(confirmDeleteId); setConfirmDeleteId(null); }}
        title={t('communication.deleteTitle')}
        message={t('communication.deleteMessage')}
        confirmLabel={t('common.delete')}
        danger
      />

      {/* ── View Communication Modal ───────────────────────────────────────── */}
      {viewItem && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) setViewItem(null); }}
        >
          <div style={{
            ...cardStyle,
            width: '100%', maxWidth: 480,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            {/* Modal header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {t('communication.communicationDetails')}
              </span>
              <button
                onClick={() => setViewItem(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Subject */}
              <div>
                <span style={labelStyle}>{t('communication.subjectLabel')}</span>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif' }}>
                  {viewItem.subject}
                </p>
              </div>

              {/* Recipients */}
              <div>
                <span style={labelStyle}>{t('communication.recipientsLabel')}</span>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif' }}>
                  {viewItem.recipients}
                </p>
              </div>

              {/* Type & Status row */}
              <div style={{ display: 'flex', gap: 24 }}>
                <div>
                  <span style={labelStyle}>{t('communication.typeLabel')}</span>
                  <div>{getTypeBadge(viewItem.type)}</div>
                </div>
                <div>
                  <span style={labelStyle}>{t('communication.statusLabel')}</span>
                  <div>{getStatusBadge(viewItem.status)}</div>
                </div>
              </div>

              {/* Date */}
              <div>
                <span style={labelStyle}>{t('communication.dateLabel')}</span>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans, sans-serif' }}>
                  {viewItem.date}
                </p>
              </div>

              {/* Message */}
              <div>
                <span style={labelStyle}>{t('communication.messageLabel')}</span>
                <div style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: '14px 16px',
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  fontFamily: 'DM Sans, sans-serif',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                }}>
                  {viewItem.message || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('communication.noMessageContent')}</span>}
                </div>
              </div>

              {/* Actions */}
              <div style={{ paddingTop: 4, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button style={secondaryBtn} onClick={() => setViewItem(null)}>{t('common.close')}</button>
                <button style={primaryBtn} onClick={() => { handleResend(viewItem); setViewItem(null); }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {viewItem.status === 'Draft' ? <Send size={13} strokeWidth={2} /> : <RefreshCw size={13} strokeWidth={2} />}
                    {viewItem.status === 'Draft' ? t('communication.send') : t('communication.resend')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
