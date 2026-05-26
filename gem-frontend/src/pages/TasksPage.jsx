import { useState, useEffect } from 'react';
import { Plus, Check, Pencil, Trash2, Search, ClipboardList } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import { getAll as getTasks, create as createTask, update as updateTask, remove as removeTask } from '../services/tasks.service';
import { getAll as getStaff } from '../services/staff.service';

const staffName = (s) => s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim();

const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)' };
const primaryBtn = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans' };
const inputStyle = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none' };

const PRIORITY_COLORS = {
  High: { bg: 'var(--accent-red-dim)', color: 'var(--accent-red)' },
  Medium: { bg: 'var(--accent-yellow-dim)', color: 'var(--accent-yellow)' },
  Low: { bg: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' },
};

const emptyForm = { title: '', description: '', dueDate: '', dueTime: '', assignedTo: '', priority: 'Medium', category: '', status: 'Pending', notes: '' };

export default function TasksPage() {
  const { t } = useLanguage();
  const [tasks, setTasks]         = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteTask, setDeleteTask] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [addAnother, setAddAnother] = useState(false);

  const today = new Date();

  useEffect(() => {
    Promise.all([getTasks(), getStaff()])
      .then(([tasksRes, staffRes]) => {
        setTasks(tasksRes.data || []);
        setStaffList(staffRes.data || []);
      })
      .catch(console.error);
  }, []);

  const filtered = tasks.filter(t => {
    const assignedName = typeof t.assignedTo === 'string' ? t.assignedTo : '';
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || assignedName.toLowerCase().includes(search.toLowerCase());
    const isOverdue = t.status !== 'Done' && t.dueDate && new Date(t.dueDate) < today;
    const matchStatus = statusFilter === 'All'
      || (statusFilter === 'Overdue' ? isOverdue : t.status === statusFilter);
    const matchPriority = priorityFilter === 'All' || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const openAdd = () => {
    setForm(emptyForm);
    setEditingTask(null);
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (task) => {
    const matchedStaff = staffList.find(s => staffName(s) === task.assignedTo);
    setForm({ ...task, assignedTo: matchedStaff?.id || '', dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : '', dueTime: task.dueTime || '', notes: '' });
    setEditingTask(task);
    setErrors({});
    setShowModal(true);
  };

  const handleSave = async (another = false) => {
    const e = {};
    if (!form.title) e.title = t('tasks.titleRequired');
    if (!form.dueDate) e.dueDate = t('tasks.dueDateRequired');
    if (Object.keys(e).length) { setErrors(e); return; }
    const payload = {
      title: form.title,
      description: form.description,
      dueDate: form.dueDate,
      dueTime: form.dueTime || null,
      assignedToId: form.assignedTo || undefined,
      priority: form.priority,
      status: form.status,
    };
    setSaving(true);
    try {
      if (editingTask) {
        const res = await updateTask(editingTask.id, payload);
        setTasks(prev => prev.map(t => t.id === editingTask.id ? res.data : t));
      } else {
        const res = await createTask(payload);
        setTasks(prev => [...prev, res.data]);
      }
      if (another) {
        setForm(emptyForm);
        setErrors({});
      } else {
        setShowModal(false);
      }
    } catch (err) {
      console.error(err);
      setErrors({ title: t('tasks.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkDone = async (id) => {
    try {
      const res = await updateTask(id, { status: 'Done' });
      setTasks(prev => prev.map(t => t.id === id ? res.data : t));
    } catch { setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'Done' } : t)); }
  };

  const handleDelete = async () => {
    try { await removeTask(deleteTask.id); } catch {}
    setTasks(prev => prev.filter(t => t.id !== deleteTask.id));
    setDeleteTask(null);
  };

  const chipStyle = (active) => ({
    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans', border: 'none',
    background: active ? 'var(--accent-gold-dim)' : 'var(--bg-card)',
    color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
    borderWidth: 1, borderStyle: 'solid',
    borderColor: active ? 'var(--accent-gold)' : 'var(--border-subtle)',
  });

  const pendingCount = tasks.filter(t => t.status === 'Pending' || t.status === 'Overdue').length;

  return (
    <div className="page-fade">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{t('tasks.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{pendingCount} {pendingCount !== 1 ? t('tasks.pendingTasksPlural') : t('tasks.pendingTasks')}</p>
        </div>
        <button style={primaryBtn} onClick={openAdd}><Plus size={13} />{t('tasks.addTask')}</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input style={{ ...inputStyle, paddingLeft: 36 }} placeholder={t('tasks.searchTasks')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['All', t('common.all')], ['Pending', t('tasks.statusPending')], ['In Progress', t('tasks.statusInProgress')], ['Done', t('tasks.statusDone')], ['Overdue', t('tasks.overdue')]].map(([key, label]) => (
            <button key={key} style={chipStyle(statusFilter === key)} onClick={() => setStatusFilter(key)}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['All', t('common.all')], ['High', t('tasks.priorityHigh')], ['Medium', t('tasks.priorityMedium')], ['Low', t('tasks.priorityLow')]].map(([key, label]) => (
            <button key={key} style={chipStyle(priorityFilter === key)} onClick={() => setPriorityFilter(key)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={cardStyle}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('tasks.title')} ({filtered.length})</span>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={ClipboardList} title={t('tasks.noTasksFound')} message={t('tasks.noTasksMessage')} />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                {[t('tasks.titleDescription'), t('tasks.assignedTo'), t('common.date'), t('tasks.priority'), t('common.status'), t('tasks.createdBy'), t('common.actions')].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => {
                const isOverdue = task.status !== 'Done' && new Date(task.dueDate) < today;
                const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;
                return (
                  <tr key={task.id} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{task.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.description}</div>
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-secondary)' }}>{task.assignedTo}</td>
                    <td style={{ padding: '12px 20px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: isOverdue ? 'var(--accent-red)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {task.dueDate ? String(task.dueDate).slice(0, 10) : '—'}
                      {task.dueTime ? <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>{task.dueTime}</span> : null}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{ ...pc, fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, display: 'inline-block' }}>{task.priority}</span>
                    </td>
                    <td style={{ padding: '12px 20px' }}><StatusBadge status={task.status.toLowerCase()} /></td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-muted)' }}>{task.createdBy}</td>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {task.status !== 'Done' && (
                          <button title={t('tasks.markDone')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4 }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-green)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                            onClick={() => handleMarkDone(task.id)}>
                            <Check size={14} />
                          </button>
                        )}
                        <button title={t('common.edit')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4 }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-gold)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                          onClick={() => openEdit(task)}>
                          <Pencil size={14} />
                        </button>
                        <button title={t('common.delete')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4 }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                          onClick={() => setDeleteTask(task)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingTask ? t('tasks.editTask') : t('tasks.addTask')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('tasks.titleLabel')}</label>
            <input style={{ ...inputStyle, borderColor: errors.title ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t('tasks.taskTitlePlaceholder')} />
            {errors.title && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.title}</div>}
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('tasks.descriptionLabel')}</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t('tasks.taskDescriptionPlaceholder')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('tasks.dueDate')}</label>
              <input type="date" style={{ ...inputStyle, borderColor: errors.dueDate ? 'var(--accent-red)' : 'var(--border-subtle)' }} value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              {errors.dueDate && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.dueDate}</div>}
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('tasks.dueTime')}</label>
              <input
                type="time"
                style={inputStyle}
                value={form.dueTime || ''}
                onChange={e => setForm(f => ({ ...f, dueTime: e.target.value || '' }))}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('tasks.assignTo')}</label>
              <select style={inputStyle} value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}>
                <option value="">{t('tasks.selectStaff')}</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{staffName(s)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('tasks.priority')}</label>
              <select style={inputStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {[['High', t('tasks.priorityHigh')], ['Medium', t('tasks.priorityMedium')], ['Low', t('tasks.priorityLow')]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('tasks.statusLabel')}</label>
              <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {[['Pending', t('tasks.statusPending')], ['In Progress', t('tasks.statusInProgress')], ['Done', t('tasks.statusDone')], ['Overdue', t('tasks.overdue')]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('tasks.category')}</label>
              <input style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder={t('tasks.categoryPlaceholder')} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('tasks.notesLabel')}</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('tasks.notesPlaceholder')} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button style={secondaryBtn} onClick={() => setShowModal(false)} disabled={saving}>{t('common.cancel')}</button>
            {!editingTask && <button style={{ ...secondaryBtn, opacity: saving ? 0.6 : 1 }} onClick={() => handleSave(true)} disabled={saving}>{t('tasks.saveAndAddAnother')}</button>}
            <button style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }} onClick={() => handleSave(false)} disabled={saving}>{saving ? t('common.loading') : t('tasks.saveTask')}</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTask} onClose={() => setDeleteTask(null)} onConfirm={handleDelete}
        title={t('tasks.deleteTask')} message={`${t('tasks.deleteConfirm')} "${deleteTask?.title}"? ${t('tasks.cannotUndo')}`} confirmLabel={t('common.delete')} />
    </div>
  );
}
