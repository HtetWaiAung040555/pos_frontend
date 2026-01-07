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
import { useLocalInventoryStore } from '@/stores/useLocalInventory';

const router = useRouter();
const toast = useToast();
const filter = useFilterStore();
const usePermission = usePermissionStore();
const useLocalInventory = useLocalInventoryStore();

const searchValue = ref('');
const startDate = ref('');
const endDate = ref('');
const dataList = ref([]);

onMounted(async () => {
    await useLocalInventory.fetchAllStock();
    dataList.value = useLocalInventory.stockList;
});

// Table headers
const columns = [
    { key: 'id', label: 'Product ID' },
    {
        key: 'image_url', label: 'Image', formatter: (row) => {
            return `<img class="object-cover w-10 h-10 rounded" src="${row.image_url}" alt="${row.name}" />`;
        }
    },
    { key: 'barcode', label: 'Barcode' },
    { key: 'name', label: 'Product', formatter: (row) => row.name },
    { key: 'price', label: 'Sales Price'},
    { key: 'qty', label: 'Qty' },
    { key: 'created_by', label: 'Created By', formatter: (row) => row.created_by },
    { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') },
    { key: 'updated_by', label: 'Updated By', formatter: (row) => row.updated_by },
    { key: 'updated_at', label: 'Updated At', formatter: (row) => moment(row.updated_at).format('DD-MM-YY hh:mm') },
];

// Route change function: need to pass route path.
function changeRoute(pathname) {
    router.push(pathname);
}

// Filter Function
const filteredRows = computed(() => {
    const searchedData = filter.searchFunction(dataList.value, searchValue.value, [
        "name", "barcode"
    ]);
    return filter.dateRangeFilter(searchedData, { dateField: 'created_at', startDate: startDate.value, endDate: endDate.value })
});

const pullCloudData = async () => {
    try {
        let payload = {
            warehouse_id: JSON.parse(localStorage.getItem('user')).branch.warehouse_id,
            created_by: JSON.parse(localStorage.getItem('user')).id
        }
        await useLocalInventory.addCloudStock(payload);
        await useLocalInventory.fetchAllStock();
        dataList.value = useLocalInventory.stockList;
        toast.add({ severity: 'success', summary: 'Success', detail: 'Data pulled from cloud successfully', life: 3000 });
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to pull data from cloud', life: 3000 });
    }
}

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Stock List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-cloud-download" label="Sync from Cloud"
                        severity="primary" @click="pullCloudData" />
                </div>
            </template>
        </PageTitle>
        <!-- DataTable -->
        <DataTable 
            :columns="columns" 
            :rows="filteredRows"
            :isLoading="useLocalInventory.loading" 
            :defaultSort="{ key: 'id', order: 'desc' }"
            :isAction="false"
        >
            <!-- Filter Section -->
            <template #filters>
                <div class="flex gap-2">
                    <BaseInput size="sm" v-model="searchValue" placeholder="Search" width="200px" height="h-[35px]"
                        icon="pi pi-search" />
                </div>
            </template>
        </DataTable>
    </div>
</template>
