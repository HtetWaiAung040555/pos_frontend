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
import { useSupplierStore } from '@/stores/useSupplierStore';


const router = useRouter();
const toast = useToast();
const filter = useFilterStore();
const usePermission = usePermissionStore();
const useSupplier = useSupplierStore();

const searchValue = ref('');
const startDate = ref('');
const endDate = ref('');
const dataList = ref([]);

onMounted(async () => {
    await useSupplier.fetchAllSupplier();
    dataList.value = useSupplier.supplierList;
});

// Table headers
const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' },
    {
        key: 'status.name', label: 'Status', formatter: (row) => {
            const color = row.status.name === 'Active' ? 'bg-green-500 text-white rounded-md py-1 px-2' : 'bg-red-500 text-white rounded-md py-1 px-2';
            return `<span class="text-white px-2 py-1 rounded ${color}">${row.status.name}</span>`;
        }
    },
    { key: 'created_by.name', label: 'Created By', formatter: (row) => row.created_by.name },
    { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') },
    { key: 'updated_by', label: 'Updated By', formatter: (row) => row.updated_by.name },
    { key: 'updated_at', label: 'Updated At', formatter: (row) => moment(row.updated_at).format('DD-MM-YY hh:mm') },
];

// Route change function: need to pass route path.
function changeRoute(pathname) {
    router.push(pathname);
}

// Filter Function
const filteredRows = computed(() => {
    const searchedData = filter.searchFunction(dataList.value, searchValue.value, [
        "name",
    ]);
    return filter.dateRangeFilter(searchedData, { dateField: 'created_at', startDate: startDate.value, endDate: endDate.value })
});

// Delete function
async function deleteHandle(id) {
    await useSupplier.deleteSupplier(id);
    if (useSupplier.error.length) {
        useSupplier.error.forEach((msg) => {
            toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
            });
        });
        return
    }
    if (useSupplier.data.status === 200) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Supplier deleted successfully.', life: 3000 });
        await useSupplier.fetchAllSupplier();
        dataList.value = useSupplier.supplierList;

    }
}

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Supplier List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton v-if="usePermission.can('Supplier', 'Create')" icon="fa fa-circle-plus" label="Create"
                        severity="primary" @click="changeRoute('/supplier/create')" />
                </div>
            </template>
        </PageTitle>
        <!-- DataTable -->
        <DataTable :columns="columns" :rows="filteredRows" :editPath="'Update Supplier'"
            :isLoading="useSupplier.loading" :defaultSort="{ key: 'created_at', order: 'desc' }"
            :isEdit="!usePermission.can('Supplier', 'Update')" :isDelete="!usePermission.can('Supplier', 'Delete')"
            @delete="deleteHandle">
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
