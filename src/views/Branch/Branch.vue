<script setup>

    import PageTitle from '@/components/PageTitle.vue';
    import DataTable from '@/components/DataTable.vue';
    import BaseButton from '@/components/BaseButton.vue';
    import { useRouter } from 'vue-router';
    import { useBranchStore } from '@/stores/useBranchStore';
    import { onMounted, ref, computed } from 'vue';
    import { useToast } from 'primevue';
    import moment from 'moment'
    import { useFilterStore } from '@/stores/filterStore';
    import { usePermissionStore } from '@/stores/usePermissionStore';
    import BaseInput from '@/components/BaseInput.vue';

    const router = useRouter();
    const useBranch = useBranchStore();
    const toast = useToast();
    const filter = useFilterStore();
    const usePermission = usePermissionStore();

    const searchValue = ref('');
    const startDate = ref('');
    const endDate = ref('');
    const branchList = ref([]);

    onMounted(async () => {
        await useBranch.fetchAllBranch();
        branchList.value = useBranch.branchList;
    });

    // Table headers
    const columns = [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone' },
        { key: 'location', label: 'Location' },
        { key: 'warehouse.name', label: 'Warehouse', formatter: (row) => row.warehouse.name },
        { key: 'status', label: 'Status', formatter: (row) => {
            const color = row.status.name === 'Active' ? 'bg-green-500 text-white rounded-md py-1 px-2' : 'bg-red-500 text-white rounded-md py-1 px-2';
            return `<span class="text-white px-2 py-1 rounded ${color}">${row.status.name}</span>`;
        } },
        { key: 'created_by.name', label: 'Created By', formatter: (row) => row.created_by.name },
        { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') },
        { key: 'updated_by.name', label: 'Updated By', formatter: (row) => row.updated_by.name },
        { key: 'updated_at', label: 'Updated At', formatter: (row) => moment(row.updated_at).format('DD-MM-YY hh:mm') },
    ];

    // Route change function: need to pass route path.
    function changeRoute(pathname) {
        router.push(pathname);
    }

    // Filter Function
    const filteredRows = computed(() => {
        const searchedData = filter.searchFunction(branchList.value, searchValue.value, [
            "name",
            "phone",
            "location"
        ]);
        return filter.dateRangeFilter(searchedData, { dateField: 'created_at', startDate: startDate.value, endDate: endDate.value })
    });

    // Branch delete function
    async function deleteHandle(id) {
        await useBranch.deleteBranch(id);
        if(useBranch.error) {
            toast.add({ severity: 'error', summary: 'Error Message', detail: useBranch.error, life: 3000 });
            return
        }
        if (useBranch.data.status === 200) {
            toast.add({ severity: 'success', summary: 'Success Message', detail: 'Branch deleted successfully.', life: 3000 });
            await useBranch.fetchAllBranch();
            branchList.value = useBranch.branchList;
        }
    }

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Branch List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton 
                        v-if="usePermission.can('Branch', 'Create')"
                        icon="fa fa-circle-plus" 
                        label="Create" 
                        severity="primary" 
                        @click="changeRoute('/branch/create')"  
                    />
                </div>
            </template>
        </PageTitle>
        <!-- DataTable -->
        <DataTable
            :columns="columns"
            :rows="filteredRows"
            :pageSize="5"
            :editPath="'Update Branch'"
            :isLoading="useBranch.loading"
            @delete="deleteHandle"
            :defaultSort="{key: 'created_at', order: 'desc'}"
            :isEdit="!usePermission.can('Branch', 'Update')"
            :isDelete="!usePermission.can('Branch', 'Delete')"
        >
            <!-- Filter Section -->
            <template #filters>
                <div class="flex gap-2">
                    <BaseInput
                        size="sm"
                        type="date"
                        v-model="startDate"
                        placeholder="Search"
                        width="200px"
                        height="h-[35px]"
                    />
                    <BaseInput
                        size="sm"
                        type="date"
                        v-model="endDate"
                        placeholder="Search"
                        width="200px"
                        height="h-[35px]"
                    />
                    <BaseInput
                        size="sm"
                        v-model="searchValue"
                        placeholder="Search"
                        width="200px"
                        height="h-[35px]"
                        icon="pi pi-search"
                    />
                </div>
            </template>
        </DataTable>
    </div>
</template>
