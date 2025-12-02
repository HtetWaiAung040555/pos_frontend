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
    import { useCategoryStore } from '@/stores/useCategoryStore';

    const router = useRouter();
    const useCategory = useCategoryStore();
    const toast = useToast();
    const filter = useFilterStore();
    const searchValue = ref('');
    const startDate = ref('');
    const endDate = ref('');
    const usePermission = usePermissionStore();
    
    let categoryList = ref([]);

    onMounted(async () => {
      await useCategory.fetchAllCategory();
      categoryList.value =useCategory.categoryList;
      console.log(categoryList.value)
    });
    

    const columns = [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'status', label: 'Status', formatter: (row) => {
            const color = row.status.name === 'Active' ? 'bg-green-500 text-white rounded-md py-1 px-2' : 'bg-red-500 text-white rounded-md py-1 px-2';
            return `<span class="text-white px-2 py-1 rounded ${color}">${row.status.name}</span>`;
        } },
        { key: 'created_by.name', label: 'Created By', formatter: (row) => row.created_by.name },
        { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') },
        { key: 'updated_by.name', label: 'Updated By', formatter: (row) => row.updated_by.name },
        { key: 'updated_at', label: 'Updated At', formatter: (row) => moment(row.updated_at).format('DD-MM-YY hh:mm') },
    ];

    function changeRoute(pathname) {
        router.push(pathname);
    }

    const filteredRows = computed(() => {
        const searchedData = filter.searchFunction(categoryList.value, searchValue.value, [
            "name",
        ]);
        return filter.dateRangeFilter(searchedData, { dateField: 'created_at', startDate: startDate.value, endDate: endDate.value })
    });

    // delete function
    async function deleteHandle(id) {
        await useCategory.deleteCategory(id);
        if(useCategory.error) {
            toast.add({ severity: 'error', summary: 'Error Message', detail: useCategory.error, life: 3000 });
            return
        }
        if (useCategory.data.status === 200) {
            toast.add({ severity: 'success', summary: 'Success Message', detail: 'Category deleted successfully.', life: 3000 });
            await useCategory.fetchAllCategory();
            categoryList.value =  useCategory.categoryList;
        }
    }
</script>

<template>
    <div class="p-4">
        <PageTitle title="Category List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton 
                        v-if="usePermission.can('Category', 'Create')"
                        icon="fa fa-circle-plus" 
                        label="Create" 
                        severity="primary" 
                        @click="changeRoute('/category/create')"  />
                </div>
            </template>
        </PageTitle>
        <DataTable 
            :columns="columns" 
            :rows="filteredRows" 
            :pageSize="5" 
            :editPath="'Update Category'" 
            :isLoading="useCategory.loading" 
            @delete="deleteHandle"
            :defaultSort="{key: 'created_at', order: 'desc'}"
            :isEdit="!usePermission.can('Category', 'Update')"
            :isDelete="!usePermission.can('Category', 'Delete')"
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
