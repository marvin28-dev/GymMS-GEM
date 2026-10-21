import { useState, useEffect } from 'react';
import { getAll as getTimecards } from '../services/timecards.service';

// Staff who clocked in today and never clocked out.
//
// The end-of-day report asks for all of them, because closing the day on any
// open shift loses those hours. The dashboard asks only for the overdue ones -
// somebody halfway through their shift is just at work, not a problem. The
// server decides which is which, since it knows the rota.
export default function useOpenShifts(enabled = true, { overdueOnly = false } = {}) {
  const [openShifts, setOpenShifts] = useState([]);

  useEffect(() => {
    if (!enabled) return;
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    getTimecards({ date: iso, openOnly: 'true', ...(overdueOnly ? { overdueOnly: 'true' } : {}) })
      .then(res => setOpenShifts(res.data || []))
      .catch(() => setOpenShifts([]));
  }, [enabled, overdueOnly]);

  return openShifts;
}
