import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Eye, EyeOff, Plus, Banknote, TrendingUp, Calendar, Download, FileText, Lock, Edit2, Camera, IdCard } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import ManagerAuthModal from '../components/ui/ManagerAuthModal';
import GemInput from '../components/ui/GemInput';
import GemSelect from '../components/ui/GemSelect';
import { getOne as getStaffMember, getCode as getStaffCode, update as updateStaff, remove as removeStaff } from '../services/staff.service';
import { uploadPhoto } from '../services/upload.service';
import { getAuth } from '../utils/auth';
import { getAll as getTasks, create as createTask } from '../services/tasks.service';

const formatMoney = (n) => `${Math.round(n || 0).toLocaleString('fr-FR')} FCFA`;

function compressImage(dataUrl, maxW = 1000, maxH = 1000, quality = 0.82) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxW || height > maxH) {
        const ratio = Math.min(maxW / width, maxH / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)' };
const primaryBtn = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const dangerBtn = { background: 'var(--bg-card)', border: '1px solid var(--accent-red-dim)', color: 'var(--accent-red)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const inputStyle = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' };

const TABS = ['Details', 'Tasks Assigned', 'Schedule', 'Pay & Earnings', 'Notes'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PRIORITY_COLORS = {
  High:   { bg: 'var(--accent-red-dim)',    color: 'var(--accent-red)' },
  Medium: { bg: 'var(--accent-yellow-dim)', color: 'var(--accent-yellow)' },
  Low:    { bg: 'var(--accent-blue-dim)',   color: 'var(--accent-blue)' },
};
const PAY_RATES = { Manager: 350000, Trainer: 200000, Instructor: 180000, 'Front Desk': 150000, Receptionist: 140000, Other: 120000 };
const HOURLY_RATES = { Manager: 2200, Trainer: 1300, Instructor: 1100, 'Front Desk': 950, Receptionist: 875, Other: 750 };

const emptySchedule = DAYS.reduce((acc, d) => ({ ...acc, [d]: { start: '08:00', end: '17:00', off: false } }), {});

const MOCK_PAY_HISTORY = [];

const StatusPill = ({ status }) => {
  const map = { paid: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' }, issued: { bg: 'rgba(201,169,110,0.15)', color: '#c9a96e' }, draft: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' } };
  const s = map[status] || map.draft;
  return <span style={{ background: s.bg, color: s.color, fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600, textTransform: 'capitalize' }}>{status}</span>;
};

export default function StaffProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('Details');
  const [showCode, setShowCode] = useState(false);
  const [revealedCode, setRevealedCode] = useState(null);
  const [showCodeAuthModal, setShowCodeAuthModal] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);

  useEffect(() => {
    if (!revealedCode) return;
    const t = setTimeout(() => { setRevealedCode(null); setShowCode(false); }, 30000);
    return () => clearTimeout(t);
  }, [revealedCode]);

  const [memberData, setMemberData] = useState(() => {
    const ns = location.state?.newStaff;
    if (!ns) return null;
    return { ...ns, photoData: ns.photo || ns.photoData || null, photoIdData: ns.photoId || ns.photoIdData || null };
  });
  const [loadingStaff, setLoadingStaff] = useState(!location.state?.newStaff);
  const [loadError, setLoadError] = useState(null);

  // Notes
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteCategory, setNoteCategory] = useState('General');
  const [notes, setNotes] = useState([
    { id: 1, date: '2026-03-10', content: 'Excellent performance this quarter. Strong member feedback.', createdBy: 'Marvin Ekokobe', category: 'Performance' },
  ]);

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const profilePhotoRef = useRef(null);

  async function handleProfilePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const url = await uploadPhoto(file, 'gem/staff');
      await updateStaff(id, { photo: url });
      setMemberData(prev => ({ ...prev, photoData: url }));
      setShowPhotoModal(false);
    } catch (err) {
      console.error('Profile photo upload failed:', err);
    } finally {
      setPhotoUploading(false);
    }
  }

  // Edit profile
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const setEF = (k, v) => setEditForm(f => ({ ...f, [k]: v }));
  const editPhotoRef = useRef(null);
  const editPhotoIdRef = useRef(null);

  // Assign task
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'Medium', dueDate: '' });
  const [localTasks, setLocalTasks] = useState([]);

  // Send message
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [msgForm, setMsgForm] = useState({ subject: '', body: '' });
  const [messageSent, setMessageSent] = useState(false);

  // Deactivate
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  // Schedule
  const [schedule, setSchedule] = useState(emptySchedule);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const setDay = (day, field, value) => setSchedule(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));

  // Pay
  const [salary, setSalary] = useState(0);
  const [showSalaryEdit, setShowSalaryEdit] = useState(false);
  const [showSalaryAuthModal, setShowSalaryAuthModal] = useState(false);
  const [salaryInput, setSalaryInput] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [showPaystubView, setShowPaystubView] = useState(false);
  const [selectedPaystub, setSelectedPaystub] = useState(null);

  const [salaryConfigured, setSalaryConfigured] = useState(!location.state?.newStaff);
  const [scheduleConfigured, setScheduleConfigured] = useState(!location.state?.newStaff);

  const [paystubAllowances, setPaystubAllowances] = useState({});
  const [allowanceForm, setAllowanceForm] = useState({ label: '', amount: '' });
  const [showAddAllowanceInView, setShowAddAllowanceInView] = useState(false);

  const [paystubDeductions, setPaystubDeductions] = useState({});
  const [deductionForm, setDeductionForm] = useState({ label: '', amount: '', note: '' });
  const [showAddDeductionInView, setShowAddDeductionInView] = useState(false);

  useEffect(() => {
    if (location.state?.newStaff) return;
    setLoadError(null);
    getStaffMember(id)
      .then(res => {
        const s = res.data;
        setMemberData({
          ...s,
          name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.id,
          status: s.isActive !== false ? 'active' : 'inactive',
          joinDate: (s.joinDate || s.createdAt) ? new Date(s.joinDate || s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
          photoData: s.photo || null,
          photoIdData: s.photoId || null,
        });
        if (s.schedule && typeof s.schedule === 'object') {
          setSchedule({ ...emptySchedule, ...s.schedule });
        }
      })
      .catch(err => {
        console.error('Failed to load staff:', err);
        const status = err?.response?.status;
        if (status === 404) {
          setLoadError('not_found');
        } else {
          setLoadError('server_error');
        }
      })
      .finally(() => setLoadingStaff(false));
  }, [id]);


  useEffect(() => {
    if (!memberData) return;
    const staffDisplayName = `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim() || memberData.name || '';
    getTasks()
      .then(res => setLocalTasks((res.data || []).filter(t => t.assignedTo === staffDisplayName)))
      .catch(console.error);
  }, [memberData?.id]);

  if (loadingStaff) {
    return (
      <div className="page-fade" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading staff profile...</p>
      </div>
    );
  }

  if (!memberData) {
    const isServerError = loadError === 'server_error';
    return (
      <div className="page-fade" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
          {isServerError
            ? 'Could not load staff profile — server error.'
            : 'Staff member not found.'}
        </p>
        {isServerError && (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>
            Try restarting the backend server, then refresh this page.
          </p>
        )}
        <button style={{ ...secondaryBtn, marginTop: 8 }} onClick={() => navigate('/staff')}>← Back to Staff</button>
      </div>
    );
  }

  const isPartTime = memberData.employmentType === 'Part Time';
  const basicPay = isPartTime ? salary * 80 : salary;
  const payHistory = MOCK_PAY_HISTORY.map(p => ({ ...p, basicPay: basicPay }));

  const avatarColors = ['gold', 'blue', 'green', 'red', 'purple'];
  const avatarColor = memberData.avatarColor || avatarColors[0];
  const fn = memberData.firstName || (memberData.name || '').split(' ')[0] || '';
  const ln = memberData.lastName || (memberData.name || '').split(' ').slice(1).join(' ') || '';

  const openEdit = () => {
    setEditForm({
      ...memberData,
      // Ensure department always has a real value so the select doesn't silently hold ''
      department: memberData.department || 'Management',
    });
    setShowEditModal(true);
  };

  function handleEditPhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEF('photoFile', file);
    const reader = new FileReader();
    reader.onload = ev => setEF('photoData', ev.target.result);
    reader.readAsDataURL(file);
  }

  function handleEditPhotoIdChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEF('photoIdFile', file);
    const reader = new FileReader();
    reader.onload = ev => setEF('photoIdData', ev.target.result);
    reader.readAsDataURL(file);
  }

  const saveEdit = async () => {
    setEditSaving(true);
    setEditError('');
    const nameParts = (editForm.name || '').trim().split(' ');
    const apiFields = {
      firstName: nameParts[0] || editForm.firstName || '',
      lastName: nameParts.slice(1).join(' ') || editForm.lastName || '',
      email: editForm.email,
      phone: editForm.phone,
      role: editForm.role,
      department: editForm.department,
      shiftStart: editForm.shiftStart,
      avatarColor: editForm.avatarColor,
      isActive: editForm.status !== 'inactive',
      emergencyContact: editForm.emergencyContact,
      emergencyPhone: editForm.emergencyPhone,
    };
    // Upload photos to Cloudinary if new files were selected
    if (editForm.photoFile) {
      try { apiFields.photo = await uploadPhoto(editForm.photoFile, 'gem/staff'); } catch (err) { console.error('Profile photo upload failed:', err); }
    }
    if (editForm.photoIdFile) {
      try { apiFields.photoId = await uploadPhoto(editForm.photoIdFile, 'gem/staff/ids'); } catch (err) { console.error('ID photo upload failed:', err); }
    }
    try {
      const res = await updateStaff(id, apiFields);
      setMemberData(prev => ({
        ...prev,
        ...editForm,
        firstName: apiFields.firstName,
        lastName: apiFields.lastName,
        ...(res?.data || {}),
        ...(apiFields.photo ? { photoData: apiFields.photo } : {}),
        ...(apiFields.photoId ? { photoIdData: apiFields.photoId } : {}),
      }));
      setShowEditModal(false);
    } catch (err) {
      console.error('Staff update failed:', err);
      const msg = err?.response?.data?.error || err?.message || 'Save failed. Please try again.';
      setEditError(msg);
    } finally {
      setEditSaving(false);
    }
  };

  const saveTask = async () => {
    if (!taskForm.title || !taskForm.dueDate) return;
    try {
      const res = await createTask({
        title: taskForm.title,
        description: taskForm.description || undefined,
        priority: taskForm.priority.toLowerCase(),
        dueDate: new Date(taskForm.dueDate).toISOString(),
        assignedToId: id,
      });
      setLocalTasks(prev => [...prev, { id: res.data.id, ...taskForm, assignedTo: memberData?.name, status: 'Pending', createdBy: 'Staff' }]);
    } catch (err) { console.error('Task save failed:', err); }
    setTaskForm({ title: '', description: '', priority: 'Medium', dueDate: '' });
    setShowTaskModal(false);
  };

  const sendMessage = () => {
    if (!msgForm.body) return;
    setMessageSent(true);
    setTimeout(() => { setMessageSent(false); setShowMessageModal(false); setMsgForm({ subject: '', body: '' }); }, 1500);
  };

  const deactivate = async () => {
    try { await removeStaff(id); } catch (err) { console.error('Deactivate failed:', err); }
    setMemberData(prev => ({ ...prev, status: 'inactive', isActive: false }));
  };

  const saveSchedule = async () => {
    try {
      await updateStaff(id, { schedule });
      setScheduleSaved(true);
      setScheduleConfigured(true);
      setTimeout(() => setScheduleSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save schedule:', err);
    }
  };

  return (
    <div className="page-fade">
      {/* Back + Header */}
      <div style={{ marginBottom: 20 }}>
        <button style={{ ...secondaryBtn, marginBottom: 16 }} onClick={() => navigate('/staff')}>
          <ArrowLeft size={13} />Back to Staff
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{memberData.name}</h1>
            <StatusBadge status={memberData.status} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={secondaryBtn} onClick={openEdit}>Edit Profile</button>
            <button style={secondaryBtn} onClick={() => setShowTaskModal(true)}>Assign Task</button>
            <button style={secondaryBtn} onClick={() => setShowMessageModal(true)}>Send Message</button>
            {memberData.status !== 'inactive' && (
              <button style={dangerBtn} onClick={() => setShowDeactivateConfirm(true)}>Deactivate</button>
            )}
            {memberData.status === 'inactive' && (
              <button style={{ ...secondaryBtn, color: 'var(--accent-green)', borderColor: 'var(--accent-green-dim)' }} onClick={() => setMemberData(prev => ({ ...prev, status: 'active' }))}>Reactivate</button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <div style={{ ...cardStyle, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <input ref={profilePhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePhotoUpload} />
          {memberData.photoData ? (
            <img
              src={memberData.photoData}
              onClick={() => setShowPhotoModal(true)}
              style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, cursor: 'pointer', border: '2px solid var(--accent-gold)' }}
              alt={memberData.name}
              title="Click to view / change photo"
            />
          ) : (
            <button
              type="button"
              onClick={() => profilePhotoRef.current?.click()}
              title="Upload profile photo"
              style={{
                width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                border: '2px dashed var(--border)', background: 'var(--bg-elevated)',
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-gold)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <Camera size={18} color="var(--text-muted)" />
              <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'DM Sans', lineHeight: 1 }}>Photo</span>
            </button>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{memberData.name}</div>
            <div style={{ display: 'inline-block', background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, marginBottom: 12 }}>{memberData.role}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {[
                { label: 'Department', value: memberData.department || '—' },
                { label: 'Employment', value: memberData.employmentType || 'Full Time' },
                { label: 'Phone', value: memberData.phone },
                { label: 'Email', value: memberData.email },
              ].map(i => (
                <div key={i.label}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{i.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{i.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Setup Checklist */}
      {(() => {
        const checkItems = [
          { key: 'photo',     label: 'Profile Photo',       done: !!memberData.photoData,        onClick: openEdit },
          { key: 'photoId',   label: 'Photo ID',            done: !!memberData.photoIdData,      onClick: openEdit },
          { key: 'email',     label: 'Email',               done: !!memberData.email,            onClick: openEdit },
          { key: 'emergency', label: 'Emergency Contact',   done: !!memberData.emergencyContact, onClick: openEdit },
          { key: 'salary',    label: 'Salary',              done: salaryConfigured,              onClick: () => setActiveTab('Pay & Earnings') },
          { key: 'schedule',  label: 'Schedule',            done: scheduleConfigured,            onClick: () => setActiveTab('Schedule') },
        ];
        const doneCount = checkItems.filter(i => i.done).length;
        if (doneCount === checkItems.length) return null;
        return (
          <div style={{ ...cardStyle, padding: '14px 20px', marginBottom: 20, border: '1px solid var(--accent-gold-dim)', background: 'rgba(201,169,110,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>Profile Setup</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{doneCount}/{checkItems.length} complete</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {checkItems.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                    background: item.done ? 'rgba(34,197,94,0.1)' : 'var(--bg-elevated)',
                    border: `1px solid ${item.done ? 'rgba(34,197,94,0.3)' : 'var(--border-subtle)'}`,
                    color: item.done ? '#22c55e' : 'var(--text-secondary)',
                    fontSize: 12, fontFamily: 'DM Sans', fontWeight: item.done ? 500 : 400,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{item.done ? '✓' : '○'}</span>
                  {item.label}
                  {!item.done && <span style={{ color: 'var(--accent-gold)', fontSize: 10 }}>→</span>}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: 24 }}>
        <div style={{ display: 'flex' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '12px 20px', fontSize: 13, cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t ? 'var(--accent-gold)' : 'transparent'}`, color: activeTab === t ? 'var(--accent-gold)' : 'var(--text-muted)', fontWeight: activeTab === t ? 600 : 400, fontFamily: 'DM Sans', transition: 'color 0.15s' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Details ─────────────────────────────────────────────────────── */}
      {activeTab === 'Details' && (
        <div style={cardStyle}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Staff Details</span>
            <button style={secondaryBtn} onClick={openEdit}>Edit</button>
          </div>
          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {[
              { label: 'Full Name', value: memberData.name },
              { label: 'Role', value: memberData.role },
              { label: 'Department', value: memberData.department || '—' },
              { label: 'Phone', value: memberData.phone },
              { label: 'Email', value: memberData.email },
              { label: 'Join Date', value: memberData.joinDate },
              { label: 'Status', value: memberData.status },
              { label: 'Access Level', value: memberData.accessLevel || (memberData.role === 'Manager' ? 'Admin' : 'Staff') },
              { label: 'Emergency Contact', value: memberData.emergencyContact || '—' },
              { label: 'Emergency Phone', value: memberData.emergencyPhone || '—' },
            ].map(i => (
              <div key={i.label} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{i.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{i.value}</div>
              </div>
            ))}
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>4-Digit Access Code</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {revealedCode && showCode ? (
                  <>
                    <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 8, color: 'var(--accent-gold)' }}>
                      {revealedCode}
                    </span>
                    <button
                      onClick={() => { setShowCode(false); setRevealedCode(null); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 2 }}
                      title="Hide code"
                    >
                      <EyeOff size={14} />
                    </button>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>auto-hides in 30s</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 8, color: 'var(--text-muted)' }}>
                      ••••
                    </span>
                    <button
                      onClick={async () => {
                        const me = getAuth()?.user;
                        if (me && me.id === memberData.id) {
                          setCodeLoading(true);
                          try { const res = await getStaffCode(memberData.id); setRevealedCode(res.data.accessCode); setShowCode(true); }
                          catch { /* ignore */ } finally { setCodeLoading(false); }
                        } else {
                          setShowCodeAuthModal(true);
                        }
                      }}
                      disabled={codeLoading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: 'var(--accent-gold-dim)', border: 'none',
                        borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                        fontSize: 11, fontWeight: 600, color: 'var(--accent-gold)',
                        fontFamily: 'DM Sans',
                      }}
                    >
                      <Lock size={10} />
                      {codeLoading ? 'Loading…' : 'View Code'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Photo ID */}
          <div style={{ padding: '16px 24px 24px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>Photo ID</div>
            {memberData.photoIdData ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                borderRadius: 10, padding: '12px 16px', maxWidth: 340,
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--accent-gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IdCard size={20} color="var(--accent-gold)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>Identity Document</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Photo ID on file</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = memberData.photoIdData;
                    a.download = `${memberData.name.replace(/\s+/g, '_')}_PhotoID`;
                    a.click();
                  }}
                  style={{ ...secondaryBtn, padding: '6px 12px', gap: 4, flexShrink: 0 }}
                  title="Download Photo ID"
                >
                  <Download size={13} />
                  Download
                </button>
              </div>
            ) : (
              <button type="button" onClick={openEdit}
                style={{ fontSize: 12, color: 'var(--accent-gold)', background: 'var(--accent-gold-dim)', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600 }}>
                + Upload Photo ID
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Tasks Assigned ───────────────────────────────────────────────── */}
      {activeTab === 'Tasks Assigned' && (
        <div style={cardStyle}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Tasks Assigned to {memberData.name}</span>
            <button style={primaryBtn} onClick={() => setShowTaskModal(true)}><Plus size={13} />Assign Task</button>
          </div>
          {localTasks.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <ClipboardList size={36} color="var(--text-muted)" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>No tasks assigned</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>This staff member has no tasks assigned yet.</div>
              <button style={primaryBtn} onClick={() => setShowTaskModal(true)}><Plus size={13} />Assign First Task</button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Title', 'Due Date', 'Priority', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {localTasks.map(t => {
                  const pc = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.Medium;
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{t.title}</td>
                      <td style={{ padding: '12px 20px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>{t.dueDate}</td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ ...pc, fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4 }}>{t.priority}</span>
                      </td>
                      <td style={{ padding: '12px 20px' }}><StatusBadge status={t.status.toLowerCase()} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Schedule ─────────────────────────────────────────────────────── */}
      {activeTab === 'Schedule' && (
        <div style={cardStyle}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Weekly Schedule — {memberData.name}</span>
            <button style={primaryBtn} onClick={saveSchedule}>
              {scheduleSaved ? '✓ Saved!' : 'Save Schedule'}
            </button>
          </div>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {DAYS.map(day => (
              <div key={day} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr auto', gap: 16, alignItems: 'center', padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 10, opacity: schedule[day].off ? 0.5 : 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{day}</span>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Start</label>
                  <input type="time" value={schedule[day].start} disabled={schedule[day].off} onChange={e => setDay(day, 'start', e.target.value)} style={{ ...inputStyle, opacity: schedule[day].off ? 0.5 : 1 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>End</label>
                  <input type="time" value={schedule[day].end} disabled={schedule[day].off} onChange={e => setDay(day, 'end', e.target.value)} style={{ ...inputStyle, opacity: schedule[day].off ? 0.5 : 1 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18 }}>
                  <input type="checkbox" id={`off-${day}`} checked={schedule[day].off} onChange={e => setDay(day, 'off', e.target.checked)} style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--accent-gold)' }} />
                  <label htmlFor={`off-${day}`} style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Sans' }}>Day Off</label>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
              Working {DAYS.filter(d => !schedule[d].off).length} days/week
            </div>
          </div>
        </div>
      )}

      {/* ── Pay & Earnings ───────────────────────────────────────────────── */}
      {activeTab === 'Pay & Earnings' && (
        <div>
          {/* Pay summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>

            {/* Salary card — editable after manager auth */}
            <div style={{ ...cardStyle, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-gold-dim)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Banknote size={18} color="var(--accent-gold)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {showSalaryEdit ? (
                    <div>
                      <input type="number" value={salaryInput} onChange={e => setSalaryInput(e.target.value)}
                        style={{ ...inputStyle, padding: '6px 10px', fontSize: 14, marginBottom: 8 }} autoFocus />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{ ...primaryBtn, padding: '4px 12px', fontSize: 11 }}
                          onClick={() => { const v = Number(salaryInput); if (v > 0) { setSalary(v); setSalaryConfigured(true); } setShowSalaryEdit(false); }}>Save</button>
                        <button style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 11 }}
                          onClick={() => setShowSalaryEdit(false)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                        {formatMoney(salary)}{isPartTime ? <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 1 }}>/hr</span> : ''}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
                          {isPartTime ? 'Hourly Rate' : 'Monthly Basic Pay'}
                        </span>
                        <button type="button" onClick={() => setShowSalaryAuthModal(true)}
                          style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--accent-gold-dim)', border: 'none', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'DM Sans', letterSpacing: '0.02em' }}>
                          <Lock size={8} />{isPartTime ? 'Change Rate' : 'Change'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Remaining 2 cards */}
            {(isPartTime ? [
              { label: 'Est. Hours / Month', value: '80 hrs', icon: Calendar, color: 'var(--accent-green)', dim: 'var(--accent-green-dim)' },
              { label: 'Est. Monthly Earnings', value: formatMoney(salary * 80), icon: TrendingUp, color: 'var(--accent-blue)', dim: 'var(--accent-blue-dim)' },
            ] : (() => {
              const latestExtras = (paystubAllowances['Mar 2026'] || []).reduce((s, a) => s + a.amount, 0);
              const latestDeds = (paystubDeductions['Mar 2026'] || []).reduce((s, d) => s + d.amount, 0);
              return [
                { label: 'Bonuses & Extras', value: formatMoney(latestExtras), icon: TrendingUp, color: 'var(--accent-green)', dim: 'var(--accent-green-dim)' },
                { label: 'Est. Net Pay/Month', value: formatMoney(basicPay + latestExtras - latestDeds), icon: Calendar, color: 'var(--accent-blue)', dim: 'var(--accent-blue-dim)' },
              ];
            })()).map(c => (
              <div key={c.label} style={{ ...cardStyle, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: c.dim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <c.icon size={18} color={c.color} />
                </div>
                <div>
                  <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{c.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', marginTop: 2 }}>{c.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Pay history */}
          <div style={cardStyle}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Pay History</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click a row to view or download paystub</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Month', 'Basic Pay', 'Bonuses', 'Deductions', 'Net Pay', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'DM Sans' }}>
                      No pay records yet. Issue the first payslip to get started.
                    </td>
                  </tr>
                ) : payHistory.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => { setSelectedPaystub(p); setShowPaystubView(true); }}>
                    <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.month}</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-primary)' }}>{formatMoney(p.basicPay)}</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--accent-green)' }}>+{formatMoney(p.allowances)}</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--accent-red)' }}>-{formatMoney(p.deductions)}</td>
                    <td style={{ padding: '12px 20px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>{formatMoney(p.basicPay + p.allowances - p.deductions)}</td>
                    <td style={{ padding: '12px 20px' }}><StatusPill status={p.status} /></td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <button style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 11 }} onClick={e => { e.stopPropagation(); setSelectedPaystub(p); setShowPaystubView(true); }}>
                        <FileText size={12} />View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {payHistory.length > 0 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>YTD Earnings (2026):</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'Manrope, sans-serif' }}>
                  {formatMoney(payHistory.filter(p => p.month.includes('2026')).reduce((s, p) => s + p.basicPay + p.allowances - p.deductions, 0))}
                </span>
              </div>
            )}
          </div>

          {/* Pay Notes */}
          <div style={{ ...cardStyle, padding: 20, marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10, fontFamily: 'DM Sans' }}>Pay Notes</div>
            <textarea
              value={payNotes}
              onChange={e => setPayNotes(e.target.value)}
              placeholder={`Notes about ${memberData.name}'s pay — agreements, one-time adjustments, special conditions...`}
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      )}

      {/* ── Notes ────────────────────────────────────────────────────────── */}
      {activeTab === 'Notes' && (
        <div style={cardStyle}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Notes</span>
            <button style={primaryBtn} onClick={() => setShowNoteModal(true)}><Plus size={13} />Add Note</button>
          </div>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notes.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No notes yet. Add one above.</div>
            )}
            {notes.map(n => (
              <div key={n.id} style={{ ...cardStyle, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>{n.date}</span>
                    <span style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>{n.category}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>by {n.createdBy}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{n.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Edit Profile Modal ───────────────────────────────────────────── */}
      <Modal open={showEditModal} onClose={() => { setShowEditModal(false); setEditError(''); }} title="Edit Staff Profile" maxWidth={600}>
        {/* Profile photo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 20 }}>
          <input ref={editPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditPhotoChange} />
          <div
            onClick={() => editPhotoRef.current?.click()}
            style={{
              width: 80, height: 80, borderRadius: '50%',
              border: `2px dashed ${editForm.photoData ? 'var(--accent-gold)' : 'var(--border)'}`,
              background: 'var(--bg-elevated)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-gold)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = editForm.photoData ? 'var(--accent-gold)' : 'var(--border)'}
          >
            {editForm.photoData
              ? <img src={editForm.photoData} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Profile" />
              : <Camera size={28} color="var(--text-muted)" />
            }
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
            {editForm.photoData ? 'Click to change photo' : 'Upload profile photo'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <GemInput label="Full Name" value={editForm.name || ''} onChange={e => setEF('name', e.target.value)} />
          </div>
          <GemInput label="Phone" value={editForm.phone || ''} onChange={e => setEF('phone', e.target.value)} />
          <GemInput label="Email" value={editForm.email || ''} onChange={e => setEF('email', e.target.value)} />
          <GemSelect label="Role" value={editForm.role || ''} onChange={e => setEF('role', e.target.value)}
            options={['Manager','Trainer','Instructor','Front Desk','Receptionist','Other'].map(r => ({ value: r, label: r }))} />
          <GemSelect label="Department" value={editForm.department || ''} onChange={e => setEF('department', e.target.value)}
            options={['Management','Fitness','Operations','Other'].map(d => ({ value: d, label: d }))} />
          <GemSelect label="Status" value={editForm.status || 'active'} onChange={e => setEF('status', e.target.value)}
            options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
          <GemSelect label="Access Level" value={editForm.accessLevel || (editForm.role === 'Manager' ? 'Admin' : 'Staff')} onChange={e => setEF('accessLevel', e.target.value)}
            options={['Admin', 'Manager', 'Staff', 'Read Only'].map(a => ({ value: a, label: a }))} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <GemInput label="Emergency Contact Name" value={editForm.emergencyContact || ''} onChange={e => setEF('emergencyContact', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <GemInput label="Emergency Phone" value={editForm.emergencyPhone || ''} onChange={e => setEF('emergencyPhone', e.target.value)} />
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontFamily: 'DM Sans', fontWeight: 500 }}>Photo ID (passport, national ID, driver's license)</label>
            <input ref={editPhotoIdRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditPhotoIdChange} />
            <div
              onClick={() => editPhotoIdRef.current?.click()}
              style={{
                border: `2px dashed ${editForm.photoIdData ? 'var(--accent-gold)' : 'var(--border)'}`,
                borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
                background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 12,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-gold)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = editForm.photoIdData ? 'var(--accent-gold)' : 'var(--border)'}
            >
              {editForm.photoIdData ? (
                <>
                  <img src={editForm.photoIdData} style={{ width: 72, height: 46, objectFit: 'cover', borderRadius: 6 }} alt="ID" />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>Click to replace</span>
                </>
              ) : (
                <>
                  <div style={{ width: 48, height: 32, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IdCard size={16} color="var(--text-muted)" />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>Click to upload Photo ID</span>
                </>
              )}
            </div>
          </div>
        </div>
        {editError && (
          <div style={{ background: 'var(--accent-red-dim)', border: '1px solid var(--accent-red)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--accent-red)', fontFamily: 'DM Sans', marginTop: 12 }}>
            {editError}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button style={secondaryBtn} onClick={() => { setShowEditModal(false); setEditError(''); }} disabled={editSaving}>Cancel</button>
          <button style={{ ...primaryBtn, opacity: editSaving ? 0.6 : 1, cursor: editSaving ? 'not-allowed' : 'pointer' }} onClick={saveEdit} disabled={editSaving}>
            {editSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      {/* ── Assign Task Modal ────────────────────────────────────────────── */}
      <Modal open={showTaskModal} onClose={() => setShowTaskModal(false)} title={`Assign Task to ${memberData.name}`} maxWidth={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <GemInput label="Task Title *" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Clean equipment room" />
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontFamily: 'DM Sans', fontWeight: 500 }}>Description</label>
            <textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Task details..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <GemSelect label="Priority" value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
              options={['High','Medium','Low'].map(p => ({ value: p, label: p }))} />
            <GemInput label="Due Date *" type="date" value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={secondaryBtn} onClick={() => setShowTaskModal(false)}>Cancel</button>
            <button style={primaryBtn} onClick={saveTask}>Assign Task</button>
          </div>
        </div>
      </Modal>

      {/* ── Send Message Modal ───────────────────────────────────────────── */}
      <Modal open={showMessageModal} onClose={() => { setShowMessageModal(false); setMessageSent(false); }} title={`Send Message to ${memberData.name}`} maxWidth={480}>
        {messageSent ? (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 14, color: 'var(--accent-green)', fontWeight: 600 }}>Message sent!</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <GemInput label="Subject" value={msgForm.subject} onChange={e => setMsgForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Schedule update" />
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontFamily: 'DM Sans', fontWeight: 500 }}>Message *</label>
              <textarea value={msgForm.body} onChange={e => setMsgForm(f => ({ ...f, body: e.target.value }))} rows={5} style={{ ...inputStyle, resize: 'vertical' }} placeholder={`Hi ${(memberData.name || '').split(' ')[0] || 'there'}, ...`} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sending to: {memberData.email} · {memberData.phone}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={secondaryBtn} onClick={() => setShowMessageModal(false)}>Cancel</button>
              <button style={primaryBtn} onClick={sendMessage}>Send Message</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Paystub View Modal ───────────────────────────────────────────── */}
      <Modal open={showPaystubView} onClose={() => { setShowPaystubView(false); setShowAddDeductionInView(false); setShowAddAllowanceInView(false); setDeductionForm({ label: '', amount: '', note: '' }); setAllowanceForm({ label: '', amount: '' }); }} title="Pay Stub Details" maxWidth={620}>
        {selectedPaystub && (() => {
          const month = selectedPaystub.month;
          const deds = paystubDeductions[month] || [];
          const totalDeds = deds.reduce((s, d) => s + d.amount, 0);
          const allowanceItems = paystubAllowances[month] || [];
          const totalAllowances = allowanceItems.reduce((s, a) => s + a.amount, 0);
          const hoursWorked = isPartTime ? 80 : 160;
          const netPay = selectedPaystub.basicPay + totalAllowances - totalDeds;
          return (
            <div>
              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.12), rgba(201,169,110,0.04))', border: '1px solid var(--accent-gold-dim)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>{memberData.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{memberData.role}{memberData.department ? ` · ${memberData.department}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pay Period</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-gold)' }}>{month}</div>
                    <StatusPill status={selectedPaystub.status} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 14 }}>
                  {[
                    { label: 'Hours Worked', value: `${hoursWorked} hrs` },
                    { label: 'Hourly Rate', value: formatMoney(Math.round(selectedPaystub.basicPay / hoursWorked)) },
                    { label: 'Working Days', value: '20 days' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Earnings */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)' }}>Earnings & Bonuses</div>
                  <button style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 11 }} onClick={() => setShowAddAllowanceInView(v => !v)}>
                    <Plus size={11} />{showAddAllowanceInView ? 'Cancel' : 'Add Bonus'}
                  </button>
                </div>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{isPartTime ? 'Hours Worked Pay' : 'Basic Salary'}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{formatMoney(selectedPaystub.basicPay)}</span>
                  </div>
                  {allowanceItems.map(a => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, color: 'var(--accent-green)' }}>+{formatMoney(a.amount)}</span>
                        <button type="button" onClick={() => setPaystubAllowances(prev => ({ ...prev, [month]: prev[month].filter(x => x.id !== a.id) }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, padding: '2px 4px', borderRadius: 4 }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        >×</button>
                      </div>
                    </div>
                  ))}
                  {showAddAllowanceInView && (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(34,197,94,0.04)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8, marginBottom: 8 }}>
                        <input placeholder="Bonus / extra label *" value={allowanceForm.label} onChange={e => setAllowanceForm(f => ({ ...f, label: e.target.value }))} style={{ ...inputStyle, padding: '7px 10px', fontSize: 12 }} />
                        <input placeholder="Amount *" type="number" value={allowanceForm.amount} onChange={e => setAllowanceForm(f => ({ ...f, amount: e.target.value }))} style={{ ...inputStyle, padding: '7px 10px', fontSize: 12 }} />
                      </div>
                      <button style={{ ...primaryBtn, padding: '5px 14px', fontSize: 11 }} onClick={() => {
                        if (!allowanceForm.label || !allowanceForm.amount) return;
                        setPaystubAllowances(prev => ({
                          ...prev,
                          [month]: [...(prev[month] || []), { id: Date.now(), label: allowanceForm.label, amount: Number(allowanceForm.amount) }],
                        }));
                        setAllowanceForm({ label: '', amount: '' });
                        setShowAddAllowanceInView(false);
                      }}>Save Bonus</button>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(34,197,94,0.06)', borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Total Earnings</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)', fontFamily: 'Manrope, sans-serif' }}>{formatMoney(selectedPaystub.basicPay + totalAllowances)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)' }}>Deductions</div>
                  <button style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 11 }} onClick={() => setShowAddDeductionInView(v => !v)}>
                    <Plus size={11} />{showAddDeductionInView ? 'Cancel' : 'Add Deduction'}
                  </button>
                </div>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, overflow: 'hidden' }}>
                  {deds.length === 0 && !showAddDeductionInView && (
                    <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>No deductions this period</div>
                  )}
                  {deds.map(d => (
                    <div key={d.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{d.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Note: {d.note}</div>
                        </div>
                        <span style={{ fontSize: 13, color: 'var(--accent-red)', fontWeight: 600 }}>-{formatMoney(d.amount)}</span>
                      </div>
                    </div>
                  ))}
                  {showAddDeductionInView && (
                    <div style={{ padding: '12px 16px', borderTop: deds.length > 0 ? '1px solid var(--border-subtle)' : 'none', background: 'rgba(201,169,110,0.04)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8, marginBottom: 8 }}>
                        <input placeholder="Deduction label *" value={deductionForm.label} onChange={e => setDeductionForm(f => ({ ...f, label: e.target.value }))} style={{ ...inputStyle, padding: '7px 10px', fontSize: 12 }} />
                        <input placeholder="Amount *" type="number" value={deductionForm.amount} onChange={e => setDeductionForm(f => ({ ...f, amount: e.target.value }))} style={{ ...inputStyle, padding: '7px 10px', fontSize: 12 }} />
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <input placeholder="Note / reason (required) *" value={deductionForm.note} onChange={e => setDeductionForm(f => ({ ...f, note: e.target.value }))} style={{ ...inputStyle, padding: '7px 10px', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
                      </div>
                      <button style={{ ...primaryBtn, padding: '5px 14px', fontSize: 11 }} onClick={() => {
                        if (!deductionForm.label || !deductionForm.amount || !deductionForm.note) return;
                        setPaystubDeductions(prev => ({
                          ...prev,
                          [month]: [...(prev[month] || []), { id: Date.now(), label: deductionForm.label, amount: Number(deductionForm.amount), note: deductionForm.note }],
                        }));
                        setDeductionForm({ label: '', amount: '', note: '' });
                        setShowAddDeductionInView(false);
                      }}>
                        Save Deduction
                      </button>
                    </div>
                  )}
                  {totalDeds > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(239,68,68,0.06)', borderTop: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Total Deductions</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-red)', fontFamily: 'Manrope, sans-serif' }}>-{formatMoney(totalDeds)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Net Pay */}
              <div style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.15), rgba(201,169,110,0.05))', border: '1px solid var(--accent-gold-dim)', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Net Pay — {month}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: 'var(--accent-gold)' }}>{formatMoney(netPay)}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                  <div>{formatMoney(selectedPaystub.basicPay + totalAllowances)} earnings</div>
                  <div>− {formatMoney(totalDeds)} deductions</div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button style={secondaryBtn} onClick={() => { setShowPaystubView(false); setShowAddDeductionInView(false); setShowAddAllowanceInView(false); }}>Close</button>
                <button style={primaryBtn} onClick={() => {
                  const lines = [
                    `PAYSTUB — ${month}`,
                    `Employee: ${memberData.name}`,
                    `Role: ${memberData.role} (${isPartTime ? 'Part Time' : 'Full Time'})`,
                    `Hours Worked: ${hoursWorked} hrs`,
                    ``,
                    `EARNINGS & BONUSES`,
                    `Basic Pay: ${formatMoney(selectedPaystub.basicPay)}`,
                    ...allowanceItems.map(a => `${a.label}: +${formatMoney(a.amount)}`),
                    `Total Earnings: ${formatMoney(selectedPaystub.basicPay + totalAllowances)}`,
                    ``,
                    `DEDUCTIONS`,
                    ...deds.map(d => `${d.label}: -${formatMoney(d.amount)} (${d.note})`),
                    `Total Deductions: -${formatMoney(totalDeds)}`,
                    ``,
                    `NET PAY: ${formatMoney(netPay)}`,
                  ];
                  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Paystub_${memberData.name.replace(' ', '_')}_${month.replace(' ', '_')}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download size={13} />Download Paystub
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── View access code — requires manager PIN ─────────────────────── */}
      <ManagerAuthModal
        open={showCodeAuthModal}
        onClose={() => setShowCodeAuthModal(false)}
        onConfirm={async () => {
          setShowCodeAuthModal(false);
          setCodeLoading(true);
          try {
            const res = await getStaffCode(memberData.id);
            setRevealedCode(res.data.accessCode);
            setShowCode(true);
          } catch { /* ignore */ }
          finally { setCodeLoading(false); }
        }}
        action={`View access code for ${memberData.name}`}
      />

      {/* ── Salary change — requires manager PIN ────────────────────────── */}
      <ManagerAuthModal
        open={showSalaryAuthModal}
        onClose={() => setShowSalaryAuthModal(false)}
        onConfirm={() => { setSalaryInput(String(salary)); setShowSalaryEdit(true); setShowSalaryAuthModal(false); }}
        action={`Change ${memberData.name}'s ${isPartTime ? 'hourly rate' : 'salary'}`}
      />

      {/* ── Deactivate — requires manager PIN ────────────────────────────── */}
      <ManagerAuthModal
        open={showDeactivateConfirm}
        onClose={() => setShowDeactivateConfirm(false)}
        onConfirm={() => { deactivate(); setShowDeactivateConfirm(false); }}
        action={`Deactivate ${memberData.name}'s account`}
        danger
      />

      {/* ── Add Note Modal ────────────────────────────────────────────────── */}
      <Modal open={showNoteModal} onClose={() => setShowNoteModal(false)} title="Add Note" maxWidth={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Note *</label>
            <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Enter note..." />
          </div>
          <GemSelect label="Category" value={noteCategory} onChange={e => setNoteCategory(e.target.value)}
            options={['General','Performance','Health','Financial','Other'].map(c => ({ value: c, label: c }))} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={secondaryBtn} onClick={() => setShowNoteModal(false)}>Cancel</button>
            <button style={primaryBtn} onClick={() => {
              if (!noteText.trim()) return;
              setNotes(prev => [...prev, { id: Date.now(), date: '2026-03-24', content: noteText, createdBy: 'Marvin Ekokobe', category: noteCategory }]);
              setNoteText('');
              setNoteCategory('General');
              setShowNoteModal(false);
            }}>Save Note</button>
          </div>
        </div>
      </Modal>

      {/* ── Profile Photo Modal ──────────────────────────────────────────── */}
      {showPhotoModal && (
        <div
          onClick={() => setShowPhotoModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            zIndex: 2000, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <img
            src={memberData.photoData}
            alt={memberData.name}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '80vw', maxHeight: '72vh', borderRadius: 16, objectFit: 'contain', boxShadow: '0 32px 96px rgba(0,0,0,0.7)', marginBottom: 24 }}
          />
          <button
            onClick={e => { e.stopPropagation(); profilePhotoRef.current?.click(); }}
            style={{ ...primaryBtn, padding: '10px 24px', fontSize: 13, gap: 8 }}
          >
            <Camera size={14} />
            Upload New Photo
          </button>
          <button
            onClick={() => setShowPhotoModal(false)}
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
          >×</button>
        </div>
      )}
    </div>
  );
}
