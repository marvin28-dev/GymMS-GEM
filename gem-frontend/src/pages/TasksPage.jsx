import { useLiveTick } from '../hooks/useLiveRefresh';
import { useState, useEffect } from 'react';
import { Plus, Check, Pencil, Trash2, Search, ClipboardList, X, Eye } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import FAB from '../components/FAB';
import { useLanguage } from '../contexts/LanguageContext';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import StatusBadge from '../components/ui/StatusBadge';
import RowMenu from '../components/ui/RowMenu';
import EmptyState from '../components/ui/EmptyState';
import { getAll as getTasks, create as createTask, update as updateTask, remove as removeTask } from '../services/tasks.service';
import { getAll as getStaff } from '../services/staff.service';
import { getRole, getAuth } from '../utils/auth';
import { notifyDataChanged } from '../utils/events';
import { TASK_CATEGORIES, categoryColor, categoryLabel, normalizeCategory } from '../utils/taskCategories';
import { assignFields, assignValue } from '../utils/departments';
import { taskNeedsAttention, taskOverdue } from '../utils/attention';
import { softAll } from '../utils/loadAll';
import { serverFieldError } from '../utils/formErrors';
import { gymCache } from '../utils/gymCache';
import { SkeletonCards } from '../components/Skeleton';
import TaskAssigneeField from '../components/TaskAssigneeField';


const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)' };
const primaryBtn = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans' };
const inputStyle = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none' };

