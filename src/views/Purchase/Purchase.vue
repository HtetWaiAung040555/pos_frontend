<script setup>

import PageTitle from '@/components/PageTitle.vue';
import DataTable from '@/components/DataTable.vue';
import BaseButton from '@/components/BaseButton.vue';
import { useRouter } from 'vue-router';
import { onMounted, ref, computed } from 'vue';
import { useToast } from 'primevue';
import moment from 'moment';
import BaseInput from '@/components/BaseInput.vue';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { usePurchaseStore } from '@/stores/usePurchaseStore';
import DashboardCard from '@/components/DashboardCard.vue';

const router = useRouter();
const usePurchase = usePurchaseStore();
const toast = useToast();
const usePermission = usePermissionStore();
const purchaseList = ref([]);
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

onMounted(async () => {

    await fetchPurchaseByDate();
});

async function fetchPurchaseByDate() {
    // convert local datetime-local strings to backend friendly format (YYYY-MM-DD HH:mm:ss)
    const start = filteredData.value.startedDate
        ? moment(filteredData.value.startedDate).format('YYYY-MM-DD HH:mm:ss')
        : null;
    const end = filteredData.value.endedDate
        ? moment(filteredData.value.endedDate).format('YYYY-MM-DD HH:mm:ss')
        : null;

    // pass plain object to store method (server should accept datetime strings)
    await usePurchase.fetchAllPurchase({
        start_date: start,
        end_date: end
    });
    purchaseList.value = usePurchase.purchaseList || [];
    selectedStatus.value = '';
    selectedPayment.value = '';
    searchValue.value = '';
}

const columns = [
    { key: 'id', label: 'Purchase No.' },
    { key: 'purchase_date', label: 'Date', formatter: (row) => moment(row.purchase_date).format('DD-MM-YY hh:mm') },
    { key: 'supplier.name', label: 'Supplier Name', formatter: (row) => row.supplier.name },
    { key: 'total_amount', label: 'Total', formatter: (row) => Number(row.total_amount).toLocaleString('en-us') },
    { key: 'warehouse.name', label: 'Warehouse', formatter: (row) => row.warehouse.name },
    { key: 'payment.name', label: 'Payment', formatter: (row) => row.payment.name },
    { key: 'status.name', label: 'Status', formatter: (row) => row.status.name },
    { key: 'created_by', label: 'Created By' },
    { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') },
    { key: 'updated_by', label: 'Updated By' },
    { key: 'updated_at', label: 'Updated At', formatter: (row) => moment(row.updated_at).format('DD-MM-YY hh:mm') },
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

const totalPurchaseAmount = computed(() => {
    return displayedPurchase.value.reduce((sum, sale) => sum + (Number(sale.total_amount) || 0), 0);
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

// Sales delete function
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
            :isEdit="!usePermission.can('Purchase', 'Update')" :isDelete="!usePermission.can('Purchase', 'Delete')">
            <template #filters>
                <div class="flex gap-2 items-center">
                    <BaseInput size="sm" v-model="filteredData.startedDate" type="datetime-local"
                        placeholder="Start DateTime" width="240px" height="h-[35px]" />
                    <BaseInput size="sm" v-model="filteredData.endedDate" type="datetime-local"
                        placeholder="End DateTime" width="240px" height="h-[35px]" />
                    <BaseButton label="Fetch" severity="primary" @click="fetchPurchaseByDate" />

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
                </div>
            </template>
        </DataTable>
    </div>
</template>
