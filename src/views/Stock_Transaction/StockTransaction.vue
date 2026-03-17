<script setup>

import PageTitle from '@/components/PageTitle.vue';
import DataTable from '@/components/DataTable.vue';
import BaseButton from '@/components/BaseButton.vue';
import { onMounted, ref, computed } from 'vue';
import { DatePicker, Dialog, useToast } from 'primevue';
import moment from 'moment'
import { useFilterStore } from '@/stores/filterStore';
import BaseInput from '@/components/BaseInput.vue';
import { useStockTransactionStore } from '@/stores/useStockTransactionStore';
import { watch } from 'vue';
import { getPresetRange } from '@/utils/datePresets';
import DashboardCard from '@/components/DashboardCard.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import exportToXlsx from '@/utils/exportXlsx';

const toast = useToast();
const filter = useFilterStore();
const useStockTransaction = useStockTransactionStore();

const searchProductValue = ref('');
const searchReference = ref('');
const selectedReferenceType = ref('');
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
const pagination = ref({});
const selectedPerPage = ref(100);
const stockTransactionFilter = ref(false);
const referenceTypes = [
    { label: 'All', value: '' },
    { label: 'Sale', value: 'sale' },
    { label: 'Sale Update', value: 'sale_update' },
    { label: 'Sale Void', value: 'sale_void' },
    { label: 'Purchase', value: 'purchase' },
    { label: 'Purchase Update', value: 'purchase_update' },
    { label: 'Purchase Void', value: 'purchase_void' },
    { label: 'Opening', value: 'opening' },
    { label: 'Opening Adjustment', value: 'opening_adjustment' },
    { label: 'Opening Void', value: 'opening_void' },
    { label: 'Adjustment', value: 'adjustment' },
];

