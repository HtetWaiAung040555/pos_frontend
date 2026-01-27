<script setup>

import PageTitle from '@/components/PageTitle.vue';
import DataTable from '@/components/DataTable.vue';
import BaseButton from '@/components/BaseButton.vue';
import { useRouter } from 'vue-router';
import { onMounted, ref, computed, watch } from 'vue';
import { DatePicker, Dialog, useToast } from 'primevue';
import moment from 'moment';
import BaseInput from '@/components/BaseInput.vue';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { useFilterStore } from '@/stores/filterStore';
import { usePurchaseStore } from '@/stores/usePurchaseStore';
import DashboardCard from '@/components/DashboardCard.vue';
import { statusBadgeHtml } from '@/utils/const';
import { getPresetRange } from '@/utils/datePresets';

const router = useRouter();
const usePurchase = usePurchaseStore();
const filter = useFilterStore();
const toast = useToast();
const usePermission = usePermissionStore();
const purchaseList = ref([]);
// Date filter dialog visibility
const visibleDateFilter = ref(false);
// Date range for API fetch
const filteredData = ref({
    // Local values bound to datetime-local inputs (format: YYYY-MM-DDTHH:mm)
    startedDate: moment().startOf('month').format('YYYY-MM-DDTHH:mm'),
    endedDate: moment().format('YYYY-MM-DDTHH:mm')
});

// Client-side filters (apply on date-range fetched data)
const selectedStatus = ref('');
const selectedPayment = ref('');
const searchValue = ref('');
const productSearch = ref('');
// Carousel window for days
const dayWindowStart = ref(0);
const windowSize = ref(7); // show 7 days at once
// Year/month/day selection for DateRangeFilter
const selectedDay = ref('');
const selectedYear = ref(String(new Date().getFullYear()));
const selectedMonth = ref(String(new Date().getMonth() + 1).padStart(2, '0'));
// New DatePicker range state
const dateRange = ref(null); // [startDate, endDate]
const isDateLoading = ref(false);

onMounted(async () => {
    // restore saved filters for this page if present
    const saved = filter.getPageFilter('purchase');
    if (saved) {
        if (saved.startedDate) filteredData.value.startedDate = saved.startedDate;
        if (saved.endedDate) filteredData.value.endedDate = saved.endedDate;
        if (saved.selectedStatus) selectedStatus.value = saved.selectedStatus;
        if (saved.selectedPayment) selectedPayment.value = saved.selectedPayment;
        if (saved.searchValue) searchValue.value = saved.searchValue;
    }
    if (filteredData.value.startedDate && filteredData.value.endedDate) {
        dateRange.value = [
            moment(filteredData.value.startedDate).toDate(),
            moment(filteredData.value.endedDate).toDate()
        ];
    }
    await fetchPurchaseByDate();
    saveFilters();
});

async function fetchPurchaseByDate() {
    isDateLoading.value = true;
    try {
        // convert local datetime-local strings to backend friendly format (YYYY-MM-DD HH:mm:ss)
        const start = filteredData.value.startedDate
            ? moment(filteredData.value.startedDate).format('YYYY-MM-DD HH:mm:ss')
            : "";
        const end = filteredData.value.endedDate
            ? moment(filteredData.value.endedDate).format('YYYY-MM-DD HH:mm:ss')
            : "";

        // pass plain object to store method (server should accept datetime strings)
        await usePurchase.fetchAllPurchase({
            start_date: start,
            end_date: end
        });
        purchaseList.value = usePurchase.purchaseList || [];
        // persist current filters after fetch
        saveFilters();
    } finally {
        isDateLoading.value = false;
    }
}

