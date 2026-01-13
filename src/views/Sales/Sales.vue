<script setup>

    import PageTitle from '@/components/PageTitle.vue';
    import DataTable from '@/components/DataTable.vue';
    import BaseButton from '@/components/BaseButton.vue';
    import { useRouter, useRoute } from 'vue-router';
    import { onMounted, ref, computed, watch } from 'vue';
    import { useToast } from 'primevue';
    import moment from 'moment';
    import BaseInput from '@/components/BaseInput.vue';
    import { usePermissionStore } from '@/stores/usePermissionStore';
    import { useSaleStore } from '@/stores/useSalesStore';
import DashboardCard from '@/components/DashboardCard.vue';

    const router = useRouter();
    const route = useRoute();
    const useSales = useSaleStore();
    const toast = useToast();
    const usePermission = usePermissionStore();
    const salesList = ref([]);
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

    // Client-side filters (apply on date-range fetched data)
    const selectedStatus = ref('');
    const selectedPayment = ref('');
    const searchValue = ref('');

    onMounted(async () => {
        // default date-time range: start of current month at 00:00 to now
        filteredData.value.startDateTimeLocal = moment().startOf('month').format('YYYY-MM-DDTHH:mm');
        filteredData.value.endDateTimeLocal = moment().format('YYYY-MM-DDTHH:mm');

        // If route contains saved filters (from Create page), apply them
        if (route && route.query) {
            if (route.query.start) filteredData.value.startDateTimeLocal = route.query.start;
            if (route.query.end) filteredData.value.endDateTimeLocal = route.query.end;
            if (route.query.status) selectedStatus.value = route.query.status;
            if (route.query.payment) selectedPayment.value = route.query.payment;
            if (route.query.year) selectedYear.value = route.query.year;
            if (route.query.month) selectedMonth.value = route.query.month;
            if (route.query.day) selectedDay.value = route.query.day;
        }

        await fetchSalesByDate();
    });

    async function fetchSalesByDate() {
        // convert local datetime-local strings to backend friendly format (YYYY-MM-DD HH:mm:ss)
        const start = filteredData.value.startDateTimeLocal
            ? moment(filteredData.value.startDateTimeLocal).format('YYYY-MM-DD HH:mm:ss')
            : null;
        const end = filteredData.value.endDateTimeLocal
            ? moment(filteredData.value.endDateTimeLocal).format('YYYY-MM-DD HH:mm:ss')
            : null;
        await useSales.fetchAllSales({
            start_date: start,
            end_date: end
        });
        salesList.value = useSales.salesList || [];
        // reset client-side filters when new date-range data fetched (optional)
        selectedStatus.value = '';
        selectedPayment.value = '';
        searchValue.value = '';
    }

    // Helper: list of years for selection (e.g., 2020..current+2)
    const years = computed(() => {
        const cur = new Date().getFullYear();
        const start = cur - 3;
        const end = cur + 2;
        const arr = [];
        for (let y = start; y <= end; y++) arr.push(String(y));
        return arr;
    });

    const months = [
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

    function selectMonthDay(dayObj) {
        selectedDay.value = dayObj.iso;
        // set datetime-local values for full day
        filteredData.value.startDateTimeLocal = `${dayObj.iso}T00:00`;
        filteredData.value.endDateTimeLocal = `${dayObj.iso}T23:59`;
        // trigger fetch for the selected day
        fetchSalesByDate();
    }

    const columns = [
        { key: 'id', label: 'Invoice No.' },
        { key: 'sale_date', label: 'Date', formatter: (row) => moment(row.sale_date).format('DD-MM-YY hh:mm') },
        { key: 'customer.name', label: 'Customer Name', formatter: (row) => row.customer.name },
        { key: 'total_amount', label: 'Total', formatter: (row) => Number(row.total_amount).toLocaleString('en-us') },
        { key: 'payment_method.name', label: 'Payment', formatter: (row) => row.payment_method.name },
        { key: 'status.name', label: 'Status', formatter: (row) => row.status.name },
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
                const id = s.id ? String(s.id) : '';
                return cust.toLowerCase().includes(q) || id.includes(q);
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
                <!-- Calendar picker: year, month, days -->
                    <div class="flex items-center gap-2 text-black">
                        <select v-model="selectedYear" class="border p-2 rounded text-sm">
                            <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
                        </select>
                        <select v-model="selectedMonth" class="border p-2 rounded text-sm">
                            <option v-for="m in months" :key="m.v" :value="m.v">{{ m.name }}</option>
                        </select>
                        <div class="flex items-center gap-x-2">
                            <button @click="prevDays" :disabled="dayWindowStart === 0" class=" rounded bg-white flex items-center justify-center cursor-pointer">
                                <i class="fa fa-chevron-circle-left text-xl"></i>
                            </button>
                            <div class="flex gap-1 px-1">
                                <button
                                    v-for="d in monthDaysSlice"
                                    :key="d.iso"
                                    @click="selectMonthDay(d)"
                                    :class="['px-2 py-1 rounded text-sm whitespace-nowrap cursor-pointer', selectedDay === d.iso ? 'bg-blue-600 text-white' : 'bg-white border']"
                                >
                                    {{ d.day }} - {{ d.date }}
                                </button>
                            </div>
                            <button @click="nextDays" :disabled="dayWindowStart >= maxWindowStart" class="rounded bg-white flex items-center justify-center cursor-pointer">
                                <i class="fa fa-chevron-circle-right text-xl"></i>
                            </button>
                        </div>
                    </div>
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
                        <BaseInput 
                            size="sm"
                            v-model="filteredData.startDateTimeLocal"
                            type="datetime-local"
                            placeholder="Start DateTime"
                            width="240px"
                            height="h-[35px]"
                        />
                        <BaseInput 
                            size="sm"
                            v-model="filteredData.endDateTimeLocal"
                            type="datetime-local"
                            placeholder="End DateTime"
                            width="240px"
                            height="h-[35px]"
                        />
                        <BaseButton label="Fetch" severity="primary" @click="fetchSalesByDate" />

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