const PRIORITY_COLORS = {
  High: { bg: 'var(--accent-red-dim)', color: 'var(--accent-red)' },
  Medium: { bg: 'var(--accent-yellow-dim)', color: 'var(--accent-yellow)' },
  Low: { bg: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' },
};

const emptyForm = { title: '', description: '', dueDate: '', assignedTo: '', priority: 'Medium', category: '', status: 'Pending' };

export default function TasksPage() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const role = getRole();
  const isFitnessRole = ['trainer', 'instructor', 'coach'].includes(role);
  const myId = getAuth()?.user?.id;
  // Show the last tasks at once and refresh quietly; a first-ever visit falls
  // back to the skeleton. See utils/gymCache.js.
  const cache = gymCache('tasks');
  const [tasks, setTasks]         = useState(() => cache.read('list', []));
  const [staffList, setStaffList] = useState(() => cache.read('staff', []));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteTask, setDeleteTask] = useState(null);
  const [viewTask, setViewTask] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [doneTask, setDoneTask] = useState(null);
  const [doneNote, setDoneNote] = useState('');
  const [actionError, setActionError] = useState('');

  const [loading, setLoading] = useState(() => !cache.has('list'));

  const liveTick = useLiveTick();
  useEffect(() => {
    softAll([getTasks(), getStaff()])
      .then(([tasksRes, staffRes]) => {
        setTasks(tasksRes.data || []);
        setStaffList(staffRes.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [liveTick]);

  useEffect(() => { cache.write('list', tasks); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tasks]);
  useEffect(() => { cache.write('staff', staffList); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [staffList]);

  // Changing what a task says, or removing it, belongs to whoever set it or to
  // management. A task the system raised belongs to management alone.
  const canEditTask = (task) => ['general_manager', 'manager'].includes(role)
    || (!task.createdBySystem && task.createdById != null && String(task.createdById) === String(myId));

  // On the task page, moving a task on is management's call alone - any task,
  // assigned to them or not. Nobody else changes a status here, not even the
  // person who raised the task. (Trainers/front desk report their own progress
  // from their profile's Tasks tab, not from this shared page.)
  const canCompleteTask = () => ['general_manager', 'manager'].includes(role);

  const filtered = tasks.filter(t => {
    const assignedName = typeof t.assignedTo === 'string' ? t.assignedTo : '';
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || assignedName.toLowerCase().includes(search.toLowerCase());
    const isOverdue = taskOverdue(t);
    const matchStatus = statusFilter === 'All'
      || (statusFilter === 'Overdue' ? isOverdue
        : statusFilter === 'Attention' ? taskNeedsAttention(t)
        : t.status === statusFilter);
    const matchPriority = priorityFilter === 'All' || t.priority === priorityFilter;
    // 'None' catches tasks raised before categories existed, or left blank
    const matchCategory = categoryFilter === 'All'
      || (categoryFilter === 'None' ? !t.category : normalizeCategory(t.category) === categoryFilter);
    return matchSearch && matchStatus && matchPriority && matchCategory;
  });

  const openAdd = () => {
    setForm(emptyForm);
    setEditingTask(null);
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (task) => {
    setForm({ ...task, category: normalizeCategory(task.category), assignedTo: assignValue(task), dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : '', notes: '' });
    setEditingTask(task);
    setErrors({});
    setShowModal(true);
  };

  const handleSave = async (another = false) => {
    const e = {};
    if (!form.title) e.title = t('tasks.titleRequired');
    if (!form.assignedTo) e.assignedTo = t('tasks.assigneeRequired');
    if (!form.dueDate) e.dueDate = t('tasks.dueDateRequired');
    if (!form.category) e.category = t('tasks.categoryRequired');
    if (Object.keys(e).length) { setErrors(e); return; }
    const payload = {
      title: form.title,
      description: form.description,
      dueDate: form.dueDate,
      ...assignFields(form.assignedTo),
      priority: form.priority,
      category: form.category || undefined,
      // Status is not set when raising a task. Only the assignee moves it on.
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
      notifyDataChanged();
      if (another) {
        setForm(emptyForm);
        setErrors({});
      } else {
        setShowModal(false);
      }
    } catch (err) {
      // The server's own reason, under its field when it names one
      const se = serverFieldError(err, t('tasks.saveFailed'));
      setErrors({ [se.field || '_form']: se.message });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkDone = (id) => {
    setDoneTask(tasks.find(t => t.id === id) || { id });
    setDoneNote('');
  };

  const handleConfirmDone = async () => {
    if (!doneTask) return;
    try {
      const res = await updateTask(doneTask.id, { status: 'Done', notes: doneNote.trim() || undefined });
      setTasks(prev => prev.map(t => t.id === doneTask.id ? (res.data || { ...t, status: 'Done', notes: doneNote.trim() }) : t));
      setActionError('');
    } catch (err) {
      setActionError(err.response?.data?.error || t('tasks.saveFailed'));
    }
    setDoneTask(null);
    setDoneNote('');
    notifyDataChanged();
  };

  // A calendar invite is answered yes/no by the person invited. An ordinary
  // task moves between Pending / In Progress / Done, which here is management's
  // call. "Done" still routes through the completion-note dialog.
  const isCalInvite = (tk) => !!tk && (!!tk.eventId || tk.category === 'Calendar');
  const canRespondInvite = (tk) => isCalInvite(tk) && tk.assignedToId != null && String(tk.assignedToId) === String(myId);
  const applyStatus = async (task, status) => {
    if (status === 'Done') { setViewTask(null); handleMarkDone(task.id); return; }
    try {
      const res = await updateTask(task.id, { status });
      setTasks(prev => prev.map(t => t.id === task.id ? (res.data || { ...t, status }) : t));
      setViewTask(prev => (prev && prev.id === task.id ? { ...prev, ...(res.data || { status }) } : prev));
      setActionError('');
    } catch (err) {
      setActionError(err.response?.data?.error || t('tasks.saveFailed'));
    }
    notifyDataChanged();
  };

  const handleDelete = async () => {
    try {
      await removeTask(deleteTask.id);
    } catch (err) {
      setActionError(err.response?.data?.error || t('tasks.deleteFailed'));
      setDeleteTask(null);
      return;
    }
    setActionError('');
    setTasks(prev => prev.filter(t => t.id !== deleteTask.id));
    setDeleteTask(null);
    notifyDataChanged();
  };

  const chipStyle = (active) => ({
    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans', border: 'none',
    background: active ? 'var(--accent-gold-dim)' : 'var(--bg-card)',
    color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
    borderWidth: 1, borderStyle: 'solid',
    borderColor: active ? 'var(--accent-gold)' : 'var(--border-subtle)',
  });

  const pendingCount = tasks.filter(t => t.status === 'Pending' || t.status === 'Overdue').length;

  // ── Mobile layout ────────────────────────────────────────────────────────────
  const errorBanner = actionError ? (
    <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13, fontFamily: 'DM Sans' }}>
      <span style={{ flex: 1, lineHeight: 1.45 }}>{actionError}</span>
      <button onClick={() => setActionError('')} aria-label={t('common.close')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, display: 'flex' }}>
        <X size={15} />
      </button>
    </div>
  ) : null;

  const sheetFieldStyle = (error) => ({
    width: '100%', background: 'var(--bg-elevated)', border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
    borderRadius: 10, padding: '10px 14px', fontSize: 16, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box',
  });

  // A row's eye opens this; edit, delete and mark-done all live inside it now.
  // Shared by the phone and desktop layouts so both behave the same.
  const viewModal = viewTask && (
    <Modal open={!!viewTask} onClose={() => setViewTask(null)} title={t('tasks.taskDetailsTitle')} maxWidth={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope' }}>{viewTask.title}</div>
            {viewTask.category && <div style={{ fontSize: 11, marginTop: 4, display: 'inline-block', padding: '2px 8px', borderRadius: 999, background: `${categoryColor(viewTask.category)}1f`, color: categoryColor(viewTask.category) }}>{categoryLabel(viewTask.category, t)}</div>}
          </div>
          <StatusBadge status={(viewTask.status || 'Pending').toLowerCase()} />
        </div>
        {viewTask.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{viewTask.description}</div>}
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: t('tasks.assignedTo'), value: viewTask.assignedTo || '-' },
            { label: t('tasks.dueDate'), value: viewTask.dueDate ? String(viewTask.dueDate).slice(0, 10) : '-' },
            { label: t('tasks.priority'), value: t(`tasks.priority${viewTask.priority}`) },
            { label: t('tasks.createdBy'), value: viewTask.createdBySystem ? t('tasks.createdBySystem') : (viewTask.createdBy || '-') },
          ].map(r => (
            <div key={r.label} style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{r.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.value}</div>
            </div>
          ))}
        </div>
        {/* Status control - the same three-way toggle as a profile's Tasks tab
            for an ordinary task, or Accept / Decline for a calendar invite. */}
        {isCalInvite(viewTask) ? (
          canRespondInvite(viewTask) && (
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('calendar.awaitingResponse')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['Accepted', t('calendar.accept'), 'var(--accent-green)', 'var(--accent-green-dim)'], ['Declined', t('calendar.decline'), 'var(--accent-red)', 'var(--accent-red-dim)']].map(([v, l, col, border]) => {
                  const active = (viewTask.status || 'Pending') === v;
                  return (
                    <button key={v} onClick={() => applyStatus(viewTask, v)}
                      style={{ flex: 1, cursor: 'pointer', borderRadius: 9, padding: '9px 10px', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans', background: active ? border : 'var(--bg-elevated)', border: `1px solid ${active ? col : 'var(--border-subtle)'}`, color: active ? col : 'var(--text-secondary)' }}>
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
          )
        ) : canCompleteTask(viewTask) && (
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('staff.updateStatus')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['Pending', t('tasks.statusPending')], ['In Progress', t('tasks.statusInProgress')], ['Done', t('tasks.statusDone')]].map(([v, l]) => {
                const active = (viewTask.status || 'Pending') === v;
                return (
                  <button key={v} onClick={() => applyStatus(viewTask, v)}
                    style={{ flex: 1, cursor: 'pointer', borderRadius: 9, padding: '9px 10px', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans', background: active ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)', border: `1px solid ${active ? 'rgba(201,169,110,0.45)' : 'var(--border-subtle)'}`, color: active ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
                    {l}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: 14, flexWrap: 'wrap' }}>
          {(() => {
            const actionBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38, padding: '0 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans', cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', transition: 'background 0.12s, border-color 0.12s' };
            return (
              <>
                {canEditTask(viewTask) && (
                  <button style={actionBtn} onClick={() => { const tk = viewTask; setViewTask(null); openEdit(tk); }}>
                    <Pencil size={14} />{t('common.edit')}
                  </button>
                )}
                {canEditTask(viewTask) && (
                  <button style={{ ...actionBtn, color: 'var(--accent-red)', borderColor: 'var(--accent-red-dim)', background: 'rgba(239,68,68,0.06)' }} onClick={() => { const tk = viewTask; setViewTask(null); setDeleteTask(tk); }}>
                    <Trash2 size={14} />{t('common.delete')}
                  </button>
                )}
                <button style={{ ...actionBtn, border: 'none', background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f' }} onClick={() => setViewTask(null)}>{t('common.close')}</button>
              </>
            );
          })()}
        </div>
      </div>
    </Modal>
  );

  // Mark as done, with its completion note: drawn by both layouts
  const doneModal = (
    <Modal open={!!doneTask} onClose={() => { setDoneTask(null); setDoneNote(''); }} title={t('tasks.markAsDone')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
          {t('tasks.markingComplete')} <strong style={{ color: 'var(--text-primary)' }}>{doneTask?.title}</strong> {t('tasks.asComplete')}
        </p>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('tasks.completionNotes')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t('common.optional')})</span></label>
          <textarea
            style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
            value={doneNote}
            onChange={e => setDoneNote(e.target.value)}
            placeholder={t('tasks.completionNotesPh')}
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
          <button style={secondaryBtn} onClick={() => { setDoneTask(null); setDoneNote(''); }}>{t('common.cancel')}</button>
          <button style={{ ...primaryBtn, background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff' }} onClick={handleConfirmDone}>
            <Check size={13} /> {t('tasks.markDone')}
          </button>
        </div>
      </div>
    </Modal>
  );

  if (isMobile) {
    const STATUS_CHIPS = [
      ['All', t('tasks.statusAll')],
      ['Attention', t('common.needsAttention')],
      ['Pending', t('tasks.statusPending')],
      ['In Progress', t('tasks.statusInProgress')],
      ['Done', t('tasks.statusDone')],
      ['Overdue', t('tasks.overdue')],
    ];
    return (
      <div style={{ minHeight: '100%' }}>
        <div style={{ padding: '16px 16px 10px' }}>
          <h1 style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t('nav.tasks')}</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0', fontFamily: 'DM Sans' }}>
            {pendingCount > 0 ? `${pendingCount} ${pendingCount !== 1 ? t('tasks.pendingTasksPlural') : t('tasks.pendingTasks')}` : t('tasks.totalTasks', { count: tasks.length })}
          </p>
        </div>

        {errorBanner && <div style={{ padding: '0 16px 10px' }}>{errorBanner}</div>}

        {/* Search */}
        <div style={{ padding: '0 16px 8px', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('tasks.searchTasks')}
            style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px 9px 34px', fontSize: 16, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Status chips */}
        <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {STATUS_CHIPS.map(([val, label]) => (
            <button key={val} onClick={() => setStatusFilter(val)} style={{ ...chipStyle(statusFilter === val), flexShrink: 0 }}>{label}</button>
          ))}
        </div>

        {/* Category */}
        <div style={{ padding: '0 16px 10px' }}>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: categoryFilter === 'All' ? 'var(--bg-elevated)' : 'var(--accent-gold-dim)',
              border: `1px solid ${categoryFilter === 'All' ? 'var(--border-subtle)' : 'rgba(201,169,110,0.45)'}`,
              color: categoryFilter === 'All' ? 'var(--text-secondary)' : 'var(--accent-gold)',
              borderRadius: 10, padding: '9px 12px', fontSize: 13,
              fontWeight: categoryFilter === 'All' ? 400 : 600,
              fontFamily: 'DM Sans', outline: 'none',
            }}
          >
            <option value="All">{t('tasks.allCategories')}</option>
            {TASK_CATEGORIES.map(c => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
            <option value="None">{t('tasks.noCategory')}</option>
          </select>
        </div>

        {/* Task list */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <SkeletonCards count={4} />
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>{t('tasks.noTasksFound')}</div>
          ) : filtered.map(task => {
            const isOverdue = taskOverdue(task);
            const isDone = task.status === 'Done';
            const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;
            return (
              <div key={task.id} style={{ background: 'var(--bg-card)', border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)'}`, borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {/* Done checkbox */}
                {(() => {
                  // A calendar invite is never "done" from here - it is answered
                  // in its detail view - so the tick is only for ordinary tasks.
                  const mine = canCompleteTask(task) && !isCalInvite(task);
                  return (
                    <button
                      onClick={() => !isDone && mine && handleMarkDone(task.id)}
                      disabled={isDone || !mine}
                      title={mine ? undefined : t('tasks.onlyAssigneeCanComplete')}
                      style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${isDone ? 'var(--accent-green)' : 'var(--border-subtle)'}`, background: isDone ? 'var(--accent-green)' : 'transparent', flexShrink: 0, cursor: isDone || !mine ? 'default' : 'pointer', opacity: !isDone && !mine ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}
                    >
                      {isDone && <Check size={11} strokeWidth={3} color="#0a0a0f" />}
                    </button>
                  );
                })()}

                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setViewTask(task)}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', fontFamily: 'DM Sans', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isDone ? 'line-through' : 'none' }}>
                    {task.title}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 20, background: pc.bg, color: pc.color, fontFamily: 'DM Sans' }}>{t(`tasks.priority${task.priority}`)}</span>
                    {task.category && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 20, background: `${categoryColor(task.category)}1f`, color: categoryColor(task.category), fontFamily: 'DM Sans' }}>{categoryLabel(task.category, t)}</span>
                    )}
                    {task.dueDate && (
                      <span style={{ fontSize: 11, color: isOverdue ? 'var(--accent-red)' : 'var(--text-muted)', fontFamily: 'DM Sans' }}>
                        {isOverdue ? `${t('tasks.overdue')} · ` : ''}{String(task.dueDate).slice(0, 10)}
                      </span>
                    )}
                    {task.assignedTo && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{task.assignedTo}</span>}
                  </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                  <RowMenu title={t('common.actions')} items={[
                    { label: t('common.viewDetails'), icon: <Eye size={15} />, onClick: () => setViewTask(task) },
                  ]} />
                </div>
              </div>
            );
          })}
        </div>

        {!isFitnessRole && <FAB onClick={openAdd} label="Add Task" />}

        {/* Reuse desktop modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '20px 20px 40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Manrope', color: 'var(--text-primary)' }}>{editingTask ? t('tasks.editTask') : t('tasks.addTask')}</span>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={18} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: t('tasks.titleLabel'), key: 'title', type: 'text', error: errors.title },
                  { label: t('tasks.dueDate'), key: 'dueDate', type: 'date', error: errors.dueDate },
                ].map(({ label, key, type, error }) => (
                  <div key={key}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontFamily: 'DM Sans' }}>{label}</label>
                    <input type={type} value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={sheetFieldStyle(error)} />
                    {error && <span style={{ fontSize: 11, color: 'var(--accent-red)' }}>{error}</span>}
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontFamily: 'DM Sans' }}>{t('tasks.priority')}</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[['High', t('tasks.priorityHigh')], ['Medium', t('tasks.priorityMedium')], ['Low', t('tasks.priorityLow')]].map(([val, label]) => <button key={val} onClick={() => setForm(f => ({ ...f, priority: val }))} style={{ ...chipStyle(form.priority === val), fontSize: 12 }}>{label}</button>)}
                  </div>
                </div>
                <div>
                  <TaskAssigneeField
                    value={form.assignedTo}
                    dueDate={form.dueDate}
                    onChange={v => { setForm(f => ({ ...f, assignedTo: v })); setErrors(er => ({ ...er, assignedTo: '' })); }}
                    staffList={staffList}
                    fieldStyle={sheetFieldStyle()}
                    labelStyle={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontFamily: 'DM Sans' }}
                    required
                  />
                  {errors.assignedTo && <span style={{ fontSize: 11, color: 'var(--accent-red)' }}>{errors.assignedTo}</span>}
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontFamily: 'DM Sans' }}>{t('tasks.category')} *</label>
                  <select
                    value={form.category}
                    onChange={e => { setForm(f => ({ ...f, category: e.target.value })); setErrors(er => ({ ...er, category: '' })); }}
                    style={sheetFieldStyle(errors.category)}
                  >
                    <option value="">{t('tasks.selectCategory')}</option>
                    {TASK_CATEGORIES.map(c => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
                  </select>
                  {errors.category && <span style={{ fontSize: 11, color: 'var(--accent-red)' }}>{errors.category}</span>}
                </div>
                {errors._form && <div role="alert" data-field-error style={{ fontSize: 12.5, color: 'var(--accent-red)', fontFamily: 'DM Sans', lineHeight: 1.5 }}>{errors._form}</div>}
                <button onClick={() => handleSave(false)} disabled={saving} style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', border: 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, color: '#0a0a0f', cursor: 'pointer', fontFamily: 'DM Sans', marginTop: 4 }}>
                  {saving ? t('tasks.savingTask') : editingTask ? t('common.saveChanges') : t('tasks.addTask')}
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmModal
          open={!!deleteTask}
          title={t('tasks.deleteTask')}
          message={`${t('tasks.deleteConfirm')} "${deleteTask?.title}"? ${t('tasks.cannotUndo')}`}
          onClose={() => setDeleteTask(null)}
          onConfirm={handleDelete}
          danger
        />
        {viewModal}
        {doneModal}
      </div>
    );
  }

  return (
    <div className="page-fade">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{t('tasks.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{pendingCount} {pendingCount !== 1 ? t('tasks.pendingTasksPlural') : t('tasks.pendingTasks')}</p>
        </div>
        {!isFitnessRole && <button style={primaryBtn} onClick={openAdd}><Plus size={13} />{t('tasks.addTask')}</button>}
      </div>

      {errorBanner && <div style={{ marginBottom: 16 }}>{errorBanner}</div>}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input style={{ ...inputStyle, paddingLeft: 36 }} placeholder={t('tasks.searchTasks')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['All', t('common.all')], ['Attention', t('common.needsAttention')], ['Pending', t('tasks.statusPending')], ['In Progress', t('tasks.statusInProgress')], ['Done', t('tasks.statusDone')], ['Overdue', t('tasks.overdue')]].map(([key, label]) => (
            <button key={key} style={chipStyle(statusFilter === key)} onClick={() => setStatusFilter(key)}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['All', t('common.all')], ['High', t('tasks.priorityHigh')], ['Medium', t('tasks.priorityMedium')], ['Low', t('tasks.priorityLow')]].map(([key, label]) => (
            <button key={key} style={chipStyle(priorityFilter === key)} onClick={() => setPriorityFilter(key)}>{label}</button>
          ))}
        </div>
        {/* A select rather than chips: eight categories would swamp the row */}
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{
            background: categoryFilter === 'All' ? 'var(--bg-card)' : 'var(--accent-gold-dim)',
            border: `1px solid ${categoryFilter === 'All' ? 'var(--border-subtle)' : 'rgba(201,169,110,0.45)'}`,
            color: categoryFilter === 'All' ? 'var(--text-secondary)' : 'var(--accent-gold)',
            borderRadius: 6, fontSize: 12, fontWeight: categoryFilter === 'All' ? 400 : 600,
            padding: '6px 10px', fontFamily: 'DM Sans', outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="All">{t('tasks.allCategories')}</option>
          {TASK_CATEGORIES.map(c => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
          <option value="None">{t('tasks.noCategory')}</option>
        </select>
      </div>

      {/* Table */}
      <div style={cardStyle}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('tasks.title')} ({filtered.length})</span>
        </div>
        {loading ? (
            <SkeletonCards count={4} />
          ) : filtered.length === 0 ? (
          <EmptyState icon={ClipboardList} title={t('tasks.noTasksFound')} message={t('tasks.noTasksMessage')} />
        ) : (
          <div className="gem-table-scroll"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                {[t('tasks.titleDescription'), t('tasks.assignedTo'), t('common.date'), t('tasks.priority'), t('common.status'), t('tasks.createdBy'), t('common.actions')].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => {
                const isOverdue = taskOverdue(task);
                const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;
                return (
                  <tr key={task.id} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{task.title}</span>
                        {task.category && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 999, whiteSpace: 'nowrap', background: `${categoryColor(task.category)}1f`, color: categoryColor(task.category) }}>
                            {categoryLabel(task.category, t)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.description}</div>
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-secondary)' }}>{task.assignedTo}</td>
                    <td style={{ padding: '12px 20px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: isOverdue ? 'var(--accent-red)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {task.dueDate ? String(task.dueDate).slice(0, 10) : '-'}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{ ...pc, fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, display: 'inline-block' }}>{t(`tasks.priority${task.priority}`)}</span>
                    </td>
                    <td style={{ padding: '12px 20px' }}><StatusBadge status={task.status.toLowerCase()} /></td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {task.createdBySystem ? t('tasks.createdBySystem') : task.createdBy}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <RowMenu title={t('common.actions')} items={[
                        { label: t('common.viewDetails'), icon: <Eye size={15} />, onClick: () => setViewTask(task) },
                      ]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
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
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('tasks.priority')}</label>
              <select style={inputStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {[['High', t('tasks.priorityHigh')], ['Medium', t('tasks.priorityMedium')], ['Low', t('tasks.priorityLow')]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <TaskAssigneeField
                value={form.assignedTo}
                dueDate={form.dueDate}
                onChange={v => { setForm(f => ({ ...f, assignedTo: v })); setErrors(er => ({ ...er, assignedTo: '' })); }}
                staffList={staffList}
                fieldStyle={inputStyle}
                labelStyle={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}
                required
              />
              {errors.assignedTo && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.assignedTo}</div>}
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{t('tasks.category')} *</label>
              <select
                style={{ ...inputStyle, borderColor: errors.category ? 'var(--accent-red)' : 'var(--border-subtle)' }}
                value={form.category}
                onChange={e => { setForm(f => ({ ...f, category: e.target.value })); setErrors(er => ({ ...er, category: '' })); }}
              >
                <option value="">{t('tasks.selectCategory')}</option>
                {TASK_CATEGORIES.map(c => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
              </select>
              {errors.category && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{errors.category}</div>}
            </div>
          </div>
          {errors._form && <div role="alert" data-field-error style={{ fontSize: 12.5, color: 'var(--accent-red)', fontFamily: 'DM Sans', lineHeight: 1.5 }}>{errors._form}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button style={secondaryBtn} onClick={() => setShowModal(false)} disabled={saving}>{t('common.cancel')}</button>
            {!editingTask && <button style={{ ...secondaryBtn, opacity: saving ? 0.6 : 1 }} onClick={() => handleSave(true)} disabled={saving}>{t('tasks.saveAndAddAnother')}</button>}
            <button style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }} onClick={() => handleSave(false)} disabled={saving}>{saving ? t('common.loading') : t('tasks.saveTask')}</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTask} onClose={() => setDeleteTask(null)} onConfirm={handleDelete}
        title={t('tasks.deleteTask')} message={`${t('tasks.deleteConfirm')} "${deleteTask?.title}"? ${t('tasks.cannotUndo')}`} confirmLabel={t('common.delete')} />

      {/* View task → then edit / delete / mark done from inside */}
      {viewModal}
      {doneModal}
    </div>
  );
}
