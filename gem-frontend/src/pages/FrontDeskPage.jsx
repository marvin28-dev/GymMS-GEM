import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Search, X, UserCheck, ChevronLeft, ChevronRight, MessageSquare,
  AlertTriangle, CheckCircle, AlertCircle, Clock, LogOut, ArrowLeft,
  ShoppingCart, Plus, Minus, Trash2, Phone, Mail,
  CreditCard, Wrench, FileText, Scan, Download, UserPlus, TrendingUp, Receipt, QrCode,
} from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import { AddMemberModal, AddVisitorModal } from './MembersPage';
import MemberProfilePage from './MemberProfilePage';
import { getAll as getMembers } from '../services/members.service';
import { getAll as getStaff } from '../services/staff.service';
import { getAll as getPackages } from '../services/packages.service';
import { getAll as getProducts } from '../services/products.service';
import { getAll as getCalendar } from '../services/calendar.service';
import { getAll as getAttendance, checkIn as checkInApi } from '../services/attendance.service';
import { getMyGym } from '../services/gym.service';
import { create as createSale } from '../services/sales.service';
import { getAll as getEquipmentIssues, create as createEquipmentIssue } from '../services/equipment.service';

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatMoney = (v) => `${Number(v || 0).toLocaleString('fr-FR')} FCFA`;
const staffFullName = (s) => s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim();

// ─── Styles ────────────────────────────────────────────────────────────────────
const primaryBtn  = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, padding: '10px 20px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, fontSize: 13, fontWeight: 600, padding: '10px 20px', cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 6 };
const inputStyle   = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' };
const labelStyle   = { fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, fontFamily: 'DM Sans' };


// ─── Mock shop products ────────────────────────────────────────────────────────
const PRODUCTS = [
  { id: 1, name: 'Water 500ml',     category: 'Beverages',    price: 500   },
  { id: 2, name: 'Protein Shake',   category: 'Beverages',    price: 3500  },
  { id: 3, name: 'Energy Bar',      category: 'Nutrition',    price: 1500  },
  { id: 4, name: 'Sports Drink',    category: 'Beverages',    price: 2000  },
  { id: 5, name: 'Whey Protein 1kg',category: 'Supplements',  price: 35000 },
  { id: 6, name: 'BCAA Mix',        category: 'Supplements',  price: 12000 },
  { id: 7, name: 'Pre-Workout',     category: 'Supplements',  price: 15000 },
  { id: 8, name: 'Creatine 500g',   category: 'Supplements',  price: 20000 },
  { id: 9, name: 'Workout Gloves',  category: 'Gear',         price: 12000 },
  { id:10, name: 'Resistance Band', category: 'Gear',         price: 7500  },
  { id:11, name: 'Sports Towel',    category: 'Accessories',  price: 4500  },
  { id:12, name: 'Gym Bag',         category: 'Accessories',  price: 28000 },
];
const PRODUCT_CATS = ['All', 'Beverages', 'Nutrition', 'Supplements', 'Gear', 'Accessories'];

const TIME_FILTERS = [
  { label: 'Today',     maxMinutes: 1440 },
  { label: 'Last hour', maxMinutes: 60   },
  { label: 'Last 24h',  maxMinutes: 1440 },
  { label: 'Last 48h',  maxMinutes: 2880 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['gold','blue','green','purple','red'];
const hashStr = (s) => { let h = 0; for (const c of String(s || '')) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0; return Math.abs(h); };
const staffColor = (s) => s.avatarColor || AVATAR_COLORS[hashStr(s.id || s.name || '') % AVATAR_COLORS.length];
const addDays = (d, n) => { const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0,10); };
const getWeekDays = (d) => {
  const dt = new Date(d + 'T00:00:00');
  const diff = dt.getDay() === 0 ? -6 : 1 - dt.getDay();
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(dt); dd.setDate(dt.getDate() + diff + i); return dd.toISOString().slice(0,10); });
};

