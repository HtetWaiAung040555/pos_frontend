<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import BaseButton from './BaseButton.vue';
import Loading from './Loading.vue';
import Dialog from 'primevue/dialog';
import { exportToXlsx } from '@/utils/exportXlsx';

const props = defineProps({
  columns: { type: Array, required: true }, // [{ key: 'name', label: 'Name' }]
  rows: { type: Array, required: true },    // your data array
  pageSize: { type: Number, default: 10 },
  isPaginate: {type: Boolean, default: false},
  isAction: {type: Boolean, default: true},
  editPath: {type: String, default: ""},
  deletePath: {type: String, default: ""},
  adjustPath: {type: String, default: ""},
  isLoading: {type: Boolean, default: false},
  defaultSort: {type: Object, default: () => ({key: null, order: 'desc'})},
  isEdit: {type: Boolean, default: true},
  isDelete: {type: Boolean, default: true},
  isAdjust: {type: Boolean, default: false},
  filename: {type: String, default: 'export'},
  isSearchable: {type: Boolean, default: false},
  // detailHeaders: array of column labels for detail rows. If empty, details won't be exported.
  detailHeaders: { type: Array, default: () => [] },
  // detailField: path on each row where detail(s) live (object or array). Default 'details'
  detailField: { type: String, default: 'details' },
  // detailKeys: array of key paths to extract from each detail object, matching detailHeaders order
  detailKeys: { type: Array, default: () => ['product.id', 'product.name', 'price', 'quantity', 'total'] },
  // totals config: enable subtotal/grand total rows
  totals: {
    type: Object,
    default: () => ({
      enabled: false,
      groupBy: null, // key/path for subtotal grouping (e.g. 'customer.id')
      showSubtotal: true,
      showGrandTotal: true,
      subtotalLabel: 'Subtotal',
      grandTotalLabel: 'Grand Total',
      labelColumnKey: null, // default: first column key
      blankValue: '–',
      columns: [] // [{ key: 'amount', type: 'sum', formatter: (v)=>v }]
    })
  }
});

const emit = defineEmits(['delete']);

const searchQuery = ref('');
const currentPage = ref(1);
const sortKey = ref(props.defaultSort.key);
const sortOrder = ref(props.defaultSort.order); // 'asc' or 'desc'
const visible = ref(false);
const rowId = ref('');

const totalsConfig = computed(() => ({
  enabled: !!props.totals?.enabled,
  groupBy: props.totals?.groupBy ?? null,
  showSubtotal: props.totals?.showSubtotal ?? true,
  showGrandTotal: props.totals?.showGrandTotal ?? true,
  subtotalLabel: props.totals?.subtotalLabel ?? 'Subtotal',
  grandTotalLabel: props.totals?.grandTotalLabel ?? 'Grand Total',
  labelColumnKey: props.totals?.labelColumnKey ?? (props.columns[0]?.key ?? null),
  blankValue: props.totals?.blankValue ?? '',
  groupCarryForward: props.totals?.groupCarryForward ?? false,
  columns: Array.isArray(props.totals?.columns) ? props.totals.columns : []
}));

// Reset sort when defaultSort prop changes (e.g., switching table modes)
watch(() => props.defaultSort, (val) => {
  sortKey.value = val?.key ?? null;
  sortOrder.value = val?.order ?? 'desc';
  currentPage.value = 1;
}, { deep: true });

