import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { DEPARTMENTS, departmentOfValue, jobOf } from '../utils/departments';
import BusyWarning from './BusyWarning';

const staffLabel = (s) => s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim();

// Who a task goes to: pick the department first, then either everyone in it
// or one particular person there. Two selects instead of one long flat list,
// so "assign to a group" reads as its own decision rather than an option
// buried among forty names.
// With a dueDate, a task given to one person warns when they already have
// something booked that day (a coach training clients, say). It never blocks.
export default function TaskAssigneeField({ value, onChange, staffList, fieldStyle, labelStyle, gap = 8, required = false, dueDate }) {
  const { t } = useLanguage();
  const active = (staffList || []).filter(s => s.isActive !== false);
  const star = required ? ' *' : '';

  const [deptId, setDeptId] = useState(() => departmentOfValue(value, active)?.id || '');
  // The value can change from outside (opening a different task to edit); the
  // department shown has to follow it rather than stick with whatever was
  // picked last time this field was open.
  useEffect(() => {
    const next = departmentOfValue(value, active)?.id || '';
    setDeptId(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const dept = DEPARTMENTS.find(d => d.id === deptId) || null;
  const peopleHere = dept ? active.filter(s => dept.roles.includes(jobOf(s.role))) : active;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      <div>
        <label style={labelStyle}>{t('tasks.department')}{star}</label>
        <select
          value={deptId}
          onChange={e => {
            const id = e.target.value;
            setDeptId(id);
            const next = DEPARTMENTS.find(d => d.id === id);
            // Choosing "no department" clears the field; choosing one with an
            // "everyone" option starts there, since that is usually the point
            // of picking a whole department rather than a person in it.
            onChange(next?.everyoneValue || '');
          }}
          style={fieldStyle}
        >
          <option value="">{t('tasks.anyDepartment')}</option>
          {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{t(d.labelKey)}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>{(dept ? t('tasks.whoInDept', { dept: t(dept.labelKey) }) : t('tasks.assignTo')) + star}</label>
        <select value={value || ''} onChange={e => onChange(e.target.value)} style={fieldStyle}>
          <option value="">{t('tasks.selectStaff')}</option>
          {dept?.everyoneValue && <option value={dept.everyoneValue}>{t('tasks.everyoneInDept', { dept: t(dept.labelKey) })}</option>}
          {peopleHere.map(s => <option key={s.id} value={s.id}>{staffLabel(s)}</option>)}
        </select>
      </div>
      {dueDate && value && !String(value).includes(':') && <BusyWarning staffIds={[value]} date={String(dueDate).slice(0, 10)} />}
    </div>
  );
}
