<script setup>

import PageTitle from '@/components/PageTitle.vue';
import DataTable from '@/components/DataTable.vue';
import BaseButton from '@/components/BaseButton.vue';
import { onMounted, ref, computed } from 'vue';
import { DatePicker, useToast } from 'primevue';
import moment from 'moment'
import { useFilterStore } from '@/stores/filterStore';
import BaseInput from '@/components/BaseInput.vue';
import { useStockTransactionStore } from '@/stores/useStockTransactionStore';
import { watch } from 'vue';
import { getPresetRange } from '@/utils/datePresets';

const toast = useToast();
const filter = useFilterStore();
const useStockTransaction = useStockTransactionStore();

const searchValue = ref('');
const selectedReference = ref('');
const selectedType = ref('');
const dataList = ref([]);
const filteredData = ref({
    startedDate: moment().startOf('week').format('YYYY-MM-DDTHH:mm'),
    endedDate: moment().format('YYYY-MM-DDTHH:mm'),
    referenceType: 'adjustment',
});
// New DatePicker range state
const dateRange = ref(null); // [startDate, endDate]
const isDateLoading = ref(false);

onMounted(async () => {
    // restore saved filters for this page if present
    const saved = filter.getPageFilter('stock_transaction');
    if (saved) {
        if (saved.startedDate) filteredData.value.startedDate = saved.startedDate;
        if (saved.endedDate) filteredData.value.endedDate = saved.endedDate;
        if (saved.selectedReference) selectedReference.value = saved.selectedReference;
        if (saved.selectedType) selectedType.value = saved.selectedType;
        if (saved.searchValue) searchValue.value = saved.searchValue;
    }
    if (filteredData.value.startedDate && filteredData.value.endedDate) {
        dateRange.value = [
            moment(filteredData.value.startedDate).toDate(),
            moment(filteredData.value.endedDate).toDate()
        ];
    }
    await fetchStockTransactions();
    // persist current filters
    saveFilters();
});

async function fetchStockTransactions() {
    isDateLoading.value = true;
    try {
        // convert local datetime-local strings to backend friendly format (YYYY-MM-DD HH:mm:ss)
        const start = filteredData.value.startedDate
            ? moment(filteredData.value.startedDate).format('YYYY-MM-DD HH:mm:ss')
            : "";
        const end = filteredData.value.endedDate
            ? moment(filteredData.value.endedDate).format('YYYY-MM-DD HH:mm:ss')
            : "";

        await useStockTransaction.fetchStockTransactions({
            start_date: start,
            end_date: end
        });
        dataList.value = useStockTransaction.list || [];
        // persist current filters after fetch
        saveFilters();
    } finally {
        isDateLoading.value = false;
    }
}

// Persist filters for this page under the key 'stock_transaction'
function saveFilters() {
    filter.setPageFilter('stock_transaction', {
        startedDate: filteredData.value.startedDate,
        endedDate: filteredData.value.endedDate,
        selectedReference: selectedReference.value,
        selectedType: selectedType.value,
        searchValue: searchValue.value,
    });
}

function setFilteredDatesFromRange(range) {
    if (Array.isArray(range) && range[0] && range[1]) {
        const start = moment(range[0]).startOf('day');
        const end = moment(range[1]).endOf('day');
        filteredData.value.startedDate = start.format('YYYY-MM-DD HH:mm:ss');
        filteredData.value.endedDate = end.format('YYYY-MM-DD HH:mm:ss');
    } else {
        filteredData.value.startedDate = "";
        filteredData.value.endedDate = "";
    }
}

function applyPresetRange(preset) {
    const range = getPresetRange(preset);
    dateRange.value = range ? range : null;
}

// Table headers
const columns = [
    { key: 'id', label: 'ID' },
    {
        key: 'image_url', label: 'Image', formatter: (row) => {
            return `<img class="object-cover w-10 h-10 rounded" src="${row.inventory.product.image_url}" alt="${row.inventory.product.name}" />`;
        }
    },
    { key: 'inventory.product.name', label: 'Product', formatter: (row) => row.inventory.product.name },
    { key: 'inventory.product.barcode', label: 'Barcode', formatter: (row) => row.inventory.product.barcode },
    { key: 'inventory.id', label: 'Inventory ID', formatter: (row) => row.inventory.id },
    { key: 'reference_id', label: 'Reference Id'},
    { key: 'reference_date', label: 'Reference Date', formatter: (row) => moment(row.reference_date).format('DD-MM-YY HH:mm') },
    { key: 'inventory.warehouse.name', label: 'Warehouse', formatter: (row) => row.inventory.warehouse.name },
    { key: 'quantity_change', label: 'Qty' },
    { key: 'type', label: 'Type',  formatter: (row) => {
            const color = row.type === 'in' ? 'bg-green-500 text-white rounded-md py-1 px-2' : 'bg-red-500 text-white rounded-md py-1 px-2';
            return `<span class="text-white px-2 py-1 rounded ${color}">${row.type.toUpperCase()}</span>`;
        }
    },
    { key: 'reference_type', label: 'Reference Type', formatter: (row) => row.reference_type.toUpperCase() },
    { key: 'inventory.expired_date', label: 'Expire', formatter: (row) => row.inventory.expired_date ? moment(row.inventory.expired_date).format('DD-MM-YY') : "N/A" },
    // { key: 'created_by.name', label: 'Created By', formatter: (row) => row.created_by.name },
    // { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY HH:mm') },
];

