import { defineStore } from "pinia";

function startOfDay(d) {
  const x = new Date(d);
  return Number.isNaN(+x) ? null : new Date(x.getFullYear(), x.getMonth(), x.getDate());
}
function endOfDay(d) {
  const x = new Date(d);
  return Number.isNaN(+x) ? null : new Date(x.getFullYear(), x.getMonth(), x.getDate(), 23, 59, 59, 999);
}

export const useFilterStore = defineStore('filter', {
    state: () => ({}),
    actions: {
        searchFunction(data, searchValue, fields) {
            if (!searchValue) return data;
            const query = searchValue.toLowerCase();
            return data.filter(item =>
                fields.some(field => {
                    const value = field.split(".").reduce((o, key) => o?.[key], item);
                    return value?.toString().toLowerCase().includes(query);
                })
            );
        },
        dateRangeFilter(data, { dateField, startDate, endDate }) {
            if (!Array.isArray(data) || !dateField) return Array.isArray(data) ? data : [];
            const hasStart = !!startDate;
            const hasEnd = !!endDate;
            if (!hasStart && !hasEnd) return data;

            const s = hasStart ? startOfDay(startDate) : null;
            const e = hasEnd ? endOfDay(endDate) : null;

            return data.filter((item) => {
                const raw = item?.[dateField];
                const d = new Date(raw);
                if (Number.isNaN(+d)) return false;

                const t = d.getTime();
                const tStart = s ? s.getTime() : -Infinity;
                const tEnd = e ? e.getTime() : Infinity;
                return t >= tStart && t <= tEnd;
            });
        },
    }
})