onMounted(async () => {
    // restore saved filters for this page if present
    const saved = filter.getPageFilter('stock_transaction');
    if (saved) {
        if (saved.startedDate) filteredData.value.startedDate = saved.startedDate;
        if (saved.endedDate) filteredData.value.endedDate = saved.endedDate;
        if (saved.selectedReferenceType) selectedReferenceType.value = saved.selectedReferenceType;
        if (saved.selectedType) selectedType.value = saved.selectedType;
        if (saved.searchProductValue) searchProductValue.value = saved.searchProductValue;
        if (saved.searchReference) searchReference.value = saved.searchReference;
        if (saved.selectedPerPage) selectedPerPage.value = saved.selectedPerPage;
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

async function fetchStockTransactions(pagePayload = 1) {
    const payloadIsObject = pagePayload && typeof pagePayload === 'object';
    const page = payloadIsObject ? Number(pagePayload.page || 1) : Number(pagePayload || 1);
    const perPage = payloadIsObject
        ? Number(pagePayload.perPage || selectedPerPage.value || 100)
        : Number(selectedPerPage.value || 100);

    if (payloadIsObject && pagePayload.perPage) {
        selectedPerPage.value = perPage;
    }
    isDateLoading.value = true;
    try {
        // convert local datetime-local strings to backend friendly format (YYYY-MM-DD HH:mm:ss)
        const start = filteredData.value.startedDate
            ? moment(filteredData.value.startedDate).format('YYYY-MM-DD HH:mm:ss')
            : "";
        const end = filteredData.value.endedDate
            ? moment(filteredData.value.endedDate).format('YYYY-MM-DD HH:mm:ss')
            : "";
        const payload = {
            start_date: start,
            end_date: end,
            referenceType: selectedReferenceType.value,
            type: selectedType.value,
            product: searchProductValue.value,
            referenceId: searchReference.value,
        }
        await useStockTransaction.fetchStockTransactions(payload, page, perPage);
        dataList.value = useStockTransaction.list || [];
        pagination.value = useStockTransaction.pagination || {};
        await useStockTransaction.fetchTransactionDashboard(payload);
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
        selectedReferenceType: selectedReferenceType.value,
        selectedType: selectedType.value,
        searchProductValue: searchProductValue.value,
        searchReference: searchReference.value,
        selectedPerPage: selectedPerPage.value,
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
    // if (hasFullRange || cleared) {
    //     await fetchStockTransactions();
    // }
});

// watch filter inputs and persist changes so coming back restores them
watch([
    () => filteredData.value.startedDate,
    () => filteredData.value.endedDate,
    () => selectedReferenceType.value,
    () => selectedType.value,
    () => searchProductValue.value,
    () => searchReference.value,
    () => selectedPerPage.value,
], () => {
    saveFilters();
});

function applyRangeAndClose() {
    // use existing filteredData values and fetch
    fetchStockTransactions();
    stockTransactionFilter.value = false;
}

//stock delete function
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

const remainingStock = computed(() => {
    return useStockTransaction.dashboardData.total_in - useStockTransaction.dashboardData.total_out;
});

async function exportToExcel() {
    await useStockTransaction.exportTransaction({
        start_date: filteredData.value.startDateTimeLocal
            ? moment(filteredData.value.startDateTimeLocal).format('YYYY-MM-DD HH:mm:ss')
            : '',
        end_date: filteredData.value.endDateTimeLocal
            ? moment(filteredData.value.endDateTimeLocal).format('YYYY-MM-DD HH:mm:ss')
            : '',
        type: selectedType.value || null,
        referenceType: selectedReferenceType.value || null,
        product: searchProductValue.value || null,
        referenceId: searchReference.value || null,
    });
    exportToXlsx({
        columns: columns,
        rows: useStockTransaction.exportData,
        filename: 'Stock_Transaction',
    });
}

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Stock Transaction List">
        </PageTitle>
        <div class="grid grid-cols-5 my-3 gap-x-4">
            <DashboardCard title="Total Stock In" :value="useStockTransaction.dashboardData.total_in" icon="fa fa-plus" color="green" />
            <DashboardCard title="Total Stock Out" :value="useStockTransaction.dashboardData.total_out" icon="fa fa-minus" color="red" />
            <DashboardCard title="Remaining Stock" :value="remainingStock" icon="fa fa-equals" color="blue" />
        </div>
        <!-- DataTable -->
        <DataTable 
            :columns="columns" 
            :rows="dataList" 
            :isAction="false"
            :isLoading="useStockTransaction.loading" :defaultSort="{ key: 'id', order: 'desc' }" @delete="deleteHandle"
            :isExcelExport="false"
            :paginationMeta="pagination"
            :isPaginate="true"
            :serverPagination="true"
            @pageChange="fetchStockTransactions"    
        >
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
                        :disabled="true"
                    >
                        <template #buttonbar="{ clearCallback }">
                            <div class="flex justify-between w-full px-2 pb-2 gap-2 flex-wrap items-center">
                                <div class="flex gap-2 flex-wrap">
                                    <BaseButton size="sm" label="Today" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('today')" />
                                    <BaseButton size="sm" label="Yesterday" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('yesterday')" />
                                    <BaseButton size="sm" label="This Week" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisWeek')" />
                                    <BaseButton size="sm" label="This Month" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisMonth')" />
                                    <BaseButton size="sm" label="This Year" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisYear')" />
                                    <BaseButton size="sm" label="All" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('all')" />
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
                    <!-- Filter Button -->
                    <BaseButton label="Filter" icon="pi pi-filter" severity="primary" @click="stockTransactionFilter = true" />
                    <!-- Export Button -->
                    <BaseButton label="Export" icon="pi pi-file-excel" severity="primary" variant="outlined" @click="exportToExcel" />
                </div>
            </template>
        </DataTable>
    </div>
    <!-- Filter Modal Dialog -->
    <Dialog v-model:visible="stockTransactionFilter" :style="{ width: '700px' }" :modal="true" :draggable="false">
        <template #container="{ closeCallback }">
            <div class="p-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-black">Stock Transaction Filter</h3>
                    <BaseButton size="sm" icon="pi pi-times" severity="danger" variant="text" @click="closeCallback" />
                </div>
                <div class="grid grid-cols-2 gap-2 items-center">
                    <div class="flex flex-col gap-1">
                        <BaseLabel label="Date Range" />
                        <DatePicker
                            v-model="dateRange"
                            selectionMode="range"
                            :manualInput="false"
                            showButtonBar
                            placeholder="Date range"
                            inputClass="h-[35px] w-full"
                            :disabled="isDateLoading"
                        >
                            <template #buttonbar="{ clearCallback }">
                                <div class="flex justify-between w-full p-2 gap-2 flex-wrap items-center">
                                    <div class="flex gap-2 flex-wrap">
                                        <BaseButton size="sm" label="Today" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('today')" />
                                        <BaseButton size="sm" label="Yesterday" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('yesterday')" />
                                        <BaseButton size="sm" label="This Week" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisWeek')" />
                                        <BaseButton size="sm" label="This Month" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisMonth')" />
                                        <BaseButton size="sm" label="This Year" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisYear')" />
                                        <BaseButton size="sm" label="All" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('all')" />
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
                    </div>
                    <div class="flex flex-col gap-1">
                        <BaseLabel label="Reference ID" />
                        <BaseInput 
                            size="sm"
                            v-model="searchReference"
                            placeholder="Search by reference id"
                            icon="pi pi-search"
                            height="h-[35px]"
                        />
                    </div>
                    <div class="flex flex-col gap-1">
                        <BaseLabel label="Product" />
                        <BaseInput 
                            size="sm"
                            v-model="searchProductValue"
                            placeholder="Search by product name, barcode"
                            icon="pi pi-search"
                            height="h-[35px]"
                        />
                    </div>
                    <div class="flex flex-col gap-1">
						<BaseLabel label="Type" />
						<select
							v-model="selectedType"
							class="w-full border border-gray-300 rounded-md px-2 py-2 text-sm"
						>
							<option value="">All</option>
                            <option value="in">In</option>
                            <option value="out">Out</option>
						</select>
					</div>
                    <div class="flex flex-col gap-1">
						<BaseLabel label="Reference Type" />
						<select
							v-model="selectedReferenceType"
							class="w-full border border-gray-300 rounded-md px-2 py-2 text-sm"
						>
							<option v-for="option in referenceTypes" :key="option.value" :value="option.value">
                                {{ option.label }}
                            </option>
						</select>
					</div>
                    <div class="col-span-2 flex items-center justify-end">
                        <BaseButton label="Apply Filter" icon="pi pi-filter" severity="primary" @click="applyRangeAndClose" />
                    </div>
                </div>
            </div>
        </template>
    </Dialog>
</template>