// Sync and auto-fetch when DatePicker range changes
watch(dateRange, async (val) => {
    setFilteredDatesFromRange(val);
    const hasFullRange = Array.isArray(val) && val[0] && val[1];
    const cleared = val === null;
    if (hasFullRange || cleared) {
        await fetchStockTransactions();
    }
});

// watch filter inputs and persist changes so coming back restores them
watch([
    () => filteredData.value.startedDate,
    () => filteredData.value.endedDate,
    () => selectedReference.value,
    () => selectedType.value,
    () => searchValue.value
], () => {
    saveFilters();
});

// Derived options from fetched data for client-side filters
const referenceTypes = computed(() => {
    const map = new Map();
    (dataList.value || []).forEach(st => {
        if (st.reference_type) map.set(st.reference_type);
    });
    return Array.from(map.entries()).map(([name]) => ({ name }));
});

// Filter Function
const filteredRows = computed(() => {
    let list = (dataList.value || []).slice();
    // filter by reference type
    if (selectedReference.value) {
        list = list.filter(st => String(st.reference_type) === String(selectedReference.value));
    }
    // filter by transaction type
    if (selectedType.value) {
        list = list.filter(st => String(st.type) === String(selectedType.value));
    }
    // search across product name, reference id
    if (searchValue.value && searchValue.value.trim() !== '') {
        const q = searchValue.value.toLowerCase().trim();
        list = list.filter(st => {
            const product = st.inventory.product?.name || '';
            const reference_id = st.reference_id ? String(st.reference_id) : '';
            return product.toLowerCase().includes(q) || reference_id.toLowerCase().includes(q);
        });
    }
    return list;
});

//Branch delete function
async function deleteHandle(id) {
    await useUser.deleteUser(id);
    if (useUser.error) {
        toast.add({ severity: 'error', summary: 'Error Message', detail: useUser.error, life: 3000 });
        return
    }
    if (useUser.data.status === 200) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Inventory deleted successfully.', life: 3000 });
        await useUser.fetchAllUsers();
        dataList.value = useUser.users;
    }
}

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Stock Transaction List">
        </PageTitle>
        <!-- DataTable -->
        <DataTable 
            :columns="columns" :rows="filteredRows" :isAction="false"
            :isLoading="useStockTransaction.loading" :defaultSort="{ key: 'id', order: 'desc' }" @delete="deleteHandle"
            :filename="'Stock_Transaction'">
            <!-- Filter Section -->
            <template #filters>
                <div class="flex gap-2 items-center">
                    <DatePicker
                        v-model="dateRange"
                        selectionMode="range"
                        :manualInput="false"
                        showButtonBar
                        placeholder="Date range"
                        inputClass="h-[35px]"
                        :disabled="isDateLoading"
                    >
                        <template #buttonbar="{ clearCallback }">
                            <div class="flex justify-between w-full px-2 pb-2 gap-2 flex-wrap items-center">
                                <div class="flex gap-2 flex-wrap">
                                    <BaseButton size="sm" label="Today" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('today')" />
                                    <BaseButton size="sm" label="Yesterday" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('yesterday')" />
                                    <BaseButton size="sm" label="This Week" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisWeek')" />
                                    <BaseButton size="sm" label="This Month" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisMonth')" />
                                    <BaseButton size="sm" label="This Year" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisYear')" />
                                </div>
                                <div class="flex gap-2 items-center">
                                    <div v-if="isDateLoading" class="flex items-center text-xs text-gray-600 gap-2">
                                        <i class="pi pi-spin pi-spinner"></i>
                                        <span>Loading...</span>
                                    </div>
                                    <BaseButton size="sm" label="Clear" icon="pi pi-times" severity="danger" variant="outlined" :disabled="isDateLoading" @click="clearCallback" />
                                </div>
                            </div>
                        </template>
                    </DatePicker>

                    <select v-model="selectedReference" class="border p-2 rounded text-sm">
                        <option value="">All Status</option>
                        <option v-for="opt in referenceTypes" :key="opt.id" :value="opt.name">{{ opt.name }}</option>
                    </select>

                    <select v-model="selectedType" class="border p-2 rounded text-sm">
                        <option value="">All Type</option>
                        <option value="in">IN</option>
                        <option value="out">OUT</option>
                    </select>

                    <BaseInput 
                        size="sm"
                        v-model="searchValue"
                        placeholder="Search..."
                        icon="pi pi-search"
                        width="200px"
                        height="h-[35px]"
                    />
                </div>
            </template>
        </DataTable>
    </div>
</template>
