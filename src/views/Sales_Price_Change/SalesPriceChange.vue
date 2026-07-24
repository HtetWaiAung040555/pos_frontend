<script setup>

    import PageTitle from '@/components/PageTitle.vue';
    import DataTable from '@/components/DataTable.vue';
    import BaseButton from '@/components/BaseButton.vue';
    import EndSalesPriceChangeDialog from '@/components/EndSalesPriceChangeDialog.vue';
    import { useRouter } from 'vue-router';
    import { onMounted, ref, computed, watch } from 'vue';
    import { useToast } from 'primevue';
    import moment from 'moment'
    import { useFilterStore } from '@/stores/filterStore';
    import BaseInput from '@/components/BaseInput.vue';
    import { usePermissionStore } from '@/stores/usePermissionStore';
    import { usePriceChangeStore } from '@/stores/usePriceChangeStore';
    import { detectTargetType, targetLabel } from '@/utils/priceChangeTargets';
    import { exportToXlsx } from '@/utils/exportXlsx';

    const router = useRouter();
    const usePriceChange = usePriceChangeStore();
    const toast = useToast();
    const filter = useFilterStore();
    const searchValue = ref('');
    const startDate = ref('');
    const endDate = ref('');
    const statusFilter = ref('');
    const showDateFilters = ref(false);
    const usePermission = usePermissionStore();
    const priceChangeList = ref([]);
    const endDialogVisible = ref(false);
    const endTarget = ref(null);
    const exportMenuVisible = ref(false);

    const SUMMARY_EXPORT_COLUMNS = [
        { key: 'price_change_id', label: 'Price Change ID' },
        { key: 'description', label: 'Description' },
        { key: 'status', label: 'Status' },
        { key: 'effective_state', label: 'Effective State' },
        { key: 'product_count', label: 'Products' },
        { key: 'price_target_count', label: 'Price Targets' },
        { key: 'branch_count', label: 'Branches' },
        { key: 'start_at', label: 'Start Date' },
        { key: 'end_at', label: 'End Date' },
        { key: 'created_by', label: 'Created By' },
        { key: 'updated_by', label: 'Updated By' },
        { key: 'updated_at', label: 'Last Updated' },
    ];

    const DETAIL_EXPORT_COLUMNS = [
        { key: 'price_change_id', label: 'Price Change ID' },
        { key: 'description', label: 'Description' },
        { key: 'status', label: 'Status' },
        { key: 'effective_state', label: 'Effective State' },
        { key: 'start_at', label: 'Start Date' },
        { key: 'end_at', label: 'End Date' },
        { key: 'product_barcode', label: 'Product Barcode' },
        { key: 'unit_barcode', label: 'Unit Barcode' },
        { key: 'product_name', label: 'Product Name' },
        { key: 'unit_name', label: 'Unit Name' },
        { key: 'target_type', label: 'Target Type' },
        { key: 'target_name', label: 'Target Name' },
        { key: 'branch_name', label: 'Branch Name' },
        { key: 'min_qty', label: 'Minimum Qty' },
        { key: 'max_qty', label: 'Maximum Qty' },
        { key: 'old_price', label: 'Old Price' },
        { key: 'new_price', label: 'New Price' },
        { key: 'updated_by', label: 'Updated By' },
    ];

    onMounted(async () => {
      const saved = filter.getPageFilter('sales-price-change');
      if (saved) {
        searchValue.value = saved.searchValue || '';
        statusFilter.value = saved.statusFilter || '';
        startDate.value = saved.startDate || '';
        endDate.value = saved.endDate || '';
        showDateFilters.value = !!(startDate.value || endDate.value);
      }

      await loadPriceChanges();
      saveFilters();
    });

    watch([searchValue, statusFilter, startDate, endDate], saveFilters);

    async function loadPriceChanges() {
        await usePriceChange.fetchAllPriceChange();
        priceChangeList.value = Array.isArray(usePriceChange.priceChangeList)
            ? usePriceChange.priceChangeList
            : [];
    }

    function saveFilters() {
        filter.setPageFilter('sales-price-change', {
            searchValue: searchValue.value,
            statusFilter: statusFilter.value,
            startDate: startDate.value,
            endDate: endDate.value,
        });
    }

    function uniqueNames(values) {
        const names = [...new Set(values.filter(Boolean))];
        if (!names.length) return '-';
        return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
    }

    function productCount(row) {
        return new Set((row.products || []).map((item) => item.product_id || item.product?.id).filter(Boolean)).size;
    }

    function branchCount(row) {
        return new Set((row.products || []).map((item) => item.branch_id || item.branch?.id).filter(Boolean)).size;
    }

    function formatScope(row) {
        const products = productCount(row);
        const prices = (row.products || []).length;
        return `${products} ${products === 1 ? 'product' : 'products'} \u00b7 ${prices} ${prices === 1 ? 'price' : 'prices'}`;
    }

    function formatScopeDetail(row) {
        const branches = branchCount(row);
        const targets = uniqueNames((row.products || []).map((item) => targetLabel(detectTargetType(item))));
        return `${targets} \u00b7 ${branches} ${branches === 1 ? 'branch' : 'branches'}`;
    }

    function formatDate(value) {
        return value ? moment(value).format('DD MMM YY, HH:mm') : '-';
    }

    function formatStatus(row) {
        const statusName = row.status?.name || '-';
        const classes = statusName === 'Active'
            ? 'bg-green-50 text-green-700 ring-green-200'
            : statusName === 'Applied'
                ? 'bg-blue-50 text-blue-700 ring-blue-200'
                : statusName === 'Ended'
                    ? 'bg-gray-100 text-gray-700 ring-gray-300'
                : 'bg-gray-100 text-gray-600 ring-gray-200';
        return `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${classes}">${statusName}</span>`;
    }

    function scheduleDetail(row) {
        if (row.effective_state === 'ended') return row.end_at ? `Ended ${formatDate(row.end_at)}` : 'Ended';
        if (row.end_at) return `Ends ${formatDate(row.end_at)}`;
        if (row.effective_state === 'ongoing' || row.status?.name === 'Applied') return 'Ongoing';
        return 'No end date';
    }

    function exportDate(value) {
        if (!value) return '';
        const date = moment(value);
        return date.isValid() ? date.format('YYYY-MM-DD HH:mm') : String(value);
    }

    function exportState(value) {
        if (!value) return '';
        return String(value)
            .replaceAll('_', ' ')
            .replace(/\b\w/g, (character) => character.toUpperCase());
    }

    function numericExportValue(value) {
        if (value === '' || value === null || value === undefined) return '';
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : '';
    }

    function priceTargetProductId(item) {
        return item?.product_id || item?.product?.id || null;
    }

    function exportablePriceTargets(row) {
        const targets = Array.isArray(row?.products) ? row.products : [];
        const productsWithGlobalUomPrice = new Set(
            targets
                .filter((item) => detectTargetType(item) === 'GLOBAL_UOM_PRICE')
                .map(priceTargetProductId)
                .filter(Boolean)
                .map(Number),
        );

        return targets.filter((item) => {
            if (detectTargetType(item) !== 'GLOBAL_PRODUCT_PRICE') return true;
            return !productsWithGlobalUomPrice.has(Number(priceTargetProductId(item)));
        });
    }

    function exportProductUnit(item) {
        return item?.product_unit
            || item?.branch_product_unit_price?.product_unit
            || item?.product_unit_price_range?.product_unit
            || item?.branch_product_unit_price_range?.branch_product_unit_price?.product_unit
            || null;
    }

    function exportBranchName(item) {
        return item?.branch?.name
            || item?.branch_product?.branch?.name
            || item?.branch_product_unit_price?.branch_product?.branch?.name
            || '';
    }

    function exportUnitName(item, targetType) {
        if (!targetType.includes('_UOM_') && targetType !== 'GLOBAL_UOM_PRICE') return '';
        const productUnit = exportProductUnit(item);
        return productUnit?.unit_name
            || productUnit?.unit?.name
            || item?.unit_name
            || item?.unit?.name
            || '';
    }

    function summaryExportRows() {
        return filteredRows.value.map((row) => {
            const targets = exportablePriceTargets(row);
            const productIds = new Set(targets.map(priceTargetProductId).filter(Boolean).map(Number));
            const branchIds = new Set(
                targets
                    .map((item) => item.branch_id || item.branch?.id)
                    .filter(Boolean)
                    .map(Number),
            );

            return {
                price_change_id: row.id,
                description: row.description || '',
                status: row.status?.name || '',
                effective_state: exportState(row.effective_state),
                product_count: productIds.size,
                price_target_count: targets.length,
                branch_count: branchIds.size,
                start_at: exportDate(row.start_at),
                end_at: exportDate(row.end_at),
                created_by: row.created_by?.name || '',
                updated_by: row.updated_by?.name || '',
                updated_at: exportDate(row.updated_at),
            };
        });
    }

    function detailExportRows() {
        return filteredRows.value.flatMap((row) => (
            exportablePriceTargets(row).map((item) => {
                const targetType = detectTargetType(item);
                const productUnit = exportProductUnit(item);

                return {
                    price_change_id: row.id,
                    description: row.description || '',
                    status: row.status?.name || '',
                    effective_state: exportState(row.effective_state),
                    start_at: exportDate(row.start_at),
                    end_at: exportDate(row.end_at),
                    product_barcode: item.product?.barcode || '',
                    unit_barcode: productUnit?.barcode || item.product?.barcode || '',
                    product_name: item.product?.name || '',
                    unit_name: exportUnitName(item, targetType),
                    target_type: targetType,
                    target_name: targetLabel(targetType),
                    branch_name: exportBranchName(item),
                    min_qty: numericExportValue(item.min_qty),
                    max_qty: numericExportValue(item.max_qty),
                    old_price: numericExportValue(item.old_price),
                    new_price: numericExportValue(item.new_price),
                    updated_by: row.updated_by?.name || '',
                };
            })
        ));
    }

    function exportSummary() {
        exportMenuVisible.value = false;
        const rows = summaryExportRows();
        if (!rows.length) {
            toast.add({ severity: 'warn', summary: 'Nothing to Export', detail: 'No price changes match the current filters.', life: 3000 });
            return;
        }

        const filename = exportToXlsx({
            columns: SUMMARY_EXPORT_COLUMNS,
            rows,
            filename: 'Sales_Price_Change_Summary',
            sheetName: 'Price Change Summary',
            columnWidths: [16, 34, 15, 18, 12, 14, 12, 20, 20, 22, 22, 20],
            preserveTypes: true,
            autoFilter: true,
        });
        if (!filename) {
            toast.add({ severity: 'error', summary: 'Export Failed', detail: 'The summary workbook could not be created.', life: 3500 });
        }
    }

    function exportDetails() {
        exportMenuVisible.value = false;
        const rows = detailExportRows();
        if (!rows.length) {
            toast.add({ severity: 'warn', summary: 'Nothing to Export', detail: 'No price targets match the current filters.', life: 3000 });
            return;
        }

        const filename = exportToXlsx({
            columns: DETAIL_EXPORT_COLUMNS,
            rows,
            filename: 'Sales_Price_Change_Details',
            sheetName: 'Price Change Details',
            columnWidths: [16, 30, 14, 18, 20, 20, 22, 22, 32, 18, 27, 34, 24, 14, 14, 16, 16, 22],
            preserveTypes: true,
            autoFilter: true,
        });
        if (!filename) {
            toast.add({ severity: 'error', summary: 'Export Failed', detail: 'The detailed workbook could not be created.', life: 3500 });
        }
    }

    function isImmutable(row) {
        return ['Applied', 'Ended'].includes(row.status?.name)
            || ['ongoing', 'ending_scheduled', 'ended'].includes(row.effective_state);
    }

    function canEnd(row) {
        return usePermission.can('Sales price change', 'End') && row.can_end === true;
    }

    function openEndDialog(row) {
        if (!canEnd(row)) return;
        endTarget.value = row;
        endDialogVisible.value = true;
    }

    async function handlePriceChangeEnded() {
        await loadPriceChanges();
    }

    const columns = [
        {
            key: 'id',
            label: 'Price Change',
            align: 'left',
            class: 'price-change-primary min-w-[160px] max-w-[260px]',
            contentClass: 'min-w-0',
            formatter: (row) => row.id,
            secondaryFormatter: (row) => row.description || 'No description',
            secondaryClass: 'mt-0.5 block truncate text-xs text-gray-500',
            onClick: (row) => {
            router.push({name: 'View Sales Price Change', query: { id: row.id }});
        }},
        {
            key: 'products',
            label: 'Scope',
            align: 'left',
            class: 'hidden min-w-[220px] md:table-cell',
            formatter: formatScope,
            secondaryFormatter: formatScopeDetail,
        },
        {
            key: 'start_at',
            label: 'Schedule',
            align: 'left',
            class: 'hidden min-w-[170px] lg:table-cell',
            formatter: (row) => formatDate(row.start_at),
            secondaryFormatter: scheduleDetail,
        },
        { key: 'status.name', label: 'Status', class: 'price-change-status', formatter: formatStatus },
        {
            key: 'updated_at',
            label: 'Last Updated',
            align: 'left',
            class: 'hidden min-w-[160px] xl:table-cell',
            formatter: (row) => formatDate(row.updated_at),
            secondaryFormatter: (row) => row.updated_by?.name || '-',
        },
    ];

    function changeRoute(pathname) {
        router.push(pathname);
    }

    const saleRows = computed(() => priceChangeList.value.filter((row) => row.type === 'sale'));

    const statuses = computed(() => {
        return [...new Set(saleRows.value.map((row) => row.status?.name).filter(Boolean))].sort();
    });

    const hasActiveFilters = computed(() => (
        !!searchValue.value || !!statusFilter.value || !!startDate.value || !!endDate.value
    ));

    const filteredRows = computed(() => {
        const query = searchValue.value.trim().toLowerCase();
        const searchedData = saleRows.value.filter((row) => {
            const searchText = [
                row.id,
                row.description,
                row.status?.name,
                row.effective_state,
                row.end_reason,
                row.ended_by?.name,
                row.created_by?.name,
                row.updated_by?.name,
                ...(row.products || []).flatMap((item) => [
                    item.product?.name,
                    item.product?.barcode,
                    item.branch?.name,
                    targetLabel(detectTargetType(item)),
                ]),
            ].filter(Boolean).join(' ').toLowerCase();

            const matchesSearch = !query || searchText.includes(query);
            const matchesStatus = !statusFilter.value || row.status?.name === statusFilter.value;
            return matchesSearch && matchesStatus;
        });

        return filter.dateRangeFilter(searchedData, {
            dateField: 'start_at',
            startDate: startDate.value,
            endDate: endDate.value,
        });
    });

    const filteredDetailCount = computed(() => (
        filteredRows.value.reduce((count, row) => count + exportablePriceTargets(row).length, 0)
    ));

    function clearFilters() {
        searchValue.value = '';
        statusFilter.value = '';
        startDate.value = '';
        endDate.value = '';
        showDateFilters.value = false;
    }

    // Delete function
    async function deleteHandle(id) {
        const row = saleRows.value.find((item) => item.id === id);
        if (row && isImmutable(row)) {
            toast.add({ severity: 'warn', summary: 'Locked price change', detail: 'Applied or ended price changes cannot be deleted.', life: 3000 });
            return;
        }

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
            await loadPriceChanges();
        }
    }

