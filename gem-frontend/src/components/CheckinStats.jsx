import { useEffect, useMemo, useState } from 'react';
import { getStats } from '../services/attendance.service';
import { useLanguage } from '../contexts/LanguageContext';
import { getDateLocale } from '../utils/date';

// The data mark. The brand gold reads a little grey and too light for a mark on
// the dark surfaces, so the marks use a deeper gold that passes contrast,
// chroma and lightness on all four theme surfaces (checked with the dataviz
// palette validator). Text never uses it: labels stay in the text colours.
const MARK = '#b8862b';

const RANGES = [7, 30, 90];

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14 };
const labelText = { fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' };
const selectStyle = {
  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 7,
  padding: '5px 8px', fontSize: 11.5, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none',
};

// Clean axis steps: 0, then a round number the peak fits under
function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s * 4 >= v);
  return step * 4;
}

function Tooltip({ tip }) {
  if (!tip) return null;
  return (
    <div role="status" style={{
      position: 'fixed', left: tip.x, top: tip.y, transform: 'translate(-50%, calc(-100% - 10px))',
      background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
      padding: '7px 10px', pointerEvents: 'none', zIndex: 600, boxShadow: 'var(--shadow-elevated)', whiteSpace: 'nowrap',
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{tip.value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 1 }}>{tip.label}</div>
    </div>
  );
}

// A short row of bars answering one question: which weekday, which hour, which
// stretch of the month. The tallest is filled, the rest washed back, so the
// answer reads before any of the numbers do.
function Breakdown({ title, note, bars, onHover, onLeave, formatValue }) {
  const peak = Math.max(0, ...bars.map(b => b.value));
  return (
    <div style={{ ...card, padding: '16px 18px', minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>{title}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 2, marginBottom: 14 }}>{note}</div>
      {/* stretch, not flex-end: the columns have to fill the row's height or the
          bars' percentages resolve against nothing and collapse to slivers */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 4, height: 110 }}>
        {bars.map((b, i) => {
          const h = peak > 0 ? Math.max(b.value > 0 ? 3 : 0, (b.value / peak) * 100) : 0;
          const isPeak = peak > 0 && b.value === peak;
          return (
            <div key={b.key ?? i} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <button
                  type="button"
                  aria-label={`${b.label}: ${formatValue ? formatValue(b.value) : b.value}`}
                  onPointerEnter={e => onHover?.(e, b)}
                  onFocus={e => onHover?.(e, b)}
                  onPointerLeave={onLeave}
                  onBlur={onLeave}
                  style={{
                    width: '100%', maxWidth: 28, height: `${h}%`, minHeight: b.value > 0 ? 3 : 0,
                    background: isPeak ? MARK : `color-mix(in oklab, ${MARK} 42%, var(--bg-card))`,
                    border: 'none', borderRadius: '4px 4px 0 0', cursor: 'pointer', padding: 0,
                  }}
                />
              </div>
              <span style={{ fontSize: 10.5, color: isPeak ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: isPeak ? 700 : 400, fontFamily: 'DM Sans', whiteSpace: 'nowrap' }}>
                {b.short ?? b.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, subTone, valueSize = 24 }) {
  return (
    <div style={{ ...card, padding: '14px 16px', minWidth: 0 }}>
      <div style={{ ...labelText, fontSize: 11.5 }}>{label}</div>
      <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: valueSize, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4, lineHeight: 1.15, overflowWrap: 'anywhere' }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, marginTop: 4, fontFamily: 'DM Sans', color: subTone === 'up' ? 'var(--accent-green)' : subTone === 'down' ? 'var(--accent-red)' : 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

export default function CheckinStats({ isMobile }) {
  const { t } = useLanguage();
  const locale = getDateLocale();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tip, setTip] = useState(null);

  // Which days of the week count, and between which hours. Empty means all.
  const [pickedDays, setPickedDays] = useState([]);
  const [hourFrom, setHourFrom] = useState(0);
  const [hourTo, setHourTo] = useState(23);
  const filtered = pickedDays.length > 0 || hourFrom !== 0 || hourTo !== 23;
  const clearFilters = () => { setPickedDays([]); setHourFrom(0); setHourTo(23); };
  const toggleDay = (wd) => setPickedDays(p => (p.includes(wd) ? p.filter(x => x !== wd) : [...p, wd].sort((a, b) => a - b)));

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    getStats({
      days,
      tz: new Date().getTimezoneOffset(),
      ...(pickedDays.length ? { weekdays: pickedDays.join(',') } : {}),
      ...(hourFrom !== 0 || hourTo !== 23 ? { fromHour: hourFrom, toHour: hourTo } : {}),
    })
      .then(res => { if (live) setData(res.data); })
      .catch(() => { if (live) setError(t('stats.loadFailed')); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [days, pickedDays, hourFrom, hourTo, t]);

  const weekdays = useMemo(() => {
    // Monday first, in the reader's language
    const monday = new Date(Date.UTC(2024, 0, 1));
    return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86400000)
      .toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }));
  }, [locale]);

  const dayLabel = (iso, opts = { day: 'numeric', month: 'short' }) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { ...opts, timeZone: 'UTC' });
  const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`;
  const show = (e, value, label) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.top, value, label });
  };
  const hide = () => setTip(null);

  // The first load has nothing to hold on to; a later one keeps the old picture, dimmed
  if (!data && loading) {
    return <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{t('common.loading')}</div>;
  }
  if (!data) {
    return <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--accent-red)', fontSize: 13 }}>{error}</div>;
  }

  const peak = Math.max(0, ...data.perDay.map(d => d.count));
  const peakDay = data.perDay.find(d => d.count === peak && peak > 0);
  const axisMax = niceMax(peak);
  const ticks = [0, axisMax / 4, axisMax / 2, (axisMax * 3) / 4, axisMax];
  const change = data.previousTotal > 0 ? Math.round(((data.total - data.previousTotal) / data.previousTotal) * 100) : null;

  // Only the hours anybody came in are worth a column: a gym open from six to
  // ten should not be drawn as a day with fourteen empty bars on either side.
  const usedHours = (data.byHour || []).map((c, h) => (c > 0 ? h : null)).filter(h => h !== null);
  const firstHour = usedHours.length ? Math.max(0, Math.min(...usedHours) - 1) : 6;
  const lastHour = usedHours.length ? Math.min(23, Math.max(...usedHours) + 1) : 22;
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);

  const xEvery = data.days === 7 ? 1 : data.days === 30 ? 5 : 15;
  const busiest = data.busiest
    ? t('stats.busiestValue', { day: weekdays[data.busiest.weekday], from: hourLabel(data.busiest.hour), to: hourLabel((data.busiest.hour + 1) % 24) })
    : '-';
  // A day and an hour range is too long for a narrow phone tile. Rather than
  // let it break mid-time, put the day on its own line and keep the range whole.
  const busiestValue = isMobile && data.busiest
    ? (<>
        <span style={{ display: 'block' }}>{weekdays[data.busiest.weekday]}</span>
        <span style={{ whiteSpace: 'nowrap' }}>
          {hourLabel(data.busiest.hour)}-{hourLabel((data.busiest.hour + 1) % 24)}
        </span>
      </>)
    : busiest;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: loading ? 0.55 : 1, transition: 'opacity 0.2s' }}>
      {/* The range scopes everything below it */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {RANGES.map(r => (
          <button key={r} onClick={() => setDays(r)} aria-pressed={days === r} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans',
            background: days === r ? 'var(--accent-gold-dim)' : 'var(--bg-card)',
            color: days === r ? 'var(--accent-gold)' : 'var(--text-secondary)',
            border: `1px solid ${days === r ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
          }}>{t('stats.lastDays', { n: r })}</button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginLeft: 4 }}>
          {dayLabel(data.from)} - {dayLabel(data.to, { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {/* Narrowing it down: which days of the week, and between which hours */}
      <div style={{ ...card, padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ ...labelText, fontSize: 11.5 }}>{t('stats.onDays')}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {weekdays.map((name, wd) => {
              const on = pickedDays.includes(wd);
              return (
                <button key={wd} type="button" onClick={() => toggleDay(wd)} aria-pressed={on}
                  style={{
                    padding: '5px 9px', borderRadius: 7, fontSize: 11.5, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'DM Sans',
                    background: on ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)',
                    color: on ? 'var(--accent-gold)' : 'var(--text-secondary)',
                    border: `1px solid ${on ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                  }}>{name}</button>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ ...labelText, fontSize: 11.5 }}>{t('stats.betweenHours')}</span>
          <select value={hourFrom} onChange={e => setHourFrom(Number(e.target.value))} aria-label={t('stats.fromHour')} style={selectStyle}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
          <span style={{ ...labelText, fontSize: 11.5 }}>-</span>
          <select value={hourTo} onChange={e => setHourTo(Number(e.target.value))} aria-label={t('stats.toHour')} style={selectStyle}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h === 23 ? 23 : h)}</option>)}
          </select>
        </div>
        {filtered && (
          <button type="button" onClick={clearFilters}
            style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 7, padding: '5px 10px', fontSize: 11.5, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Sans' }}>
            {t('stats.clearFilters')}
          </button>
        )}
      </div>

      {/* Headline figures */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12 }}>
        <StatTile label={t('stats.checkIns')} value={data.total.toLocaleString(locale)}
          sub={change === null ? t('stats.noEarlier') : t('stats.vsPrevious', { sign: change > 0 ? '+' : '', pct: change })}
          subTone={change === null || change === 0 ? null : change > 0 ? 'up' : 'down'} />
        <StatTile label={t('stats.differentMembers')} value={data.uniqueMembers.toLocaleString(locale)} />
        <StatTile label={t('stats.busiestTime')} value={busiestValue} valueSize={isMobile ? 18 : 24}
          sub={data.busiest ? t('stats.visitsInSlot', { n: data.busiest.count }) : null} />
      </div>

      {/* Check-ins per day */}
      <div style={{ ...card, padding: isMobile ? '14px 12px' : '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>{t('stats.perDayTitle')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 2 }}>{t('stats.perDaySub')}</div>
          </div>
        </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {/* Y axis */}
            <div style={{ position: 'relative', width: 26, height: 180, flexShrink: 0 }}>
              {ticks.map(v => (
                <span key={v} style={{ position: 'absolute', right: 0, bottom: `${(v / axisMax) * 100}%`, transform: 'translateY(50%)', fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'DM Sans', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Plot: hairline grid, columns from one baseline */}
              <div style={{ position: 'relative', height: 180 }}>
                {ticks.map(v => (
                  <div key={v} style={{ position: 'absolute', left: 0, right: 0, bottom: `${(v / axisMax) * 100}%`, borderTop: '1px solid var(--border-subtle)' }} />
                ))}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                  {data.perDay.map(d => {
                    const h = (d.count / axisMax) * 100;
                    const isPeak = peakDay && d.date === peakDay.date;
                    const label = dayLabel(d.date, { weekday: 'short', day: 'numeric', month: 'short' });
                    return (
                      <button key={d.date} type="button"
                        aria-label={`${label}: ${d.count}`}
                        onPointerEnter={e => show(e, t('stats.nCheckIns', { n: d.count }), label)}
                        onPointerLeave={hide} onFocus={e => show(e, t('stats.nCheckIns', { n: d.count }), label)} onBlur={hide}
                        style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'default', minWidth: 0, position: 'relative' }}>
                        {isPeak && (
                          <span style={{ position: 'absolute', bottom: `calc(${h}% + 4px)`, fontSize: 10.5, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{d.count}</span>
                        )}
                        <span style={{ width: '100%', maxWidth: 24, height: `${h}%`, minHeight: d.count ? 2 : 0, background: MARK, borderRadius: '4px 4px 0 0' }} />
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* X axis: a few dates, never one per column */}
              <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
                {data.perDay.map((d, i) => (
                  <span key={d.date} style={{ flex: 1, minWidth: 0, fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'DM Sans', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'visible' }}>
                    {(i % xEvery === 0 || i === data.perDay.length - 1) && (data.days === 7 ? weekdays[(new Date(`${d.date}T12:00:00Z`).getUTCDay() + 6) % 7] : dayLabel(d.date))}
                  </span>
                ))}
              </div>
            </div>
          </div>
      </div>

      {/* The three questions: which day, which hour, which part of the month */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
        <Breakdown
          title={t('stats.busiestDaysTitle')}
          note={t('stats.busiestDaysSub')}
          bars={weekdays.map((name, wd) => ({ key: wd, label: name, short: name, value: data.weekdayAverages?.[wd] ?? 0, total: data.byWeekday?.[wd] ?? 0 }))}
          formatValue={(v) => v.toLocaleString(locale)}
          onHover={(e, b) => show(e, t('stats.perDayAverage', { n: b.value.toLocaleString(locale) }), t('stats.visitsTotal', { n: b.total.toLocaleString(locale) }))}
          onLeave={hide}
        />
        <Breakdown
          title={t('stats.busiestHoursTitle')}
          note={t('stats.busiestHoursSub')}
          bars={hours.map(h => ({ key: h, label: hourLabel(h), short: h % (isMobile ? 4 : 3) === 0 ? String(h).padStart(2, '0') : '', value: data.byHour?.[h] ?? 0 }))}
          onHover={(e, b) => show(e, t('stats.visits', { n: b.value.toLocaleString(locale) }), b.label)}
          onLeave={hide}
        />
        <Breakdown
          title={t('stats.monthPartTitle')}
          note={t('stats.monthPartSub')}
          bars={(data.byMonthPart || []).map((count, i) => ({ key: i, label: t(`stats.monthPart${i}`), short: t(`stats.monthPart${i}Short`), value: count }))}
          onHover={(e, b) => show(e, t('stats.visits', { n: b.value.toLocaleString(locale) }), b.label)}
          onLeave={hide}
        />
      </div>

      <Tooltip tip={tip} />
    </div>
  );
}
