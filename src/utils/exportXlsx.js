import * as XLSX from 'xlsx';
import moment from 'moment';

export function exportToXlsx({
  columns = [],
  rows = [],
  filename = 'export',
  detailHeaders = [],
  detailField = 'details',
  detailKeys = [],
  sheetName = 'Sheet1',
  columnWidths = [],
  preserveTypes = false,
  autoFilter = false,
}) {
  try {
    const parentHeaders = columns.map(c => (c.label || c.key));
    const configuredDetailHeaders = Array.isArray(detailHeaders) ? detailHeaders : [];
    const configuredDetailKeys = Array.isArray(detailKeys) ? detailKeys : [];

    const getByPath = (obj, path) => {
      return path.split('.').reduce((acc, k) => acc?.[k], obj);
    };

    const includeDetails = configuredDetailHeaders.length > 0 && rows.some(r => {
      const d = getByPath(r, detailField);
      return d !== undefined && d !== null && (Array.isArray(d) ? d.length > 0 : true);
    });

    const headers = includeDetails ? parentHeaders.concat(configuredDetailHeaders) : parentHeaders;

    const data = [headers];

    const formatCellValue = (value) => {
      if (value instanceof Date) return moment(value).format('DD-MM-YYYY HH:mm');
      if (value === undefined || value === null) return '';
      if (preserveTypes && (typeof value === 'number' || typeof value === 'boolean')) return value;
      return String(value);
    };

    const formatParentValues = (row) => {
      return columns.map(col => {
        const val = getByPath(row, col.key);
        return formatCellValue(val);
      });
    };

    const formatDetailValues = (d) => {
      if (!includeDetails) return [];
      return configuredDetailKeys.map(k => {
        const v = getByPath(d, k);
        return formatCellValue(v);
      });
    };

    rows.forEach(r => {
      const parentVals = formatParentValues(r);
      const details = getByPath(r, detailField);

      if (includeDetails) {
        if (Array.isArray(details) && details.length > 0) {
          data.push(parentVals.concat(formatDetailValues(details[0])));
          for (let i = 1; i < details.length; i++) {
            const blankParents = parentVals.map(() => '');
            data.push(blankParents.concat(formatDetailValues(details[i])));
          }
        } else if (details && typeof details === 'object') {
          data.push(parentVals.concat(formatDetailValues(details)));
        } else {
          const emptyDetails = configuredDetailKeys.map(() => '');
          data.push(parentVals.concat(emptyDetails));
        }
      } else {
        data.push(parentVals);
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    if (Array.isArray(columnWidths) && columnWidths.length) {
      ws['!cols'] = columnWidths.map(width => (
        typeof width === 'number' ? { wch: width } : width
      ));
    }
    if (autoFilter && headers.length) {
      ws['!autofilter'] = {
        ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}${Math.max(1, data.length)}`,
      };
    }

    const wb = XLSX.utils.book_new();
    const safeSheetName = String(sheetName || 'Sheet1')
      .replace(/[\\/?*[\]:]/g, ' ')
      .trim()
      .slice(0, 31) || 'Sheet1';
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

    const outName = `${filename}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'_')}.xlsx`;
    XLSX.writeFile(wb, outName);
    return outName;
  } catch (err) {
    console.error('Export to excel failed', err);
    return null;
  }
}

export default exportToXlsx;