// ─── Schedule panel (left column) ─────────────────────────────────────────────
function SchedulePanel({ events = [] }) {
  const { t, lang } = useLanguage();
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const todayStr = new Date().toISOString().slice(0,10);
  const [view, setView]   = useState('day');
  const [sel,  setSel]    = useState(todayStr);
  const [moCursor, setMoCursor] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });

  const dayEvents = events.filter(e => e.date === sel).sort((a,b) => a.start.localeCompare(b.start));
  const weekDays  = getWeekDays(sel);

  const fmtDayLabel = (d) => {
    if (d === todayStr) return t('common.today');
    return new Date(d + 'T00:00:00').toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Month calendar data
  const firstDay    = new Date(moCursor.year, moCursor.month, 1).getDay();
  const daysInMonth = new Date(moCursor.year, moCursor.month + 1, 0).getDate();
  const moCells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1);
  const moName  = new Date(moCursor.year, moCursor.month).toLocaleString(locale, { month: 'short', year: 'numeric' });
  const toDateStr = (d) => `${moCursor.year}-${String(moCursor.month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('frontDesk.program')}</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {['day','week','month'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ background: view === v ? 'var(--accent-gold)' : 'var(--bg-elevated)', color: view === v ? '#0a0a0f' : 'var(--text-muted)', border: 'none', borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans', transition: 'all 0.1s' }}>
              {v[0].toUpperCase() + v.slice(1,3)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Day view ── */}
      {view === 'day' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button onClick={() => setSel(addDays(sel,-1))} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:2 }}><ChevronLeft size={13}/></button>
            <span style={{ fontSize: 11, fontWeight: 600, color: sel === todayStr ? 'var(--accent-gold)' : 'var(--text-primary)', fontFamily: 'DM Sans' }}>{fmtDayLabel(sel)}</span>
            <button onClick={() => setSel(addDays(sel, 1))} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:2 }}><ChevronRight size={13}/></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 260, overflowY: 'auto' }}>
            {dayEvents.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', textAlign: 'center', padding: '20px 0' }}>{t('frontDesk.noClassesScheduled')}</div>
            ) : dayEvents.map(e => (
              <div key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'DM Sans', width: 34, flexShrink: 0, paddingTop: 1 }}>{e.start}</span>
                <div style={{ borderLeft: `2px solid ${e.color}`, paddingLeft: 7, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans', lineHeight: 1.2 }}>{e.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{e.instructor}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Week view ── */}
      {view === 'week' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button onClick={() => setSel(addDays(weekDays[0],-1))} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:2 }}><ChevronLeft size={13}/></button>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
              {new Date(weekDays[0]+'T00:00:00').toLocaleDateString(locale,{month:'short',day:'numeric'})} – {new Date(weekDays[6]+'T00:00:00').toLocaleDateString(locale,{month:'short',day:'numeric'})}
            </span>
            <button onClick={() => setSel(addDays(weekDays[6], 1))} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:2 }}><ChevronRight size={13}/></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {['M','T','W','T','F','S','S'].map((l,i) => (
              <div key={i} style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 3 }}>{l}</div>
            ))}
            {weekDays.map(d => {
              const isToday = d === todayStr;
              const isSel   = d === sel;
              const evts    = events.filter(e => e.date === d);
              return (
                <div key={d} onClick={() => { setSel(d); setView('day'); }} style={{ cursor: 'pointer', borderRadius: 6, padding: '4px 2px', textAlign: 'center', border: `1px solid ${isToday ? 'var(--accent-gold)' : isSel ? 'var(--accent-gold-dim)' : 'transparent'}`, background: isSel ? 'var(--accent-gold-dim)' : 'transparent' }}>
                  <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>{new Date(d+'T00:00:00').getDate()}</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 1, marginTop: 2, minHeight: 6, flexWrap: 'wrap' }}>
                    {evts.slice(0,3).map((e,j) => <div key={j} style={{ width: 4, height: 4, borderRadius: '50%', background: e.color }}/>)}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans', textAlign: 'center' }}>{t('frontDesk.tapDayToView')}</div>
        </div>
      )}

      {/* ── Month view ── */}
      {view === 'month' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button onClick={() => setMoCursor(c => { const d = new Date(c.year, c.month-1); return {year:d.getFullYear(),month:d.getMonth()}; })} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:2 }}><ChevronLeft size={13}/></button>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope' }}>{moName}</span>
            <button onClick={() => setMoCursor(c => { const d = new Date(c.year, c.month+1); return {year:d.getFullYear(),month:d.getMonth()}; })} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:2 }}><ChevronRight size={13}/></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, textAlign: 'center' }}>
            {['S','M','T','W','T','F','S'].map((l,i) => <div key={i} style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', padding: '2px 0' }}>{l}</div>)}
            {moCells.map((d,i) => {
              const dStr    = d ? toDateStr(d) : null;
              const isToday = dStr === todayStr;
              const isSel   = dStr === sel;
              const evts    = dStr ? events.filter(e => e.date === dStr) : [];
              return (
                <div key={i} onClick={() => { if (dStr) { setSel(dStr); setView('day'); } }} style={{ cursor: d ? 'pointer' : 'default', borderRadius: 4, padding: '3px 1px', background: isToday ? 'var(--accent-gold)' : isSel ? 'var(--accent-gold-dim)' : 'transparent' }}>
                  <div style={{ fontSize: 10, fontWeight: isToday ? 700 : 400, color: isToday ? '#0a0a0f' : d ? 'var(--text-secondary)' : 'transparent' }}>{d || ''}</div>
                  {d && evts.length > 0 && <div style={{ display: 'flex', justifyContent: 'center', gap: 1, marginTop: 1 }}>{evts.slice(0,2).map((e,j) => <div key={j} style={{ width: 3, height: 3, borderRadius: '50%', background: isToday ? '#0a0a0f' : e.color }}/>)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Status dot (check-in list) ────────────────────────────────────────────────
function StatusDot({ member }) {
  if (!member) return null;
  if (['expired','suspended','deactivated','pending'].includes(member.status)) return <AlertCircle size={13} color="var(--accent-red)"/>;
  if (member.status === 'expiring' || member.balance > 0) return <AlertTriangle size={13} color="var(--accent-yellow)"/>;
  return <CheckCircle size={13} color="var(--accent-green)"/>;
}

// ─── Login PIN pad ────────────────────────────────────────────────────────────
function LoginPinPad({ onDigit, onBack, onConfirm, confirmEnabled }) {
  const base = { height: 52, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'Manrope', transition: 'all 0.1s' };
  const hover = (e, on) => { e.currentTarget.style.background = on ? 'var(--bg-card-hover)' : 'var(--bg-elevated)'; e.currentTarget.style.borderColor = on ? 'var(--accent-gold)' : 'var(--border-subtle)'; };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {[1,2,3,4,5,6,7,8,9].map(n => (
        <button key={n} style={base} onClick={() => onDigit(String(n))} onMouseEnter={e=>hover(e,true)} onMouseLeave={e=>hover(e,false)}>{n}</button>
      ))}
      <button style={{...base,fontSize:14,color:'var(--text-muted)'}} onClick={onBack} onMouseEnter={e=>hover(e,true)} onMouseLeave={e=>hover(e,false)}>⌫</button>
      <button style={base} onClick={() => onDigit('0')} onMouseEnter={e=>hover(e,true)} onMouseLeave={e=>hover(e,false)}>0</button>
      <button onClick={onConfirm} disabled={!confirmEnabled} style={{...base, background: confirmEnabled ? 'linear-gradient(135deg,#c9a96e,#b08d4a)' : 'var(--bg-elevated)', border: confirmEnabled ? '1px solid transparent' : '1px solid var(--border-subtle)', color: confirmEnabled ? '#0a0a0f' : 'var(--text-muted)', cursor: confirmEnabled ? 'pointer' : 'default'}}>✓</button>
    </div>
  );
}

// ─── Member profile drawer ─────────────────────────────────────────────────────
function MemberDrawer({ member: m, onClose, onCheckIn }) {
  const { t } = useLanguage();
  if (!m) return null;
  const canCheckIn = !['suspended','frozen','expired','deactivated','pending'].includes(m.status);
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200 }}/>
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 460, background: 'var(--bg-card)', zIndex: 201, overflowY: 'auto', boxShadow: '-8px 0 32px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {m.photo ? <img src={m.photo} alt={m.firstName} style={{ width:44, height:44, borderRadius:'50%', objectFit:'cover', flexShrink:0, cursor:'zoom-in' }} onClick={e=>{e.stopPropagation();setPhotoLightbox(m.photo);}}/> : <Avatar firstName={m.firstName} lastName={m.lastName} avatarColor={m.avatarColor} size={44}/>}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{m.firstName} {m.lastName}</span>
              <StatusBadge status={m.status}/>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{m.memberCode || m.id} · {m.package?.name ?? m.package ?? '—'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}><X size={16}/></button>
        </div>

        {/* Content */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
          {/* Balance */}
          <div style={{ padding: '12px 16px', borderRadius: 10, background: m.balance > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(52,211,153,0.06)', border: `1px solid ${m.balance > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.2)'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            {m.balance > 0 ? <AlertTriangle size={16} color="var(--accent-red)"/> : <CheckCircle size={16} color="var(--accent-green)"/>}
            <span style={{ fontSize: 13, fontWeight: 600, color: m.balance > 0 ? 'var(--accent-red)' : 'var(--accent-green)', fontFamily: 'DM Sans' }}>
              {m.balance > 0 ? `${t('frontDesk.owes')} ${formatMoney(m.balance)}` : t('frontDesk.noBalanceDue')}
            </span>
          </div>

          {/* Membership info */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 10, fontFamily: 'DM Sans' }}>{t('members.membershipInfo').toUpperCase()}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: t('members.package'),   value: m.package?.name ?? m.package ?? '—' },
                { label: t('common.status'),     value: <StatusBadge status={m.status}/> },
                { label: t('members.startDate'), value: formatDate(m.startDate) },
                { label: t('members.endDate'),   value: formatDate(m.endDate) },
                { label: t('members.lastVisit'), value: formatDate(m.lastVisit) },
                { label: t('members.accessCode'), value: <span style={{ fontFamily:'monospace', color:'var(--accent-gold)' }}>••••</span> },
              ].map(i => (
                <div key={i.label} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{i.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{i.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 10, fontFamily: 'DM Sans' }}>{t('frontDesk.contact').toUpperCase()}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
                <Phone size={13} color="var(--text-muted)"/>{m.phone}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
                <Mail size={13} color="var(--text-muted)"/>{m.email}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
            <button
              disabled={!canCheckIn}
              onClick={() => { onCheckIn && onCheckIn(m); onClose(); }}
              style={{ ...primaryBtn, justifyContent:'center', opacity: canCheckIn ? 1 : 0.4, cursor: canCheckIn ? 'pointer' : 'not-allowed' }}
            >
              <UserCheck size={13}/> {t('frontDesk.checkIn')}
            </button>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ ...secondaryBtn, flex:1, justifyContent:'center' }}><CreditCard size={13}/> {t('payments.addPayment')}</button>
              <button style={{ ...secondaryBtn, flex:1, justifyContent:'center' }}><MessageSquare size={13}/> {t('members.sendMessage')}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function FrontDeskPage() {
  const { t, lang } = useLanguage();
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const navigate = useNavigate();

  // ── Session ────────────────────────────────────────────────────────────────
  const [session, setSession] = useState(() => {
    try { const s = sessionStorage.getItem('fd_session'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [loginStep,     setLoginStep]     = useState('select');
  const [selStaff,      setSelStaff]      = useState(null);
  const [loginPin,      setLoginPin]      = useState('');
  const [loginError,    setLoginError]    = useState('');

  // ── Shared UI ──────────────────────────────────────────────────────────────
  const [activeTab,     setActiveTab]     = useState('CHECK-IN');
  const [memberDrawer,  setMemberDrawer]  = useState(null); // memberId string

  // ── CHECK-IN ───────────────────────────────────────────────────────────────
  const [pinInput,      setPinInput]      = useState('');
  const [searchTerm,    setSearchTerm]    = useState('');
  const [foundMember,   setFoundMember]   = useState(null);
  const [checkedIn,     setCheckedIn]     = useState(false);
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [codeEntered,   setCodeEntered]   = useState('');
  const [codeError,     setCodeError]     = useState('');
  const [sendCodeSent,  setSendCodeSent]  = useState(false);
  const [timeFilter,    setTimeFilter]    = useState('Today');
  const [photoLightbox, setPhotoLightbox] = useState(null); // photo URL or null

  // ── SIGN UP ────────────────────────────────────────────────────────────────
  const emptySignUp = { firstName:'', lastName:'', phone:'', email:'', gender:'Male', packageId:'', payMethod:'Cash', amount:'', notes:'' };
  const [signUpForm,    setSignUpForm]    = useState(emptySignUp);
  const [signUpErrors,  setSignUpErrors]  = useState({});
  const [signUpSuccess, setSignUpSuccess] = useState(null); // registered member name
  const [todaySignups,  setTodaySignups]  = useState([]);

  // ── PRODUCT SALE ───────────────────────────────────────────────────────────
  const [prodCat,       setProdCat]       = useState('All');
  const [cart,          setCart]          = useState([]); // {id, name, price, qty}
  const [payMethod,     setPayMethod]     = useState('Cash');
  const [saleSuccess,   setSaleSuccess]   = useState(false);

  // ── OPERATIONS ────────────────────────────────────────────────────────────
  const emptyIssue = { equipment: '', location: '', description: '', severity: 'Medium' };
  const [issueForm,     setIssueForm]     = useState(emptyIssue);
  const [issueSuccess,  setIssueSuccess]  = useState(false);
  const emptyExpense = { description: '', amount: '', category: 'Supplies', paymentMethod: 'Cash' };
  const [expenseForm,    setExpenseForm]    = useState(emptyExpense);
  const [expenseSuccess, setExpenseSuccess] = useState(false);
  const [opsActivity,   setOpsActivity]   = useState([]);

  // ── New Task ──────────────────────────────────────────────────────────────
  const emptyTask = { title: '', description: '', assignedTo: '', dueDate: '', priority: 'Medium' };
  const [taskForm,      setTaskForm]      = useState(emptyTask);
  const [taskSuccess,   setTaskSuccess]   = useState(false);

  // ── Daily revenue tracking ────────────────────────────────────────────────
  const [daySales, setDaySales] = useState([
    { total: 7000,  items: 3, time: '08:15 AM' },
    { total: 3500,  items: 1, time: '09:02 AM' },
    { total: 35000, items: 1, time: '09:55 AM' },
  ]);
  const [dayRegs, setDayRegs] = useState([]);
  const [dayExpenses, setDayExpenses] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gem_expenses') || '[]').filter(e => e.date === new Date().toISOString().slice(0,10)); }
    catch { return []; }
  });

  // ── Sign Up modals ────────────────────────────────────────────────────────
  const [showAddMember,  setShowAddMember]  = useState(false);
  const [showAddVisitor, setShowAddVisitor] = useState(false);

  // ── QR scanner overlay ────────────────────────────────────────────────────
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrManualInput, setQrManualInput] = useState('');

  // ── Operations modals ─────────────────────────────────────────────────────
  const [showIssueModal,    setShowIssueModal]    = useState(false);
  const [showExpenseModal,  setShowExpenseModal]  = useState(false);
  const [showTaskModal,     setShowTaskModal]     = useState(false);
  const [showEodModal,      setShowEodModal]      = useState(false);
  const [eodSections, setEodSections] = useState({ checkins:true, registrations:true, sales:true, expenses:true, staff:true, issues:true, revenue:true });

  // ── Inline member profile (avoids navigation glitch) ─────────────────────
  const [fdProfileId, setFdProfileId] = useState(null);

  // ── Exit re-auth ──────────────────────────────────────────────────────────
  const [showExitAuth,  setShowExitAuth]  = useState(false);
  const [exitStep,      setExitStep]      = useState('select'); // 'select' | 'pin'
  const [exitSelStaff,  setExitSelStaff]  = useState(null);
  const [exitPin,       setExitPin]       = useState('');
  const [exitPinError,  setExitPinError]  = useState('');

  const TABS = [
    { key: 'CHECK-IN',      label: t('frontDesk.checkIn') },
    { key: 'SIGN UP',       label: t('frontDesk.signUp') },
    { key: 'PRODUCT SALE',  label: t('frontDesk.productSale') },
    { key: 'OPERATIONS',    label: t('frontDesk.operations') },
  ];

  // ── Real data ──────────────────────────────────────────────────────────────
  const cachedStaff = (() => { try { return JSON.parse(localStorage.getItem('gem_fd_staff') || '[]'); } catch { return []; } })();
  const cachedGym   = (() => { try { return JSON.parse(localStorage.getItem('gem_fd_gym')   || 'null'); } catch { return null; } })();

  const [staffList,      setStaffList]      = useState(cachedStaff);
  const [membersList,    setMembersList]    = useState([]);
  const [packagesList,   setPackagesList]   = useState([]);
  const [gymData,        setGymData]        = useState(cachedGym);
  const [productsData,   setProductsData]   = useState([]);
  const [scheduleEvents, setScheduleEvents] = useState([]);
  const [todayCheckins,  setTodayCheckins]  = useState([]);

  useEffect(() => {
    // Refresh staff and gym name in background; cache for instant next load
    getStaff().then(sRes => {
      const data = sRes.data || [];
      setStaffList(data);
      try { localStorage.setItem('gem_fd_staff', JSON.stringify(data)); } catch {}
    }).catch(console.error);
    getMyGym().then(gymRes => {
      const data = gymRes.data || null;
      setGymData(data);
      try { localStorage.setItem('gem_fd_gym', JSON.stringify(data)); } catch {}
    }).catch(console.error);

    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      getMembers(), getPackages(),
      getProducts(), getCalendar({ date: today }), getAttendance({ date: today }),
      getEquipmentIssues().catch(() => ({ data: [] })),
    ]).then(([mRes, pkRes, prRes, calRes, attRes, eqRes]) => {
      setMembersList(mRes.data || []);
      setPackagesList(pkRes.data || []);
      const pkgs = pkRes.data || [];
      const todayMembers = (mRes.data || []).filter(m => m.createdAt && m.createdAt.slice(0, 10) === today);
      setDayRegs(todayMembers.map(m => {
        const pkg = pkgs.find(p => p.id === m.packageId);
        return {
          name: `${m.firstName} ${m.lastName}`,
          type: (m.isVisitor || m.status === 'visitor') ? 'Visitor' : 'Membership',
          amount: pkg?.price || 0,
          time: new Date(m.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        };
      }));
      setTodaySignups(todayMembers.map(m => {
        const pkg = pkgs.find(p => p.id === m.packageId);
        return {
          name: `${m.firstName} ${m.lastName}`,
          package: pkg?.name || '',
          time: new Date(m.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        };
      }));
      setProductsData(prRes.data || []);
      setScheduleEvents((calRes.data || []).map(e => ({
        id: e.id,
        date: e.date ? String(e.date).slice(0, 10) : (e.startTime || '').slice(0, 10),
        start: e.time || (e.startTime || '').slice(11, 16),
        end: '',
        title: e.title,
        instructor: e.instructor ? `${e.instructor.firstName} ${e.instructor.lastName}` : (e.instructorName || ''),
        color: e.color || '#818cf8',
      })));
      const now = new Date();
      const checkins = (attRes.data || []).map(ci => ({
        ...ci,
        type: 'member',
        timeLabel: new Date(ci.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        minutesAgo: Math.floor((now - new Date(ci.checkIn)) / 60000),
      }));
      setTodayCheckins(checkins);
      const issueEntries = (eqRes.data || []).map(issue => ({
        type: 'issue',
        text: `Issue reported: ${issue.equipment}`,
        time: new Date(issue.reportedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      }));
      setOpsActivity([
        ...checkins.map(ci => ({
          type: 'checkin',
          text: `${ci.member?.firstName || ''} ${ci.member?.lastName || ''} checked in`.trim(),
          time: ci.timeLabel,
        })),
        ...issueEntries,
      ]);
    }).catch(console.error);
  }, []);

  const displayProducts = productsData.length > 0 ? productsData : PRODUCTS;
  const displayCats = ['All', ...new Set(displayProducts.map(p => p.category))];

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLoginConfirm = () => {
    if (loginPin === selStaff.accessCode) {
      const s = { staffId: selStaff.id, staffName: staffFullName(selStaff) };
      sessionStorage.setItem('fd_session', JSON.stringify(s));
      setSession(s);
      setLoginStep('select'); setSelStaff(null); setLoginPin(''); setLoginError('');
    } else {
      setLoginError(t('frontDesk.incorrectPin'));
      setLoginPin('');
    }
  };
  const handleExit = () => {
    setShowExitAuth(true);
    setExitStep('select');
    setExitSelStaff(null);
    setExitPin('');
    setExitPinError('');
  };

  const handleExitConfirm = () => {
    if (exitPin === exitSelStaff.accessCode) {
      sessionStorage.removeItem('fd_session');
      setSession(null);
      resetCheckin();
      navigate('/dashboard');
    } else {
      setExitPinError('Incorrect PIN. Try again.');
      setExitPin('');
    }
  };

  // ── Check-in ───────────────────────────────────────────────────────────────
  const resetCheckin = () => {
    setPinInput(''); setSearchTerm(''); setFoundMember(null);
    setCheckedIn(false); setShowCodeEntry(false);
    setCodeEntered(''); setCodeError(''); setSendCodeSent(false);
  };
  const getCheckInBlock = (m) => {
    if (!m || m._isStaff) return null;
    if (m.status === 'pending')     return `Membership not started yet${m.startDate ? ` — starts ${formatDate(m.startDate)}` : ''}.`;
    if (m.status === 'suspended')   return 'Account suspended — registration fee overdue.';
    if (m.status === 'frozen')      return 'Membership is currently frozen.';
    if (m.status === 'expired')     return 'Membership expired. Please renew.';
    if (m.status === 'deactivated') return 'Account deactivated.';
    if ((m.isVisitor || m.status === 'visitor') && (m.passesRemaining ?? 0) <= 0) return 'No passes remaining.';
    return null;
  };
  const runSearch = (val) => {
    setCheckedIn(false); setShowCodeEntry(false); setCodeEntered(''); setCodeError(''); setSendCodeSent(false);
    const trimmed = val.trim();
    if (!trimmed) { setFoundMember(null); return; }
    const lower = trimmed.toLowerCase();
    const staffMatch = staffList.find(s => s.accessCode === trimmed);
    if (staffMatch) {
      const fn = staffMatch.firstName || staffFullName(staffMatch).split(' ')[0];
      const ln = staffMatch.lastName || staffFullName(staffMatch).split(' ').slice(1).join(' ') || 'X';
      setFoundMember({ id: `STAFF-${staffMatch.id}`, firstName: fn, lastName: ln, phone: staffMatch.phone, package: staffMatch.role, status: 'staff', balance: 0, avatarColor: staffColor(staffMatch), _isStaff: true, _foundByCode: true });
      return;
    }
    const byCode = membersList.find(m => m.accessCode === trimmed || (m.memberCode || '').toLowerCase() === lower);
    if (byCode) { setFoundMember({...byCode, _foundByCode:true}); return; }
    const match = membersList.find(m =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(lower) ||
      (m.phone || '').includes(trimmed) ||
      (m.memberCode || '').toLowerCase().includes(lower)
    );
    setFoundMember(match ? {...match, _foundByCode:false} : null);
  };
  const handlePinPress = (d) => { const n = pinInput + d; setPinInput(n); setSearchTerm(n); runSearch(n); };
  const handlePinBack  = ()  => { const n = pinInput.slice(0,-1); setPinInput(n); setSearchTerm(n); runSearch(n); };
  const addCheckinToList = (member) => {
    const timeLabel = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setTodayCheckins(prev => [{
      id: `local-${Date.now()}`,
      checkIn: new Date().toISOString(),
      type: 'member',
      timeLabel,
      minutesAgo: 0,
      member,
    }, ...prev]);
    setOpsActivity(prev => [{
      type: 'checkin',
      text: `${member.firstName} ${member.lastName} checked in`,
      time: timeLabel,
    }, ...prev]);
  };

  const applyCheckInResult = (member, apiRes) => {
    const serverMember = apiRes?.data?.member;
    const updated = serverMember
      ? { ...member, passesRemaining: serverMember.passesRemaining ?? member.passesRemaining }
      : member;
    if (updated.passesRemaining !== member.passesRemaining) {
      setMembersList(prev => prev.map(m => m.id === member.id ? { ...m, passesRemaining: updated.passesRemaining } : m));
    }
    return updated;
  };

  const handleCheckIn = async () => {
    if (!foundMember || !!getCheckInBlock(foundMember) || checkedIn) return;
    if (foundMember._foundByCode) {
      let apiRes;
      try { apiRes = await checkInApi({ memberId: foundMember.id }); } catch {}
      const memberAfter = applyCheckInResult(foundMember, apiRes);
      setFoundMember(memberAfter);
      addCheckinToList(memberAfter);
      setCheckedIn(true);
    } else {
      setShowCodeEntry(true);
    }
  };

  const handleCodeVerifyCheckIn = async () => {
    if (codeEntered.trim() === foundMember.accessCode) {
      let apiRes;
      try { apiRes = await checkInApi({ memberId: foundMember.id }); } catch {}
      const memberAfter = applyCheckInResult(foundMember, apiRes);
      setFoundMember(memberAfter);
      addCheckinToList(memberAfter);
      setCheckedIn(true);
      setShowCodeEntry(false);
    } else {
      setCodeError('Incorrect code. Please try again.');
    }
  };

  const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const isWorkingToday = (s) => {
    if (!s.schedule || typeof s.schedule !== 'object') return true;
    const day = s.schedule[todayDayName];
    return !day?.off;
  };

  const maxMinutes = TIME_FILTERS.find(f => f.label === timeFilter)?.maxMinutes ?? 1440;
  const filteredCheckins = useMemo(() => todayCheckins.filter(c => c.minutesAgo <= maxMinutes), [todayCheckins, maxMinutes]);
  const memberCheckins = filteredCheckins.filter(c => c.type === 'member');
  const staffCheckins  = filteredCheckins.filter(c => c.type === 'staff');
  const blockReason    = foundMember ? getCheckInBlock(foundMember) : null;

  // ── Sign Up ────────────────────────────────────────────────────────────────
  const handleSignUp = () => {
    const errs = {};
    if (!signUpForm.firstName.trim()) errs.firstName = 'Required';
    if (!signUpForm.lastName.trim())  errs.lastName  = 'Required';
    if (!signUpForm.phone.trim())     errs.phone     = 'Required';
    if (!signUpForm.packageId)        errs.packageId = 'Select a package';
    if (Object.keys(errs).length) { setSignUpErrors(errs); return; }
    const name = `${signUpForm.firstName.trim()} ${signUpForm.lastName.trim()}`;
    setSignUpSuccess(name);
    setTodaySignups(prev => [{ name, package: packagesList.find(p=>p.id===signUpForm.packageId)?.name, time: new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) }, ...prev]);
    setSignUpForm(emptySignUp); setSignUpErrors({});
  };

  // ── Product Sale ───────────────────────────────────────────────────────────
  const cartTotal   = cart.reduce((s,i) => s + i.price * i.qty, 0);
  const addToCart   = (p) => setCart(c => { const ex = c.find(x=>x.id===p.id); return ex ? c.map(x=>x.id===p.id?{...x,qty:x.qty+1}:x) : [...c,{...p,qty:1}]; });
  const changeQty   = (id, delta) => setCart(c => c.map(x=>x.id===id?{...x,qty:Math.max(0,x.qty+delta)}:x).filter(x=>x.qty>0));
  const handleSale  = async () => {
    if (!cart.length) return;
    const realItems = cart.filter(i => productsData.some(p => p.id === i.id));
    if (realItems.length > 0) {
      try {
        await createSale({
          items: realItems.map(i => ({ productId: i.id, quantity: i.qty })),
          method: payMethod,
        });
        setProductsData(prev => prev.map(p => {
          const item = realItems.find(i => i.id === p.id);
          return item ? { ...p, stock: p.stock - item.qty } : p;
        }));
      } catch (err) { console.error('Sale save failed:', err); }
    }
    setDaySales(prev => [...prev, { total: cartTotal, items: cart.reduce((s,i)=>s+i.qty,0), time: new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) }]);
    setSaleSuccess(true); setCart([]);
    setTimeout(() => setSaleSuccess(false), 3000);
  };

  // ── Operations ────────────────────────────────────────────────────────────
  const handleIssue = async () => {
    if (!issueForm.equipment.trim() || !issueForm.description.trim()) return;
    const timeLabel = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    try {
      await createEquipmentIssue({
        equipment: issueForm.equipment.trim(),
        location: issueForm.location.trim() || undefined,
        description: issueForm.description.trim(),
        severity: issueForm.severity.toLowerCase(),
      });
    } catch (err) { console.error('Failed to save issue:', err); }
    setOpsActivity(prev => [{ type: 'issue', text: `Issue reported: ${issueForm.equipment}`, time: timeLabel }, ...prev]);
    setIssueSuccess(true); setIssueForm(emptyIssue);
    setTimeout(() => setIssueSuccess(false), 3000);
  };
  const handleExpense = () => {
    const amt = parseFloat(expenseForm.amount);
    if (!expenseForm.description.trim() || !amt || amt <= 0) return;
    const limit = parseFloat(localStorage.getItem('gem_expense_limit') || '50000');
    const status = amt > limit ? 'pending' : 'pending';
    const entry = { id: Date.now(), description: expenseForm.description, amount: amt, category: expenseForm.category, paymentMethod: expenseForm.paymentMethod, submittedBy: session?.staffName || 'Staff', time: new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}), date: new Date().toISOString().slice(0,10), status, exceedsLimit: amt > limit };
    const all = (() => { try { return JSON.parse(localStorage.getItem('gem_expenses')||'[]'); } catch { return []; } })();
    localStorage.setItem('gem_expenses', JSON.stringify([...all, entry]));
    setDayExpenses(prev => [...prev, entry]);
    setOpsActivity(prev => [{ type:'expense', text:`Expense logged: ${expenseForm.description} — ${formatMoney(amt)}${amt>limit?' (needs approval)':''}`, time: entry.time }, ...prev]);
    setExpenseSuccess(true); setExpenseForm(emptyExpense);
    setTimeout(() => setExpenseSuccess(false), 3000);
  };
  const handleAddTask = () => {
    if (!taskForm.title.trim() || !taskForm.assignedTo) return;
    setOpsActivity(prev => [{ type:'task', text:`Task created: ${taskForm.title} → ${taskForm.assignedTo}`, time: new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) }, ...prev]);
    setTaskSuccess(true); setTaskForm(emptyTask);
    setTimeout(() => setTaskSuccess(false), 3000);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // LOGIN SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (!session) {
    const gymName = (gymData?.name || 'GEM FITNESS').toUpperCase();
    return (
      <div className="page-fade" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: 24 }}>
        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 16, background: 'var(--accent-gold-dim)', border: '1px solid var(--accent-gold)', marginBottom: 16 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-gold)', fontFamily: 'Manrope' }}>G</span>
          </div>
          <div style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>{gymName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 4 }}>
            {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
          </div>
        </div>

        {/* Login card */}
        <div style={{ width: '100%', maxWidth: loginStep === 'pin' ? 400 : 560, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
            {loginStep === 'pin' && (
              <button onClick={() => { setLoginStep('select'); setLoginPin(''); setLoginError(''); }} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:2 }}><ArrowLeft size={16}/></button>
            )}
            <div>
              <div style={{ fontFamily:'Manrope', fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>
                {loginStep === 'select' ? t('frontDesk.frontDeskLogin') : t('frontDesk.enterYourPin')}
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:2 }}>
                {loginStep === 'select' ? t('frontDesk.selectYourName') : `${t('frontDesk.loggingInAs')} ${selStaff ? staffFullName(selStaff) : ''}`}
              </div>
            </div>
            <span style={{ marginLeft:'auto', background:'var(--accent-gold-dim)', color:'var(--accent-gold)', fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:20, letterSpacing:'1.5px', flexShrink:0 }}>FRONT DESK</span>
          </div>

          <div style={{ padding: 28 }}>
            {/* Staff grid */}
            {loginStep === 'select' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                {staffList.filter(s => {
                  if (s.isActive === false) return false;
                  if (!['manager', 'front_desk', 'general_manager'].includes(s.role)) return false;
                  if (s.role === 'manager' || s.role === 'general_manager') return true;
                  return isWorkingToday(s);
                }).map(s => {
                  const name = staffFullName(s); const [fn,...rest] = name.split(' '); const ln = rest.join(' ') || 'X';
                  return (
                    <button key={s.id} onClick={() => { setSelStaff(s); setLoginPin(''); setLoginError(''); setLoginStep('pin'); }} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:12, padding:'16px 12px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:10, transition:'all 0.15s', textAlign:'center' }} onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent-gold)'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.background='var(--bg-card-hover)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-subtle)'; e.currentTarget.style.transform='none'; e.currentTarget.style.background='var(--bg-elevated)'; }}>
                      {s.photo ? <img src={s.photo} alt={name} style={{ width:44, height:44, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/> : <Avatar firstName={fn} lastName={ln} avatarColor={staffColor(s)} size={44}/>}
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', fontFamily:'Manrope', lineHeight:1.3 }}>{name}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:2 }}>{s.role}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* PIN entry */}
            {loginStep === 'pin' && selStaff && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20 }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                  {(() => { const nm = staffFullName(selStaff); const [fn,...r] = nm.split(' '); return selStaff.photo ? <img src={selStaff.photo} alt={fn} style={{ width:52, height:52, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/> : <Avatar firstName={fn} lastName={r.join(' ')||'X'} avatarColor={staffColor(selStaff)} size={52}/>; })()}
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', fontFamily:'Manrope' }}>{staffFullName(selStaff)}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{selStaff.role}</div>
                </div>
                <div style={{ display:'flex', justifyContent:'center', gap:12, minHeight:32, alignItems:'center' }}>
                  {loginPin.length > 0
                    ? Array.from(loginPin).map((_,i) => <div key={i} style={{ width:12, height:12, borderRadius:'50%', background: loginError ? 'var(--accent-red)' : 'var(--accent-gold)' }}/>)
                    : <span style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.enterPinToLogin')}</span>}
                </div>
                {loginError && <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:8, padding:'8px 14px', fontSize:12, color:'var(--accent-red)', fontFamily:'DM Sans', textAlign:'center', width:'100%' }}>{loginError}</div>}
                <div style={{ width:'100%' }}>
                  <LoginPinPad onDigit={d => { if (loginPin.length < 6) { setLoginPin(p=>p+d); setLoginError(''); } }} onBack={() => { setLoginPin(p=>p.slice(0,-1)); setLoginError(''); }} onConfirm={handleLoginConfirm} confirmEnabled={loginPin.length >= 3}/>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop:20, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.selectNameAndPin')}</span>
          <span onClick={() => navigate('/dashboard')} style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', cursor:'pointer', transition:'color 0.15s' }} onMouseEnter={e=>e.currentTarget.style.color='var(--text-secondary)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}>{t('frontDesk.backToDashboard')}</span>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // KIOSK SCREEN
  // ══════════════════════════════════════════════════════════════════════════

  // Left sidebar (always visible)
  const leftPanel = (
    <div style={{ borderRight:'1px solid var(--border-subtle)', padding:20, display:'flex', flexDirection:'column', gap:20, overflowY:'auto' }}>
      <SchedulePanel events={scheduleEvents}/>
      <div style={{ borderTop:'1px solid var(--border-subtle)', paddingTop:16 }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', marginBottom:12, fontFamily:'DM Sans' }}>{t('frontDesk.staffOnDuty')}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {staffList.filter(s=>s.isActive!==false && isWorkingToday(s)).slice(0,5).map(s => {
            const nm = staffFullName(s); const [fn,...r] = nm.split(' ');
            return (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
                {s.photo ? <img src={s.photo} alt={fn} style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/> : <Avatar firstName={fn} lastName={r.join(' ')||'X'} avatarColor={staffColor(s)} size={28}/>}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color: s.id===session.staffId ? 'var(--accent-gold)' : 'var(--text-primary)', fontFamily:'DM Sans', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nm}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{s.role}</div>
                </div>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent-green)', flexShrink:0 }}/>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-fade" style={{ minHeight:'100vh', background:'var(--bg-base)', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <div style={{ background:'var(--bg-card)', borderBottom:'1px solid var(--border-subtle)', padding:'0 28px', display:'flex', alignItems:'center', justifyContent:'space-between', height:56, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <span style={{ fontFamily:'Manrope', fontSize:17, fontWeight:800, color:'var(--accent-gold)', letterSpacing:'1px' }}>{(gymData?.name||'GEM FITNESS').toUpperCase()}</span>
          <span style={{ background:'var(--accent-gold-dim)', color:'var(--accent-gold)', fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:20, letterSpacing:'1.5px' }}>{t('frontDesk.frontDeskMode')}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--accent-green)' }}/>
            <span style={{ fontSize:12, color:'var(--text-secondary)', fontFamily:'DM Sans' }}>{t('frontDesk.loggedInAs')}: <strong style={{ color:'var(--text-primary)' }}>{session.staffName}</strong></span>
          </div>
          <button onClick={handleExit} style={{ ...secondaryBtn, padding:'6px 14px', fontSize:12, color:'var(--accent-red)', borderColor:'rgba(239,68,68,0.3)' }}><LogOut size={13}/> {t('frontDesk.exitFrontDesk')}</button>
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{ background:'var(--bg-card)', borderBottom:'1px solid var(--border-subtle)', padding:'0 28px', display:'flex', flexShrink:0 }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding:'12px 20px', background:'none', border:'none', borderBottom:`2px solid ${activeTab===tab.key?'var(--accent-gold)':'transparent'}`, color: activeTab===tab.key ? 'var(--accent-gold)' : 'var(--text-secondary)', fontSize:11, fontWeight:700, letterSpacing:'1px', cursor:'pointer', fontFamily:'DM Sans', transition:'color 0.15s' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'260px 1fr 300px', overflow:'hidden' }}>

        {/* Left: always schedule + staff */}
        {leftPanel}

        {/* ── CENTER ─────────────────────────────────────────────────────── */}
        {activeTab === 'CHECK-IN' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'24px 28px', overflowY:'auto' }}>
            <div style={{ width:'100%', maxWidth:440 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', marginBottom:16, fontFamily:'DM Sans', textAlign:'center' }}>{t('frontDesk.checkInMemberOrStaff')}</div>
              {/* Search */}
              <div style={{ position:'relative', marginBottom:20 }}>
                <Search size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
                <input value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPinInput(''); runSearch(e.target.value); }} onKeyDown={e => e.key==='Enter'&&handleCheckIn()} placeholder={t('frontDesk.searchPlaceholderCheckin')} style={{ width:'100%', height:48, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:10, paddingLeft:42, paddingRight:80, fontSize:14, color:'var(--text-primary)', fontFamily:'DM Sans', outline:'none', boxSizing:'border-box', transition:'border-color 0.15s' }} onFocus={e=>e.target.style.borderColor='var(--accent-gold)'} onBlur={e=>e.target.style.borderColor='var(--border-subtle)'}/>
                <div style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', display:'flex', alignItems:'center', gap:4 }}>
                  {searchTerm && <button onClick={resetCheckin} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:2 }}><X size={14}/></button>}
                  <button onClick={() => { setQrManualInput(''); setShowQrScanner(true); }} title="Scan QR code" style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:6, cursor:'pointer', color:'var(--text-muted)', display:'flex', alignItems:'center', padding:'4px 6px', transition:'all 0.1s' }} onMouseEnter={e=>{e.currentTarget.style.color='var(--accent-gold)';e.currentTarget.style.borderColor='var(--accent-gold)';}} onMouseLeave={e=>{e.currentTarget.style.color='var(--text-muted)';e.currentTarget.style.borderColor='var(--border-subtle)';}}><Scan size={14}/></button>
                </div>
              </div>
              {/* Result — shown above keypad */}
              {searchTerm && foundMember && (
                <div style={{ padding:16, background: blockReason?'rgba(239,68,68,0.04)':'var(--bg-elevated)', borderRadius:12, border:`1px solid ${blockReason?'rgba(239,68,68,0.3)':checkedIn?'rgba(52,211,153,0.4)':'var(--accent-gold-dim)'}`, marginBottom:20 }}>
                  {blockReason && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:7, padding:'8px 12px', fontSize:12, color:'var(--accent-red)', fontFamily:'DM Sans', display:'flex', alignItems:'flex-start', gap:8, marginBottom:12 }}><AlertTriangle size={13} style={{ flexShrink:0, marginTop:1 }}/>{blockReason}</div>}
                  {!blockReason && foundMember.status==='expiring' && <div style={{ background:'var(--accent-yellow-dim)', color:'var(--accent-yellow)', borderRadius:7, padding:'7px 12px', fontSize:12, fontFamily:'DM Sans', fontWeight:500, marginBottom:12 }}>⚠ {t('frontDesk.membershipExpiringSoon')} — {formatDate(foundMember.endDate)}</div>}
                  {checkedIn && <div style={{ background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:7, padding:'8px 12px', fontSize:13, fontWeight:600, color:'#34d399', fontFamily:'DM Sans', textAlign:'center', marginBottom:12 }}>{t('frontDesk.checkedInSuccess')}</div>}
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    {(() => {
                      const mp = foundMember.photo || null;
                      return mp
                        ? <img src={mp} alt={foundMember.firstName} onClick={() => setPhotoLightbox(mp)} style={{ width:40, height:40, borderRadius:'50%', objectFit:'cover', flexShrink:0, cursor:'zoom-in', border:'2px solid var(--accent-gold-dim)' }}/>
                        : <Avatar firstName={foundMember.firstName} lastName={foundMember.lastName} avatarColor={foundMember.avatarColor} size={40}/>;
                    })()}
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                        <span style={{ fontFamily:'Manrope', fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{foundMember.firstName} {foundMember.lastName}</span>
                        <StatusBadge status={foundMember.status}/>
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'monospace' }}>{foundMember.memberCode || foundMember.id} · {foundMember.package?.name ?? foundMember.package ?? '—'}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginTop:4 }}>
                        {foundMember.balance > 0
                          ? <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'var(--accent-red-dim)', color:'var(--accent-red)', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:600 }}>⚠ {t('frontDesk.owes')} {formatMoney(foundMember.balance)}</span>
                          : <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'var(--accent-green-dim)', color:'var(--accent-green)', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:600 }}>✓ {t('frontDesk.noBalanceDue')}</span>}
                        {(foundMember.isVisitor || foundMember.status === 'visitor') && (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'var(--accent-blue-dim)', color:'var(--accent-blue)', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:600 }}>
                            {foundMember.passesRemaining ?? 0} pass{(foundMember.passesRemaining ?? 0) !== 1 ? 'es' : ''} left
                          </span>
                        )}
                      </div>
                    </div>
                    {!foundMember._isStaff && <button onClick={() => setMemberDrawer(foundMember)} style={{ ...secondaryBtn, padding:'6px 12px', fontSize:11 }}>{t('members.viewProfile')} →</button>}
                  </div>
                  {checkedIn && <button onClick={resetCheckin} style={{ ...secondaryBtn, marginTop:12, width:'100%', justifyContent:'center' }}>{t('common.close')}</button>}
                </div>
              )}
              {searchTerm && !foundMember && <div style={{ padding:'12px 16px', background:'var(--bg-elevated)', borderRadius:10, fontSize:13, color:'var(--text-muted)', fontFamily:'DM Sans', textAlign:'center', marginBottom:20 }}>{t('frontDesk.noMatchFor')} "{searchTerm}"</div>}
              {/* PIN dots */}
              <div style={{ display:'flex', justifyContent:'center', gap:10, marginBottom:20, minHeight:36, alignItems:'center' }}>
                {pinInput.length > 0
                  ? Array.from(pinInput).map((_,i) => <div key={i} style={{ width:12, height:12, borderRadius:'50%', background:'var(--accent-gold)' }}/>)
                  : <span style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.enterPinOrSearch')}</span>}
              </div>
              {/* PIN pad */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginBottom:20 }}>
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button key={n} style={{ height:56, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:10, fontSize:20, fontWeight:600, color:'var(--text-primary)', cursor:'pointer', fontFamily:'Manrope', transition:'all 0.1s' }} onClick={()=>handlePinPress(String(n))} onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-card-hover)';e.currentTarget.style.borderColor='var(--accent-gold)';}} onMouseLeave={e=>{e.currentTarget.style.background='var(--bg-elevated)';e.currentTarget.style.borderColor='var(--border-subtle)';}}>{n}</button>
                ))}
                <button onClick={handlePinBack} style={{ height:56, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:10, fontSize:14, color:'var(--text-muted)', cursor:'pointer', transition:'all 0.1s' }} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'} onMouseLeave={e=>e.currentTarget.style.background='var(--bg-elevated)'}>⌫</button>
                <button onClick={()=>handlePinPress('0')} style={{ height:56, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:10, fontSize:20, fontWeight:600, color:'var(--text-primary)', cursor:'pointer', fontFamily:'Manrope', transition:'all 0.1s' }} onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-card-hover)';e.currentTarget.style.borderColor='var(--accent-gold)';}} onMouseLeave={e=>{e.currentTarget.style.background='var(--bg-elevated)';e.currentTarget.style.borderColor='var(--border-subtle)';}}>0</button>
                <button onClick={handleCheckIn} disabled={!foundMember||!!blockReason||checkedIn} style={{ height:56, background: foundMember&&!blockReason&&!checkedIn ? 'linear-gradient(135deg,#c9a96e,#b08d4a)' : 'var(--bg-elevated)', border:`1px solid ${foundMember&&!blockReason&&!checkedIn?'transparent':'var(--border-subtle)'}`, borderRadius:10, fontSize:20, color: foundMember&&!blockReason&&!checkedIn ? '#0a0a0f' : 'var(--text-muted)', cursor: foundMember&&!blockReason&&!checkedIn ? 'pointer' : 'default', transition:'all 0.1s' }}>✓</button>
              </div>
            </div>
          </div>
        )}

        {/* ── SIGN UP ─────────────────────────────────────────────────────── */}
        {activeTab === 'SIGN UP' && (
          <div style={{ overflowY:'auto', padding:'24px 28px', display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.registration')}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              {/* New Member card */}
              <button onClick={() => setShowAddMember(true)} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:14, padding:'28px 20px', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }} onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-gold)';e.currentTarget.style.transform='translateY(-2px)';}} onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-subtle)';e.currentTarget.style.transform='none';}}>
                <div style={{ width:44, height:44, borderRadius:12, background:'var(--accent-gold-dim)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
                  <UserCheck size={20} color="var(--accent-gold)"/>
                </div>
                <div style={{ fontFamily:'Manrope', fontSize:15, fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>{t('frontDesk.newMemberTitle')}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', lineHeight:1.5 }}>{t('frontDesk.newMemberDesc')}</div>
              </button>
              {/* New Visitor card */}
              <button onClick={() => setShowAddVisitor(true)} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:14, padding:'28px 20px', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }} onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-blue)';e.currentTarget.style.transform='translateY(-2px)';}} onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-subtle)';e.currentTarget.style.transform='none';}}>
                <div style={{ width:44, height:44, borderRadius:12, background:'var(--accent-blue-dim)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
                  <UserPlus size={20} color="var(--accent-blue)"/>
                </div>
                <div style={{ fontFamily:'Manrope', fontSize:15, fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>{t('frontDesk.newVisitorTitle')}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', lineHeight:1.5 }}>{t('frontDesk.newVisitorDesc')}</div>
              </button>
            </div>
          </div>
        )}

        {/* ── PRODUCT SALE ──────────────────────────────────────────────── */}
        {activeTab === 'PRODUCT SALE' && (
          <div style={{ overflowY:'auto', padding:'24px 28px' }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', marginBottom:16, fontFamily:'DM Sans' }}>{t('frontDesk.productSaleLabel')}</div>
            {/* Category filter */}
            <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
              {displayCats.map(c => (
                <button key={c} onClick={()=>setProdCat(c)} style={{ padding:'5px 12px', background: prodCat===c?'var(--accent-gold)':'var(--bg-elevated)', color: prodCat===c?'#0a0a0f':'var(--text-secondary)', border:`1px solid ${prodCat===c?'transparent':'var(--border-subtle)'}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans', transition:'all 0.1s' }}>{c}</button>
              ))}
            </div>
            {/* Product grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))', gap:10 }}>
              {displayProducts.filter(p => prodCat==='All' || p.category===prodCat).map(p => (
                <button key={p.id} onClick={()=>addToCart(p)} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:12, padding:'14px 12px', cursor:'pointer', textAlign:'left', transition:'all 0.12s' }} onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-gold)';e.currentTarget.style.background='var(--bg-card-hover)';}} onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-subtle)';e.currentTarget.style.background='var(--bg-elevated)';}}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-primary)', fontFamily:'DM Sans', marginBottom:6, lineHeight:1.3 }}>{p.name}</div>
                  <div style={{ fontSize:10, color:'var(--accent-gold)', fontFamily:'DM Sans', marginBottom:6 }}>{p.category}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', fontFamily:'Manrope' }}>{formatMoney(p.price)}</div>
                  <div style={{ marginTop:8, display:'flex', alignItems:'center', justifyContent:'center', gap:4, background:'var(--accent-gold-dim)', color:'var(--accent-gold)', borderRadius:6, padding:'3px 0', fontSize:11, fontWeight:700, fontFamily:'DM Sans' }}><Plus size={10}/> {t('common.add')}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── OPERATIONS ──────────────────────────────────────────────────── */}
        {activeTab === 'OPERATIONS' && (
          <div style={{ overflowY:'auto', padding:'24px 28px', display:'flex', flexDirection:'column', gap:24 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.todaysSummary')}</div>

            {/* ── Daily Summary Strip ── */}
            {(() => {
              const productRev  = daySales.reduce((s,t) => s+t.total, 0);
              const regRev      = dayRegs.reduce((s,r) => s+r.amount, 0);
              const totalRev    = productRev + regRev;
              const itemsSold   = daySales.reduce((s,t) => s+t.items, 0);
              const memberCI    = todayCheckins.filter(c=>c.type==='member').length;
              const visitorCI   = todayCheckins.filter(c=>c.type==='visitor').length;
              const fmt = n => `${n.toLocaleString('fr-FR')} FCFA`;
              const tiles = [
                { label: t('operations.checkInsToday'),   value: memberCI,          sub: `${visitorCI} visitor${visitorCI!==1?'s':''}`, accent:'var(--accent-blue)',   dim:'var(--accent-blue-dim)',   icon: UserCheck },
                { label: t('frontDesk.newRegistrations'), value: dayRegs.length,    sub: dayRegs.filter(r=>r.type==='Membership').length+' members · '+dayRegs.filter(r=>r.type==='Visitor').length+' visitors', accent:'var(--accent-gold)', dim:'var(--accent-gold-dim)', icon: UserPlus },
                { label: t('operations.eodItemsSold'),    value: itemsSold,         sub: daySales.length+' transaction'+(daySales.length!==1?'s':''),         accent:'var(--accent-purple)', dim:'var(--accent-purple-dim)', icon: ShoppingCart },
                { label: t('operations.eodMemberRev'),   value: fmt(regRev),       sub: null,                            accent:'var(--accent-yellow)', dim:'var(--accent-yellow-dim)', icon: CreditCard },
                { label: t('operations.eodProductRev'),  value: fmt(productRev),   sub: null,                            accent:'var(--accent-blue)',   dim:'var(--accent-blue-dim)',   icon: ShoppingCart },
                { label: t('dashboard.revenue'),         value: fmt(totalRev),     sub: t('common.today'),               accent:'var(--accent-green)',  dim:'var(--accent-green-dim)',  icon: TrendingUp  },
              ];
              return (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                  {tiles.map(t => (
                    <div key={t.label} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:12, padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <div style={{ width:26, height:26, borderRadius:7, background:t.dim, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <t.icon size={12} color={t.accent}/>
                        </div>
                        <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans', fontWeight:600 }}>{t.label}</span>
                      </div>
                      <div style={{ fontSize:20, fontWeight:800, color:t.accent, fontFamily:'Manrope', lineHeight:1.1 }}>{t.value}</div>
                      {t.sub && <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:4 }}>{t.sub}</div>}
                    </div>
                  ))}
                </div>
              );
            })()}

            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.quickActions')}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                { icon: Wrench,   label: t('operations.reportIssue'),  accent:'var(--accent-yellow)', dim:'rgba(251,191,36,0.1)',  onClick:()=>setShowIssueModal(true) },
                { icon: Receipt,  label: t('frontDesk.quickExpense'),   accent:'#f87171',              dim:'rgba(248,113,113,0.1)', onClick:()=>setShowExpenseModal(true) },
                { icon: FileText, label: t('tasks.addTask'),            accent:'var(--accent-green)',  dim:'rgba(52,211,153,0.1)', onClick:()=>setShowTaskModal(true) },
                { icon: Download, label: t('frontDesk.eodReport'),      accent:'var(--accent-gold)',   dim:'rgba(201,169,110,0.1)', onClick:()=>setShowEodModal(true) },
              ].map(btn => (
                <button key={btn.label} onClick={btn.onClick} style={{ background:'var(--bg-elevated)', border:`1px solid var(--border-subtle)`, borderRadius:12, padding:'16px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:12, textAlign:'left', transition:'all 0.15s' }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor=btn.accent; e.currentTarget.style.background=btn.dim; }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border-subtle)'; e.currentTarget.style.background='var(--bg-elevated)'; }}>
                  <div style={{ width:34, height:34, borderRadius:9, background:btn.dim, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <btn.icon size={15} color={btn.accent}/>
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', fontFamily:'Manrope', lineHeight:1.3 }}>{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────────── */}
        {activeTab === 'CHECK-IN' && (
          <div style={{ borderLeft:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', overflowY:'auto' }}>
            <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.recentCheckIns')}</span>
              <select value={timeFilter} onChange={e=>setTimeFilter(e.target.value)} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:6, padding:'3px 8px', fontSize:11, color:'var(--text-secondary)', fontFamily:'DM Sans', cursor:'pointer', outline:'none' }}>
                {TIME_FILTERS.map(f=><option key={f.label}>{f.label}</option>)}
              </select>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'12px 0' }}>
              {memberCheckins.length > 0 && <>
                <div style={{ padding:'4px 18px 8px', fontSize:9, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.membersLabel')}</div>
                {memberCheckins.map((c,i) => { const m = c.member; if (!m) return null; const mp = m.photo || null; return (
                  <div key={i} style={{ padding:'9px 18px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', transition:'background 0.1s' }} onClick={()=>setMemberDrawer(m)} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {mp ? <img src={mp} alt={m.firstName} onClick={e=>{e.stopPropagation();setPhotoLightbox(mp);}} style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', flexShrink:0, cursor:'zoom-in' }}/> : <Avatar firstName={m.firstName} lastName={m.lastName} avatarColor={m.avatarColor} size={28}/>}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', fontFamily:'DM Sans', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.firstName} {m.lastName}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{m.package?.name ?? m.memberCode ?? '—'}</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, flexShrink:0 }}>
                      <StatusDot member={m}/>
                      <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{c.timeLabel}</span>
                    </div>
                  </div>
                );})}
              </>}
              {staffCheckins.length > 0 && <>
                <div style={{ padding:'12px 18px 8px', fontSize:9, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans', borderTop: memberCheckins.length>0?'1px solid var(--border-subtle)':'none', marginTop: memberCheckins.length>0?4:0 }}>{t('frontDesk.staffLabel')}</div>
                {staffCheckins.map((c,i) => { const m = c.member; if (!m) return null; const nm = staffFullName(m); const [fn,...r] = nm.split(' '); const sp = m.photo || null; return (
                  <div key={i} style={{ padding:'9px 18px', display:'flex', alignItems:'center', gap:10, transition:'background 0.1s' }} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {sp ? <img src={sp} alt={fn} style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/> : <Avatar firstName={fn} lastName={r.join(' ')||'X'} avatarColor={m.avatarColor || 'gold'} size={28}/>}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', fontFamily:'DM Sans', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nm}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{m.role || 'Staff'}</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, flexShrink:0 }}>
                      <CheckCircle size={13} color="var(--accent-green)"/>
                      <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{c.timeLabel}</span>
                    </div>
                  </div>
                );})}
              </>}
              {memberCheckins.length===0 && staffCheckins.length===0 && (
                <div style={{ padding:'32px 18px', textAlign:'center' }}>
                  <Clock size={28} color="var(--text-muted)" style={{ marginBottom:8 }}/>
                  <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.noCheckInsThisPeriod')}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'SIGN UP' && (
          <div style={{ borderLeft:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', overflowY:'auto' }}>
            <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--border-subtle)', flexShrink:0 }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.todaySignups')}</span>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'12px 0' }}>
              {todaySignups.length === 0 ? (
                <div style={{ padding:'32px 18px', textAlign:'center' }}>
                  <UserCheck size={28} color="var(--text-muted)" style={{ marginBottom:8 }}/>
                  <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.noSignupsToday')}</div>
                </div>
              ) : todaySignups.map((s,i) => (
                <div key={i} style={{ padding:'10px 18px', borderBottom:'1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', fontFamily:'DM Sans' }}>{s.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:2 }}>{s.package} · {s.time}</div>
                </div>
              ))}
            </div>
            {/* Packages reference */}
            <div style={{ borderTop:'1px solid var(--border-subtle)', padding:'14px 18px', flexShrink:0 }}>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans', marginBottom:10 }}>{t('frontDesk.packagesRef')}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {packagesList.filter(p=>p.status==='active').map(p => (
                  <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:'DM Sans' }}>{p.name}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:'var(--accent-gold)', fontFamily:'DM Sans' }}>{formatMoney(p.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'PRODUCT SALE' && (
          <div style={{ borderLeft:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', overflowY:'auto' }}>
            <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
              <ShoppingCart size={14} color="var(--accent-gold)"/>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.cartLabel')}</span>
              {cart.length > 0 && <span style={{ marginLeft:'auto', background:'var(--accent-red-dim)', color:'var(--accent-red)', borderRadius:20, padding:'1px 7px', fontSize:10, fontWeight:700 }}>{cart.length}</span>}
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'12px 0' }}>
              {saleSuccess && <div style={{ margin:'0 16px 12px', background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.25)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#34d399', fontFamily:'DM Sans' }}>{t('frontDesk.saleRecorded')}</div>}
              {cart.length === 0 ? (
                <div style={{ padding:'32px 18px', textAlign:'center' }}>
                  <ShoppingCart size={28} color="var(--text-muted)" style={{ marginBottom:8 }}/>
                  <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.cartEmpty')}</div>
                </div>
              ) : cart.map(item => (
                <div key={item.id} style={{ padding:'10px 18px', borderBottom:'1px solid var(--border-subtle)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', fontFamily:'DM Sans', flex:1 }}>{item.name}</span>
                    <button onClick={()=>changeQty(item.id,-item.qty)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:2 }}><Trash2 size={12}/></button>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <button onClick={()=>changeQty(item.id,-1)} style={{ width:22, height:22, borderRadius:6, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Minus size={10}/></button>
                      <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', fontFamily:'DM Sans', minWidth:16, textAlign:'center' }}>{item.qty}</span>
                      <button onClick={()=>changeQty(item.id, 1)} style={{ width:22, height:22, borderRadius:6, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Plus size={10}/></button>
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--accent-gold)', fontFamily:'DM Sans' }}>{formatMoney(item.price * item.qty)}</span>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div style={{ borderTop:'1px solid var(--border-subtle)', padding:'16px 18px', flexShrink:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)', fontFamily:'DM Sans' }}>{t('frontDesk.totalLabel')}</span>
                  <span style={{ fontSize:15, fontWeight:800, color:'var(--text-primary)', fontFamily:'Manrope' }}>{formatMoney(cartTotal)}</span>
                </div>
                <select style={{ ...inputStyle, marginBottom:10 }} value={payMethod} onChange={e=>setPayMethod(e.target.value)}>
                  {['Cash','Card','Mobile Money'].map(m=><option key={m}>{m}</option>)}
                </select>
                <button style={{ ...primaryBtn, width:'100%', justifyContent:'center' }} onClick={handleSale}><CreditCard size={13}/> {t('frontDesk.recordSale')}</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'OPERATIONS' && (
          <div style={{ borderLeft:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', overflowY:'auto' }}>
            <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--border-subtle)', flexShrink:0 }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.activityLog')}</span>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'12px 0' }}>
              {opsActivity.map((a,i) => {
                const colors = { checkin:'var(--accent-green)', signup:'var(--accent-blue)', payment:'var(--accent-gold)', issue:'var(--accent-yellow)', announce:'var(--accent-blue)' };
                return (
                  <div key={i} style={{ padding:'10px 18px', borderBottom:'1px solid var(--border-subtle)', display:'flex', gap:10, alignItems:'flex-start' }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background: colors[a.type]||'var(--text-muted)', marginTop:5, flexShrink:0 }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, color:'var(--text-secondary)', fontFamily:'DM Sans', lineHeight:1.4 }}>{a.text}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:2 }}>{a.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Report Issue Modal ── */}
      <Modal open={showIssueModal} onClose={()=>{ setShowIssueModal(false); }} title={t('frontDesk.reportIssueTitle')} maxWidth={480}>
        {issueSuccess ? (
          <div style={{ padding:'24px 0', textAlign:'center' }}>
            <CheckCircle size={40} color="var(--accent-green)" style={{ marginBottom:12 }}/>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', fontFamily:'Manrope' }}>{t('frontDesk.issueReported')}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:6 }}>{t('frontDesk.issueLoggedMsg')}</div>
            <button style={{ ...secondaryBtn, marginTop:20 }} onClick={()=>setShowIssueModal(false)}>{t('common.close')}</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label style={labelStyle}>{t('operations.equipmentArea')}</label><input style={inputStyle} value={issueForm.equipment} onChange={e=>setIssueForm(f=>({...f,equipment:e.target.value}))} placeholder={t('operations.equipmentPlaceholder')}/></div>
              <div><label style={labelStyle}>{t('operations.location')}</label><input style={inputStyle} value={issueForm.location} onChange={e=>setIssueForm(f=>({...f,location:e.target.value}))} placeholder={t('operations.locationPlaceholder')}/></div>
            </div>
            <div><label style={labelStyle}>{t('payments.description')} *</label><textarea style={{ ...inputStyle, minHeight:72, resize:'vertical' }} value={issueForm.description} onChange={e=>setIssueForm(f=>({...f,description:e.target.value}))} placeholder={t('operations.descriptionPlaceholder')}/></div>
            <div><label style={labelStyle}>{t('operations.severity')}</label>
              <select style={inputStyle} value={issueForm.severity} onChange={e=>setIssueForm(f=>({...f,severity:e.target.value}))}>
                {[['Low', t('operations.severityLow')], ['Medium', t('operations.severityMedium')], ['High', t('operations.severityHigh')], ['Critical', t('operations.severityCritical')]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={secondaryBtn} onClick={()=>setShowIssueModal(false)}>{t('common.cancel')}</button>
              <button style={primaryBtn} onClick={handleIssue}><Wrench size={13}/> {t('frontDesk.submitBtn')}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Quick Expense Modal ── */}
      <Modal open={showExpenseModal} onClose={()=>{ setShowExpenseModal(false); setExpenseSuccess(false); }} title={t('frontDesk.logQuickExpense')} maxWidth={460}>
        {expenseSuccess ? (
          <div style={{ padding:'24px 0', textAlign:'center' }}>
            <CheckCircle size={40} color="var(--accent-green)" style={{ marginBottom:12 }}/>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', fontFamily:'Manrope' }}>{t('frontDesk.expenseLogged')}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:6 }}>{t('frontDesk.expenseLoggedMsg')}</div>
            <button style={{ ...secondaryBtn, marginTop:20 }} onClick={()=>{ setShowExpenseModal(false); setExpenseSuccess(false); }}>{t('common.close')}</button>
          </div>
        ) : (() => {
          const limit = parseFloat(localStorage.getItem('gem_expense_limit') || '50000');
          const amt = parseFloat(expenseForm.amount) || 0;
          const overLimit = amt > 0 && amt > limit;
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ background:'rgba(201,169,110,0.08)', border:'1px solid rgba(201,169,110,0.2)', borderRadius:10, padding:'10px 14px', fontSize:12, color:'var(--text-secondary)', fontFamily:'DM Sans' }}>
                {t('frontDesk.expenseLimit')}: <strong style={{ color:'var(--accent-gold)' }}>{formatMoney(limit)}</strong>. {t('frontDesk.expenseLimitMsg')}
              </div>
              <div><label style={labelStyle}>{t('payments.description')} *</label><input style={inputStyle} value={expenseForm.description} onChange={e=>setExpenseForm(f=>({...f,description:e.target.value}))} placeholder={t('frontDesk.descriptionPurchased')}/></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={labelStyle}>{t('frontDesk.amountLabel')}</label>
                  <input style={{ ...inputStyle, borderColor: overLimit ? 'rgba(248,113,113,0.5)' : undefined }} type="number" min="0" value={expenseForm.amount} onChange={e=>setExpenseForm(f=>({...f,amount:e.target.value}))} placeholder="0"/>
                  {overLimit && <div style={{ fontSize:10, color:'#f87171', marginTop:4, fontFamily:'DM Sans' }}>{t('frontDesk.exceedsLimit')}</div>}
                </div>
                <div><label style={labelStyle}>{t('frontDesk.categoryLabel')}</label>
                  <select style={inputStyle} value={expenseForm.category} onChange={e=>setExpenseForm(f=>({...f,category:e.target.value}))}>
                    {['Supplies','Cleaning','Maintenance','Food & Drinks','Equipment','Transport','Other'].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={labelStyle}>{t('frontDesk.paymentMethodLabel')}</label>
                <select style={inputStyle} value={expenseForm.paymentMethod} onChange={e=>setExpenseForm(f=>({...f,paymentMethod:e.target.value}))}>
                  {['Cash','Card','Mobile Money'].map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button style={secondaryBtn} onClick={()=>setShowExpenseModal(false)}>{t('common.cancel')}</button>
                <button style={primaryBtn} onClick={handleExpense}><Receipt size={13}/> {t('frontDesk.submitBtn')}</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── Add Task Modal ── */}
      <Modal open={showTaskModal} onClose={()=>setShowTaskModal(false)} title={t('frontDesk.addTaskTitle')} maxWidth={480}>
        {taskSuccess ? (
          <div style={{ padding:'24px 0', textAlign:'center' }}>
            <CheckCircle size={40} color="var(--accent-green)" style={{ marginBottom:12 }}/>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', fontFamily:'Manrope' }}>{t('frontDesk.taskCreated')}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:6 }}>{t('frontDesk.taskCreatedMsg')}</div>
            <button style={{ ...secondaryBtn, marginTop:20 }} onClick={()=>setShowTaskModal(false)}>{t('common.close')}</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div><label style={labelStyle}>{t('frontDesk.taskTitleLabel')}</label><input style={inputStyle} value={taskForm.title} onChange={e=>setTaskForm(f=>({...f,title:e.target.value}))} placeholder={t('frontDesk.taskTitlePlaceholder')}/></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label style={labelStyle}>{t('frontDesk.assignToLabel')}</label>
                <select style={inputStyle} value={taskForm.assignedTo} onChange={e=>setTaskForm(f=>({...f,assignedTo:e.target.value}))}>
                  <option value="">{t('frontDesk.selectStaff')}</option>
                  {staffList.filter(s=>s.status==='active').map(s=><option key={s.id} value={s.id}>{staffFullName(s)}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>{t('frontDesk.priorityLabel')}</label>
                <select style={inputStyle} value={taskForm.priority} onChange={e=>setTaskForm(f=>({...f,priority:e.target.value}))}>
                  {[['Low', t('tasks.priorityLow')], ['Medium', t('tasks.priorityMedium')], ['High', t('tasks.priorityHigh')]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div><label style={labelStyle}>{t('frontDesk.dueDateLabel')}</label><input style={inputStyle} type="date" value={taskForm.dueDate} onChange={e=>setTaskForm(f=>({...f,dueDate:e.target.value}))}/></div>
            <div><label style={labelStyle}>{t('tasks.descriptionLabel')}</label><textarea style={{ ...inputStyle, minHeight:60, resize:'vertical' }} value={taskForm.description} onChange={e=>setTaskForm(f=>({...f,description:e.target.value}))} placeholder={t('frontDesk.taskDescPlaceholder')}/></div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={secondaryBtn} onClick={()=>setShowTaskModal(false)}>{t('common.cancel')}</button>
              <button style={primaryBtn} onClick={handleAddTask}><FileText size={13}/> {t('frontDesk.createTask')}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── EOD Report Modal ── */}
      {showEodModal && (() => {
        const today = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
        const checkinMembers = todayCheckins.filter(c=>c.type==='member').map(c=> c.member ? `${c.member.firstName} ${c.member.lastName}` : '—');
        const checkinStaff   = todayCheckins.filter(c=>c.type==='staff').map(c=> c.member ? staffFullName(c.member) : '—');
        const activeStaff    = staffList.filter(s=>s.status==='active');
        const issueItems     = opsActivity.filter(a=>a.type==='issue');
        const totalSalesAmt  = daySales.reduce((s,x)=>s+x.total,0);
        const totalRegAmt    = dayRegs.reduce((s,x)=>s+x.amount,0);
        const totalExpAmt    = dayExpenses.reduce((s,x)=>s+x.amount,0);
        const totalRev       = totalSalesAmt + totalRegAmt;
        const gymName        = (gymData?.name || 'GEM FITNESS').toUpperCase();

        const generatePDF = () => {
          const row = (a,b,bold=false) => `<tr><td style="padding:5px 10px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;${bold?'font-weight:700;':''}">${a}</td><td style="padding:5px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;${bold?'font-weight:700;color:#c9a96e;':''}">${b}</td></tr>`;
          const section = (title, rows) => `<div style="margin-bottom:20px"><h3 style="font-size:13px;font-weight:700;color:#111827;margin:0 0 8px;padding-bottom:6px;border-bottom:2px solid #c9a96e">${title}</h3><table style="width:100%;border-collapse:collapse">${rows}</table></div>`;
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>EOD Report — ${today}</title><style>body{font-family:'Helvetica Neue',Arial,sans-serif;margin:0;padding:32px;background:#fff;color:#111827}@media print{body{padding:16px}}</style></head><body>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #c9a96e">
              <div><h1 style="font-size:22px;font-weight:800;margin:0;color:#111827">${gymName}</h1><div style="font-size:12px;color:#6b7280;margin-top:4px">End of Day Report</div></div>
              <div style="text-align:right"><div style="font-size:13px;font-weight:700;color:#111827">${today}</div><div style="font-size:11px;color:#6b7280;margin-top:2px">Generated by: ${session.staffName} · ${new Date().toLocaleTimeString()}</div></div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
              ${[
                ['Check-ins', todayCheckins.length, '#16a34a'],
                ['Registrations', dayRegs.length, '#2563eb'],
                ['Items Sold', daySales.reduce((s,x)=>s+x.items,0), '#d97706'],
                ['Staff on Duty', activeStaff.length, '#7c3aed'],
                ['Issues', issueItems.length, '#dc2626'],
                ['Total Revenue', formatMoney(totalRev), '#059669'],
              ].map(([l,v,c])=>`<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center"><div style="font-size:20px;font-weight:800;color:${c}">${v}</div><div style="font-size:10px;color:#6b7280;margin-top:4px">${l}</div></div>`).join('')}
            </div>
            ${eodSections.checkins ? section('Member Check-ins', [...checkinMembers.map(n=>row('•  '+n,'')), ...checkinStaff.map(n=>row('•  '+n+' (staff)',''))].join('')||row('No check-ins recorded','')) : ''}
            ${eodSections.registrations ? section('New Registrations', dayRegs.length ? dayRegs.map(r=>row(`${r.name} <span style="color:#9ca3af;font-size:11px">(${r.type})</span>`, formatMoney(r.amount))).join('') : row('No registrations today','')) : ''}
            ${eodSections.sales ? section('Product Sales', daySales.length ? daySales.map(s=>row(`${s.items} item(s) @ ${s.time}`, formatMoney(s.total))).join('') : row('No sales recorded','')) : ''}
            ${eodSections.expenses ? section('Expenses', dayExpenses.length ? dayExpenses.map(e=>row(`${e.description} <span style="color:#9ca3af;font-size:11px">[${e.category}] ${e.exceedsLimit?'⚠ pending approval':e.status}</span>`, formatMoney(e.amount))).join('') + row('Total Expenses', formatMoney(totalExpAmt), true) : row('No expenses recorded','')) : ''}
            ${eodSections.staff ? section('Staff on Duty', activeStaff.map(s=>row(staffFullName(s), s.role)).join('')) : ''}
            ${eodSections.issues ? section('Equipment Issues', issueItems.length ? issueItems.map(a=>row('•  '+a.text, a.time)).join('') : row('No issues reported','')) : ''}
            ${eodSections.revenue ? section('Revenue Summary', [row('Registration Revenue', formatMoney(totalRegAmt)), row('Product Sales Revenue', formatMoney(totalSalesAmt)), row('Expenses', '-'+formatMoney(totalExpAmt)), row('Net Total Revenue', formatMoney(totalRev - totalExpAmt), true)].join('')) : ''}
          </body></html>`;
          const win = window.open('','_blank'); win.document.write(html); win.document.close(); win.print();
        };

        const secToggle = (k) => setEodSections(s=>({...s,[k]:!s[k]}));
        const SecHeader = ({k, label}) => (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', fontFamily:'Manrope' }}>{label}</span>
            <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:11, color:'var(--text-muted)', fontFamily:'DM Sans' }}>
              <input type="checkbox" checked={eodSections[k]} onChange={()=>secToggle(k)} style={{ accentColor:'var(--accent-gold)', cursor:'pointer' }}/>
              {t('frontDesk.includeLabel')}
            </label>
          </div>
        );

        return (
          <Modal open={showEodModal} onClose={()=>setShowEodModal(false)} title={t('frontDesk.eodReportTitle')} maxWidth={640}>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {/* Summary strip */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {[
                  { label: t('attendance.checkInsLabel'), value: todayCheckins.length,                     accent:'var(--accent-green)' },
                  { label: t('frontDesk.newRegistrations'), value: dayRegs.length,                         accent:'var(--accent-blue)' },
                  { label: t('operations.eodItemsSold'),  value: daySales.reduce((s,x)=>s+x.items,0),      accent:'var(--accent-gold)' },
                  { label: t('operations.staffOnDuty'),   value: activeStaff.length,                       accent:'#a78bfa' },
                  { label: t('frontDesk.expensesLabel'),  value: formatMoney(totalExpAmt),                 accent:'#f87171' },
                  { label: t('dashboard.revenue'),        value: formatMoney(totalRev),                    accent:'#34d399' },
                ].map(tile => (
                  <div key={tile.label} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                    <div style={{ fontSize:16, fontWeight:800, color:tile.accent, fontFamily:'Manrope', lineHeight:1 }}>{tile.value}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:4 }}>{tile.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'DM Sans', borderTop:'1px solid var(--border-subtle)', paddingTop:12 }}>
                {t('frontDesk.toggleSectionsMsg')}
              </div>

              {/* Check-ins */}
              <div style={{ background:'var(--bg-elevated)', borderRadius:12, padding:14 }}>
                <SecHeader k="checkins" label={t('frontDesk.memberCheckIns')}/>
                {eodSections.checkins && (
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {checkinMembers.map((n,i)=><div key={i} style={{ fontSize:12, color:'var(--text-secondary)', fontFamily:'DM Sans', padding:'3px 0', borderBottom:'1px solid var(--border-subtle)' }}>• {n}</div>)}
                    {checkinStaff.map((n,i)=><div key={i} style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', padding:'3px 0', borderBottom:'1px solid var(--border-subtle)' }}>• {n} <span style={{ fontSize:10 }}>(staff)</span></div>)}
                    {checkinMembers.length===0 && checkinStaff.length===0 && <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.noCheckinsRecorded')}</div>}
                  </div>
                )}
              </div>

              {/* Registrations */}
              <div style={{ background:'var(--bg-elevated)', borderRadius:12, padding:14 }}>
                <SecHeader k="registrations" label={t('frontDesk.newRegistrations')}/>
                {eodSections.registrations && (
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {dayRegs.length > 0 ? dayRegs.map((r,i)=>(
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-secondary)', fontFamily:'DM Sans', padding:'4px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                        <span>{r.name} <span style={{ color:'var(--text-muted)', fontSize:11 }}>({r.type})</span></span>
                        <span style={{ fontWeight:700, color:'var(--accent-gold)' }}>{formatMoney(r.amount)}</span>
                      </div>
                    )) : <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.noRegistrationsToday')}</div>}
                  </div>
                )}
              </div>

              {/* Sales */}
              <div style={{ background:'var(--bg-elevated)', borderRadius:12, padding:14 }}>
                <SecHeader k="sales" label={t('frontDesk.productSales')}/>
                {eodSections.sales && (
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {daySales.length > 0 ? daySales.map((s,i)=>(
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-secondary)', fontFamily:'DM Sans', padding:'4px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                        <span>{s.items} item(s) <span style={{ color:'var(--text-muted)', fontSize:11 }}>@ {s.time}</span></span>
                        <span style={{ fontWeight:700, color:'var(--accent-gold)' }}>{formatMoney(s.total)}</span>
                      </div>
                    )) : <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.noSalesRecorded')}</div>}
                  </div>
                )}
              </div>

              {/* Expenses */}
              <div style={{ background:'var(--bg-elevated)', borderRadius:12, padding:14 }}>
                <SecHeader k="expenses" label={t('frontDesk.expensesLabel')}/>
                {eodSections.expenses && (
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {dayExpenses.length > 0 ? <>
                      {dayExpenses.map((e,i)=>(
                        <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-secondary)', fontFamily:'DM Sans', padding:'4px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                          <span>{e.description} <span style={{ color:'var(--text-muted)', fontSize:10 }}>[{e.category}]</span> {e.exceedsLimit && <span style={{ color:'#f87171', fontSize:10 }}>⚠ pending</span>}</span>
                          <span style={{ fontWeight:700, color:'#f87171' }}>{formatMoney(e.amount)}</span>
                        </div>
                      ))}
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:700, color:'var(--text-primary)', fontFamily:'Manrope', paddingTop:6 }}>
                        <span>{t('common.total')}</span><span style={{ color:'#f87171' }}>{formatMoney(totalExpAmt)}</span>
                      </div>
                    </> : <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.noExpensesRecorded')}</div>}
                  </div>
                )}
              </div>

              {/* Staff on duty */}
              <div style={{ background:'var(--bg-elevated)', borderRadius:12, padding:14 }}>
                <SecHeader k="staff" label={t('frontDesk.staffOnDutySection')}/>
                {eodSections.staff && (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    {activeStaff.map(s=>(
                      <div key={s.id} style={{ fontSize:12, color:'var(--text-secondary)', fontFamily:'DM Sans', padding:'3px 0' }}>• {staffFullName(s)} <span style={{ color:'var(--text-muted)', fontSize:10 }}>({s.role})</span></div>
                    ))}
                  </div>
                )}
              </div>

              {/* Equipment issues */}
              <div style={{ background:'var(--bg-elevated)', borderRadius:12, padding:14 }}>
                <SecHeader k="issues" label={t('frontDesk.equipmentIssues')}/>
                {eodSections.issues && (
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {issueItems.length > 0 ? issueItems.map((a,i)=>(
                      <div key={i} style={{ fontSize:12, color:'var(--text-secondary)', fontFamily:'DM Sans', padding:'4px 0', borderBottom:'1px solid var(--border-subtle)' }}>• {a.text}</div>
                    )) : <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{t('frontDesk.noIssuesReported')}</div>}
                  </div>
                )}
              </div>

              {/* Revenue */}
              <div style={{ background:'var(--bg-elevated)', borderRadius:12, padding:14 }}>
                <SecHeader k="revenue" label={t('frontDesk.revenueSummary')}/>
                {eodSections.revenue && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {[
                      { label: t('frontDesk.registrationRevenue'),  value: formatMoney(totalRegAmt),      color:'var(--text-primary)' },
                      { label: t('frontDesk.productSalesRevenue'),  value: formatMoney(totalSalesAmt),    color:'var(--text-primary)' },
                      { label: t('frontDesk.expensesOutgoing'),     value: '− '+formatMoney(totalExpAmt), color:'#f87171' },
                    ].map(r=>(
                      <div key={r.label} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-secondary)', fontFamily:'DM Sans' }}>
                        <span>{r.label}</span><span style={{ fontWeight:700, color:r.color }}>{r.value}</span>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, fontWeight:800, color:'#34d399', fontFamily:'Manrope', borderTop:'1px solid var(--border-subtle)', paddingTop:8, marginTop:2 }}>
                      <span>{t('frontDesk.netRevenue')}</span><span>{formatMoney(totalRev - totalExpAmt)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button style={secondaryBtn} onClick={()=>setShowEodModal(false)}>{t('common.close')}</button>
                <button style={primaryBtn} onClick={generatePDF}><Download size={13}/> {t('frontDesk.generatePdf')}</button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ── QR Scanner Overlay ── */}
      {showQrScanner && (
        <div style={{ position:'fixed', inset:0, zIndex:1100, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setShowQrScanner(false)}>
          <style>{`@keyframes gemScanLine { 0%{top:8%} 50%{top:88%} 100%{top:8%} }`}</style>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20 }} onClick={e => e.stopPropagation()}>
            {/* Viewfinder */}
            <div style={{ position:'relative', width:260, height:260, background:'#0a0a0f', borderRadius:16, overflow:'hidden' }}>
              {/* Corner brackets */}
              {[{top:10,left:10,borderTop:'3px solid #c9a96e',borderLeft:'3px solid #c9a96e'},{top:10,right:10,borderTop:'3px solid #c9a96e',borderRight:'3px solid #c9a96e'},{bottom:10,left:10,borderBottom:'3px solid #c9a96e',borderLeft:'3px solid #c9a96e'},{bottom:10,right:10,borderBottom:'3px solid #c9a96e',borderRight:'3px solid #c9a96e'}].map((s,i) => (
                <div key={i} style={{ position:'absolute', width:24, height:24, borderRadius:2, ...s }} />
              ))}
              {/* Scan line */}
              <div style={{ position:'absolute', left:12, right:12, height:2, background:'linear-gradient(90deg, transparent, #c9a96e, transparent)', animation:'gemScanLine 2s ease-in-out infinite' }} />
              <QrCode size={64} color="rgba(201,169,110,0.15)" style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)' }} />
            </div>
            <p style={{ color:'#fff', fontSize:13, textAlign:'center', margin:0, fontFamily:'DM Sans', lineHeight:1.6 }}>
              {t('frontDesk.pointCamera')}<br/>
              <span style={{ color:'rgba(255,255,255,0.45)', fontSize:12 }}>{t('frontDesk.orEnterCode')}</span>
            </p>
            {/* Manual entry */}
            <div style={{ display:'flex', gap:8, width:300 }}>
              <input
                autoFocus
                value={qrManualInput}
                onChange={e => setQrManualInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && qrManualInput.trim()) {
                    setSearchTerm(qrManualInput.trim());
                    runSearch(qrManualInput.trim());
                    setShowQrScanner(false);
                  }
                }}
                placeholder={t('frontDesk.typeOrPaste')}
                style={{ flex:1, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, padding:'9px 14px', fontSize:13, color:'#fff', fontFamily:'DM Sans', outline:'none' }}
              />
              <button
                style={{ ...primaryBtn, flexShrink:0 }}
                onClick={() => { if (qrManualInput.trim()) { setSearchTerm(qrManualInput.trim()); runSearch(qrManualInput.trim()); setShowQrScanner(false); } }}
              >
                {t('frontDesk.searchBtn')}
              </button>
            </div>
            <button onClick={() => setShowQrScanner(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize:13, fontFamily:'DM Sans', padding:'4px 12px' }}>
              {t('frontDesk.cancelBtn')}
            </button>
          </div>
        </div>
      )}

      {/* ── Add Member / Visitor Modals ── */}
      <AddMemberModal
        open={showAddMember}
        onClose={() => setShowAddMember(false)}
        packagesList={packagesList}
        gymData={gymData ?? {}}
        onCreated={(newId, newMember) => {
          setShowAddMember(false);
          if (newId) setFdProfileId(newId);
          if (newMember) {
            const timeLabel = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const pkg = packagesList.find(p => p.id === newMember.packageId);
            const fullName = `${newMember.firstName} ${newMember.lastName}`;
            setMembersList(prev => [newMember, ...prev]);
            setDayRegs(prev => [{ name: fullName, type: 'Membership', amount: pkg?.price || 0, time: timeLabel }, ...prev]);
            setTodaySignups(prev => [{ name: fullName, package: pkg?.name || '', time: timeLabel }, ...prev]);
            setOpsActivity(prev => [{ type: 'signup', text: `${fullName} registered as member`, time: timeLabel }, ...prev]);
          }
        }}
      />
      <AddVisitorModal
        open={showAddVisitor}
        onClose={() => setShowAddVisitor(false)}
        packagesList={packagesList}
        gymData={gymData ?? {}}
        onCreated={(newId, newMember) => {
          setShowAddVisitor(false);
          if (newId) setFdProfileId(newId);
          if (newMember) {
            const timeLabel = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const pkg = packagesList.find(p => p.id === newMember.packageId);
            const fullName = `${newMember.firstName} ${newMember.lastName}`;
            setMembersList(prev => [newMember, ...prev]);
            setDayRegs(prev => [{ name: fullName, type: 'Visitor', amount: pkg?.price || 0, time: timeLabel }, ...prev]);
            setTodaySignups(prev => [{ name: fullName, package: pkg?.name || '', time: timeLabel }, ...prev]);
            setOpsActivity(prev => [{ type: 'signup', text: `${fullName} registered as visitor`, time: timeLabel }, ...prev]);
          }
        }}
      />

      {/* ── Code Verification Modal ── */}
      {showCodeEntry && foundMember && (
        <Modal open={showCodeEntry} onClose={()=>{ setShowCodeEntry(false); setCodeEntered(''); setCodeError(''); setSendCodeSent(false); }} title={t('frontDesk.verifyAccessCode')} maxWidth={360}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.6, fontFamily:'DM Sans' }}>
              {t('frontDesk.askForCode')} <strong style={{ color:'var(--text-primary)' }}>{foundMember.firstName} {foundMember.lastName}</strong> {t('frontDesk.forTheirCode')}
            </div>
            <input autoFocus type="password" maxLength={6} value={codeEntered} onChange={e=>{ setCodeEntered(e.target.value); setCodeError(''); }} onKeyDown={e=>{ if (e.key==='Enter') handleCodeVerifyCheckIn(); }} placeholder="••••" style={{ background:'var(--bg-elevated)', border:`1px solid ${codeError?'rgba(239,68,68,0.5)':'var(--border-subtle)'}`, borderRadius:10, padding:'11px 14px', fontSize:20, color:'var(--accent-gold)', fontFamily:'JetBrains Mono, monospace', letterSpacing:'0.25em', textAlign:'center', outline:'none', width:'100%', boxSizing:'border-box' }}/>
            {codeError && (
              <div style={{ fontSize:11, color:'#ef4444', fontFamily:'DM Sans', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span>{t('frontDesk.incorrectCode')}</span>
                {!sendCodeSent ? <button onClick={()=>setSendCodeSent(true)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--accent-gold)',fontSize:11,fontFamily:'DM Sans',display:'flex',alignItems:'center',gap:4,textDecoration:'underline' }}><MessageSquare size={11}/> {t('frontDesk.sendToPhone')} {foundMember.phone}</button> : <span style={{ color:'#34d399' }}>{t('frontDesk.codeSent')}</span>}
              </div>
            )}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={secondaryBtn} onClick={()=>{ setShowCodeEntry(false); setCodeEntered(''); setCodeError(''); setSendCodeSent(false); }}>{t('common.cancel')}</button>
              <button style={{ ...primaryBtn, opacity:codeEntered.trim()?1:0.4, cursor:codeEntered.trim()?'pointer':'not-allowed' }} disabled={!codeEntered.trim()} onClick={handleCodeVerifyCheckIn}>
                <UserCheck size={13}/> {t('frontDesk.checkIn')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Member profile drawer ── */}
      {memberDrawer && <MemberDrawer member={memberDrawer} onClose={()=>setMemberDrawer(null)} onCheckIn={(m) => { setFoundMember({...m, _foundByCode:true}); setSearchTerm(m.accessCode||m.memberCode||''); setCheckedIn(true); }}/>}

      {/* ── Photo lightbox ── */}
      {photoLightbox && (
        <div onClick={() => setPhotoLightbox(null)} style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-out' }}>
          <img src={photoLightbox} alt="Profile" style={{ maxWidth:'80vw', maxHeight:'80vh', borderRadius:16, objectFit:'contain', boxShadow:'0 32px 80px rgba(0,0,0,0.6)', border:'2px solid rgba(255,255,255,0.1)' }}/>
          <div style={{ position:'absolute', top:24, right:24, color:'rgba(255,255,255,0.5)', fontSize:12, fontFamily:'DM Sans' }}>Click anywhere to close</div>
        </div>
      )}

      {/* ── Exit re-auth overlay ── */}
      {showExitAuth && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ width:'100%', maxWidth: exitStep==='pin' ? 400 : 560, background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:18, boxShadow:'0 24px 80px rgba(0,0,0,0.5)', overflow:'hidden' }}>
            {/* Header */}
            <div style={{ padding:'20px 28px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:12 }}>
              {exitStep === 'pin' && (
                <button onClick={() => { setExitStep('select'); setExitPin(''); setExitPinError(''); }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:2 }}>
                  <ArrowLeft size={16}/>
                </button>
              )}
              <div>
                <div style={{ fontFamily:'Manrope', fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>
                  {exitStep === 'select' ? t('frontDesk.returnToDashboard') : t('frontDesk.enterYourPin')}
                </div>
                <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:2 }}>
                  {exitStep === 'select' ? t('frontDesk.selectProfile') : `${t('frontDesk.authenticatingAs')} ${exitSelStaff ? staffFullName(exitSelStaff) : ''}`}
                </div>
              </div>
              <button onClick={() => setShowExitAuth(false)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:4 }}>
                <X size={16}/>
              </button>
            </div>

            <div style={{ padding:28 }}>
              {/* Staff grid */}
              {exitStep === 'select' && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:12 }}>
                  {staffList.filter(s => s.isActive !== false).map(s => {
                    const nm = staffFullName(s); const [fn,...rest] = nm.split(' '); const ln = rest.join(' ') || 'X';
                    return (
                      <button key={s.id} onClick={() => { setExitSelStaff(s); setExitPin(''); setExitPinError(''); setExitStep('pin'); }} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:12, padding:'16px 12px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:10, transition:'all 0.15s', textAlign:'center' }} onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent-gold)'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.background='var(--bg-card-hover)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-subtle)'; e.currentTarget.style.transform='none'; e.currentTarget.style.background='var(--bg-elevated)'; }}>
                        <Avatar firstName={fn} lastName={ln} avatarColor={staffColor(s)} size={44}/>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', fontFamily:'Manrope', lineHeight:1.3 }}>{nm}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'DM Sans', marginTop:2 }}>{s.role}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* PIN entry */}
              {exitStep === 'pin' && exitSelStaff && (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                    {(() => { const nm = staffFullName(exitSelStaff); const [fn,...r] = nm.split(' '); return <Avatar firstName={fn} lastName={r.join(' ')||'X'} avatarColor={staffColor(exitSelStaff)} size={52}/>; })()}
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', fontFamily:'Manrope' }}>{staffFullName(exitSelStaff)}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>{exitSelStaff.role}</div>
                  </div>
                  <div style={{ display:'flex', justifyContent:'center', gap:12, minHeight:32, alignItems:'center' }}>
                    {exitPin.length > 0
                      ? Array.from(exitPin).map((_,i) => <div key={i} style={{ width:12, height:12, borderRadius:'50%', background: exitPinError ? 'var(--accent-red)' : 'var(--accent-gold)' }}/>)
                      : <span style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'DM Sans' }}>Enter your PIN</span>}
                  </div>
                  {exitPinError && (
                    <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:8, padding:'8px 14px', fontSize:12, color:'var(--accent-red)', fontFamily:'DM Sans', textAlign:'center', width:'100%' }}>{exitPinError}</div>
                  )}
                  <div style={{ width:'100%' }}>
                    <LoginPinPad
                      onDigit={d => { if (exitPin.length < 6) { setExitPin(p=>p+d); setExitPinError(''); } }}
                      onBack={() => { setExitPin(p=>p.slice(0,-1)); setExitPinError(''); }}
                      onConfirm={handleExitConfirm}
                      confirmEnabled={exitPin.length >= 3}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Inline member profile overlay (no navigation, no glitch) ── */}
      {fdProfileId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg-primary)', overflowY: 'auto' }}>
          <MemberProfilePage
            memberId={fdProfileId}
            onBack={() => setFdProfileId(null)}
            fromFrontDesk={true}
          />
        </div>
      )}
    </div>
  );
}
