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
import { useStockTransactionStore } from '@/stores/useStockTransactionStore';

const router = useRouter();
const toast = useToast();
const filter = useFilterStore();
const usePermission = usePermissionStore();
const useStockTransaction = useStockTransactionStore();

const searchValue = ref('');
const startDate = ref('');
const endDate = ref('');
const dataList = ref([]);
const filteredData = ref({
    startedDate: moment().startOf('month').format('YYYY-MM-DDTHH:mm'),
    endedData: moment().format('YYYY-MM-DDTHH:mm'),
    referenceType: 'adjustment',
})

onMounted(async () => {
    await useStockTransaction.fetchStockTransactions({
        start_date: moment(filteredData.value.startedDate).format('YYYY-MM-DD HH:mm:ss'),
        end_date: moment(filteredData.value.endedData).format('YYYY-MM-DD HH:mm:ss'),
        reference_type: filteredData.value.referenceType,
    });
    dataList.value = useStockTransaction.list;
});

// Table headers
const columns = [
    { key: 'id', label: 'ID' },
    {
        key: 'image_url', label: 'Image', formatter: (row) => {
            return `<img class="object-cover w-10 h-10 rounded" src="${row.inventory.product.image_url}" alt="${row.inventory.product.name}" />`;
        }
    },
    { key: 'product.name', label: 'Product', formatter: (row) => row.inventory.product.name },
    { key: 'warehouse.name', label: 'Warehouse', formatter: (row) => row.inventory.warehouse.name },
    { key: 'quantity_change', label: 'Qty' },
    { key: 'type', label: 'In/Out',  formatter: (row) => {
            const color = row.type === 'in' ? 'bg-green-500 text-white rounded-md py-1 px-2' : 'bg-red-500 text-white rounded-md py-1 px-2';
            return `<span class="text-white px-2 py-1 rounded ${color}">${row.type.toUpperCase()}</span>`;
        }
    },
    { key: 'reference_type', label: 'Reference Type', formatter: (row) => row.reference_type.toUpperCase() },
    { key: 'expired_date', label: 'Expire', formatter: (row) => row.inventory.expired_date ? moment(row.inventory.expired_date).format('DD-MM-YY') : "N/A" },
    { key: 'created_by', label: 'Created By', formatter: (row) => row.created_by.name },
    { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY HH:mm') },
];

// Route change function: need to pass route path.
function changeRoute(pathname) {
    router.push(pathname);
}

// Filter Function
const filteredRows = computed(() => {
    const searchedData = filter.searchFunction(dataList.value, searchValue.value, [
        "reference_type",
    ]);
    return filter.dateRangeFilter(searchedData, { dateField: 'created_at', startDate: startDate.value, endDate: endDate.value })
});

//Branch delete function
async function deleteHandle(id) {
    await useUser.deleteUser(id);
    if (useUser.error) {
        toast.add({ severity: 'error', summary: 'Error Message', detail: useUser.error, life: 3000 });
        return
    }
    if (useUser.data.status === 200) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Inventory deleted successfully.', life: 3000 });
        await useUser.fetchAllUsers();
        dataList.value = useUser.users;
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
        <DataTable :columns="columns" :rows="filteredRows" :isPaginate="false" :isAction="false"
            :isLoading="useStockTransaction.loading" :defaultSort="{ key: 'created_at', order: 'desc' }" @delete="deleteHandle">
            <!-- Filter Section -->
            <template #filters>
                <div class="flex gap-2">
                    <BaseInput size="sm" type="datetime-local" v-model="filteredData.startedDate" placeholder="Search" width="200px"
                        height="h-[35px]" />
                    <BaseInput size="sm" type="datetime-local" v-model="filteredData.endedData" placeholder="Search" width="200px"
                        height="h-[35px]" />
                    <BaseInput size="sm" v-model="searchValue" placeholder="Search" width="200px" height="h-[35px]"
                        icon="pi pi-search" />
                </div>
            </template>
        </DataTable>
    </div>
</template>
