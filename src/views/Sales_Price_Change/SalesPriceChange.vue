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
    import { detectTargetType, targetLabel } from '@/utils/priceChangeTargets';

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
      priceChangeList.value = usePriceChange.priceChangeList;
    });

    function uniqueNames(values) {
        const names = [...new Set(values.filter(Boolean))];
        if (!names.length) return '-';
        return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
    }

    const columns = [
        { key: 'id', label: 'ID', formatter: (row) => row.id, onClick: (row) => {
            router.push({name: 'View Sales Price Change', query: { id: row.id }});
        }},
        { key: 'description', label: 'Description' },
        { key: 'type', label: 'Type'},
        { key: 'targets', label: 'Targets', formatter: (row) => uniqueNames((row.products || []).map((item) => targetLabel(detectTargetType(item)))) },
        { key: 'branches', label: 'Branches', formatter: (row) => uniqueNames((row.products || []).map((item) => item.branch?.name)) },
        { key: 'products', label: 'Price Rows', formatter: (row) => (row.products || []).length },
        { key: 'start_at', label: 'Start', formatter: (row) => moment(row.start_at).format('DD-MM-YY hh:mm') },
        // { key: 'end_at', label: 'End', formatter: (row) => moment(row.end_at).format('DD-MM-YY hh:mm') },
        { key: 'status.name', label: 'Status', formatter: (row) => {
            const statusName = row.status?.name || '-';
            const color = statusName === 'Active' ? 'bg-green-500' : statusName === 'Applied' ? 'bg-blue-500' : 'bg-red-500';
            return `<span class="text-white px-2 py-1 rounded-md ${color}">${statusName}</span>`;
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
        const saleOnly = priceChangeList.value.filter(
            row => row.type === 'sale'
        );

        const searchedData = filter.searchFunction( saleOnly, searchValue.value, [
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
            toast.add({ severity: 'success', summary: 'Success Message', detail: 'Sale price change deleted successfully.', life: 3000 });
            await usePriceChange.fetchAllPriceChange();
            priceChangeList.value = usePriceChange.priceChangeList;
        }
    }

</script>



<template>
    <div class="p-4">
        <PageTitle title="Sales Price Change List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton 
                        v-if="usePermission.can('Sales price change', 'Create')"
                        icon="fa fa-circle-plus" 
                        label="Create" 
                        severity="primary" 
                        @click="changeRoute('/sales_price_change/create')"  />
                </div>
            </template>
        </PageTitle>
        <DataTable 
            :columns="columns" 
            :rows="filteredRows" 
            :pageSize="5" 
            :editPath="'Update Sales Price Change'" 
            :isLoading="usePriceChange.loading"
            @delete="deleteHandle"
            :defaultSort="{key: 'id', order: 'desc'}"
            :isEdit="(row) => !usePermission.can('Sales price change', 'Update') || row.status?.name === 'Applied'"
            :isDelete="!usePermission.can('Sales price change', 'Delete')"
            filename="Sales_Price_Change"
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
