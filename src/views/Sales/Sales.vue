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
    import { getPresetRange } from '@/utils/datePresets';
import BaseLabel from '@/components/BaseLabel.vue';
import exportToXlsx from '@/utils/exportXlsx';

    const router = useRouter();
    const useSales = useSaleStore();
    const filter = useFilterStore();
    const toast = useToast();
    const usePermission = usePermissionStore();
    const salesList = ref([]);
    const isDateLoading = ref(false); // show loading while fetching on date changes
    const dateRange = ref(null); // PrimeVue date range
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
    // Sales filter modal visibility
    const salesFilter = ref(false);

    // Client-side filters (apply on date-range fetched data)
    const selectedStatus = ref('');
    const selectedPayment = ref('');
    const searchValue = ref('');
    const invoiceSearchValue = ref('');
    const productSearchValue = ref('');
    const customerSearchValue = ref('');
    const pagination = ref({});
    const selectedPerPage = ref(100);

    onMounted(async () => {
        // default date-time range: start of current week at 00:00 to now
        filteredData.value.startDateTimeLocal = moment().startOf('week').format('YYYY-MM-DDTHH:mm');
        filteredData.value.endDateTimeLocal = moment().format('YYYY-MM-DDTHH:mm');

        // restore saved filters for this page if present
        const saved = filter.getPageFilter('sales');
        if (saved) {
            if (saved.startDateTimeLocal) filteredData.value.startDateTimeLocal = saved.startDateTimeLocal;
            if (saved.endDateTimeLocal) filteredData.value.endDateTimeLocal = saved.endDateTimeLocal;
            if (saved.selectedStatus) selectedStatus.value = saved.selectedStatus;
            if (saved.selectedPayment) selectedPayment.value = saved.selectedPayment;
            if (saved.searchValue) searchValue.value = saved.searchValue;
            if (saved.productSearchValue) productSearchValue.value = saved.productSearchValue;
            if (saved.customerSearchValue) customerSearchValue.value = saved.customerSearchValue;
            if (saved.invoiceSearchValue) invoiceSearchValue.value = saved.invoiceSearchValue;
            if (saved.selectedYear) selectedYear.value = saved.selectedYear;
            if (saved.selectedMonth) selectedMonth.value = saved.selectedMonth;
            if (saved.selectedDay) selectedDay.value = saved.selectedDay;
            if (saved.selectedPerPage) selectedPerPage.value = Number(saved.selectedPerPage) || 100;
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

    async function fetchSalesByDate(pagePayload = 1) {
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
            const start = filteredData.value.startDateTimeLocal
                ? moment(filteredData.value.startDateTimeLocal).format('YYYY-MM-DD HH:mm:ss')
                : '';
            const end = filteredData.value.endDateTimeLocal
                ? moment(filteredData.value.endDateTimeLocal).format('YYYY-MM-DD HH:mm:ss')
                : '';
            const payload = {
                start_date: start,
                end_date: end,
                customer: customerSearchValue.value || null,
                statusId: selectedStatus.value || null,
                paymentId: selectedPayment.value || null,
                warehouseId: null, // currently not used in UI but can be added as a filter later
                product: productSearchValue.value || null,
                invoice: invoiceSearchValue.value || null,
            }
            await useSales.fetchAllSales(payload, page, perPage);
            salesList.value = useSales.salesList || [];
            pagination.value = useSales.pagination || {};
            await useSales.fetchDashboardSales(payload);
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
            customerSearchValue: customerSearchValue.value,
            invoiceSearchValue: invoiceSearchValue.value,
            selectedYear: selectedYear.value,
            selectedMonth: selectedMonth.value,
            selectedDay: selectedDay.value,
            selectedPerPage: selectedPerPage.value,
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
        () => customerSearchValue.value,
        () => invoiceSearchValue.value,
        () => selectedYear.value,
        () => selectedMonth.value,
        () => selectedDay.value,
        () => selectedPerPage.value
    ], () => {
        saveFilters();
    });

    // Keep filteredData in sync with PrimeVue date range picker and trigger fetch
    watch(dateRange, async (val) => {
        setFilteredDatesFromRange(val);
        const hasFullRange = Array.isArray(val) && val[0] && val[1];
        const cleared = val === null
        // if (hasFullRange || cleared) {
        //     await fetchSalesByDate();
        // }
    });

    function setFilteredDatesFromRange(range) {
        if (Array.isArray(range) && range[0] && range[1]) {
            const start = moment(range[0]).startOf('day');
            const end = moment(range[1]).endOf('day');
            filteredData.value.startDateTimeLocal = start.format('YYYY-MM-DDTHH:mm');
            filteredData.value.endDateTimeLocal = end.format('YYYY-MM-DDTHH:mm');
        } else {
            filteredData.value.startDateTimeLocal = "";
            filteredData.value.endDateTimeLocal = "";
        }
    }

    function applyRangeAndClose() {
        // use existing filteredData values and fetch
        fetchSalesByDate();
        salesFilter.value = false;
    }

    function applyPresetRange(preset) {
        let range = getPresetRange(preset);
        dateRange.value = range ? range : null;
    }

    const columns = [
        { key: 'id', label: 'Invoice No.', formatter: (row) => row.id, onClick: (row) => {
            router.push({name: 'View Sales', query: { id: row.id }});
        }},
        { key: 'sale_date', label: 'Date', formatter: (row) => moment(row.sale_date).format('DD-MM-YY HH:mm') },
        { key: 'customer.name', label: 'Customer Name', formatter: (row) => row.customer.name },
        { key: 'total_amount', label: 'Total', formatter: (row) => Number(row.total_amount).toLocaleString('en-us') },
        { key: 'payment_method.name', label: 'Payment', formatter: (row) => row.payment_method.name },
        { key: 'status.name', label: 'Status', formatter: (row) => statusBadgeHtml(row.status?.name) },
        { key: 'created_by', label: 'Created By', formatter: (row) => row.created_by },
        { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') },
        // { key: 'updated_by', label: 'Updated By', formatter: (row) => row.updated_by },
        // { key: 'updated_at', label: 'Updated At', formatter: (row) => moment(row.updated_at).format('DD-MM-YY hh:mm') },
    ];

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

    async function exportToExcel() {
        await useSales.exportSales({
            start_date: filteredData.value.startDateTimeLocal
                ? moment(filteredData.value.startDateTimeLocal).format('YYYY-MM-DD HH:mm:ss')
                : '',
            end_date: filteredData.value.endDateTimeLocal
                ? moment(filteredData.value.endDateTimeLocal).format('YYYY-MM-DD HH:mm:ss')
                : '',
            customer: customerSearchValue.value || null,
            statusId: selectedStatus.value || null,
            paymentId: selectedPayment.value || null,
            warehouseId: null, // currently not used in UI but can be added as a filter later
            product: productSearchValue.value || null,
            invoice: invoiceSearchValue.value || null,
        });
        exportToXlsx({
            columns: columns,
            rows: useSales.exportData,
            filename: 'Sales',
            detailHeaders: ['Product ID', 'Product Name', 'Price', 'Discount Amount', 'Discount Price', 'Qty', 'Total'],
            detailField: 'details',
            detailKeys: ['product.id', 'product.name', 'price', 'discount_amount', 'discount_price', 'quantity', 'total'],
        });
    }

</script>



<template>
    <div class="p-4">
        <PageTitle title="Sales List">
            <template #titleButtons>
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
        <div class="grid grid-cols-5 my-3 gap-x-4">
            <DashboardCard title="Total Sales" :value="useSales.dashboardData.total_invoice" icon="fa fa-receipt" color="green" />
            <DashboardCard title="Total Sales Amount" :value="Number(useSales.dashboardData.total_sales).toLocaleString('en-us')" icon="fa fa-money-bill" color="blue" />
            <DashboardCard title="Total Cash" :value="Number(useSales.dashboardData.total_cash).toLocaleString('en-us')" icon="fa fa-hand-holding-dollar" color="gray" />
            <DashboardCard title="Total Kpay" :value="Number(useSales.dashboardData.total_kpay).toLocaleString('en-us')" icon="fa fa-credit-card" color="blue" />
            <DashboardCard title="Total Wallet" :value="Number(useSales.dashboardData.total_wallet).toLocaleString('en-us')" icon="fa fa-wallet" color="purple" />
        </div>
        <DataTable 
            :columns="columns" 
            :rows="salesList" 
            :editPath="'Update Sales'" 
            :isLoading="useSales.loading" 
            @delete="deleteHandle"
            :defaultSort="{key: 'created_at', order: 'desc'}"
            :isEdit="!usePermission.can('Sales', 'Update')"
            :isDelete="!usePermission.can('Sales', 'Delete')"
            :isExcelExport="false"
            :paginationMeta="pagination"
            :isPaginate = "true"
            :serverPagination = "true"
            @page-change="fetchSalesByDate"
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
                    <BaseButton label="Filter" icon="pi pi-filter" severity="primary" @click="salesFilter = true" />
                    <!-- Export Button -->
                    <BaseButton label="Export" icon="pi pi-file-excel" severity="primary" variant="outlined" @click="exportToExcel" />
                </div>
            </template>
        </DataTable>
    </div>

    <!-- Filter Modal Dialog -->
    <Dialog v-model:visible="salesFilter" :style="{ width: '700px' }" :modal="true" :draggable="false">
        <template #container="{ closeCallback }">
            <div class="p-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-black">Sales Filter</h3>
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
                        <BaseLabel label="Invoice" />
                        <BaseInput 
                            size="sm"
                            v-model="invoiceSearchValue"
                            placeholder="Search by invoice"
                            icon="pi pi-search"
                            height="h-[35px]"
                        />
                    </div>
                    <div class="flex flex-col gap-1">
                        <BaseLabel label="Customer" />
                        <BaseInput 
                            size="sm"
                            v-model="customerSearchValue"
                            placeholder="Search by customer name, ID"
                            icon="pi pi-search"
                            height="h-[35px]"
                        />
                    </div>
                    <div class="flex flex-col gap-1">
                        <BaseLabel label="Product" />
                        <BaseInput 
                            size="sm"
                            v-model="productSearchValue"
                            placeholder="Search by product name, barcode"
                            icon="pi pi-search"
                            height="h-[35px]"
                        />
                    </div>
                    <div class="flex flex-col gap-1">
						<BaseLabel label="Payment Method" />
						<select
							v-model="selectedPayment"
							class="w-full border border-gray-300 rounded-md px-2 py-2 text-sm"
						>
							<option value="">All</option>
                            <option value="1">Cash</option>
                            <option value="2">Credit</option>
                            <option value="3">Wallet</option>
                            <option value="4">Kpay</option>
						</select>
					</div>
                    <div class="flex flex-col gap-1">
						<BaseLabel label="Status" />
						<select
							v-model="selectedStatus"
							class="w-full border border-gray-300 rounded-md px-2 py-2 text-sm"
						>
							<option value="">All</option>
                            <option value="5">Hold</option>
                            <option value="7">Complete</option>
                            <option value="8">Void</option>
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
