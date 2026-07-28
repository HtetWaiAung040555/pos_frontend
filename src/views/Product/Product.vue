<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue';
import moment from 'moment';
import PageTitle from '@/components/PageTitle.vue';
import DataTable from '@/components/DataTable.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseInput from '@/components/BaseInput.vue';
import { formatPrice } from '@/utils/const';
import { useFilterStore } from '@/stores/filterStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { useProductStore } from '@/stores/useProductStore';
import { exportToXlsx } from '@/utils/exportXlsx';

const router = useRouter();
const toast = useToast();
const filter = useFilterStore();
const usePermission = usePermissionStore();
const useProduct = useProductStore();

const searchValue = ref('');
const categoryFilter = ref('');
const statusFilter = ref('');
const startDate = ref('');
const endDate = ref('');
const showDateFilters = ref(false);
const dataList = ref([]);
const exportMenuVisible = ref(false);

const SUMMARY_EXPORT_COLUMNS = [
  { key: 'product_id', label: 'Product ID' },
  { key: 'product_name', label: 'Product Name' },
  { key: 'secondary_property', label: 'Secondary Property' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'category', label: 'Category' },
  { key: 'default_unit', label: 'Default Unit' },
  { key: 'sales_price', label: 'Sales Price' },
  { key: 'purchase_price', label: 'Purchase Price' },
  { key: 'unit_count', label: 'Units' },
  { key: 'branch_count', label: 'Branches' },
  { key: 'status', label: 'Status' },
  { key: 'created_by', label: 'Created By' },
  { key: 'created_at', label: 'Created At' },
  { key: 'updated_by', label: 'Updated By' },
  { key: 'updated_at', label: 'Updated At' },
];

const DETAIL_EXPORT_COLUMNS = [
  { key: 'product_id', label: 'Product ID' },
  { key: 'product_name', label: 'Product Name' },
  { key: 'secondary_property', label: 'Secondary Property' },
  { key: 'category', label: 'Category' },
  { key: 'product_status', label: 'Product Status' },
  { key: 'price_type', label: 'Price Type' },
  { key: 'branch', label: 'Branch' },
  { key: 'unit', label: 'Unit' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'conversion_to_base', label: 'Conversion To Base' },
  { key: 'min_qty', label: 'Minimum Qty' },
  { key: 'max_qty', label: 'Maximum Qty' },
  { key: 'product_unit_price', label: 'Product Unit Price' },
  { key: 'range_price', label: 'Range Price' },
  { key: 'product_branches', label: 'Product Branches' },
  { key: 'product_branches_range', label: 'Product Branches Range' },
  { key: 'price_status', label: 'Price Status' },
  { key: 'updated_at', label: 'Updated At' },
];

const totalProducts = computed(() => dataList.value.length);
const activeProducts = computed(() => dataList.value.filter((row) => row.status?.name === 'Active').length);
const totalProductUnits = computed(() => dataList.value.reduce((total, row) => total + (row.product_units?.length || 0), 0));
const productsWithBranchPricing = computed(() => dataList.value.filter((row) => (row.branch_products || []).length > 0).length);