// Filtered rows by search
const filteredRows = computed(() => {
  if (!searchQuery.value) return props.rows;
  return props.rows.filter(row =>
    Object.values(row).some(val =>
      String(val).toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  );
});

// Sorted rows
const sortedRows = computed(() => {
  if (!sortKey.value) return filteredRows.value;
  return [...filteredRows.value].sort((a, b) => {
    const aVal = a[sortKey.value];
    const bVal = b[sortKey.value];
    if (aVal < bVal) return sortOrder.value === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder.value === 'asc' ? 1 : -1;
    return 0;
  });
});

function getValueByPath(obj, path) {
  if (!path) return undefined;
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function isEmptyGroupValue(val) {
  return val === '' || val === null || val === undefined;
}

function initTotalsAcc() {
  const acc = {};
  totalsConfig.value.columns.forEach(col => {
    acc[col.key] = 0;
  });
  return acc;
}

function accumulateTotals(row, acc) {
  totalsConfig.value.columns.forEach(col => {
    const type = col.type || 'sum';
    if (type === 'count') {
      acc[col.key] += 1;
      return;
    }
    const raw = getValueByPath(row, col.key);
    const val = Number(raw || 0);
    acc[col.key] += isNaN(val) ? 0 : val;
  });
}

function makeTotalRow(kind, totals, label, groupValue) {
  return {
    __type: kind,
    __totals: { ...totals },
    __label: label,
    __groupValue: groupValue
  };
}

const displayRows = computed(() => {
  const baseRows = sortedRows.value;
  if (!totalsConfig.value.enabled || totalsConfig.value.columns.length === 0) {
    return baseRows;
  }

  const rowsWithTotals = [];
  const hasGroup = !!totalsConfig.value.groupBy;
  let currentGroup = null;
  let lastNonEmptyGroup = null;
  let subtotalAcc = initTotalsAcc();
  let grandAcc = initTotalsAcc();

  baseRows.forEach((row, idx) => {
    const rawGroupVal = hasGroup ? getValueByPath(row, totalsConfig.value.groupBy) : null;
    const groupVal = hasGroup && totalsConfig.value.groupCarryForward && isEmptyGroupValue(rawGroupVal)
      ? lastNonEmptyGroup
      : rawGroupVal;

    if (hasGroup && !isEmptyGroupValue(rawGroupVal)) {
      lastNonEmptyGroup = rawGroupVal;
    }

    if (hasGroup && currentGroup !== null && groupVal !== currentGroup && totalsConfig.value.showSubtotal) {
      rowsWithTotals.push(makeTotalRow('subtotal', subtotalAcc, totalsConfig.value.subtotalLabel, currentGroup));
      subtotalAcc = initTotalsAcc();
    }

    if (hasGroup && currentGroup === null) {
      currentGroup = groupVal;
    }

    rowsWithTotals.push(row);
    accumulateTotals(row, subtotalAcc);
    accumulateTotals(row, grandAcc);

    if (hasGroup) currentGroup = groupVal;

    if (idx === baseRows.length - 1 && hasGroup && totalsConfig.value.showSubtotal) {
      rowsWithTotals.push(makeTotalRow('subtotal', subtotalAcc, totalsConfig.value.subtotalLabel, currentGroup));
    }
  });

  if (baseRows.length > 0 && totalsConfig.value.showGrandTotal) {
    rowsWithTotals.push(makeTotalRow('grandtotal', grandAcc, totalsConfig.value.grandTotalLabel, null));
  }

  return rowsWithTotals;
});

function changeSort(key) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'asc';
  }
}

function changePage(page) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
}

// Pagination
const totalPages = computed(() => Math.ceil(displayRows.value.length / props.pageSize));

// Paginated rows
const paginatedRows = computed(() => {
  if (!props.isPaginate) return displayRows.value;
  const start = (currentPage.value - 1) * props.pageSize;
  return displayRows.value.slice(start, start + props.pageSize);
});

function getAlignClass(align) {
  if (align === 'right') return 'text-right';
  if (align === 'left') return 'text-left';
  return 'text-center';
}

// Pagination Pages Array
const paginationPages = computed(() => {
  const pages = [];
  const total = totalPages.value;
  const current = currentPage.value;

  if (total <= 7) {
    // Show all pages if small
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    // Always show first two pages
    pages.push(1);
    if (current > 3) pages.push('...');

    const startPage = Math.max(2, current - 1);
    const endPage = Math.min(total - 1, current + 1);

    for (let i = startPage; i <= endPage; i++) pages.push(i);

    if (current < total - 2) pages.push('...');
    pages.push(total);
  }
  return pages;
});

// Open delete modal function
function openModal(id) {
  visible.value = !visible.value;
  rowId.value = id;
}

// Confirm delete function
function confirmDelete() {
  emit('delete', rowId.value);
  visible.value = !visible.value;
}

function exportToExcel() {
  exportToXlsx({
    columns: props.columns,
    rows: props.rows,
    filename: props.filename,
    detailHeaders: props.detailHeaders,
    detailField: props.detailField,
    detailKeys: props.detailKeys,
  });
}

function isTotalRow(row) {
  return row && typeof row === 'object' && (row.__type === 'subtotal' || row.__type === 'grandtotal');
}

function isTotalColumn(colKey) {
  return totalsConfig.value.columns.some(c => c.key === colKey);
}

function formatTotalValue(row, colKey) {
  const colConfig = totalsConfig.value.columns.find(c => c.key === colKey);
  const raw = row?.__totals?.[colKey] ?? 0;
  if (colConfig?.formatter) return colConfig.formatter(raw, row);
  return raw;
}

</script>