</script>



<template>
    <div class="p-3 sm:p-4 lg:p-6">
      <div class="mx-auto w-full max-w-screen-2xl">
        <PageTitle title="Sales Price Changes">
            <template #titleButtons>
                <div class="price-change-title-actions flex items-center gap-2">
                    <BaseButton
                        :icon="usePriceChange.loading ? 'fa fa-spinner' : 'fa fa-rotate-right'"
                        label="Refresh"
                        variant="outlined"
                        severity="secondary"
                        :isLoading="usePriceChange.loading"
                        :disabled="usePriceChange.loading"
                        title="Refresh"
                        aria-label="Refresh"
                        @click="loadPriceChanges"
                    />
                    <BaseButton 
                        v-if="usePermission.can('Sales price change', 'Create')"
                        icon="fa fa-circle-plus" 
                        label="New price change"
                        severity="primary" 
                        title="New price change"
                        aria-label="New price change"
                        @click="changeRoute('/sales_price_change/create')"  />
                </div>
            </template>
        </PageTitle>
        <div class="price-change-list">
            <DataTable
                :columns="columns" 
                :rows="filteredRows" 
                :pageSize="50"
                :isPaginate="true"
                :editPath="'Update Sales Price Change'" 
                :isLoading="usePriceChange.loading"
                @delete="deleteHandle"
                :defaultSort="{key: 'id', order: 'desc'}"
                :isEdit="(row) => !usePermission.can('Sales price change', 'Update') || isImmutable(row)"
                :isDelete="(row) => !usePermission.can('Sales price change', 'Delete') || isImmutable(row)"
                filename="Sales_Price_Change"
            >
                <template #export-actions>
                    <div class="relative">
                        <BaseButton
                            label="Export"
                            icon="fa fa-file-excel"
                            size="sm"
                            variant="solid"
                            severity="success"
                            aria-haspopup="menu"
                            :aria-expanded="exportMenuVisible"
                            @click="exportMenuVisible = !exportMenuVisible"
                        />
                        <button
                            v-if="exportMenuVisible"
                            type="button"
                            class="fixed inset-0 z-20 cursor-default bg-transparent"
                            aria-label="Close export options"
                            @click="exportMenuVisible = false"
                        ></button>
                        <div
                            v-if="exportMenuVisible"
                            class="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-xl"
                            role="menu"
                        >
                            <div class="border-b border-gray-100 px-4 py-3">
                                <div class="text-sm font-semibold text-gray-900">Export price changes</div>
                                <div class="mt-0.5 text-xs text-gray-500">Uses the current search and filters</div>
                            </div>
                            <button
                                type="button"
                                class="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50"
                                role="menuitem"
                                @click="exportSummary"
                            >
                                <i class="fa fa-table-list mt-0.5 text-green-600"></i>
                                <span class="min-w-0">
                                    <span class="block text-sm font-medium text-gray-900">Export Summary</span>
                                    <span class="mt-0.5 block text-xs text-gray-500">
                                        {{ filteredRows.length }} price {{ filteredRows.length === 1 ? 'change' : 'changes' }}, one row each
                                    </span>
                                </span>
                            </button>
                            <button
                                type="button"
                                class="flex w-full items-start gap-3 border-t border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
                                role="menuitem"
                                @click="exportDetails"
                            >
                                <i class="fa fa-list-check mt-0.5 text-blue-600"></i>
                                <span class="min-w-0">
                                    <span class="block text-sm font-medium text-gray-900">Export Details</span>
                                    <span class="mt-0.5 block text-xs text-gray-500">
                                        {{ filteredDetailCount }} price {{ filteredDetailCount === 1 ? 'target' : 'targets' }}, one row each
                                    </span>
                                </span>
                            </button>
                        </div>
                    </div>
                </template>
                <template #row-actions="{ row }">
                    <BaseButton
                        v-if="canEnd(row)"
                        icon="fa fa-circle-stop"
                        variant="text"
                        severity="danger"
                        size="sm"
                        title="End price change"
                        aria-label="End price change"
                        @click="openEndDialog(row)"
                    />
                </template>
                <template #filters>
                    <div class="flex min-w-0 flex-col gap-3">
                        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(300px,1fr)_180px_auto_auto]">
                            <BaseInput
                                v-model="searchValue"
                                size="sm"
                                placeholder="Search ID, description, product, barcode, branch..."
                                height="h-[40px]"
                                icon="pi pi-search"
                            />

                            <select v-model="statusFilter" class="h-[40px] min-w-0 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-900">
                                <option value="">All statuses</option>
                                <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
                            </select>

                            <BaseButton
                                :label="showDateFilters ? 'Hide dates' : 'Start date'"
                                icon="fa fa-calendar-days"
                                variant="outlined"
                                severity="secondary"
                                class="h-[40px] whitespace-nowrap"
                                @click="showDateFilters = !showDateFilters"
                            />

                            <BaseButton
                                v-if="hasActiveFilters"
                                label="Clear"
                                icon="fa fa-xmark"
                                variant="text"
                                severity="secondary"
                                class="h-[40px]"
                                @click="clearFilters"
                            />
                        </div>

                        <div v-if="showDateFilters" class="flex flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-end">
                            <div class="w-full sm:w-[200px]">
                                <label class="mb-1 block text-xs font-medium text-gray-600">Starts from</label>
                                <BaseInput v-model="startDate" size="sm" type="date" height="h-[38px]" :max="endDate || undefined" />
                            </div>
                            <div class="w-full sm:w-[200px]">
                                <label class="mb-1 block text-xs font-medium text-gray-600">Starts to</label>
                                <BaseInput v-model="endDate" size="sm" type="date" height="h-[38px]" :min="startDate || undefined" />
                            </div>
                        </div>

                        <div class="flex items-center gap-1.5 text-xs text-gray-500">
                            <span v-if="usePriceChange.loading">Loading price changes...</span>
                            <template v-else>
                                <span class="font-medium text-gray-700">{{ filteredRows.length.toLocaleString('en-US') }}</span>
                                <span>{{ filteredRows.length === 1 ? 'price change' : 'price changes' }}</span>
                                <span v-if="hasActiveFilters">of {{ saleRows.length.toLocaleString('en-US') }}</span>
                            </template>
                        </div>
                    </div>
                </template>
            </DataTable>
        </div>
      </div>

      <EndSalesPriceChangeDialog
        v-model:visible="endDialogVisible"
        :priceChange="endTarget"
        @ended="handlePriceChangeEnded"
      />
    </div>