const categories = computed(() => {
  const categoryMap = new Map();
  dataList.value.forEach((row) => {
    if (!row.category_id?.name) return;
    categoryMap.set(categoryKey(row.category_id), row.category_id.name);
  });
  return [...categoryMap.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

const statuses = computed(() => {
  return [...new Set(dataList.value.map((row) => row.status?.name).filter(Boolean))].sort();
});

const hasActiveFilters = computed(() => (
  !!searchValue.value
  || !!categoryFilter.value
  || !!statusFilter.value
  || !!startDate.value
  || !!endDate.value
));

onMounted(async () => {
  const saved = filter.getPageFilter('product');
  if (saved) {
    startDate.value = saved.startDate || '';
    endDate.value = saved.endDate || '';
    searchValue.value = saved.searchValue || '';
    categoryFilter.value = saved.categoryFilter || '';
    statusFilter.value = saved.statusFilter || '';
    showDateFilters.value = !!(startDate.value || endDate.value);
  }

  await loadProducts();
  saveFilters();
});

watch(
  [startDate, endDate, searchValue, categoryFilter, statusFilter],
  saveFilters
);

function saveFilters() {
  filter.setPageFilter('product', {
    startDate: startDate.value,
    endDate: endDate.value,
    searchValue: searchValue.value,
    categoryFilter: categoryFilter.value,
    statusFilter: statusFilter.value,
  });
}

async function loadProducts() {
  await useProduct.fetchAllProduct();
  dataList.value = Array.isArray(useProduct.productList) ? useProduct.productList : [];
}

function safeName(value) {
  return value?.name || '-';
}

function categoryKey(category) {
  return String(category?.id ?? category?.name ?? '');
}

function productUnitName(productUnit) {
  return productUnit?.unit_id?.name || productUnit?.unit_name || '-';
}

function defaultProductUnit(row) {
  if (row.default_product_unit?.id) return row.default_product_unit;
  return row.product_units?.find((unit) => unit.is_default_sale_unit)
    || row.product_units?.find((unit) => unit.is_base_unit)
    || row.product_units?.[0]
    || null;
}

function formatProductName(row) {
  const secondaryProperty = String(row.sec_prop ?? '').trim();
  const hasSecondaryProperty = secondaryProperty && secondaryProperty.toLowerCase() !== 'null';
  return hasSecondaryProperty ? `${row.name} · ${secondaryProperty}` : row.name;
}

function formatDefaultBarcode(row) {
  return defaultProductUnit(row)?.barcode || row.barcode || '-';
}

function formatDefaultUnit(row) {
  const productUnit = defaultProductUnit(row);
  return productUnit ? productUnitName(productUnit) : safeName(row.unit_id);
}

function formatDefaultPrice(row) {
  return formatPrice(defaultProductUnit(row)?.price ?? row.price ?? 0);
}

function formatBranchCount(row) {
  return (row.branch_products || []).length;
}

function formatUpdatedAt(row) {
  return row.updated_at ? moment(row.updated_at).format('DD MMM YY, HH:mm') : '-';
}

function exportDate(value) {
  if (!value) return '';
  const date = moment(value);
  return date.isValid() ? date.format('YYYY-MM-DD HH:mm') : String(value);
}

function numericExportValue(value) {
  if (value === '' || value === null || value === undefined) return '';
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : '';
}

function exportStatus(item) {
  if (item?.status?.name) return item.status.name;
  if (item?.status_id === '' || item?.status_id === null || item?.status_id === undefined) return '';
  return Number(item.status_id) === 2 ? 'Inactive' : 'Active';
}

function findBranchProductUnit(row, unitPrice) {
  if (unitPrice?.product_unit) return unitPrice.product_unit;

  const productUnits = Array.isArray(row?.product_units) ? row.product_units : [];
  return productUnits.find((unit) => (
    unitPrice?.product_unit_id
    && Number(unit.id) === Number(unitPrice.product_unit_id)
  )) || productUnits.find((unit) => (
    unitPrice?.unit_id
    && Number(unit.unit_id?.id || unit.unit_id) === Number(unitPrice.unit_id)
  )) || null;
}

function priceDetailBase(row) {
  return {
    product_id: row.id,
    product_name: row.name || '',
    secondary_property: row.sec_prop || '',
    category: row.category_id?.name || '',
    product_status: row.status?.name || '',
    branch: '',
    unit: '',
    barcode: '',
    conversion_to_base: '',
    min_qty: '',
    max_qty: '',
    product_unit_price: '',
    range_price: '',
    product_branches: '',
    product_branches_range: '',
    price_status: '',
    updated_at: exportDate(row.updated_at),
  };
}

function summaryExportRows() {
  return filteredRows.value.map((row) => {
    const defaultUnit = defaultProductUnit(row);
    return {
      product_id: row.id,
      product_name: row.name || '',
      secondary_property: row.sec_prop || '',
      barcode: defaultUnit?.barcode || row.barcode || '',
      category: row.category_id?.name || '',
      default_unit: defaultUnit ? productUnitName(defaultUnit) : row.unit_id?.name || '',
      sales_price: numericExportValue(defaultUnit?.price ?? row.price),
      purchase_price: numericExportValue(defaultUnit?.purchase_price ?? row.purchase_price),
      unit_count: Array.isArray(row.product_units) ? row.product_units.length : 0,
      branch_count: Array.isArray(row.branch_products) ? row.branch_products.length : 0,
      status: row.status?.name || '',
      created_by: row.created_by?.name || '',
      created_at: exportDate(row.created_at),
      updated_by: row.updated_by?.name || '',
      updated_at: exportDate(row.updated_at),
    };
  });
}

function detailExportRows() {
  return filteredRows.value.flatMap((row) => {
    const details = [];
    const productUnits = Array.isArray(row.product_units) ? row.product_units : [];

    if (!productUnits.length) {
      details.push({
        ...priceDetailBase(row),
        price_type: 'product_unit_price',
        unit: row.unit_id?.name || '',
        barcode: row.barcode || '',
        conversion_to_base: 1,
        product_unit_price: numericExportValue(row.price),
        price_status: row.status?.name || '',
      });
    }

    productUnits.forEach((unit) => {
      const unitBase = {
        ...priceDetailBase(row),
        unit: productUnitName(unit),
        barcode: unit.barcode || row.barcode || '',
        conversion_to_base: numericExportValue(unit.conversion_to_base),
      };

      details.push({
        ...unitBase,
        price_type: 'product_unit_price',
        product_unit_price: numericExportValue(unit.price),
        price_status: exportStatus(unit),
      });

      (unit.price_ranges || []).forEach((range) => {
        details.push({
          ...unitBase,
          price_type: 'range_price',
          min_qty: numericExportValue(range.min_qty),
          max_qty: numericExportValue(range.max_qty),
          range_price: numericExportValue(range.price),
          price_status: exportStatus(range),
        });
      });
    });

    (row.branch_products || []).forEach((branchProduct) => {
      const branch = branchProduct.branch?.name || '';
      const unitPrices = Array.isArray(branchProduct.unit_prices) ? branchProduct.unit_prices : [];

      if (!unitPrices.length && branchProduct.price !== null && branchProduct.price !== undefined) {
        const defaultUnit = defaultProductUnit(row);
        details.push({
          ...priceDetailBase(row),
          price_type: 'product_branches',
          branch,
          unit: defaultUnit ? productUnitName(defaultUnit) : row.unit_id?.name || '',
          barcode: defaultUnit?.barcode || row.barcode || '',
          conversion_to_base: numericExportValue(defaultUnit?.conversion_to_base ?? 1),
          product_branches: numericExportValue(branchProduct.price),
          price_status: exportStatus(branchProduct),
        });
      }

      unitPrices.forEach((unitPrice) => {
        const productUnit = findBranchProductUnit(row, unitPrice);
        const branchUnitBase = {
          ...priceDetailBase(row),
          branch,
          unit: unitPrice.unit_name || productUnitName(productUnit),
          barcode: productUnit?.barcode || row.barcode || '',
          conversion_to_base: numericExportValue(productUnit?.conversion_to_base),
        };

        details.push({
          ...branchUnitBase,
          price_type: 'product_branches',
          product_branches: numericExportValue(unitPrice.price),
          price_status: exportStatus(unitPrice),
        });

        (unitPrice.price_ranges || []).forEach((range) => {
          details.push({
            ...branchUnitBase,
            price_type: 'product_branches_range',
            min_qty: numericExportValue(range.min_qty),
            max_qty: numericExportValue(range.max_qty),
            product_branches_range: numericExportValue(range.price),
            price_status: exportStatus(range),
          });
        });
      });
    });

    return details;
  });
}

function exportSummary() {
  exportMenuVisible.value = false;
  const rows = summaryExportRows();
  if (!rows.length) {
    toast.add({ severity: 'warn', summary: 'Nothing to Export', detail: 'No products match the current filters.', life: 3000 });
    return;
  }

  const filename = exportToXlsx({
    columns: SUMMARY_EXPORT_COLUMNS,
    rows,
    filename: 'Products_Summary',
    sheetName: 'Product Summary',
    columnWidths: [12, 32, 24, 22, 24, 18, 16, 16, 10, 10, 14, 22, 20, 22, 20],
    preserveTypes: true,
    autoFilter: true,
  });
  if (!filename) {
    toast.add({ severity: 'error', summary: 'Export Failed', detail: 'The product summary workbook could not be created.', life: 3500 });
  }
}

function exportDetails() {
  exportMenuVisible.value = false;
  const rows = detailExportRows();
  if (!rows.length) {
    toast.add({ severity: 'warn', summary: 'Nothing to Export', detail: 'No product price details match the current filters.', life: 3000 });
    return;
  }

  const filename = exportToXlsx({
    columns: DETAIL_EXPORT_COLUMNS,
    rows,
    filename: 'Products_Details',
    sheetName: 'Product Price Details',
    columnWidths: [12, 32, 24, 24, 16, 28, 24, 18, 22, 20, 14, 14, 18, 16, 18, 24, 16, 20],
    preserveTypes: true,
    autoFilter: true,
  });
  if (!filename) {
    toast.add({ severity: 'error', summary: 'Export Failed', detail: 'The product details workbook could not be created.', life: 3500 });
  }
}

function formatStatus(row) {
  const active = row.status?.name === 'Active';
  const classes = active
    ? 'bg-green-50 text-green-700 ring-green-200'
    : 'bg-gray-100 text-gray-600 ring-gray-200';
  return `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${classes}">${row.status?.name || '-'}</span>`;
}

const columns = [
  {
    key: 'name',
    label: 'Product',
    align: 'left',
    formatter: formatProductName,
    onClick: (row) => router.push({ name: 'View Product', query: { id: row.id } }),
  },
  { key: 'barcode', label: 'Barcode', align: 'left', formatter: formatDefaultBarcode },
  { key: 'category_id.name', label: 'Category', align: 'left', formatter: (row) => safeName(row.category_id) },
  { key: 'default_product_unit', label: 'Default unit', align: 'left', formatter: formatDefaultUnit },
  { key: 'price', label: 'Sales price', align: 'right', formatter: formatDefaultPrice },
  { key: 'product_units', label: 'Units', formatter: (row) => row.product_units?.length || 0 },
  { key: 'branch_products', label: 'Branches', formatter: formatBranchCount },
  { key: 'status', label: 'Status', formatter: formatStatus },
  { key: 'updated_at', label: 'Updated', align: 'left', formatter: formatUpdatedAt },
];

const filteredRows = computed(() => {
  const query = searchValue.value.trim().toLowerCase();
  let rows = dataList.value.filter((row) => {
    const defaultUnit = defaultProductUnit(row);
    const searchText = [
      row.name,
      row.sec_prop,
      row.barcode,
      defaultUnit?.barcode,
      row.category_id?.name,
      productUnitName(defaultUnit),
      ...(row.product_units || []).map(productUnitName),
      ...(row.branch_products || []).map((item) => item.branch?.name),
    ].filter(Boolean).join(' ').toLowerCase();

    const matchesSearch = !query || searchText.includes(query);
    const matchesCategory = !categoryFilter.value || categoryKey(row.category_id) === categoryFilter.value;
    const matchesStatus = !statusFilter.value || row.status?.name === statusFilter.value;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  rows = filter.dateRangeFilter(rows, {
    dateField: 'created_at',
    startDate: startDate.value,
    endDate: endDate.value,
  });

  return rows;
});

const filteredDetailCount = computed(() => detailExportRows().length);

function clearFilters() {
  searchValue.value = '';
  categoryFilter.value = '';
  statusFilter.value = '';
  startDate.value = '';
  endDate.value = '';
  showDateFilters.value = false;
}

async function deleteHandle(id) {
  await useProduct.deleteProduct(id);
  if (useProduct.error.length) {
    useProduct.error.forEach((msg) => {
      toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 3000 });
    });
    return;
  }

  if (useProduct.data?.status === 200) {
    toast.add({ severity: 'success', summary: 'Product deleted', detail: 'The product was deleted successfully.', life: 3000 });
    await loadProducts();
  }
}
</script>

<template>
  <div class="p-3 sm:p-4 lg:p-6">
    <div class="mx-auto w-full max-w-screen-2xl">
      <PageTitle title="Products">
        <template #titleButtons>
          <div class="flex items-center gap-2">
            <BaseButton
              :icon="useProduct.loading ? 'fa fa-spinner' : 'fa fa-rotate-right'"
              label="Refresh"
              variant="outlined"
              severity="secondary"
              :isLoading="useProduct.loading"
              :disabled="useProduct.loading"
              @click="loadProducts"
            />
            <BaseButton
              v-if="usePermission.can('Product', 'Create')"
              icon="fa fa-circle-plus"
              label="New product"
              severity="primary"
              @click="router.push('/product/create')"
            />
          </div>
        </template>
      </PageTitle>

      <DataTable
        :columns="columns"
        :rows="filteredRows"
        editPath="Update Product"
        :isLoading="useProduct.loading"
        :defaultSort="{ key: 'updated_at', order: 'desc' }"
        :isEdit="!usePermission.can('Product', 'Update')"
        :isDelete="!usePermission.can('Product', 'Delete')"
        :isPaginate="true"
        :pageSize="50"
        filename="Products"
        @delete="deleteHandle"
      >
        <template #export-actions>
          <div class="relative">
            <BaseButton
              label="Export"
              icon="fa fa-file-excel"
              size="sm"
              variant="solid"
              severity="success"
              aria-haspopup="menu"
              :aria-expanded="exportMenuVisible"
              @click="exportMenuVisible = !exportMenuVisible"
            />
            <button
              v-if="exportMenuVisible"
              type="button"
              class="fixed inset-0 z-20 cursor-default bg-transparent"
              aria-label="Close export options"
              @click="exportMenuVisible = false"
            ></button>
            <div
              v-if="exportMenuVisible"
              class="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-xl"
              role="menu"
            >
              <div class="border-b border-gray-100 px-4 py-3">
                <div class="text-sm font-semibold text-gray-900">Export products</div>
                <div class="mt-0.5 text-xs text-gray-500">Uses the current search and filters</div>
              </div>
              <button
                type="button"
                class="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50"
                role="menuitem"
                @click="exportSummary"
              >
                <i class="fa fa-table-list mt-0.5 text-green-600"></i>
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-gray-900">Export Summary</span>
                  <span class="mt-0.5 block text-xs text-gray-500">
                    {{ filteredRows.length }} {{ filteredRows.length === 1 ? 'product' : 'products' }}, one row each
                  </span>
                </span>
              </button>
              <button
                type="button"
                class="flex w-full items-start gap-3 border-t border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
                role="menuitem"
                @click="exportDetails"
              >
                <i class="fa fa-list-check mt-0.5 text-blue-600"></i>
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-gray-900">Export Details</span>
                  <span class="mt-0.5 block text-xs text-gray-500">
                    {{ filteredDetailCount }} {{ filteredDetailCount === 1 ? 'price row' : 'price rows' }}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </template>
        <template #filters>
          <div class="flex min-w-0 flex-col gap-3">
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_200px_170px_auto_auto]">
              <BaseInput
                v-model="searchValue"
                size="sm"
                placeholder="Search name, barcode, unit, branch..."
                height="h-[40px]"
                icon="pi pi-search"
              />

              <select v-model="categoryFilter" class="h-[40px] min-w-0 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-900">
                <option value="">All categories</option>
                <option v-for="category in categories" :key="category.value" :value="category.value">{{ category.label }}</option>
              </select>

              <select v-model="statusFilter" class="h-[40px] min-w-0 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-900">
                <option value="">All statuses</option>
                <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
              </select>

              <BaseButton
                :label="showDateFilters ? 'Hide dates' : 'Created date'"
                icon="fa fa-calendar-days"
                variant="outlined"
                severity="secondary"
                class="h-[40px] whitespace-nowrap"
                @click="showDateFilters = !showDateFilters"
              />

              <BaseButton
                v-if="hasActiveFilters"
                label="Clear"
                icon="fa fa-xmark"
                variant="text"
                severity="secondary"
                class="h-[40px]"
                @click="clearFilters"
              />
            </div>

            <div v-if="showDateFilters" class="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-end">
              <div class="w-full sm:w-[200px]">
                <label class="mb-1 block text-xs font-medium text-gray-600">Created from</label>
                <BaseInput v-model="startDate" size="sm" type="date" height="h-[38px]" />
              </div>
              <div class="w-full sm:w-[200px]">
                <label class="mb-1 block text-xs font-medium text-gray-600">Created to</label>
                <BaseInput v-model="endDate" size="sm" type="date" height="h-[38px]" />
              </div>
            </div>

            <div class="flex items-center gap-2 text-xs text-gray-500">
              <span class="font-medium text-gray-700">{{ filteredRows.length.toLocaleString('en-US') }}</span>
              <span>{{ filteredRows.length === 1 ? 'product' : 'products' }}</span>
              <span v-if="hasActiveFilters">matching your filters</span>
            </div>
          </div>
        </template>
      </DataTable>
    </div>
  </div>
</template>
