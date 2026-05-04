<script setup>

import PageTitle from '@/components/PageTitle.vue';
import DataTable from '@/components/DataTable.vue';
import BaseButton from '@/components/BaseButton.vue';
import { useRouter } from 'vue-router';
import { onMounted, ref, watch } from 'vue';
import { DatePicker, Dialog, useToast } from 'primevue';
import moment from 'moment'
import { useFilterStore } from '@/stores/filterStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import BaseInput from '@/components/BaseInput.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import { useStockTransactionStore } from '@/stores/useStockTransactionStore';
import { getPresetRange } from '@/utils/datePresets';

const router = useRouter();
const toast = useToast();
const filter = useFilterStore();
const usePermission = usePermissionStore();
const useStockTransaction = useStockTransactionStore();

const searchProductValue = ref('');
const selectedType = ref('');
const selectedPerPage = ref(100);
const pagination = ref({});
const dataList = ref([]);
const dateRange = ref(null);
const stockAdjustmentFilter = ref(false);
const isDateLoading = ref(false);
const filteredData = ref({
    startedDate: moment().startOf('week').format('YYYY-MM-DDTHH:mm'),
    endedDate: moment().format('YYYY-MM-DDTHH:mm'),
    referenceType: 'adjustment',
})

onMounted(async () => {
    const saved = filter.getPageFilter('stock_adjustment');
    if (saved) {
        if (saved.startedDate) filteredData.value.startedDate = saved.startedDate;
        if (saved.endedDate) filteredData.value.endedDate = saved.endedDate;
        if (saved.searchProductValue) searchProductValue.value = saved.searchProductValue;
        if (saved.selectedType) selectedType.value = saved.selectedType;
        if (saved.selectedPerPage) selectedPerPage.value = saved.selectedPerPage;
    }

    if (filteredData.value.startedDate && filteredData.value.endedDate) {
        dateRange.value = [
            moment(filteredData.value.startedDate).toDate(),
            moment(filteredData.value.endedDate).toDate()
        ];
    }
    await fetchStockTransactions();
    saveFilters();
});

function saveFilters() {
    filter.setPageFilter('stock_adjustment', {
        startedDate: filteredData.value.startedDate,
        endedDate: filteredData.value.endedDate,
        searchProductValue: searchProductValue.value,
        selectedType: selectedType.value,
        selectedPerPage: selectedPerPage.value,
    });
}

async function fetchStockTransactions(pagePayload = 1) {
    isDateLoading.value = true;
    const payloadIsObject = pagePayload && typeof pagePayload === 'object';
    const page = payloadIsObject ? Number(pagePayload.page || 1) : Number(pagePayload || 1);
    const perPage = payloadIsObject ? Number(pagePayload.perPage || selectedPerPage.value || 100) : Number(selectedPerPage.value || 100);
    if (payloadIsObject && pagePayload.perPage) {
        selectedPerPage.value = perPage;
    }
    try {
        const start = filteredData.value.startedDate ? moment(filteredData.value.startedDate).format('YYYY-MM-DD HH:mm:ss') : "";
        const end = filteredData.value.endedDate ? moment(filteredData.value.endedDate).format('YYYY-MM-DD HH:mm:ss') : "";
        const payload = {
            start_date: start,
            end_date: end,
            referenceType: filteredData.value.referenceType ? filteredData.value.referenceType : "",
            type: selectedType.value,
            product: searchProductValue.value,
        };
        console.log('Fetching with payload:', payload, 'Page:', page, 'Per Page:', perPage);
        await useStockTransaction.fetchStockTransactions(payload, page, perPage);
        dataList.value = useStockTransaction.list;
        pagination.value = useStockTransaction.pagination;
        saveFilters();
    } finally {
        isDateLoading.value = false;
    }
}

function setFilteredDatesFromRange(range) {
    if (Array.isArray(range) && range[0] && range[1]) {
        const start = moment(range[0]).startOf('day');
        const end = moment(range[1]).endOf('day');
        filteredData.value.startedDate = start.format('YYYY-MM-DDTHH:mm');
        filteredData.value.endedDate = end.format('YYYY-MM-DDTHH:mm');
    } else {
        filteredData.value.startedDate = "";
        filteredData.value.endedDate = "";
    }
}