</template>

<style scoped>
@media (max-width: 639px) {
    .price-change-title-actions :deep(button) {
        padding-left: 10px;
        padding-right: 10px;
    }

    .price-change-title-actions :deep(button span) {
        display: none;
    }

    .price-change-title-actions :deep(button i) {
        margin-right: 0;
    }

    .price-change-list :deep(.data-table-scroll) {
        overflow-x: hidden;
    }

    .price-change-list :deep(table),
    .price-change-list :deep(tbody) {
        display: block;
        min-width: 0;
        width: 100%;
    }

    .price-change-list :deep(thead) {
        display: none;
    }

    .price-change-list :deep(tbody tr) {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 4px 8px;
        border-bottom: 1px solid #e5e7eb;
        padding: 10px 0;
    }

    .price-change-list :deep(tbody tr:last-child) {
        border-bottom: 0;
    }

    .price-change-list :deep(tbody td) {
        padding: 0 4px;
    }

    .price-change-list :deep(.price-change-primary) {
        grid-column: 1;
        min-width: 0;
        width: auto;
    }

    .price-change-list :deep(.price-change-status) {
        grid-column: 1;
        text-align: left;
    }

    .price-change-list :deep(.data-table-actions) {
        grid-column: 2;
        grid-row: 1 / span 2;
        width: auto;
        white-space: nowrap;
    }

    .price-change-list :deep(tbody td[colspan]) {
        grid-column: 1 / -1;
        padding: 16px 4px;
    }
}
</style>
