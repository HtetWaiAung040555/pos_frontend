<script setup>

import PageTitle from '@/components/PageTitle.vue';
import DataTable from '@/components/DataTable.vue';
import BaseButton from '@/components/BaseButton.vue';
import { useRouter } from 'vue-router';
import { onMounted, ref, computed } from 'vue';
import { useToast } from 'primevue';
import moment from 'moment'
import { useFilterStore } from '@/stores/filterStore';
import BaseInput from '@/components/BaseInput.vue';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { useUnitStore } from '@/stores/useUnitStore';

const router = useRouter();
const useUnit = useUnitStore();
const toast = useToast();
const filter = useFilterStore();
const searchValue = ref('');
const startDate = ref('');
const endDate = ref('');
const usePermission = usePermissionStore();

let unitList = ref([]);

onMounted(async () => {
    await useUnit.fetchAllUnit();
    unitList.value = useUnit.unitList
    console.log(unitList.value);
});

const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    {
        key: 'status', label: 'Status', formatter: (row) => {
            const color = row.status.name === 'Active' ? 'bg-green-500 text-white rounded-md py-1 px-2' : 'bg-red-500 text-white rounded-md py-1 px-2';
            return `<span class="text-white px-2 py-1 rounded ${color}">${row.status.name}</span>`;
        }
    },
    { key: 'created_by.name', label: 'Created By', formatter: (row) => row.created_by.name },
    { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') },
    { key: 'updated_by.name', label: 'Updated By', formatter: (row) => row.updated_by.name },
    { key: 'updated_at', label: 'Updated At', formatter: (row) => moment(row.updated_at).format('DD-MM-YY hh:mm') },
];

function changeRoute(pathname) {
    router.push(pathname);
}

const filteredRows = computed(() => {
    const searchedData = filter.searchFunction(unitList.value, searchValue.value, [
        "name",
    ]);
    return filter.dateRangeFilter(searchedData, { dateField: 'created_at', startDate: startDate.value, endDate: endDate.value })
});

// delete function
async function deleteHandle(id) {
    await useUnit.deleteUnit(id);
    if (useUnit.error.length) {
        useUnit.error.forEach((msg) => {
            toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
            });
        });
        return
    }
    if (useUnit.data.status === 200) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Unit deleted successfully.', life: 3000 });
        await useUnit.fetchAllUnit();
        unitList.value = useUnit.unitList
    }
}
</script>

<template>
    <div class="p-4">
        <PageTitle title="Unit List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton v-if="usePermission.can('Unit', 'Create')" icon="fa fa-circle-plus"
                        label="Create" severity="primary" @click="changeRoute('/unit/create')" />
                </div>
            </template>
        </PageTitle>
        <DataTable :columns="columns" :rows="filteredRows" :pageSize="5" :editPath="'Update Unit'"
            :isLoading="useUnit.loading" @delete="deleteHandle"
            :defaultSort="{ key: 'created_at', order: 'desc' }" :isEdit="!usePermission.can('Unit', 'Update')"
            :isDelete="!usePermission.can('Unit', 'Delete')">
            <template #filters>
                <div class="flex gap-2">
                    <BaseInput size="sm" v-model="startDate" type="date" placeholder="Start Date" width="200px"
                        height="h-[35px]" />
                    <BaseInput size="sm" v-model="endDate" type="date" placeholder="End Date" width="200px"
                        height="h-[35px]" />
                    <BaseInput size="sm" v-model="searchValue" placeholder="Search..." icon="pi pi-search" width="200px"
                        height="h-[35px]" />
                </div>
            </template>
        </DataTable>
    </div>
</template>
