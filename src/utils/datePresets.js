// src/utils/datePresets.js
import moment from 'moment';

export function getPresetRange(preset) {
  let start, end;
  switch (preset) {
    case 'today':
      start = moment().startOf('day'); end = moment().endOf('day'); break;
    case 'yesterday':
      start = moment().subtract(1, 'day').startOf('day'); end = moment().subtract(1, 'day').endOf('day'); break;
    case 'thisWeek':
      start = moment().startOf('week'); end = moment().endOf('week'); break;
    case 'thisMonth':
      start = moment().startOf('month'); end = moment().endOf('month'); break;
    case 'thisYear':
      start = moment().startOf('year'); end = moment().endOf('year'); break;
    case 'all':
      return null;
    default:
      return null;
  }
  return [start.toDate(), end.toDate()];
}