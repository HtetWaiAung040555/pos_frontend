<script setup>

    import PageTitle from '@/components/PageTitle.vue';
    import DataTable from '@/components/DataTable.vue';
    import BaseButton from '@/components/BaseButton.vue';
    import { useRouter, useRoute } from 'vue-router';
    import { onMounted, ref, computed, watch, nextTick } from 'vue';
    import { useToast } from 'primevue';
    import { Dialog } from 'primevue';
    import DatePicker from 'primevue/datepicker';
    import moment from 'moment';
    import BaseInput from '@/components/BaseInput.vue';
    import { usePermissionStore } from '@/stores/usePermissionStore';
    import { useSaleStore } from '@/stores/useSalesStore';
    import { useFilterStore } from '@/stores/filterStore';
    import DashboardCard from '@/components/DashboardCard.vue';
    import { statusBadgeHtml } from '@/utils/const';

    const router = useRouter();
    const route = useRoute();
    const useSales = useSaleStore();
    const filter = useFilterStore();
    const toast = useToast();
    const usePermission = usePermissionStore();
    const salesList = ref([]);
    const isDateLoading = ref(false); // show loading while fetching on date changes
    const dateRange = ref(null); // PrimeVue date range
    let suppressMonthYearWatch = false; // avoid double-fetch when presets set both range and year/month
    // Date range for API fetch
    const filteredData = ref({
        // Local values bound to datetime-local inputs (format: YYYY-MM-DDTHH:mm)
        startDateTimeLocal: '',
        endDateTimeLocal: ''
    });

    // Calendar selection: year, month, day
    const selectedYear = ref(String(new Date().getFullYear()));
    const selectedMonth = ref(String(new Date().getMonth() + 1).padStart(2, '0'));
    const selectedDay = ref('');
    // Carousel window for days
    const dayWindowStart = ref(0);
    const windowSize = ref(7); // show 7 days at once
    // Date filter modal visibility
    const visibleDateFilter = ref(false);

    // Client-side filters (apply on date-range fetched data)
    const selectedStatus = ref('');
    const selectedPayment = ref('');
    const searchValue = ref('');
    const productSearchValue = ref('');

    onMounted(async () => {
        // default date-time range: start of current month at 00:00 to now
        filteredData.value.startDateTimeLocal = moment().startOf('month').format('YYYY-MM-DDTHH:mm');
        filteredData.value.endDateTimeLocal = moment().format('YYYY-MM-DDTHH:mm');

        // restore saved filters for this page if present
        const saved = filter.getPageFilter('sales');
        if (saved) {
            if (saved.startDateTimeLocal) filteredData.value.startDateTimeLocal = saved.startDateTimeLocal;
            if (saved.endDateTimeLocal) filteredData.value.endDateTimeLocal = saved.endDateTimeLocal;
            if (saved.selectedStatus) selectedStatus.value = saved.selectedStatus;
            if (saved.selectedPayment) selectedPayment.value = saved.selectedPayment;
            if (saved.searchValue) searchValue.value = saved.searchValue;
            if (saved.selectedYear) selectedYear.value = saved.selectedYear;
            if (saved.selectedMonth) selectedMonth.value = saved.selectedMonth;
            if (saved.selectedDay) selectedDay.value = saved.selectedDay;
        }

        // Initialize PrimeVue date range from persisted values
        if (filteredData.value.startDateTimeLocal && filteredData.value.endDateTimeLocal) {
            dateRange.value = [
                moment(filteredData.value.startDateTimeLocal).toDate(),
                moment(filteredData.value.endDateTimeLocal).toDate()
            ];
        }

        await fetchSalesByDate();
    });

    async function fetchSalesByDate() {
        isDateLoading.value = true;
        try {
            // convert local datetime-local strings to backend friendly format (YYYY-MM-DD HH:mm:ss)
            const start = filteredData.value.startDateTimeLocal
                ? moment(filteredData.value.startDateTimeLocal).format('YYYY-MM-DD HH:mm:ss')
                : '';
            const end = filteredData.value.endDateTimeLocal
                ? moment(filteredData.value.endDateTimeLocal).format('YYYY-MM-DD HH:mm:ss')
                : '';
            await useSales.fetchAllSales({
                start_date: start,
                end_date: end
            });
            salesList.value = useSales.salesList || [];
            // persist current filters after fetch
            saveFilters();
        } finally {
            isDateLoading.value = false;
        }
    }

    // Persist filters for this page under the key 'sales'
    function saveFilters() {
        filter.setPageFilter('sales', {
            startDateTimeLocal: filteredData.value.startDateTimeLocal,
            endDateTimeLocal: filteredData.value.endDateTimeLocal,
            selectedStatus: selectedStatus.value,
            selectedPayment: selectedPayment.value,
            searchValue: searchValue.value,
            productSearchValue: productSearchValue.value,
            selectedYear: selectedYear.value,
            selectedMonth: selectedMonth.value,
            selectedDay: selectedDay.value,
        });
    }

    // watch filter inputs and persist changes so coming back restores them
    watch([
        () => filteredData.value.startDateTimeLocal,
        () => filteredData.value.endDateTimeLocal,
        () => selectedStatus.value,
        () => selectedPayment.value,
        () => searchValue.value,
        () => productSearchValue.value,
        () => selectedYear.value,
        () => selectedMonth.value,
        () => selectedDay.value
    ], () => {
        saveFilters();
    });

    // Keep filteredData in sync with PrimeVue date range picker and trigger fetch
    watch(dateRange, async (val) => {
        if (!val || !Array.isArray(val)) return;
        const [start, end] = val;

        // Clear case: both cleared -> fetch without range
        if (!start && !end) {
            filteredData.value.startDateTimeLocal = '';
            filteredData.value.endDateTimeLocal = '';
            await fetchSalesByDate();
            return;
        }

        // Wait until both start and end are chosen
        if (!start || !end) return;

        filteredData.value.startDateTimeLocal = moment(start).startOf('day').format('YYYY-MM-DDTHH:mm');
        filteredData.value.endDateTimeLocal = moment(end).endOf('day').format('YYYY-MM-DDTHH:mm');
        await fetchSalesByDate();
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
        if (suppressMonthYearWatch) return;
        if (!newYear) return;
        // Case 1: ALL years – show all data
        if (newYear === "All") {
            filteredData.value.startDateTimeLocal = "";
            filteredData.value.endDateTimeLocal = "";
            selectedMonth.value = "All"; 
            dateRange.value = [null, null];
            await fetchSalesByDate();
            return;
        }

        // Case 2: Year selected but month = ALL → show full year
        if (selectedMonth.value === "All") {
            filteredData.value.startDateTimeLocal = `${newYear}-01-01T00:00`;
            filteredData.value.endDateTimeLocal = `${newYear}-12-31T23:59`;
            dateRange.value = [
                moment(`${newYear}-01-01`).toDate(),
                moment(`${newYear}-12-31`).toDate()
            ];
            await fetchSalesByDate();
            return;
        }

        // Case 3: Year changed but month is still specific
        const m = selectedMonth.value;
        const daysInMonth = new Date(Number(newYear), Number(m), 0).getDate();
        filteredData.value.startDateTimeLocal = `${newYear}-${m}-01T00:00`;
        filteredData.value.endDateTimeLocal = `${newYear}-${m}-${String(daysInMonth).padStart(2, '0')}T23:59`;
        dateRange.value = [
            moment(`${newYear}-${m}-01`).toDate(),
            moment(`${newYear}-${m}-${String(daysInMonth).padStart(2, '0')}`).toDate()
        ];
        await fetchSalesByDate();
    });

    // When month changes, fetch that month within selectedYear
    watch(selectedMonth, async (newMonth) => {
        if (suppressMonthYearWatch) return;
        if (!newMonth || !selectedYear.value) return;
        const y = selectedYear.value;
        // Case 1: ALL Months + ALL Years
        if (newMonth === "All" && y === "All") {
            filteredData.value.startDateTimeLocal = "";
            filteredData.value.endDateTimeLocal = "";
            dateRange.value = [null, null];
            await fetchSalesByDate();
            return;
        }

        // Case 2: ALL Months but specific year
        if (newMonth === "All") {
            filteredData.value.startDateTimeLocal = `${y}-01-01T00:00`;
            filteredData.value.endDateTimeLocal = `${y}-12-31T23:59`;
            dateRange.value = [
                moment(`${y}-01-01`).toDate(),
                moment(`${y}-12-31`).toDate()
            ];
            await fetchSalesByDate();
            return;
        }

        // Case 3: Specific month + specific year
        const daysInMonth = new Date(Number(y), Number(newMonth), 0).getDate();
        filteredData.value.startDateTimeLocal = `${y}-${newMonth}-01T00:00`;
        filteredData.value.endDateTimeLocal = `${y}-${newMonth}-${String(daysInMonth).padStart(2, '0')}T23:59`;
        dateRange.value = [
            moment(`${y}-${newMonth}-01`).toDate(),
            moment(`${y}-${newMonth}-${String(daysInMonth).padStart(2, '0')}`).toDate()
        ];
        await fetchSalesByDate();
    });

    function openDateFilterDialog() {
        visibleDateFilter.value = true;
    }

    function applyRangeAndClose() {
        // use existing filteredData values and fetch
        fetchSalesByDate();
        visibleDateFilter.value = false;
    }

    function selectMonthDay(dayObj) {
        selectedDay.value = dayObj.iso;
        // set datetime-local values for full day
        filteredData.value.startDateTimeLocal = `${dayObj.iso}T00:00`;
        filteredData.value.endDateTimeLocal = `${dayObj.iso}T23:59`;
        // trigger fetch for the selected day
        dateRange.value = [moment(dayObj.iso).toDate(), moment(dayObj.iso).toDate()];
        fetchSalesByDate();
    }

    function applyPresetRange(preset) {
        const today = moment().startOf('day');
        let start = today.clone();
        let end = today.clone().endOf('day');

        switch (preset) {
            case 'yesterday':
                start = today.clone().subtract(1, 'day');
                end = today.clone().subtract(1, 'day').endOf('day');
                break;
            case 'thisWeek':
                start = today.clone().startOf('week');
                end = today.clone().endOf('week');
                break;
            case 'thisMonth':
                start = today.clone().startOf('month');
                end = today.clone().endOf('month');
                break;
            case 'thisYear':
                start = today.clone().startOf('year');
                end = today.clone().endOf('year');
                break;
            case 'today':
            default:
                // already set
                break;
        }

        // Keep UI selectors in sync without triggering their fetch logic
        suppressMonthYearWatch = true;
        selectedYear.value = start.format('YYYY');
        selectedMonth.value = start.format('MM');
        // Only lock the exact day when the preset is today or yesterday
        selectedDay.value = (preset === 'today' || preset === 'yesterday')
            ? start.format('YYYY-MM-DD')
            : '';

        dateRange.value = [start.toDate(), end.toDate()];

        nextTick(() => {
            suppressMonthYearWatch = false;
        });
    }

    // Use shared status badge helper

    const columns = [
        { key: 'id', label: 'Invoice No.', formatter: (row) => {
            const href = router.resolve({ name: 'View Sales', query: { id: row.id } }).href;
            return `<a href="${href}">
                <span class="cursor-pointer text-blue-600 hover:underline">${row.id}</span>
            </a>`;
        } },
        { key: 'sale_date', label: 'Date', formatter: (row) => moment(row.sale_date).format('DD-MM-YY hh:mm') },
        { key: 'customer.name', label: 'Customer Name', formatter: (row) => row.customer.name },
        { key: 'total_amount', label: 'Total', formatter: (row) => Number(row.total_amount).toLocaleString('en-us') },
        { key: 'payment_method.name', label: 'Payment', formatter: (row) => row.payment_method.name },
        { key: 'status.name', label: 'Status', formatter: (row) => statusBadgeHtml(row.status?.name) },
        { key: 'created_by', label: 'Created By', formatter: (row) => row.created_by },
        { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') },
        // { key: 'updated_by', label: 'Updated By', formatter: (row) => row.updated_by },
        // { key: 'updated_at', label: 'Updated At', formatter: (row) => moment(row.updated_at).format('DD-MM-YY hh:mm') },
    ];

    // Derived options from fetched data for client-side filters
    const statusOptions = computed(() => {
        const map = new Map();
        (salesList.value || []).forEach(s => {
            if (s.status && s.status.id) map.set(s.status.id, s.status.name);
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    });

    const paymentOptions = computed(() => {
        const map = new Map();
        (salesList.value || []).forEach(s => {
            if (s.payment_method && s.payment_method.id) map.set(s.payment_method.id, s.payment_method.name);
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    });

    // Final list shown in table after client-side filtering
    const displayedSales = computed(() => {
        let list = (salesList.value || []).slice();

        // filter by status
        if (selectedStatus.value) {
            list = list.filter(s => String(s.status?.id) === String(selectedStatus.value));
        }

        // filter by payment method
        if (selectedPayment.value) {
            list = list.filter(s => String(s.payment_method?.id) === String(selectedPayment.value));
        }

        // search across invoice id, customer name
        if (searchValue.value && searchValue.value.trim() !== '') {
            const q = searchValue.value.toLowerCase().trim();
            list = list.filter(s => {
                const cust = s.customer?.name || '';
                const id = s.id || '';
                return cust.toLowerCase().includes(q) || id.toLowerCase().includes(q);
            });
        }

        // search across product names in sale details
        if (productSearchValue.value && productSearchValue.value.trim() !== '') {
            const pq = productSearchValue.value.toLowerCase().trim();
            list = list.filter(s => {
                const prodBarcode = s.details?.map(d => d.product?.barcode || '').join(' ').toLowerCase();
                const prodNames = (s.details || []).map(d => d.product?.name || '').join(' ').toLowerCase();
                return prodNames.includes(pq) || prodBarcode.includes(pq);
            });
        }

        return list;
    });

    const totalSalesAmount = computed(() => {
        return displayedSales.value.reduce((sum, sale) => sum + (Number(sale.total_amount) || 0), 0);
    });

    const totalCashAmount = computed(() => {
        return displayedSales.value.reduce((sum, sale) => {
            if (sale.payment_method && sale.payment_method.name === 'Cash') {
                return sum + (Number(sale.total_amount) || 0);
            }
            return sum;
        }, 0);
    });

    const totalKpayAmount = computed(() => {
        return displayedSales.value.reduce((sum, sale) => {
            if (sale.payment_method && sale.payment_method.name === 'Kpay') {
                return sum + (Number(sale.total_amount) || 0);
            }
            return sum;
        }, 0);
    });

    const totalWalletAmount = computed(() => {
        return displayedSales.value.reduce((sum, sale) => {
            if (sale.payment_method && sale.payment_method.name === 'Wallet') {
                return sum + (Number(sale.total_amount) || 0);
            }
            return sum;
        }, 0);
    });

    function changeRoute(pathname) {
        router.push(pathname);
    }

    // Sales delete function
    async function deleteHandle(id) {
        await useSales.deleteSales({void_by: JSON.parse(localStorage.getItem('user')).id}, id);
        if(useSales.error.length) {
            toast.add({ severity: 'error', summary: 'Error Message', detail: useSales.error, life: 3000 });
            return
        }
        if (useSales.data.status === 200) {
            toast.add({ severity: 'success', summary: 'Success Message', detail: 'Sales deleted successfully.', life: 3000 });
            // refetch with current date range
            await fetchSalesByDate();
        }
    }

</script>



<template>
    <div class="p-4">
        <PageTitle title="Sales List">
            <template #titleButtons>
                <!-- <div class="border-t flex gap-x-2 items-center">
                    <div class="flex items-center gap-2 text-black mb-2">
                        <select v-model="selectedYear" class="border p-2 rounded text-sm">
                            <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
                        </select>
                        <select v-model="selectedMonth" class="border p-2 rounded text-sm" :disabled="selectedYear === 'All'">
                            <option v-for="m in months" :key="m.v" :value="m.v">{{ m.name }}</option>
                        </select>
                    </div>

                    <div class="flex items-center gap-x-2">
                        <button @click="prevDays" :disabled="dayWindowStart === 0" class=" rounded text-black flex items-center justify-center cursor-pointer">
                            <i class="fa fa-chevron-circle-left text-xl"></i>
                        </button>
                        <div class="flex gap-1 px-1 flex-wrap">
                            <button
                                v-for="d in monthDaysSlice"
                                :key="d.iso"
                                @click="selectMonthDay(d)"
                                :class="['px-3 py-2 rounded text-sm whitespace-nowrap cursor-pointer text-black', selectedDay === d.iso ? 'bg-blue-500 text-white' : 'bg-white border border-gray-300']"
                            >
                                <div class="text-xs">{{ d.day }}</div>
                                <div class="font-semibold">{{ d.date }}</div>
                            </button>
                        </div>
                        <button @click="nextDays" :disabled="dayWindowStart >= maxWindowStart" class="rounded text-black flex items-center justify-center cursor-pointer">
                            <i class="fa fa-chevron-circle-right text-xl"></i>
                        </button>
                    </div>
                </div> -->
                <div class="flex gap-x-2 items-center">
                    <BaseButton 
                        v-if="usePermission.can('Sales', 'Create')"
                        icon="fa fa-circle-plus" 
                        label="Create" 
                        severity="primary" 
                        @click="changeRoute('/sales/create')"  />
                    <BaseButton 
                        v-if="usePermission.can('POS', 'View')"
                        icon="fa fa-cash-register" 
                        label="POS Sale" 
                        severity="primary" 
                        variant="outlined"
                        @click="changeRoute('/pos')"  />
                </div>
            </template>
        </PageTitle>
        <!-- <Dialog v-model:visible="visibleDateFilter" :style="{ width: '700px' }" :modal="true" :draggable="false">
            <template #container="{ closeCallback }">
                <div class="p-4">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-semibold text-black">Date Filter</h3>
                        <div class="flex gap-x-2">
                            <BaseButton severity="secondary" variant="outlined" @click="() => { filteredData.startDateTimeLocal = ''; filteredData.endDateTimeLocal = ''; }" icon="pi pi-refresh" />
                            <BaseButton severity="secondary" @click="visibleDateFilter = false" icon="fa fa-x" />
                        </div>
                    </div>

                    <div class="flex gap-2 items-center mb-4">
                        <BaseInput
                            size="sm"
                            v-model="filteredData.startDateTimeLocal"
                            type="datetime-local"
                            placeholder="Start DateTime"
                            width="250px"
                            height="h-[35px]"
                        />
                        <BaseInput
                            size="sm"
                            v-model="filteredData.endDateTimeLocal"
                            type="datetime-local"
                            placeholder="End DateTime"
                            width="250px"
                            height="h-[35px]"
                        />
                        <BaseButton label="Apply Range" severity="primary" @click="applyRangeAndClose" />
                    </div>

                    <div class="border-t pt-3">
                        <div class="flex items-center gap-2 text-black mb-2">
                            <select v-model="selectedYear" class="border p-2 rounded text-sm">
                                <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
                            </select>
                            <select v-model="selectedMonth" class="border p-2 rounded text-sm" :disabled="selectedYear === 'All'">
                                <option v-for="m in months" :key="m.v" :value="m.v">{{ m.name }}</option>
                            </select>
                        </div>

                        <div class="flex items-center gap-x-2">
                            <button @click="prevDays" :disabled="dayWindowStart === 0" class=" rounded bg-white flex items-center justify-center cursor-pointer">
                                <i class="fa fa-chevron-circle-left text-xl"></i>
                            </button>
                            <div class="flex gap-1 px-1 flex-wrap">
                                <button
                                    v-for="d in monthDaysSlice"
                                    :key="d.iso"
                                    @click="selectMonthDay(d)"
                                    :class="['px-3 py-2 rounded text-sm whitespace-nowrap cursor-pointer', selectedDay === d.iso ? 'bg-blue-400 text-white' : 'bg-white border']"
                                >
                                    <div class="text-xs text-gray-500">{{ d.day }}</div>
                                    <div class="font-semibold">{{ d.date }}</div>
                                </button>
                            </div>
                            <button @click="nextDays" :disabled="dayWindowStart >= maxWindowStart" class="rounded bg-white flex items-center justify-center cursor-pointer">
                                <i class="fa fa-chevron-circle-right text-xl"></i>
                            </button>
                        </div>
                        <div class="text-sm text-gray-500 mt-2">Select year → month → day to filter. Year/month selection auto-applies.</div>
                    </div>
                </div>
            </template>
        </Dialog> -->
        <div class="grid grid-cols-5 my-3 gap-x-4">
            <DashboardCard title="Total Sales" :value="displayedSales.length" icon="fa fa-receipt" color="green" />
            <DashboardCard title="Total Sales Amount" :value="totalSalesAmount.toLocaleString('en-us')" icon="fa fa-money-bill" color="blue" />
            <DashboardCard title="Total Cash" :value="totalCashAmount.toLocaleString('en-us')" icon="fa fa-hand-holding-dollar" color="gray" />
            <DashboardCard title="Total Kpay" :value="totalKpayAmount.toLocaleString('en-us')" icon="fa fa-credit-card" color="blue" />
            <DashboardCard title="Total Wallet" :value="totalWalletAmount.toLocaleString('en-us')" icon="fa fa-wallet" color="purple" />
        </div>
        <DataTable 
            :columns="columns" 
            :rows="displayedSales" 
            :editPath="'Update Sales'" 
            :isLoading="useSales.loading" 
            filename="Sales"
            @delete="deleteHandle"
            :defaultSort="{key: 'created_at', order: 'desc'}"
            :isEdit="!usePermission.can('Sales', 'Update')"
            :isDelete="!usePermission.can('Sales', 'Delete')"
            :detailHeaders="['Product ID', 'Product Name', 'Price', 'Discount Amount', 'Discount Price', 'Qty', 'Total']"
            detailField="details"
            :detailKeys="['product.id', 'product.name', 'price', 'discount_amount', 'discount_price', 'quantity', 'total']"
        >
            <template #filters>
                <div class="flex gap-2 items-center">
                    <!-- Date range filter from prime vue -->
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
                        
                    <select v-model="selectedStatus" class="border p-2 rounded text-sm">
                        <option value="">All Status</option>
                        <option v-for="opt in statusOptions" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
                    </select>

                    <select v-model="selectedPayment" class="border p-2 rounded text-sm">
                        <option value="">All Payment</option>
                        <option v-for="opt in paymentOptions" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
                    </select>

                    <BaseInput 
                        size="sm"
                        v-model="searchValue"
                        placeholder="Search by customer, invoice"
                        icon="pi pi-search"
                        width="200px"
                        height="h-[35px]"
                    />
                    <BaseInput 
                        size="sm"
                        v-model="productSearchValue"
                        placeholder="Search by product name, barcode"
                        icon="pi pi-search"
                        width="200px"
                        height="h-[35px]"
                    />
                </div>
            </template>
        </DataTable>
    </div>
</template>
