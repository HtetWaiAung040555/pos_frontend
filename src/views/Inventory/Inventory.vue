<script setup>

    import PageTitle from '@/components/PageTitle.vue';
    import DataTable from '@/components/DataTable.vue';
    import BaseButton from '@/components/BaseButton.vue';
    import { useRouter } from 'vue-router';
    import { onMounted, ref, computed, watch } from 'vue';
    import { useToast } from 'primevue';
    import moment from 'moment'
    import { useFilterStore } from '@/stores/filterStore';
    import { usePermissionStore } from '@/stores/usePermissionStore';
    import BaseInput from '@/components/BaseInput.vue';
    import { useInventoryStore } from '@/stores/useInventoryStore';

    const router = useRouter();
    const toast = useToast();
    const filter = useFilterStore();
    const usePermission = usePermissionStore();
    const useInventory = useInventoryStore();

    const searchValue = ref('');
    const startDate = ref('');
    const endDate = ref('');
    const dataList = ref([]);
    const nearlyExpire = ref(false);

    onMounted(async () => {
        // restore saved filters
        const saved = filter.getPageFilter('inventory');
        if (saved) {
            if (saved.startDate) startDate.value = saved.startDate;
            if (saved.endDate) endDate.value = saved.endDate;
            if (saved.searchValue) searchValue.value = saved.searchValue;
            if (typeof saved.nearlyExpire !== 'undefined') nearlyExpire.value = saved.nearlyExpire;
        }

        await useInventory.fetchAllStock();
        const inventory = useInventory.stockList.filter(item => item.warehouse.id === JSON.parse(localStorage.getItem('user')).branch.warehouse_id);
        dataList.value = inventory;
        console.log('Inventory List:', dataList.value);
        // persist current filters
        saveFilters();
    });

// persist filters for this page
function saveFilters() {
    filter.setPageFilter('inventory', {
        startDate: startDate.value,
        endDate: endDate.value,
        searchValue: searchValue.value,
        nearlyExpire: nearlyExpire.value,
    });
}

watch([
    () => startDate.value,
    () => endDate.value,
    () => searchValue.value,
    () => nearlyExpire.value
], () => {
    saveFilters();
});

    // Table headers
    const columns = [
        { key: 'id', label: 'ID' },
        { key: 'image_url', label: 'Image', formatter: (row) => {
            return `<img class="object-cover w-10 h-10 rounded" src="${row.product.image_url}" alt="${row.product.name}" />`;
        } },
        { key: 'product.barcode', label: 'Barcode', formatter: (row) => row.product.barcode },
        { key: 'product.name', label: 'Product', formatter: (row) => row.product.name },
        { key: 'warehouse.name', label: 'Warehouse', formatter: (row) => row.warehouse.name },
        { key: 'qty', label: 'Qty' },
        { key: 'expired_date', label: 'Expire', formatter: (row) => row.expired_date? moment(row.expired_date).format('DD-MM-YY') : "N/A" },
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
            "product.name",
        ]);

        if (nearlyExpire.value) {
            const today = moment().startOf('day');
            const twoMonths = moment().add(2, 'months').endOf('day');
            return searchedData.filter(item => item.expired_date && moment(item.expired_date).isBetween(today, twoMonths, undefined, '[]'));
        }

        return filter.dateRangeFilter(searchedData, { dateField: 'created_at', startDate: startDate.value, endDate: endDate.value })
    });

    //Branch delete function
    async function deleteHandle(id) {
        await useInventory.deleteUser(id);
        if(useInventory.error.length) {
            useInventory.error.forEach((msg) => {
            toast.add({
              severity: 'error',
              summary: 'Error Message',
              detail: msg,
              life: 3000
            });
        });
            return
        }
        if (useInventory.stockList.status === 200) {
            toast.add({ severity: 'success', summary: 'Success Message', detail: 'Inventory deleted successfully.', life: 3000 });
            await useUser.fetchAllUsers();
            dataList.value = useUser.users;
        }
    }

    function handleNearlyExpire() {
        nearlyExpire.value = !nearlyExpire.value;
        if (nearlyExpire.value) {
            startDate.value = '';
            endDate.value = '';
        }
    }

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Stock List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton 
                        v-if="usePermission.can('Inventory', 'Create')"
                        icon="fa fa-circle-plus" 
                        label="Create" 
                        severity="primary" 
                        @click="changeRoute('/inventory/create')"  
                    />
                </div>
            </template>
        </PageTitle>
        <!-- DataTable -->
        <DataTable
            :columns="columns"
            :rows="filteredRows"
            :editPath="'Update Inventory'"
            :isLoading="useInventory.loading"
            :defaultSort="{key: 'created_at', order: 'desc'}"
            :isEdit="!usePermission.can('Inventory', 'Update')"
            :isDelete="!usePermission.can('Inventory', 'Delete')"
            :isAdjust="true"
            @delete="deleteHandle"
            filename="Inventory_Stock"
        >
            <!-- Filter Section -->
            <template #filters>
                <div class="flex gap-2">
                    <BaseInput
                        size="sm"
                        type="date"
                        v-model="startDate"
                        width="200px"
                        height="h-[35px]"
                    />
                    <BaseInput
                        size="sm"
                        type="date"
                        v-model="endDate"
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
                    <BaseButton label="Nearly Expire" severity="secondary" @click="handleNearlyExpire" />
                </div>
            </template>
        </DataTable>
    </div>
</template>
