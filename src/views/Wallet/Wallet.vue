<script setup>

import PageTitle from '@/components/PageTitle.vue';
import DataTable from '@/components/DataTable.vue';
import BaseButton from '@/components/BaseButton.vue';
import { useRouter } from 'vue-router';
import { onMounted, ref, computed, watch } from 'vue';
import { useToast } from 'primevue';
import moment from 'moment'
import { useFilterStore } from '@/stores/filterStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import BaseInput from '@/components/BaseInput.vue';

import { useWalletStore } from '@/stores/useWalletStore';
import DashboardCard from '@/components/DashboardCard.vue';
import { statusBadgeHtml } from '@/utils/const';

const router = useRouter();
const toast = useToast();
const filter = useFilterStore();
const usePermission = usePermissionStore();
const useWallet = useWalletStore();
const searchValue = ref('');
const walletList = ref([]);
const selectedPaymentMethod = ref('');
const selectedType = ref('');
const filteredData = ref({
    startedDate: "",
    endedDate: ""
});

// Persist filters for this page under the key 'wallet'
function saveFilters() {
    filter.setPageFilter('wallet', {
        startedDate: filteredData.value.startedDate,
        endedDate: filteredData.value.endedDate,
        selectedPaymentMethod: selectedPaymentMethod.value,
        selectedType: selectedType.value,
        searchValue: searchValue.value,
    });
}

onMounted(async () => {
    // restore saved filters if present
    const saved = filter.getPageFilter('wallet');
    if (saved) {
        if (saved.startedDate) filteredData.value.startedDate = saved.startedDate;
        if (saved.endedDate) filteredData.value.endedDate = saved.endedDate;
        if (saved.selectedPaymentMethod) selectedPaymentMethod.value = saved.selectedPaymentMethod;
        if (saved.selectedType) selectedType.value = saved.selectedType;
        if (saved.searchValue) searchValue.value = saved.searchValue;
    }
    await fetchTransaction();
});



async function fetchTransaction() {
    // convert local datetime-local strings to backend friendly format (YYYY-MM-DD HH:mm:ss)
    const start = filteredData.value.startedDate
        ? moment(filteredData.value.startedDate).format('YYYY-MM-DD HH:mm:ss')
        : "";
    const end = filteredData.value.endedDate
        ? moment(filteredData.value.endedDate).format('YYYY-MM-DD HH:mm:ss')
        : "";
    await useWallet.fetchAllWallet({
        start_date: start,
        end_date: end,
        customer_id: "",
        status_id: 7, // completed status only
    });
    walletList.value = useWallet.walletList || [];
    // persist current filters after fetch
    saveFilters();
}

// watch filter inputs and persist changes so coming back restores them
watch([
    () => filteredData.value.startedDate,
    () => filteredData.value.endedDate,
    () => selectedPaymentMethod.value,
    () => selectedType.value,
    () => searchValue.value
], () => {
    saveFilters();
});

