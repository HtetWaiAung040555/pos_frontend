<script setup>
import { ref, computed, onMounted } from 'vue';
import BaseButton from './BaseButton.vue';
import Loading from './Loading.vue';
import Dialog from 'primevue/dialog';

const props = defineProps({
  columns: { type: Array, required: true }, // [{ key: 'name', label: 'Name' }]
  rows: { type: Array, required: true },    // your data array
  pageSize: { type: Number, default: 5 },
  isAction: {type: Boolean, default: true},
  editPath: {type: String, default: ""},
  deletePath: {type: String, default: ""},
  adjustPath: {type: String, default: ""},
  isLoading: {type: Boolean, default: false},
  defaultSort: {type: Object, default: () => ({key: null, order: 'desc'})},
  isEdit: {type: Boolean, default: true},
  isDelete: {type: Boolean, default: true},
  isAdjust: {type: Boolean, default: false},
});

const emit = defineEmits(['delete']);

const searchQuery = ref('');
const currentPage = ref(1);
const sortKey = ref(props.defaultSort.key);
const sortOrder = ref(props.defaultSort.order); // 'asc' or 'desc'
const visible = ref(false);
const rowId = ref('');

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
const totalPages = computed(() => Math.ceil(sortedRows.value.length / props.pageSize));

// Paginated rows
const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * props.pageSize;
  return sortedRows.value.slice(start, start + props.pageSize);
});

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

</script>

<template>
  <div class="bg-white text-black rounded-lg shadow p-4 mt-3">
    <!-- Search -->
    <div class="mb-3">
      <slot name="filters">
        <!-- Default fallback: search input -->
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Search..."
          class="w-full border rounded px-3 py-2 text-sm"
        />
      </slot>
    </div>

    <div class="flex flex-col max-h-[300px] overflow-hidden">

      <!-- Table -->
      <div class="flex-1 overflow-y-auto">
        <table class="w-full">
          <thead class="sticky top-0 z-10">
            <tr class="bg-gray-100">
              <th
                v-for="col in columns"
                :key="col.key"
                class="px-4 py-2 cursor-pointer select-none text-black"
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
              <td :colspan="columns.length" class="text-center py-4 text-gray-500">No data found</td>
            </tr>
            <tr v-if="isLoading">
              <td :colspan="columns.length" class="py-4 text-gray-500">
                <div class="flex items-center justify-center gap-2">
                  <Loading />
                </div>
              </td>
            </tr>
            <tr
              v-else
              v-for="(row, idx) in paginatedRows"
              :key="idx"
              class="hover:bg-gray-50 text-[13px]"
            >
              <td
                v-for="col in columns"
                :key="col.key"
                class="p-2 text-center"
                v-html="col.formatter ? col.formatter(row) : row[col.key]"
              >
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
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="sticky bottom-0 bg-white border-t border-gray-200">
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
