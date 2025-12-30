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
import { usePurchaseReturnStore } from '@/stores/usePurchaseReturn';

const router = useRouter();
const usePurchaseReturn = usePurchaseReturnStore();
const toast = useToast();
const usePermission = usePermissionStore();
const returnList = ref([]);
// Date range for API fetch
const filteredData = ref({
    startedDate: moment().startOf('month').format('YYYY-MM-DDTHH:mm'),
    endedDate: moment().format('YYYY-MM-DDTHH:mm')
});

// Client-side filters (apply on date-range fetched data)
const selectedStatus = ref('');
const selectedPayment = ref('');
const searchValue = ref('');

onMounted(async () => {
    await fetchPurchaseReturn();
});

async function fetchPurchaseReturn() {
    // convert local datetime-local strings to backend friendly format (YYYY-MM-DD HH:mm:ss)
    const start = filteredData.value.startedDate
        ? moment(filteredData.value.startedDate).format('YYYY-MM-DD HH:mm:ss')
        : null;
    const end = filteredData.value.endedDate
        ? moment(filteredData.value.endedDate).format('YYYY-MM-DD HH:mm:ss')
        : null;

    await usePurchaseReturn.fetchAllPurchaseReturn({
        start_date: start,
        end_date: end
    });
    returnList.value = usePurchaseReturn.returnList || [];
    selectedStatus.value = '';
    selectedPayment.value = '';
    searchValue.value = '';
}

const columns = [
    { key: 'id', label: 'Return No.' },
    { key: 'return_date', label: 'Date', formatter: (row) => moment(row.return_date).format('DD-MM-YY hh:mm') },
    { key: 'supplier.name', label: 'Supplier Name', formatter: (row) => row.supplier.name },
    { key: 'total_amount', label: 'Total' },
    { key: 'payment_method.name', label: 'Payment', formatter: (row) => row.payment_method.name },
    { key: 'warehouse.name', label: 'Warehouse', formatter: (row) => row.warehouse.name },
    { key: 'status.name', label: 'Status', formatter: (row) => row.status.name },
    { key: 'created_by.name', label: 'Created By', formatter: (row) => row.created_by.name },
    { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') },
    { key: 'updated_by.name', label: 'Updated By', formatter: (row) => row.updated_by.name },
    { key: 'updated_at', label: 'Updated At', formatter: (row) => moment(row.updated_at).format('DD-MM-YY hh:mm') },
];

// Derived options from fetched data for client-side filters
const statusOptions = computed(() => {
    const map = new Map();
    (returnList.value || []).forEach(s => {
        if (s.status && s.status.id) map.set(s.status.id, s.status.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
});

const paymentOptions = computed(() => {
    const map = new Map();
    (returnList.value || []).forEach(s => {
        if (s.payment_method && s.payment_method.id) map.set(s.payment_method.id, s.payment_method.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
});

// Final list shown in table after client-side filtering
const displayedSalesReturn = computed(() => {
    let list = (returnList.value || []).slice();

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

function changeRoute(pathname) {
    router.push(pathname);
}

// Sales delete function
async function deleteHandle(id) {
    await usePurchaseReturn.deletePurchaseReturn({void_by: JSON.parse(localStorage.getItem('user')).id}, id);
    if (usePurchaseReturn.error.length) {
        usePurchaseReturn.error.forEach((msg) => {
            toast.add({
              severity: 'error',
              summary: 'Error Message',
              detail: msg,
              life: 3000
            });
        });
        return
    }
    if (usePurchaseReturn.data.status === 200) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Sales deleted successfully.', life: 3000 });
        // refetch with current date range
        await fetchPurchaseReturn();
    }
}

</script>



<template>
    <div class="p-4">
        <PageTitle title="Purchase Return List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton v-if="usePermission.can('Purchase return', 'Create')" icon="fa fa-circle-plus" label="Create"
                        severity="primary" @click="changeRoute('/purchase_return/create')" />
                </div>
            </template>
        </PageTitle>
        <DataTable :columns="columns" :rows="displayedSalesReturn" :editPath="'Update Purchase Return'"
            :isLoading="usePurchaseReturn.loading" @delete="deleteHandle" :defaultSort="{ key: 'created_at', order: 'desc' }"
            :isEdit="!usePermission.can('Purchase return', 'Update')" :isDelete="!usePermission.can('Purchase return', 'Delete')">
            <template #filters>
                <div class="flex gap-2 items-center">
                    <BaseInput size="sm" v-model="filteredData.startedDate" type="datetime-local"
                        placeholder="Start DateTime" width="240px" height="h-[35px]" />
                    <BaseInput size="sm" v-model="filteredData.endedDate" type="datetime-local"
                        placeholder="End DateTime" width="240px" height="h-[35px]" />
                    <BaseButton label="Fetch" severity="primary" @click="fetchPurchaseReturn" />

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
