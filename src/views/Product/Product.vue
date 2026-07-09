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
    import { useProductStore } from '@/stores/useProductStore';

    const router = useRouter();
    const toast = useToast();
    const filter = useFilterStore();
    const usePermission = usePermissionStore();
    const useProduct = useProductStore();

    const searchValue = ref('');
    const startDate = ref('');
    const endDate = ref('');
    const dataList = ref([]);

    onMounted(async () => {
        // restore saved filters
        const saved = filter.getPageFilter('product');
        if (saved) {
            if (saved.startDate) startDate.value = saved.startDate;
            if (saved.endDate) endDate.value = saved.endDate;
            if (saved.searchValue) searchValue.value = saved.searchValue;
        }

        await useProduct.fetchAllProduct();
        dataList.value = useProduct.productList;
        // persist current filters
        saveFilters();
    });

    // persist filters for this page
    function saveFilters() {
        filter.setPageFilter('product', {
            startDate: startDate.value,
            endDate: endDate.value,
            searchValue: searchValue.value,
        });
    }

    watch([() => startDate.value, () => endDate.value, () => searchValue.value], () => {
        saveFilters();
    });

    function safeName(value) {
        return value?.name || '-';
    }

    function productUnitName(productUnit) {
        return productUnit?.unit_id?.name || productUnit?.unit_name || '-';
    }

    function defaultProductUnit(row) {
        if (row.default_product_unit?.id) return row.default_product_unit;
        return row.product_units?.find((unit) => unit.is_default_sale_unit)
            || row.product_units?.find((unit) => unit.is_base_unit)
            || row.product_units?.[0]
            || null;
    }

    function formatDefaultUnit(row) {
        const productUnit = defaultProductUnit(row);
        if (productUnit) {
            return `${productUnitName(productUnit)}`;
        }
        return safeName(row.unit_id);
    }

    function formatProductUnits(row) {
        if (!row.uom_enabled || !row.product_units?.length) {
            return safeName(row.unit_id);
        }

        return row.product_units.map((unit) => {
            const label = `${productUnitName(unit)}`;
            return `<div class="text-xs leading-5">${label}</div>`;
        }).join('');
    }

    function formatPriceRanges(row) {
        const productUnit = defaultProductUnit(row);
        if (!productUnit?.price_ranges?.length) return '-';

        return productUnit.price_ranges.map((range) => {
            const maxQty = range.max_qty === null || range.max_qty === undefined ? '+' : Number(range.max_qty).toLocaleString('en-us');
            return `<div class="text-xs leading-5">${Number(range.min_qty).toLocaleString('en-us')} - ${maxQty}: ${Number(range.price || 0).toLocaleString('en-us')}</div>`;
        }).join('');
    }

    function formatBranchProducts(row) {
        const branches = [...new Set((row.branch_products || []).map((item) => item.branch?.name).filter(Boolean))];
        if (!branches.length) return '-';
        return branches.length > 2 ? `${branches.slice(0, 2).join(', ')} +${branches.length - 2}` : branches.join(', ');
    }

    function formatBranchUnitPriceCount(row) {
        return (row.branch_products || []).reduce((total, item) => total + (item.unit_prices || []).length, 0);
    }

    // Table headers
    const columns = [
        { key: 'id', label: 'ID', formatter: (row) => row.id, onClick: (row) => {
            router.push({ name: 'View Product', query: { id: row.id } });
        } },
        { key: 'image_url', label: 'Image', formatter: (row) => {
            return `<img class="object-cover w-10 h-10 rounded" src="${row.image_url}" alt="${row.name}" />`;
        } },
        { key: 'name', label: 'Name' },
        { key: 'barcode', label: 'Barcode' },
        { key: 'uom_enabled', label: 'UOM', formatter: (row) => row.uom_enabled ? 'Multi' : 'Single' },
        { key: 'default_product_unit', label: 'Base Unit', formatter: formatDefaultUnit },
        { key: 'product_units', label: 'Product Units', formatter: formatProductUnits },
        { key: 'price_ranges', label: 'Default Ranges', formatter: formatPriceRanges },
        { key: 'branch_products', label: 'Branches', formatter: formatBranchProducts },
        { key: 'branch_unit_prices', label: 'Branch Price Rows', formatter: formatBranchUnitPriceCount },
        { key: 'category_id.name', label: 'Category', formatter: (row) => safeName(row.category_id) },
        { key: 'sec_prop', label: 'Property' },
        { key: 'price', label: 'Sales Price', formatter: (row) => Number(row.price).toLocaleString('en-us') },
        //{ key: 'purchase_price', label: 'Purchase Price' },
        { key: 'status', label: 'Status', formatter: (row) => {
            const color = row.status?.name === 'Active' ? 'bg-green-500 text-white rounded-md py-1 px-2' : 'bg-red-500 text-white rounded-md py-1 px-2';
            return `<span class="text-white px-2 py-1 rounded ${color}">${row.status?.name || '-'}</span>`;
        } },
        { key: 'created_by.name', label: 'Created By', formatter: (row) => safeName(row.created_by) },
        { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') },
        { key: 'updated_by.name', label: 'Updated By', formatter: (row) => safeName(row.updated_by) },
        { key: 'updated_at', label: 'Updated At', formatter: (row) => moment(row.updated_at).format('DD-MM-YY hh:mm') },
    ];

    // Route change function: need to pass route path.
    function changeRoute(pathname) {
        router.push(pathname);
    }

    // Filter Function
    const filteredRows = computed(() => {
        const searchedData = filter.searchFunction(dataList.value, searchValue.value, [
            "name",
            "barcode"
        ]);
        return filter.dateRangeFilter(searchedData, { dateField: 'created_at', startDate: startDate.value, endDate: endDate.value })
    });

    // Branch delete function
    async function deleteHandle(id) {
        await useProduct.deleteProduct(id);
        if(useProduct.error.length) {
            useProduct.error.forEach((msg) => {
                toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
                });
            });
            return
        }
        if (useProduct.data.status === 200) {
            toast.add({ severity: 'success', summary: 'Success Message', detail: 'Product deleted successfully.', life: 3000 });
            await useProduct.fetchAllProduct();
            dataList.value = useProduct.productList;
        }
    }

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Product List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton 
                        v-if="usePermission.can('Product', 'Create')"
                        icon="fa fa-circle-plus" 
                        label="Create" 
                        severity="primary" 
                        @click="changeRoute('/product/create')"  
                    />
                </div>
            </template>
        </PageTitle>
        <!-- DataTable -->
        <DataTable
            :columns="columns"
            :rows="filteredRows"
            :editPath="'Update Product'"
            :isLoading="useProduct.loading"
            :defaultSort="{key: 'created_at', order: 'desc'}"
            :isEdit="!usePermission.can('Product', 'Update')"
            :isDelete="!usePermission.can('Product', 'Delete')"
            @delete="deleteHandle"
            filename="Product"
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