<template>
  <div class="bg-white text-black rounded-lg shadow p-4 mt-3">
    <!-- Search -->
    <div class="mb-3">
      <div class="flex items-center gap-2">
        <div class="flex-1">
          <slot name="filters">
            <!-- Default fallback: search input -->
            <input v-if="isSearchable"
              type="text"
              v-model="searchQuery"
              placeholder="Search..."
              class="w-full border rounded px-3 py-2 text-sm"
            />
          </slot>
        </div>
        <div class="">
          <BaseButton
            label="Export"
            icon="fa fa-file-excel"
            size="sm"
            variant="solid"
            severity="success"
            @click="exportToExcel"
          />
        </div>
      </div>
    </div>

    <div class="flex flex-col max-h-[450px] overflow-hidden">

      <!-- Table -->
      <div class="flex-1 overflow-y-auto">
        <table class="w-full">
          <thead class="sticky top-0 z-10">
            <tr class="bg-gray-100">
              <th
                v-for="col in columns"
                :key="col.key"
                :class="['px-4 py-2 cursor-pointer select-none text-black', getAlignClass(col.align)]"
                @click="changeSort(col.key)"
              >
                {{ col.label }}
                <span class="text-[10px]" v-if="sortKey === col.key">
                  {{ sortOrder === 'asc' ? '▲' : '▼' }}
                </span>
              </th>
              <th 
                v-if="props.isAction"
                class="px-4 py-2 cursor-pointer select-none text-black"
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="paginatedRows.length === 0 && !isLoading">
              <td :colspan="columns.length + (props.isAction ? 1 : 0)" class="text-center py-4 text-gray-500">No data found</td>
            </tr>
            <tr v-if="isLoading">
              <td :colspan="columns.length + (props.isAction ? 1 : 0)" class="py-4 text-gray-500">
                <div class="flex items-center justify-center gap-2">
                  <Loading />
                </div>
              </td>
            </tr>
            <tr
              v-else
              v-for="(row, idx) in paginatedRows"
              :key="idx"
              :class="isTotalRow(row) ? 'bg-gray-50 text-[13px] font-semibold sticky bottom-0' : 'hover:bg-gray-50 text-[13px]'"
            >
              <template v-if="isTotalRow(row)">
                <td
                  v-for="col in columns"
                  :key="col.key"
                  :class="['p-2', getAlignClass(col.align)]"
                >
                  <template v-if="col.key === totalsConfig.labelColumnKey">
                    {{ row.__label }}
                  </template>
                  <template v-else-if="isTotalColumn(col.key)">
                    {{ formatTotalValue(row, col.key) }}
                  </template>
                  <template v-else>
                    {{ totalsConfig.blankValue }}
                  </template>
                </td>
                <td v-if="props.isAction" class="p-2 text-center w-[120px]"></td>
              </template>
              <template v-else>
                <td
                  v-for="col in columns"
                  :key="col.key"
                  :class="['p-2', getAlignClass(col.align)]"
                >
                  <template v-if="col.onClick">
                    <span
                      class="cursor-pointer text-blue-600 hover:underline"
                      @click="() => col.onClick(row)"
                    >
                      {{ col.formatter ? col.formatter(row) : row[col.key] }}
                    </span>
                  </template>
                  <template v-else-if="col.to">
                    <router-link
                      class="cursor-pointer text-blue-600 hover:underline"
                      :to="typeof col.to === 'function' ? col.to(row) : col.to"
                    >
                      {{ col.formatter ? col.formatter(row) : row[col.key] }}
                    </router-link>
                  </template>
                  <span v-else v-html="col.formatter ? col.formatter(row) : row[col.key]"></span>
                </td>
                <td class="p-2 text-center w-[120px]" v-if="props.isAction">
                  <router-link v-if="isAdjust" :to="{name: props.adjustPath, query: {id: row.id}}">
                    <BaseButton 
                      icon="pi pi-sliders-h" 
                      variant="text" 
                      size="sm" 
                    />
                  </router-link>
                  <router-link :to="{name: props.editPath, query: {id: row.id}}">
                    <BaseButton 
                      icon="pi pi-pen-to-square" 
                      variant="text" 
                      severity="info" 
                      size="sm" 
                      :disabled="isEdit"
                    />
                  </router-link>
                  <BaseButton 
                    icon="pi pi-trash" 
                    variant="text" 
                    severity="danger" 
                    size="sm" 
                    @click="openModal(row.id)" 
                    :disabled="isDelete"
                  />
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="isPaginate" class="sticky bottom-0 bg-white border-t border-gray-200">
        <div class="flex items-center justify-end mt-3 gap-2">
          <BaseButton 
            icon="fa fa-chevron-left" 
            variant="text"
            severity="contrast"
            size="sm"
            class="w-6 h-6"
            rounded
            :disabled="currentPage === 1"
            @click="changePage(currentPage - 1)"
          />
          <!-- Page Numbers -->
          <template v-for="(page, index) in paginationPages" :key="index">
            <span
              v-if="page === '...'"
              class="px-2 text-gray-500 select-none"
            >
              ...
            </span>
            <BaseButton
              v-else
              :label="String(page)"
              :variant="page === currentPage ? 'solid' : 'text'"
              severity="contrast"
              size="sm"
              class="w-6 h-6"
              rounded
              @click="changePage(page)"
            />
          </template>
          <!-- <span class="px-2 py-1">{{ currentPage }} / {{ totalPages }}</span> -->
          <BaseButton 
            icon="fa fa-chevron-right" 
            variant="text"
            severity="contrast"
            size="sm"
            class="w-6 h-6"
            rounded
            :disabled="currentPage === totalPages"
            @click="changePage(currentPage + 1)"
          />
        </div>
      </div>

    </div>

  </div>

  <Dialog v-model:visible="visible" :style="{ width: '300px', height: '100px' }" :modal="true" :draggable="false" :position="'center'">
    <template #container="{ closeCallback }">
      <div class="flex flex-col gap-y-4 p-4">
        <p class="m-0 text-black text-center">
          Are you sure you want to delete?
        </p>
        <div class="flex justify-center items-center gap-x-4">
          <BaseButton size="sm" label="Cancel" severity="danger" @click="openModal" />
          <BaseButton size="sm" label="Okay" severity="primary" @click="confirmDelete"  />
        </div>
      </div>
    </template>
    
  </Dialog>

</template>
