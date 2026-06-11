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
    import { usePromotionStore } from '@/stores/usePromotionStore';
import { getPromotionLifecycleStatusName, statusBadgeHtml } from '@/utils/const';

    const router = useRouter();
    const usePromo = usePromotionStore();
    const toast = useToast();
    const filter = useFilterStore();
    const searchValue = ref('');
    const startDate = ref('');
    const endDate = ref('');
    const usePermission = usePermissionStore();
    const promoList = ref([]);

    onMounted(async () => {
      await usePromo.fetchAllPromo();
      promoList.value = usePromo.promoList;
    });

    function promotionStatusName(row) {
        return getPromotionLifecycleStatusName(row.start_at, row.end_at);
    }

    const columns = [
        { key: 'id', label: 'ID', formatter: (row) => row.id, onClick: (row) => {
            router.push({name: 'View Promotion', query: { id: row.id }});
        }},
        { key: 'name', label: 'Name' },
        { key: 'promo_type', label: 'Promo Type', formatter: (row) => statusBadgeHtml(row.promo_type)},
        // { key: 'discount_type', label: 'Type' },
        // { key: 'discount_value', label: 'Discount Value', formatter: (row) => `${Number(row.discount_value).toLocaleString('en-us')}${row.discount_type === 'Percentage' ? '%' : ''}` },
        { key: 'start_at', label: 'Start', formatter: (row) => moment(row.start_at).format('DD-MM-YY hh:mm') },
        { key: 'end_at', label: 'End', formatter: (row) => moment(row.end_at).format('DD-MM-YY hh:mm') },
        { key: 'status', label: 'Status', formatter: (row) => statusBadgeHtml(promotionStatusName(row)) },
        { key: 'created_by.name', label: 'Created By', formatter: (row) => row.created_by?.name },
        { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') },
        // { key: 'updated_by.name', label: 'Updated By', formatter: (row) => row.updated_by?.name },
        // { key: 'updated_at', label: 'Updated At', formatter: (row) => moment(row.updated_at).format('DD-MM-YY hh:mm') },
    ];

    function changeRoute(pathname) {
        router.push(pathname);
    }

    const filteredRows = computed(() => {
        const searchedData = filter.searchFunction(promoList.value, searchValue.value, [
            "name",
            // "phone",
            // "location"
        ]);
        return filter.dateRangeFilter(searchedData, { dateField: 'start_at', startDate: startDate.value, endDate: endDate.value })
    });

    // Delete function
    async function deleteHandle(id) {

        await usePromo.deletePromo({void_by: JSON.parse(localStorage.getItem('user')).id}, id);
        if(usePromo.error.length) {
            usePromo.error.forEach((msg) => {
                toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
                });
            });
        }
        if (usePromo.data.status === 200) {
            toast.add({ severity: 'success', summary: 'Success Message', detail: 'Promotion deleted successfully.', life: 3000 });
            await usePromo.fetchAllPromo();
            promoList.value = usePromo.promoList;
        }
    }

</script>

<template>
    <div class="p-4">
        <PageTitle title="Promotion List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton 
                        v-if="usePermission.can('Promotion', 'Create')"
                        icon="fa fa-circle-plus" 
                        label="Create" 
                        severity="primary" 
                        @click="changeRoute('/promotion/create')"  />
                </div>
            </template>
        </PageTitle>
        <DataTable 
            :columns="columns" 
            :rows="filteredRows" 
            :editPath="'Update Promotion'" 
            :isLoading="usePromo.loading" 
            @delete="deleteHandle"
            :defaultSort="{key: 'start_at', order: 'desc'}"
            :isEdit="(row) => !usePermission.can('Promotion', 'Update') || promotionStatusName(row) === 'Inactive'"
            :isDelete="!usePermission.can('Promotion', 'Delete')"
            filename="Promotion"
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
