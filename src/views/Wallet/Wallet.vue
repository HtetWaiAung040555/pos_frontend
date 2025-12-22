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
const startDate = ref('');
const endDate = ref('');
const walletList = ref([]);

onMounted(async () => {
    await useWallet.fetchAllWallet();
    walletList.value = useWallet.walletList;
    console.log(walletList.value);
});

// Table headers
const columns = [
    { key: 'id', label: 'ID' },
    { key: 'customer.name', label: 'Name', formatter: (row) => row.customer?.name },
    { key: 'amount', label: 'Amount' },
    { key: 'payment_method.name', label: 'Payment Method', formatter: (row) => row.payment_method?.name },
    { key: 'pay_date', label: 'Pay Date', formatter: (row) => moment(row.pay_date).format('DD-MM-YY hh:mm') },
    { key: 'sale_id', label: 'Sale' },
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

// Filter Function
const filteredRows = computed(() => {
    const searchedData = filter.searchFunction(walletList.value, searchValue.value, [
        "customer.name",
        "type",
        "payment_method.name"
    ]);
    return filter.dateRangeFilter(searchedData, { dateField: 'created_at', startDate: startDate.value, endDate: endDate.value })
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
        <PageTitle title="Wallet Transaction List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton v-if="usePermission.can('Wallet', 'Create')" icon="fa fa-circle-plus" label="Create"
                        severity="primary" @click="changeRoute('/wallet/createTopUp')" />
                </div>
            </template>
        </PageTitle>
        <!-- DataTable -->
        <DataTable :columns="columns" :rows="filteredRows" :pageSize="5" :editPath="'Update Wallet Top Up'"
            :isLoading="useWallet.loading" @delete="deleteHandle" :defaultSort="{ key: 'created_at', order: 'desc' }"
            :isEdit="!usePermission.can('Wallet', 'Update')" :isDelete="!usePermission.can('Wallet', 'Delete')">
            <!-- Filter Section -->
            <template #filters>
                <div class="flex gap-2">
                    <BaseInput size="sm" type="date" v-model="startDate" placeholder="Search" width="200px"
                        height="h-[35px]" />
                    <BaseInput size="sm" type="date" v-model="endDate" placeholder="Search" width="200px"
                        height="h-[35px]" />
                    <BaseInput size="sm" v-model="searchValue" placeholder="Search" width="200px" height="h-[35px]"
                        icon="pi pi-search" />
                </div>
            </template>
        </DataTable>
    </div>
</template>
