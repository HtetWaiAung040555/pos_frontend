import * as XLSX from 'xlsx';
import moment from 'moment';

export function normalizeCell(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

export function normalizeKey(key) {
    return normalizeCell(key).toLowerCase().replace(/\s+/g, '_');
}

export function normalizeRowKeys(row) {
    const normalized = {};
    Object.keys(row || {}).forEach((key) => {
        normalized[normalizeKey(key)] = row[key];
    });
    return normalized;
}

export function toNumber(value, defaultValue = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : defaultValue;
}

export function findSheetName(workbook, preferredNames = []) {
    const names = workbook?.SheetNames || [];
    if (!names.length) return '';

    const normalizedPreferred = preferredNames.map((name) => normalizeCell(name).toLowerCase());
    const matched = names.find((sheetName) => normalizedPreferred.includes(normalizeCell(sheetName).toLowerCase()));
    return matched || names[0] || '';
}

export async function readWorkbookFromFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    return XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
}

export function readNormalizedSheetRows(workbook, preferredNames = []) {
    const sheetName = findSheetName(workbook, preferredNames);
    if (!sheetName) return [];
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }).map(normalizeRowKeys);
}

export function parseExcelDateTime(dateValue, outputFormat = 'YYYY-MM-DD HH:mm:ss') {
    if (dateValue === null || dateValue === undefined || dateValue === '') return '';

    if (typeof dateValue === 'number') {
        const parsed = XLSX.SSF.parse_date_code(dateValue);
        if (parsed) {
            const dt = new Date(
                parsed.y,
                (parsed.m || 1) - 1,
                parsed.d || 1,
                parsed.H || 0,
                parsed.M || 0,
                Math.floor(parsed.S || 0)
            );
            return moment(dt).format(outputFormat);
        }
    }

    const input = normalizeCell(dateValue);
    const parsed = moment(input, [
        'YYYY-MM-DD HH:mm:ss',
        'YYYY-MM-DD HH:mm',
        'YYYY-MM-DDTHH:mm:ss',
        'YYYY-MM-DDTHH:mm',
        'YYYY-MM-DD',
        'DD-MM-YYYY HH:mm:ss',
        'DD-MM-YYYY HH:mm',
        'DD-MM-YYYY',
        'MM/DD/YYYY HH:mm:ss',
        'MM/DD/YYYY HH:mm',
        'MM/DD/YYYY'
    ], true);

    if (!parsed.isValid()) return '';
    return parsed.format(outputFormat);
}

export function resolveIdByIdOrName(list, idValue, nameValue, nameKey = 'name') {
    const id = normalizeCell(idValue);
    if (id) {
        const foundById = (list || []).find((item) => String(item.id) === id);
        if (foundById) return foundById.id;
    }

    const name = normalizeCell(nameValue).toLowerCase();
    if (name) {
        const foundByName = (list || []).find((item) => normalizeCell(item?.[nameKey]).toLowerCase() === name);
        if (foundByName) return foundByName.id;
    }

    return null;
}
