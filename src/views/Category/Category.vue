<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue';
import moment from 'moment';
import PageTitle from '@/components/PageTitle.vue';
import DataTable from '@/components/DataTable.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseInput from '@/components/BaseInput.vue';
import { useFilterStore } from '@/stores/filterStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { categoryCode, flattenCategories } from '@/utils/categories';

const router = useRouter();
const toast = useToast();
const filter = useFilterStore();
const usePermission = usePermissionStore();
const useCategory = useCategoryStore();

const searchValue = ref('');
const startDate = ref('');
const endDate = ref('');

onMounted(loadCategories);

async function loadCategories() {
  await useCategory.fetchAllCategory();
  useCategory.error.forEach((message) => {
    toast.add({
      severity: 'error',
      summary: 'Categories could not be loaded',
      detail: message,
      life: 5000,
    });
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatCategoryName(row) {
  const indent = Math.max(0, Number(row.depth ?? 0)) * 18;
  const branch = row.depth > 0 ? '<span class="mr-1 text-gray-400">↳</span>' : '';
  return `<span class="inline-flex items-center" style="padding-left:${indent}px">${branch}${escapeHtml(row.name)}</span>`;
}

function formatStatus(row) {
  const name = row.status?.name
    ?? (Number(row.status_id ?? 1) === 1 ? 'Active' : 'Inactive');
  const classes = String(name).toLowerCase() === 'active'
    ? 'bg-green-100 text-green-800 ring-green-600/20'
    : 'bg-red-100 text-red-800 ring-red-600/20';
  return `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${classes}">${escapeHtml(name)}</span>`;
}

const treeRows = computed(() => {
  const flattened = flattenCategories(useCategory.categoryList);
  const pathById = new Map(flattened.map((category) => [String(category.id), category.path_label]));

  return flattened.map((category) => ({
    ...category,
    parent_path: category.parent_id === null || category.parent_id === undefined
      ? 'Root'
      : pathById.get(String(category.parent_id)) || category.parent?.name || 'Unknown parent',
  }));
});

const filteredRows = computed(() => {
  const query = searchValue.value.trim().toLowerCase();
  const searchedRows = !query
    ? treeRows.value
    : treeRows.value.filter((category) => (
      [
        category.name,
        categoryCode(category),
        category.path_label,
        category.parent_path,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    ));

  return filter.dateRangeFilter(searchedRows, {
    dateField: 'created_at',
    startDate: startDate.value,
    endDate: endDate.value,
  });
});

const columns = [
  {
    key: 'name',
    label: 'Category',
    align: 'left',
    formatter: formatCategoryName,
    secondaryFormatter: (row) => row.path_label,
  },
  {
    key: 'code',
    label: 'Code',
    align: 'left',
    formatter: (row) => escapeHtml(categoryCode(row) || '—'),
  },
  { key: 'parent_path', label: 'Parent', align: 'left' },
  { key: 'sort_order', label: 'Sort order', formatter: (row) => row.sort_order ?? 0 },
  { key: 'status', label: 'Status', formatter: formatStatus },
  {
    key: 'created_by.name',
    label: 'Created by',
    formatter: (row) => escapeHtml(row.created_by?.name || '—'),
  },
  {
    key: 'updated_at',
    label: 'Updated',
    align: 'left',
    formatter: (row) => row.updated_at ? moment(row.updated_at).format('DD MMM YY, HH:mm') : '—',
  },
];

async function deleteHandle(id) {
  await useCategory.deleteCategory(id);

  if (useCategory.error.length) {
    useCategory.error.forEach((message) => {
      toast.add({
        severity: 'error',
        summary: useCategory.deleteBlockers.length ? 'Category is in use' : 'Category could not be deleted',
        detail: message,
        life: 6000,
      });
    });
    return;
  }

  if (useCategory.data?.status === 200) {
    toast.add({
      severity: 'success',
      summary: 'Category deleted',
      detail: 'The category was deleted successfully.',
      life: 3000,
    });
    await loadCategories();
  }
}
</script>

<template>
  <div class="p-4">
    <PageTitle title="Categories">
      <template #titleButtons>
        <div class="flex items-center gap-2">
          <BaseButton
            :icon="useCategory.loading ? 'fa fa-spinner' : 'fa fa-rotate-right'"
            label="Refresh"
            severity="secondary"
            variant="outlined"
            :isLoading="useCategory.loading"
            :disabled="useCategory.loading"
            @click="loadCategories"
          />
          <BaseButton
            v-if="usePermission.can('Category', 'Create')"
            icon="fa fa-circle-plus"
            label="Create"
            severity="primary"
            @click="router.push('/category/create')"
          />
        </div>
      </template>
    </PageTitle>

    <DataTable
      :columns="columns"
      :rows="filteredRows"
      editPath="Update Category"
      :isLoading="useCategory.loading"
      :defaultSort="{ key: null, order: 'asc' }"
      :isEdit="!usePermission.can('Category', 'Update')"
      :isDelete="!usePermission.can('Category', 'Delete')"
      :isPaginate="true"
      :pageSize="50"
      filename="Categories"
      @delete="deleteHandle"
    >
      <template #filters>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <BaseInput
            v-model="searchValue"
            size="sm"
            placeholder="Search name, path, or code..."
            icon="pi pi-search"
            height="h-[40px]"
          />
          <BaseInput
            v-model="startDate"
            size="sm"
            type="date"
            placeholder="Created from"
            height="h-[40px]"
          />
          <BaseInput
            v-model="endDate"
            size="sm"
            type="date"
            placeholder="Created to"
            height="h-[40px]"
          />
        </div>
      </template>
    </DataTable>
  </div>
</template>
