<script setup>

import PageTitle from '@/components/PageTitle.vue';
import DataTable from '@/components/DataTable.vue';
import BaseButton from '@/components/BaseButton.vue';
import { useRouter } from 'vue-router';
import { onMounted, ref, computed } from 'vue';
import { useToast } from 'primevue';
import moment from 'moment'
import { useFilterStore } from '@/stores/filterStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import BaseInput from '@/components/BaseInput.vue';

import { useWalletStore } from '@/stores/useWalletStore';

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
    startedDate: moment().startOf('month').format('YYYY-MM-DDTHH:mm'),
    endedDate: moment().format('YYYY-MM-DDTHH:mm')
});

onMounted(async () => {
    await fetchTransaction();
});



async function fetchTransaction() {
    // convert local datetime-local strings to backend friendly format (YYYY-MM-DD HH:mm:ss)
    const start = filteredData.value.startedDate
        ? moment(filteredData.value.startedDate).format('YYYY-MM-DD HH:mm:ss')
        : null;
    const end = filteredData.value.endedDate
        ? moment(filteredData.value.endedDate).format('YYYY-MM-DD HH:mm:ss')
        : null;
    await useWallet.fetchAllWallet({
        start_date: start,
        end_date: end
    });
    walletList.value = useWallet.walletList || [];
    selectedType.value = '';
    selectedPaymentMethod.value = '';
    searchValue.value = '';
}

// Table headers
const columns = [
    { key: 'id', label: 'ID' },
    { key: 'customer.name', label: 'Name', formatter: (row) => row.customer?.name },
    { key: 'amount', label: 'Amount' },
    { key: 'payment_method.name', label: 'Payment Method', formatter: (row) => row.payment_method?.name },
    { key: 'pay_date', label: 'Date', formatter: (row) => moment(row.pay_date).format('DD-MM-YY hh:mm') },
    { key: 'sale_id', label: 'Sales ID' },
    { key: 'type', label: 'Type' },
    { key: 'created_by', label: 'Created By', },
    { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') },
    { key: 'updated_by', label: 'Updated By', },
    { key: 'updated_at', label: 'Updated At', formatter: (row) => moment(row.updated_at).format('DD-MM-YY hh:mm') },
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
            return customer.toLowerCase().includes(q)
        });
    }
    return list;
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
        await useWallet.fetchAllWallet();
        walletList.value = useWallet.walletList;
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
        <!-- DataTable -->
        <DataTable :columns="columns" :rows="filteredRows" :editPath="'Update Wallet Top Up'"
            :isLoading="useWallet.loading" @delete="deleteHandle" :defaultSort="{ key: 'created_at', order: 'desc' }"
            :isEdit="!usePermission.can('Wallet', 'Update')" :isDelete="!usePermission.can('Wallet', 'Delete')">
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
                        <option value="">All Status</option>
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
