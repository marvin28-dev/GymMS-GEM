import api from './api';

// One day of the gym from its real records. tz is the browser's offset from UTC
// so "the day" is the gym's local day.
export const getEod = (date) =>
  api.get('/reports/eod', { params: { date, tz: new Date().getTimezoneOffset() } });
