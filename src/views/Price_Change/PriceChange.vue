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
    import { usePriceChangeStore } from '@/stores/usePriceChangeStore';

    const router = useRouter();
    const usePriceChange = usePriceChangeStore();
    const toast = useToast();
    const filter = useFilterStore();
    const searchValue = ref('');
    const startDate = ref('');
    const endDate = ref('');
    const usePermission = usePermissionStore();
    const priceChangeList = ref([]);

    onMounted(async () => {
      await usePriceChange.fetchAllPriceChange();
      console.log('Fetched price changes:', usePriceChange.priceChangeList); 
      priceChangeList.value = usePriceChange.priceChangeList;
    });

    const columns = [
        { key: 'id', label: 'ID' },
        { key: 'description', label: 'Description' },
        { key: 'type', label: 'Type'},
        { key: 'start_at', label: 'Start', formatter: (row) => moment(row.start_at).format('DD-MM-YY hh:mm') },
        { key: 'end_at', label: 'End', formatter: (row) => moment(row.end_at).format('DD-MM-YY hh:mm') },
        { key: 'status', label: 'Status', formatter: (row) => {
            const color = row.status.name === 'Active' ? 'bg-green-500 text-white rounded-md py-1 px-2' : 'bg-red-500 text-white rounded-md py-1 px-2';
            return `<span class="text-white px-2 py-1 rounded ${color}">${row.status.name}</span>`;
        } },
        { key: 'created_by.name', label: 'Created By', formatter: (row) => row.created_by?.name },
        { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') },
        { key: 'updated_by.name', label: 'Updated By', formatter: (row) => row.updated_by?.name },
        { key: 'updated_at', label: 'Updated At', formatter: (row) => moment(row.updated_at).format('DD-MM-YY hh:mm') },
    ];

    function changeRoute(pathname) {
        router.push(pathname);
    }

    const filteredRows = computed(() => {
        const searchedData = filter.searchFunction(priceChangeList.value, searchValue.value, [
            "description",
        ]);
        return filter.dateRangeFilter(searchedData, { dateField: 'start_at', startDate: startDate.value, endDate: endDate.value })
    });

    // Delete function
    async function deleteHandle(id) {
        await usePriceChange.deletePriceChange({void_by: JSON.parse(localStorage.getItem('user')).id}, id);
        if(usePriceChange.error.length) {
            usePriceChange.error.forEach((msg) => {
                toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
                });
            });
        }
        if (usePriceChange.data.status === 200) {
            toast.add({ severity: 'success', summary: 'Success Message', detail: 'Price change deleted successfully.', life: 3000 });
            await usePriceChange.fetchAllPriceChange();
            priceChangeList.value = usePriceChange.priceChangeList;
        }
    }

</script>



<template>
    <div class="p-4">
        <PageTitle title="Price Change List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton 
                        v-if="usePermission.can('Price change', 'Create')"
                        icon="fa fa-circle-plus" 
                        label="Create" 
                        severity="primary" 
                        @click="changeRoute('/price_change/create')"  />
                </div>
            </template>
        </PageTitle>
        <DataTable 
            :columns="columns" 
            :rows="filteredRows" 
            :pageSize="5" 
            :editPath="'Update Price Change'" 
            :isLoading="usePriceChange.loading" 
            @delete="deleteHandle"
            :defaultSort="{key: 'start_at', order: 'desc'}"
            :isEdit="!usePermission.can('Price change', 'Update')"
            :isDelete="!usePermission.can('Price change', 'Delete')"
        >
            <template #filters>
                <div class="flex gap-2">
                    <BaseInput 
                        size="sm"
                        v-model="startDate"
                        type="date"
                        placeholder="Start Date"
                        width="200px"
                        height="h-[35px]"
                    />
                    <BaseInput 
                        size="sm"
                        v-model="endDate"
                        type="date"
                        placeholder="End Date"
                        width="200px"
                        height="h-[35px]"
                    />
                    <BaseInput 
                        size="sm"
                        v-model="searchValue"
                        placeholder="Search..."
                        icon="pi pi-search"
                        width="200px"
                        height="h-[35px]"
                    />
                </div>
            </template>
        </DataTable>
    </div>
</template>