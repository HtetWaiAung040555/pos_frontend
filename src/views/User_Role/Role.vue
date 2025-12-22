<script setup>

import PageTitle from '@/components/PageTitle.vue';
import DataTable from '@/components/DataTable.vue';
import BaseButton from '@/components/BaseButton.vue';
import { useRouter } from 'vue-router';
import { onMounted, ref, computed } from 'vue';
import { useToast } from 'primevue';
import moment from 'moment'
import { useFilterStore } from '@/stores/filterStore';
import { useUserRoleStore } from '@/stores/useUserRoleStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import BaseInput from '@/components/BaseInput.vue';

const router = useRouter();
const useRole = useUserRoleStore();
const toast = useToast();
const filter = useFilterStore();
const usePermission = usePermissionStore();
const searchValue = ref('');
const startDate = ref('');
const endDate = ref('');
const roleList = ref([]);

onMounted(async () => {
    await useRole.fetchAllRole();
    roleList.value = useRole.roleList;
});

// Table header
const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'desc', label: 'Description' },
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

// Change route function
function changeRoute(pathname) {
    router.push(pathname);
}

// Filter function
const filteredRows = computed(() => {
    const searchedData = filter.searchFunction(roleList.value, searchValue.value, [
        "name",
    ]);
    return filter.dateRangeFilter(searchedData, { dateField: 'created_at', startDate: startDate.value, endDate: endDate.value });
});

// Role delete function
async function deleteHandle(id) {
    await useRole.deleteRole(id);
    if (useRole.error.length) {
        useRole.error.forEach((msg) => {
            toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
            });
        });
        return
    }
    if (useRole.data.status === 200) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Branch deleted successfully.', life: 3000 });
        await useRole.fetchAllBranch();
        roleList.value = useRole.roleList
    }
}

</script>

<template>
    <div class="p-4">
        <!-- Page title -->
        <PageTitle title="Role List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton v-if="usePermission.can('Role', 'Create')" icon="fa fa-circle-plus" label="Create"
                        severity="primary" @click="changeRoute('/role/create')" />
                </div>
            </template>
        </PageTitle>
        <!-- Displaying role data -->
        <DataTable :columns="columns" :rows="filteredRows" :pageSize="5" :editPath="'Update Role'"
            :isLoading="useRole.loading" @delete="deleteHandle" :defaultSort="{ key: 'created_at', order: 'desc' }"
            :isEdit="!usePermission.can('Role', 'Update')" :isDelete="!usePermission.can('Role', 'Delete')">
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
