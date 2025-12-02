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
    import { useSaleStore } from '@/stores/useSalesStore';

    const router = useRouter();
    const useSales = useSaleStore();
    const toast = useToast();
    const usePermission = usePermissionStore();
    const salesList = ref([]);
    const filterData = ref({
        startDate: '',
        endDate: ''
    });

    onMounted(async () => {
      await useSales.fetchAllSales();
      salesList.value = useSales.salesList;
    });

    const columns = [
        { key: 'id', label: 'Invoice No.' },
        { key: 'sale_date', label: 'Date', formatter: (row) => moment(row.sale_date).format('dd-mm-yy hh:mm') },
        { key: 'customer.name', label: 'Customer Name', formatter: (row) => row.customer.name },
        { key: 'total_amount', label: 'Total' },
        { key: 'payment_method.name', label: 'Payment', formatter: (row) => row.payment_method.name },
        { key: 'status.name', label: 'Status', formatter: (row) => row.status.name },
        { key: 'created_by.name', label: 'Created By', formatter: (row) => row.created_by.name },
        { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') },
        { key: 'updated_by.name', label: 'Updated By', formatter: (row) => row.updated_by.name },
        { key: 'updated_at', label: 'Updated At', formatter: (row) => moment(row.updated_at).format('DD-MM-YY hh:mm') },
    ];

    function changeRoute(pathname) {
        router.push(pathname);
    }


    // Sales delete function
    async function deleteHandle(id) {
        await useSales.deleteSales(id);
        if(useSales.error) {
            toast.add({ severity: 'error', summary: 'Error Message', detail: useSales.error, life: 3000 });
            return
        }
        if (useSales.data.status === 200) {
            toast.add({ severity: 'success', summary: 'Success Message', detail: 'Sales deleted successfully.', life: 3000 });
            await useSales.fetchAllSales();
            salesList.value = useSales.salesList
        }
    }

</script>



<template>
    <div class="p-4">
        <PageTitle title="Sales List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton 
                        v-if="usePermission.can('Sales', 'Create')"
                        icon="fa fa-circle-plus" 
                        label="Create" 
                        severity="primary" 
                        @click="changeRoute('/sales/create')"  />
                </div>
            </template>
        </PageTitle>
        <DataTable 
            :columns="columns" 
            :rows="salesList" 
            :pageSize="5" 
            :editPath="'Update Sales'" 
            :isLoading="useSales.loading" 
            @delete="deleteHandle"
            :defaultSort="{key: 'created_at', order: 'desc'}"
            :isEdit="!usePermission.can('Sales', 'Update')"
            :isDelete="!usePermission.can('Sales', 'Delete')"
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
