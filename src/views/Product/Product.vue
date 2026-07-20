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
