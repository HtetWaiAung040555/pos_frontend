<script setup>

import PageTitle from '@/components/PageTitle.vue';
import DataTable from '@/components/DataTable.vue';
import BaseButton from '@/components/BaseButton.vue';
import { useRouter } from 'vue-router';
import { onMounted, ref, computed } from 'vue';
import { useToast } from 'primevue';
import moment from 'moment'
import { useFilterStore } from '@/stores/filterStore';
import { useCounterStore } from '@/stores/useCounterStore';
import BaseInput from '@/components/BaseInput.vue';
import { usePermissionStore } from '@/stores/usePermissionStore';

const router = useRouter();
const useCounter = useCounterStore();
const toast = useToast();
const filter = useFilterStore();
const searchValue = ref('');
const startDate = ref('');
const endDate = ref('');
const usePermission = usePermissionStore();


let counterList = ref([]);

onMounted(async () => {
    await useCounter.fetchAllCounter();
    counterList.value = useCounter.counterList;

});

const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'branch.name', label: 'Branch', formatter: (row) => row.branch.name },
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
    const searchedData = filter.searchFunction(counterList.value, searchValue.value, [
        "name",
    ]);
    return filter.dateRangeFilter(searchedData, { dateField: 'created_at', startDate: startDate.value, endDate: endDate.value })
});


// Counter delete function
async function deleteHandle(id) {
    await useCounter.deleteCounter(id);
    if (useCounter.error.length) {
        useCounter.error.forEach((msg) => {
            toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
            });
        });
        return
    }
    if (useCounter.data.status === 200) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Counter deleted successfully.', life: 3000 });
        await useCounter.fetchAllCounter();
        counterList.value = useCounter.counterList;
    }
}



</script>

<template>
    <div class="p-4">
        <PageTitle title="Counter List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton v-if="usePermission.can('Counter', 'Create')" icon="fa fa-circle-plus" label="Create"
                        severity="primary" @click="changeRoute('/counter/create')" />
                </div>
            </template>
        </PageTitle>
        <DataTable :columns="columns" :rows="filteredRows" :editPath="'Update Counter'"
            :isLoading="useCounter.loading" @delete="deleteHandle" :defaultSort="{ key: 'created_at', order: 'desc' }"
            :isEdit="!usePermission.can('Counter', 'Update')" :isDelete="!usePermission.can('Counter', 'Delete')">
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