function applyPresetRange(preset) {
    const range = getPresetRange(preset);
    dateRange.value = range ? range : null;
}

watch(dateRange, (val) => {
    setFilteredDatesFromRange(val);
});

watch([
    () => filteredData.value.startedDate,
    () => filteredData.value.endedDate,
    () => searchProductValue.value,
    () => selectedType.value,
    () => selectedPerPage.value,
], () => {
    saveFilters();
});

function applyRangeAndClose() {
    fetchStockTransactions();
    stockAdjustmentFilter.value = false;
}

// Table headers
const columns = [
    { key: 'id', label: 'ID' },
    {
        key: 'image_url', label: 'Image', formatter: (row) => {
            return `<img class="object-cover w-10 h-10 rounded" src="${row.inventory.product.image_url}" alt="${row.inventory.product.name}" />`;
        }
    },
    { key: 'inventory.product.barcode', label: 'Barcode', formatter: (row) => row.inventory.product.barcode },
    { key: 'inventory.product.name', label: 'Product', formatter: (row) => row.inventory.product.name },
    { key: 'inventory.warehouse.name', label: 'Warehouse', formatter: (row) => row.inventory.warehouse.name },
    { key: 'quantity_change', label: 'Qty' },
    { key: 'type', label: 'In/Out',  formatter: (row) => {
            const color = row.type === 'in' ? 'bg-green-500 text-white rounded-md py-1 px-2' : 'bg-red-500 text-white rounded-md py-1 px-2';
            return `<span class="text-white px-2 py-1 rounded ${color}">${row.type.toUpperCase()}</span>`;
        }
    },
    // { key: 'reference_type', label: 'Reference Type', formatter: (row) => row.reference_type.toUpperCase() },
    { key: 'reference_date', label: 'Reference Date', formatter: (row) => row.reference_date ? moment(row.reference_date).format('DD-MM-YY') : "N/A" },
    { key: 'expired_date', label: 'Expire', formatter: (row) => row.inventory.expired_date ? moment(row.inventory.expired_date).format('DD-MM-YY') : "N/A" },
    { key: 'created_by.name', label: 'Created By', formatter: (row) => row.created_by.name },
    { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY HH:mm') },
];

// Route change function: need to pass route path.
function changeRoute(pathname) {
    router.push(pathname);
}

//Branch delete function
async function deleteHandle(id) {
    await useStockTransaction.deleteStockAdjust(id);
    if (useStockTransaction.error.length) {
        console.error('Delete Error:', useStockTransaction.error);
        toast.add({ severity: 'error', summary: 'Error Message', detail: useStockTransaction.error, life: 3000 });
        return
    }
    if (useStockTransaction.data.status === 200) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Inventory deleted successfully.', life: 3000 });
        await fetchStockTransactions();
        dataList.value = useStockTransaction.list;
    }
}

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Stock Adjustment List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton v-if="usePermission.can('Stock adjustment', 'Create')" icon="fa fa-circle-plus"
                        label="Create" severity="primary" @click="changeRoute('/stock_adjustment/create')" />
                </div>
            </template>
        </PageTitle>
        <!-- DataTable -->
        <DataTable 
            :columns="columns" :rows="dataList" :isPaginate="true"
            :paginationMeta="pagination"
            :serverPagination="true"
            :isLoading="useStockTransaction.loading" @delete="deleteHandle"
            filename="Stock_Adjustment"
            :isDelete="!usePermission.can('Stock adjustment', 'Delete')"
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
                    <BaseButton label="Filter" icon="pi pi-filter" severity="primary" @click="stockAdjustmentFilter = true" />
                </div>
            </template>
        </DataTable>
    </div>

    <Dialog v-model:visible="stockAdjustmentFilter" :style="{ width: '700px' }" :modal="true" :draggable="false">
        <template #container="{ closeCallback }">
            <div class="p-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-black">Stock Adjustment Filter</h3>
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
                        <BaseInput 
                            label="Product"
                            size="sm"
                            v-model="searchProductValue"
                            placeholder="Search by product name/barcode"
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
                    <div class="col-span-2 flex items-center justify-end">
                        <BaseButton label="Apply Filter" icon="pi pi-filter" severity="primary" @click="applyRangeAndClose" />
                    </div>
                </div>
            </div>
        </template>
    </Dialog>
</template>
