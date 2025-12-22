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
import { useCustomerStore } from '@/stores/useCustomerStore';

const router = useRouter();
const toast = useToast();
const filter = useFilterStore();
const usePermission = usePermissionStore();
const useCustomer = useCustomerStore();

const searchValue = ref('');
const startDate = ref('');
const endDate = ref('');
const dataList = ref([]);

onMounted(async () => {
    await useCustomer.fetchAllCustomer();
    dataList.value = useCustomer.customerList;
});

// Table headers
const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'balance', label: 'Balance' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' },
    { key: 'created_by', label: 'Created By', formatter: (row) => row.created_by.name },
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

//Customer delete function
async function deleteHandle(id) {
    await useCustomer.deleteCustomer(id);
    if (useCustomer.error.length) {
        useCustomer.error.forEach((msg) => {
            toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
            });
        });
        return
    }
    if (useCustomer.data.status === 200) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Inventory deleted successfully.', life: 3000 });
        await useCustomer.fetchAllCustomer();
        dataList.value = useCustomer.customerList;
    }
}

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Customer List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton v-if="usePermission.can('Customer', 'Create')" icon="fa fa-circle-plus" label="Create"
                        severity="primary" @click="changeRoute('/customer/create')" />
                </div>
            </template>
        </PageTitle>
        <!-- DataTable -->
        <DataTable :columns="columns" :rows="filteredRows" :pageSize="5" :editPath="'Update Customer'"
            :isLoading="useCustomer.loading" :defaultSort="{ key: 'created_at', order: 'desc' }"
            :isEdit="!usePermission.can('Customer', 'Update')" :isDelete="!usePermission.can('Customer', 'Delete')"
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