// persist filters for this page
function saveFilters() {
    filter.setPageFilter('purchase', {
        startedDate: filteredData.value.startedDate,
        endedDate: filteredData.value.endedDate,
        selectedStatus: selectedStatus.value,
        selectedPayment: selectedPayment.value,
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

// Sync and auto-fetch when DatePicker range changes
watch(dateRange, async (val) => {
    setFilteredDatesFromRange(val);
    const hasFullRange = Array.isArray(val) && val[0] && val[1];
    const cleared = val === null;
    if (hasFullRange || cleared) {
        await fetchPurchaseByDate();
    }
});

// watch filter inputs and persist changes
watch([
    () => filteredData.value.startedDate,
    () => filteredData.value.endedDate,
    () => selectedStatus.value,
    () => selectedPayment.value,
    () => searchValue.value
], () => {
    saveFilters();
});

// Helper: list of years for selection (e.g., 2020..current+2)
const years = computed(() => {
    const cur = new Date().getFullYear();
    const start = cur - 3;
    const end = cur + 2;
    const arr = ["All"];
    for (let y = start; y <= end; y++) arr.push(String(y));
    return arr;
});

const months = [
    { v: "All", name: "All" },
    { v: '01', name: 'January' },
    { v: '02', name: 'February' },
    { v: '03', name: 'March' },
    { v: '04', name: 'April' },
    { v: '05', name: 'May' },
    { v: '06', name: 'June' },
    { v: '07', name: 'July' },
    { v: '08', name: 'August' },
    { v: '09', name: 'September' },
    { v: '10', name: 'October' },
    { v: '11', name: 'November' },
    { v: '12', name: 'December' },
];

// Compute all days for selected month-year with weekday labels
const monthDays = computed(() => {
    const y = Number(selectedYear.value);
    const m = Number(selectedMonth.value) - 1; // JS month index
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const arr = [];
    for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(y, m, d);
        const dayName = moment(dt).format('ddd').toUpperCase(); // MON, TUE, ...
        arr.push({
            day: dayName,
            date: String(d).padStart(2, '0'),
            iso: moment(dt).format('YYYY-MM-DD')
        });
    }
    return arr;
});

const maxWindowStart = computed(() => Math.max(0, monthDays.value.length - windowSize.value));

const monthDaysSlice = computed(() => {
    return monthDays.value.slice(dayWindowStart.value, dayWindowStart.value + windowSize.value);
});

function prevDays() {
    dayWindowStart.value = Math.max(0, dayWindowStart.value - windowSize.value);
}

function nextDays() {
    dayWindowStart.value = Math.min(maxWindowStart.value, dayWindowStart.value + windowSize.value);
}

// reset window when month or year changes
watch([selectedYear, selectedMonth], () => {
    dayWindowStart.value = 0;
    selectedDay.value = '';
});

// When year changes, fetch that whole year
watch(selectedYear, async (newYear) => {
    if (!newYear) return;
    if (newYear === 'All') {
        filteredData.value.startedDate = '';
        filteredData.value.endedDate = '';
        selectedMonth.value = 'All';
        await fetchPurchaseByDate();
        return;
    }

    if (selectedMonth.value === 'All') {
        filteredData.value.startedDate = `${newYear}-01-01T00:00`;
        filteredData.value.endedDate = `${newYear}-12-31T23:59`;
        await fetchPurchaseByDate();
        return;
    }

    const m = selectedMonth.value;
    const daysInMonth = new Date(Number(newYear), Number(m), 0).getDate();
    filteredData.value.startedDate = `${newYear}-${m}-01T00:00`;
    filteredData.value.endedDate = `${newYear}-${m}-${String(daysInMonth).padStart(2, '0')}T23:59`;
    await fetchPurchaseByDate();
});

// When month changes, fetch that month within selectedYear
watch(selectedMonth, async (newMonth) => {
    if (!newMonth || !selectedYear.value) return;
    const y = selectedYear.value;
    if (newMonth === 'All' && y === 'All') {
        filteredData.value.startedDate = '';
        filteredData.value.endedDate = '';
        await fetchPurchaseByDate();
        return;
    }
    if (newMonth === 'All') {
        filteredData.value.startedDate = `${y}-01-01T00:00`;
        filteredData.value.endedDate = `${y}-12-31T23:59`;
        await fetchPurchaseByDate();
        return;
    }
    const daysInMonth = new Date(Number(y), Number(newMonth), 0).getDate();
    filteredData.value.startedDate = `${y}-${newMonth}-01T00:00`;
    filteredData.value.endedDate = `${y}-${newMonth}-${String(daysInMonth).padStart(2, '0')}T23:59`;
    await fetchPurchaseByDate();
});

function openDateFilterDialog() {
    visibleDateFilter.value = true;
}

function applyRangeAndClose() {
    // use existing filteredData values and fetch
    fetchPurchaseByDate();
    visibleDateFilter.value = false;
}

function selectMonthDay(dayObj) {
    selectedDay.value = dayObj.iso;
    // set datetime-local values for full day
    filteredData.value.startedDate = `${dayObj.iso}T00:00`;
    filteredData.value.endedDate = `${dayObj.iso}T23:59`;
    // trigger fetch for the selected day
    fetchPurchaseByDate();
}

const columns = [
    { key: 'id', label: 'Purchase No.', formatter: (row) => {
        const href = router.resolve({ name: 'View Sales', query: { id: row.id } }).href;
        return `<a href="${href}">
            <span class="cursor-pointer text-blue-600 hover:underline">${row.id}</span>
        </a>`;
    } },
    { key: 'purchase_date', label: 'Date', formatter: (row) => moment(row.purchase_date).format('DD-MM-YY hh:mm') },
    { key: 'supplier.name', label: 'Supplier Name', formatter: (row) => row.supplier.name },
    { key: 'total_amount', label: 'Total', formatter: (row) => Number(row.total_amount).toLocaleString('en-us') },
    { key: 'warehouse.name', label: 'Warehouse', formatter: (row) => row.warehouse.name },
    { key: 'payment.name', label: 'Payment', formatter: (row) => row.payment.name },
    { key: 'status.name', label: 'Status', formatter: (row) => statusBadgeHtml(row.status?.name) },
    { key: 'created_by', label: 'Created By' },
    { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') },
    // { key: 'updated_by', label: 'Updated By' },
    // { key: 'updated_at', label: 'Updated At', formatter: (row) => moment(row.updated_at).format('DD-MM-YY hh:mm') },
];

// Derived options from fetched data for client-side filters
const statusOptions = computed(() => {
    const map = new Map();
    (purchaseList.value || []).forEach(s => {
        if (s.status && s.status.id) map.set(s.status.id, s.status.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
});

const paymentOptions = computed(() => {
    const map = new Map();
    (purchaseList.value || []).forEach(s => {
        if (s.payment && s.payment.id) map.set(s.payment.id, s.payment.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
});

// Final list shown in table after client-side filtering
const displayedPurchase = computed(() => {
    let list = (purchaseList.value || []).slice();

    // filter by status
    if (selectedStatus.value) {
        list = list.filter(p => String(p.status?.id) === String(selectedStatus.value));
    }

    // filter by payment method
    if (selectedPayment.value) {
        list = list.filter(p => String(p.payment?.id) === String(selectedPayment.value));
    }

    // search across invoice id, supplier name
    if (searchValue.value && searchValue.value.trim() !== '') {
        const q = searchValue.value.toLowerCase().trim();
        list = list.filter(s => {
            const supplier = s.supplier?.name || '';
            const id = s.id ? String(s.id) : '';
            return supplier.toLowerCase().includes(q) || id.toLowerCase().includes(q);
        });
    }

    // search across invoice id, supplier name
    if (productSearch.value && productSearch.value.trim() !== '') {
        const q = productSearch.value.toLowerCase().trim();
        list = list.filter(s => {
            const prodNames = (s.details || []).map(d => d.product?.name || '').join(' ').toLowerCase();
            return prodNames.includes(q);
        });
    }

    return list;
});

const totalPurchaseAmount = computed(() => {
    return displayedPurchase.value.reduce((sum, purchase) => sum + (Number(purchase.total_amount) || 0), 0);
});

const totalCashAmount = computed(() => {
    return displayedPurchase.value.reduce((sum, purchase) => {
        if (purchase.payment && purchase.payment.name === 'Cash') {
            return sum + (Number(purchase.total_amount) || 0);
        }
        return sum;
    }, 0);
});

const totalKpayAmount = computed(() => {
    return displayedPurchase.value.reduce((sum, purchase) => {
        if (purchase.payment && purchase.payment.name === 'Kpay') {
            return sum + (Number(purchase.total_amount) || 0);
        }
        return sum;
    }, 0);
});

const totalWalletAmount = computed(() => {
    return displayedPurchase.value.reduce((sum, purchase) => {
        if (purchase.payment && purchase.payment.name === 'Wallet') {
            return sum + (Number(purchase.total_amount) || 0);
        }
        return sum;
    }, 0);
});

function changeRoute(pathname) {
    router.push(pathname);
}

// Purchase delete function
async function deleteHandle(id) {
    await usePurchase.deletePurchase({ void_by: JSON.parse(localStorage.getItem('user')).id }, id);
    if (usePurchase.error.length) {
        toast.add({ severity: 'error', summary: 'Error Message', detail: usePurchase.error, life: 3000 });
        return
    }
    if (usePurchase.data.status === 200) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Purchase deleted successfully.', life: 3000 });
        // refetch with current date range
        await fetchPurchaseByDate();
    }
}

</script>



<template>
    <div class="p-4">
        <PageTitle title="Purchase List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton v-if="usePermission.can('Purchase', 'Create')" icon="fa fa-circle-plus" label="Create"
                        severity="primary" @click="changeRoute('/purchase/create')" />
                </div>
            </template>
        </PageTitle>
        <div class="grid grid-cols-5 my-3 gap-x-4">
            <DashboardCard title="Total Purchase" :value="displayedPurchase.length" icon="fa fa-receipt" color="green" />
            <DashboardCard title="Total Purchase Amount" :value="totalPurchaseAmount.toLocaleString('en-us')" icon="fa fa-money-bill" color="blue" />
            <DashboardCard title="Total Cash" :value="totalCashAmount.toLocaleString('en-us')" icon="fa fa-hand-holding-dollar" color="gray" />
            <DashboardCard title="Total Kpay" :value="totalKpayAmount.toLocaleString('en-us')" icon="fa fa-credit-card" color="blue" />
            <DashboardCard title="Total Wallet" :value="totalWalletAmount.toLocaleString('en-us')" icon="fa fa-wallet" color="purple" />
        </div>
        <DataTable :columns="columns" :rows="displayedPurchase" :editPath="'Update Purchase'"
            :isLoading="usePurchase.loading" @delete="deleteHandle" :defaultSort="{ key: 'created_at', order: 'desc' }"
            :isEdit="!usePermission.can('Purchase', 'Update')" :isDelete="!usePermission.can('Purchase', 'Delete')" filename="Purchase">
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
                    <select v-model="selectedStatus" class="border p-2 rounded text-sm">
                        <option value="">All Status</option>
                        <option v-for="opt in statusOptions" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
                    </select>

                    <select v-model="selectedPayment" class="border p-2 rounded text-sm">
                        <option value="">All Payment</option>
                        <option v-for="opt in paymentOptions" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
                    </select>

                    <BaseInput size="sm" v-model="searchValue" placeholder="Search..." icon="pi pi-search" width="200px"
                        height="h-[35px]" />

                    <BaseInput size="sm" v-model="productSearch" placeholder="Product search..." icon="pi pi-search" width="200px"
                        height="h-[35px]" />
                </div>
            </template>
        </DataTable>
    </div>
</template>