// Table headers
const columns = [
    { key: 'id', label: 'ID' },
    { key: 'customer.id', label: 'Customer ID', formatter: (row) => row.customer?.id },
    { key: 'customer.name', label: 'Name', formatter: (row) => row.customer?.name },
    { key: 'amount', label: 'Amount', formatter: (row) => {
        return `<span class="${Number(row.amount) < 0 ? 'text-red-700' : 'text-blue-700'}">
            ${Number(row.amount).toLocaleString('en-us')}
        </span>`
    } },
    { key: 'payment_method.name', label: 'Payment Method', formatter: (row) => row.payment_method?.name },
    { key: 'pay_date', label: 'Date', formatter: (row) => moment(row.pay_date).format('DD-MM-YY hh:mm') },
    { key: 'sale_id', label: 'Sales ID' },
    { key: 'type', label: 'Type' },
    { key: 'status.name', label: 'Status', formatter: (row) => statusBadgeHtml(row.status?.name) },
    { key: 'created_by', label: 'Created By', },
    { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') },
    // { key: 'updated_by', label: 'Updated By', },
    // { key: 'updated_at', label: 'Updated At', formatter: (row) => moment(row.updated_at).format('DD-MM-YY hh:mm') },
];

// Route change function: need to pass route path.
function changeRoute(pathname) {
    router.push(pathname);
}

const paymentMethods = computed(() => {
    const map = new Map();
    (walletList.value || []).forEach(w => {
        if (w.payment_method.name) map.set(w.payment_method.name);
    });
    return Array.from(map.entries()).map(([name]) => ({ name }));
});

// Filter Function
const filteredRows = computed(() => {
    let list = (walletList.value || []).slice();
    // filter by payment method
    if (selectedPaymentMethod.value) {
        list = list.filter(w => String(w.payment_method.name) === String(selectedPaymentMethod.value));
    }
    // filter by transaction type
    if (selectedType.value) {
        list = list.filter(w => String(w.type) === String(selectedType.value));
    }
    if (searchValue.value && searchValue.value.trim() !== '') {
        const q = searchValue.value.toLowerCase().trim();
        
        list = list.filter(w => {
            const customer = w.customer?.name || '';
            const id = w.customer_id || '';
            return customer.toLowerCase().includes(q) || id.toLowerCase().includes(q);
        });
    }
    return list;
});

const totalAmount = computed(() => {
        return filteredRows.value.reduce((sum, wallet) => sum + (Number(wallet.amount) || 0), 0);
    });

    const totalCashAmount = computed(() => {
        return filteredRows.value.reduce((sum, wallet) => {
            if (wallet.payment_method && wallet.payment_method.name === 'Cash') {
                return sum + (Number(wallet.amount) || 0);
            }
            return sum;
        }, 0);
    });

    const totalKpayAmount = computed(() => {
        return filteredRows.value.reduce((sum, wallet) => {
            if (wallet.payment_method && wallet.payment_method.name === 'Kpay') {
                return sum + (Number(wallet.amount) || 0);
            }
            return sum;
        }, 0);
    });

//  Delete function
async function deleteHandle(id) {
    await useWallet.deleteWallet(id);
    if (useWallet.error.length) {
        useWallet.error.forEach((msg) => {
            toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
            });
        });
        return
    }
    if (useWallet.data.status === 200) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Wallet transaction deleted successfully.', life: 3000 });
        fetchTransaction();
    }
}
</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Customer Transaction List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton v-if="usePermission.can('Wallet', 'Create')" icon="fa fa-circle-plus" label="Create"
                        severity="primary" @click="changeRoute('/wallet/createTopUp')" />
                </div>
            </template>
        </PageTitle>
        <div class="grid grid-cols-5 my-3 gap-x-4">
            <DashboardCard title="Total" :value="filteredRows.length" icon="fa fa-receipt" color="green" />
            <DashboardCard title="Total Amount" :value="totalAmount.toLocaleString('en-us')" icon="fa fa-money-bill" color="blue" />
            <DashboardCard title="Total Cash" :value="totalCashAmount.toLocaleString('en-us')" icon="fa fa-hand-holding-dollar" color="gray" />
            <DashboardCard title="Total Kpay" :value="totalKpayAmount.toLocaleString('en-us')" icon="fa fa-credit-card" color="blue" />
        </div>
        <!-- DataTable -->
        <DataTable :columns="columns" :rows="filteredRows" :editPath="'Update Wallet Top Up'"
            :isLoading="useWallet.loading" @delete="deleteHandle" :defaultSort="{ key: 'pay_date', order: 'desc' }"
            :isEdit="!usePermission.can('Wallet', 'Update')" :isDelete="!usePermission.can('Wallet', 'Delete')" filename="Customer_Transaction">
            <!-- Filter Section -->
            <template #filters>
                <div class="flex gap-2">
                    <BaseInput size="sm" type="datetime-local" v-model="filteredData.startedDate" width="200px"
                        height="h-[35px]" />
                    <BaseInput size="sm" type="datetime-local" v-model="filteredData.endedDate" width="200px"
                        height="h-[35px]" />
                    <BaseButton label="Fetch" severity="primary" @click="fetchTransaction" />
                    <BaseInput size="sm" v-model="searchValue" placeholder="Search by customer" width="200px" height="h-[35px]"
                        icon="pi pi-search" />
                    <select v-model="selectedPaymentMethod" class="border p-2 rounded text-sm">
                        <option value="">All Payment</option>
                        <option v-for="opt in paymentMethods" :key="opt.id" :value="opt.name">{{ opt.name }}</option>
                    </select>

                    <select v-model="selectedType" class="border p-2 rounded text-sm">
                        <option value="">All Type</option>
                        <option value="sale">Sales</option>
                        <option value="top-up">Top-up</option>
                    </select>
                </div>
            </template>
        </DataTable>
    </div>
</template>
