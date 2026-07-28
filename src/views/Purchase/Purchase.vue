<script setup>

import PageTitle from '@/components/PageTitle.vue';
import DataTable from '@/components/DataTable.vue';
import BaseButton from '@/components/BaseButton.vue';
import { useRouter } from 'vue-router';
import { onMounted, ref, computed, watch } from 'vue';
import { DatePicker, Dialog, useToast } from 'primevue';
import moment from 'moment';
import BaseInput from '@/components/BaseInput.vue';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { useFilterStore } from '@/stores/filterStore';
import { usePurchaseStore } from '@/stores/usePurchaseStore';
import { useSupplierStore } from '@/stores/useSupplierStore';
import { useWarehouseStore } from '@/stores/useWarehouseStore';
import { usePaymentMethodStore } from '@/stores/usePaymentMethodStore';
import { useProductStore } from '@/stores/useProductStore';
import DashboardCard from '@/components/DashboardCard.vue';
import { statusBadgeHtml } from '@/utils/const';
import { getPresetRange } from '@/utils/datePresets';
import * as XLSX from 'xlsx';
import BaseLabel from '@/components/BaseLabel.vue';
import exportToXlsx from '@/utils/exportXlsx';

const router = useRouter();
const usePurchase = usePurchaseStore();
const useSupplier = useSupplierStore();
const useWarehouse = useWarehouseStore();
const usePaymentMethod = usePaymentMethodStore();
const useProduct = useProductStore();
const filter = useFilterStore();
const toast = useToast();
const usePermission = usePermissionStore();

const purchaseList = ref([]);
const importInputRef = ref(null);
const isImporting = ref(false);
// Date range for API fetch
const filteredData = ref({
    // Local values bound to datetime-local inputs (format: YYYY-MM-DDTHH:mm)
    startedDate: moment().startOf('month').format('YYYY-MM-DDTHH:mm'),
    endedDate: moment().format('YYYY-MM-DDTHH:mm')
});
// Client-side filters (apply on date-range fetched data)
const selectedStatus = ref('');
const selectedPayment = ref('');
const searchValue = ref('');
const invoiceSearchValue = ref('');
const productSearch = ref('');
const supplierSearchValue = ref('');
const pagination = ref({});
const selectedPerPage = ref(100);
// New DatePicker range state
const dateRange = ref(null); // [startDate, endDate]
const isDateLoading = ref(false);
const purchaseFilter = ref(false);

onMounted(async () => {
    // restore saved filters for this page if present
    const saved = filter.getPageFilter('purchase');
    if (saved) {
        if (saved.startedDate) filteredData.value.startedDate = saved.startedDate;
        if (saved.endedDate) filteredData.value.endedDate = saved.endedDate;
        if (saved.selectedStatus) selectedStatus.value = saved.selectedStatus;
        if (saved.selectedPayment) selectedPayment.value = saved.selectedPayment;
        if (saved.invoiceSearchValue) invoiceSearchValue.value = saved.invoiceSearchValue;
        if (saved.productSearchValue) productSearch.value = saved.productSearchValue;
        if (saved.supplierSearchValue) supplierSearchValue.value = saved.supplierSearchValue;
        if (saved.selectedPerPage) selectedPerPage.value = saved.selectedPerPage;
    }
    if (filteredData.value.startedDate && filteredData.value.endedDate) {
        dateRange.value = [
            moment(filteredData.value.startedDate).toDate(),
            moment(filteredData.value.endedDate).toDate()
        ];
    }
    await fetchPurchaseByDate();
    saveFilters();
});

function getPurchaseFilterPayload() {
    return {
        start_date: filteredData.value.startedDate
            ? moment(filteredData.value.startedDate).format('YYYY-MM-DD HH:mm:ss')
            : '',
        end_date: filteredData.value.endedDate
            ? moment(filteredData.value.endedDate).format('YYYY-MM-DD HH:mm:ss')
            : '',
        supplier: supplierSearchValue.value || null,
        statusId: selectedStatus.value || null,
        paymentId: selectedPayment.value || null,
        warehouseId: null,
        product: productSearch.value || null,
        invoice: invoiceSearchValue.value || null,
    };
}

async function fetchPurchaseByDate(pagePayload = 1) {
    const payloadIsObject = pagePayload && typeof pagePayload === 'object';
    const page = payloadIsObject ? Number(pagePayload.page || 1) : Number(pagePayload || 1);
    const perPage = payloadIsObject
        ? Number(pagePayload.perPage || selectedPerPage.value || 100)
        : Number(selectedPerPage.value || 100);

    if (payloadIsObject && pagePayload.perPage) {
        selectedPerPage.value = perPage;
    }
    isDateLoading.value = true;
    try {
        const payload = getPurchaseFilterPayload();
        await usePurchase.fetchAllPurchase(payload, page, perPage);
        purchaseList.value = usePurchase.purchaseList || [];
        pagination.value = usePurchase.pagination || {};
        await usePurchase.fetchDashboardPurchases(payload);
        // persist current filters after fetch
        saveFilters();
    } finally {
        isDateLoading.value = false;
    }
}

// persist filters for this page
function saveFilters() {
    filter.setPageFilter('purchase', {
        startedDate: filteredData.value.startedDate,
        endedDate: filteredData.value.endedDate,
        selectedStatus: selectedStatus.value,
        selectedPayment: selectedPayment.value,
        searchValue: searchValue.value,
        selectedPerPage: selectedPerPage.value,
    });
}

function setFilteredDatesFromRange(range) {
    if (Array.isArray(range) && range[0] && range[1]) {
        const start = moment(range[0]).startOf('day');
        const end = moment(range[1]).endOf('day');
        filteredData.value.startedDate = start.format('YYYY-MM-DD HH:mm:ss');
        filteredData.value.endedDate = end.format('YYYY-MM-DD HH:mm:ss');
    } else {
        filteredData.value.startedDate = "";
        filteredData.value.endedDate = "";
    }
}

function applyPresetRange(preset) {
    const range = getPresetRange(preset);
    dateRange.value = range ? range : null;
}

// Sync and auto-fetch when DatePicker range changes
watch(dateRange, async (val) => {
    setFilteredDatesFromRange(val);
});

// watch filter inputs and persist changes
watch([
    () => filteredData.value.startedDate,
    () => filteredData.value.endedDate,
    () => selectedStatus.value,
    () => selectedPayment.value,
    () => invoiceSearchValue.value,
    () => productSearch.value,
    () => supplierSearchValue.value,
    () => selectedPerPage.value
], () => {
    saveFilters();
});

function applyRangeAndClose() {
    // use existing filteredData values and fetch
    fetchPurchaseByDate();
    purchaseFilter.value = false;
}

const columns = [
    { key: 'id', label: 'Purchase No.', formatter: (row) => {
        const href = router.resolve({ name: 'View Purchase', query: { id: row.id } }).href;
        return `<a href="${href}">
            <span class="cursor-pointer text-blue-600 hover:underline">${row.id}</span>
        </a>`;
    } },
    { key: 'purchase_date', label: 'Date', formatter: (row) => moment(row.purchase_date).format('DD-MM-YY hh:mm') },
    { key: 'supplier.name', label: 'Supplier Name', formatter: (row) => row.supplier.name },
    { key: 'details', label: 'Purchased Units', formatter: (row) => {
        const labels = (row.details || []).map(detail => {
            const productName = detail.product?.name || '-';
            const unitName = detail.uom?.unit_name;
            return unitName ? `${productName} (${unitName})` : productName;
        });
        return [...new Set(labels)].join('<br>') || '-';
    } },
    { key: 'total_amount', label: 'Total', formatter: (row) => Number(row.total_amount).toLocaleString('en-us') },
    { key: 'warehouse.name', label: 'Warehouse', formatter: (row) => row.warehouse.name },
    { key: 'payment.name', label: 'Payment', formatter: (row) => row.payment.name },
    { key: 'status.name', label: 'Status', formatter: (row) => statusBadgeHtml(row.status?.name) },
    { key: 'created_by', label: 'Created By' },
    { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') }
];

function changeRoute(pathname) {
    router.push(pathname);
}

// Purchase delete function
async function deleteHandle(id) {
    await usePurchase.deletePurchase({ void_by: JSON.parse(localStorage.getItem('user')).id }, id);
    if (usePurchase.error.length) {
        toast.add({ severity: 'error', summary: 'Error Message', detail: usePurchase.error, life: 3000 });
        return
    }
    if (usePurchase.data.status === 200) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Purchase deleted successfully.', life: 3000 });
        // refetch with current date range
        await fetchPurchaseByDate();
    }
}

// Purchase copy function
function copyPurchase(row) {
    localStorage.setItem('copiedPurchase', JSON.stringify(row));
    router.push('/purchase/create');
}

// Excel import helpers

function normalizeCell(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function normalizeKey(key) {
    return normalizeCell(key).toLowerCase().replace(/\s+/g, '_');
}

function normalizeRowKeys(row) {
    const normalized = {};
    Object.keys(row || {}).forEach((key) => {
        normalized[normalizeKey(key)] = row[key];
    });
    return normalized;
}

function excelDateToInput(dateValue) {
    if (dateValue === null || dateValue === undefined || dateValue === '') return '';
    if (typeof dateValue === 'number') {
        const parsed = XLSX.SSF.parse_date_code(dateValue);
        if (parsed) {
            const dt = new Date(
                parsed.y,
                (parsed.m || 1) - 1,
                parsed.d || 1,
                parsed.H || 0,
                parsed.M || 0,
                Math.floor(parsed.S || 0)
            );
            return moment(dt).format('YYYY-MM-DDTHH:mm');
        }
    }
    const input = normalizeCell(dateValue);
    const parsed = moment(input, [
        'YYYY-MM-DD HH:mm:ss',
        'YYYY-MM-DD HH:mm',
        'YYYY-MM-DDTHH:mm:ss',
        'YYYY-MM-DDTHH:mm',
        'YYYY-MM-DD',
        'DD-MM-YYYY HH:mm:ss',
        'DD-MM-YYYY HH:mm',
        'DD-MM-YYYY',
        'MM/DD/YYYY HH:mm:ss',
        'MM/DD/YYYY HH:mm',
        'MM/DD/YYYY',
        'M/D/YYYY H:mm',
        'M/D/YYYY H:mm:ss',
        'M/D/YY H:mm',
        'M/D/YY H:mm:ss', 
        'M/D/YYYY',
        'M/D/YY', 
    ], true);
    if (!parsed.isValid()) return '';
    return parsed.format('YYYY-MM-DDTHH:mm');
}

function fixExcelDate(value, { withTime = true } = {}) {
    if (!value) return null;

    let date;

    console.log('Fixing date value:', value, 'withTime:', withTime);

    if (value instanceof Date) {
        date = new Date(value);

        date.setMinutes(Math.round(date.getMinutes()));
    }

    else if (typeof value === 'number') {
        // Excel epoch starts at 1899-12-30
        date = new Date(Math.round((value - 25569) * 86400 * 1000));
    }

    else if (typeof value === 'string') {
        const trimmed = value.trim();

        date = moment(trimmed, [
            'D/M/YYYY H:mm',
            'D/M/YYYY H:mm:ss',
            'D/M/YYYY',
            'D/M/YY H:mm',
            'D/M/YY H:mm:ss', 
            'D/M/YYYY',
            'D/M/YY', 
            'YYYY-MM-DD HH:mm:ss',
            'YYYY-MM-DD HH:mm',
            'YYYY-MM-DD',
        ], true).toDate();

        if (!date || isNaN(date.getTime())) {
            return null;
        }
    }

    else {
        return null;
    }

    if (!withTime) {
        date.setHours(0, 0, 0, 0);
    } else {
        date.setSeconds(0);
        date.setMilliseconds(0);
    }

    return date;
}

function toNumber(value, defaultValue = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : defaultValue;
}

async function ensureImportLookups() {
    const jobs = [];
    if (!Array.isArray(useSupplier.supplierList) || useSupplier.supplierList.length === 0) jobs.push(useSupplier.fetchAllSupplier());
    if (!Array.isArray(useWarehouse.warehouseList) || useWarehouse.warehouseList.length === 0) jobs.push(useWarehouse.fetchAllWarehouse());
    if (!Array.isArray(usePaymentMethod.paymentMethodList) || usePaymentMethod.paymentMethodList.length === 0) jobs.push(usePaymentMethod.fetchAllPaymentMethod());
    if (!Array.isArray(useProduct.productList) || useProduct.productList.length === 0) jobs.push(useProduct.fetchAllProduct());
    if (jobs.length > 0) await Promise.all(jobs);
}

function resolveIdByIdOrName(list, idValue, nameValue) {
    const byId = normalizeCell(idValue);
    if (byId) {
        const foundById = (list || []).find((item) => String(item.id) === byId);
        if (foundById) return foundById.id;
    }
    const byName = normalizeCell(nameValue).toLowerCase();
    if (byName) {
        const foundByName = (list || []).find((item) => normalizeCell(item.name).toLowerCase() === byName);
        if (foundByName) return foundByName.id;
    }
    return null;
}

function resolveProduct(row) {
    const products = useProduct.productList || [];
    const productId = normalizeCell(row.product_id || row.product);
    const barcode = normalizeCell(row.barcode || row.product_barcode).toLowerCase();
    const name = normalizeCell(row.product_name || row.name).toLowerCase();

    if (productId) {
        const foundById = products.find((item) => String(item.id) === productId);
        if (foundById) return foundById;
    }
    if (barcode) {
        const foundByBarcode = products.find((item) => normalizeCell(item.barcode).toLowerCase() === barcode);
        if (foundByBarcode) return foundByBarcode;
    }
    if (name) {
        const foundByName = products.find((item) => normalizeCell(item.name).toLowerCase() === name);
        if (foundByName) return foundByName;
    }
    return null;
}

function resolveProductUnit(row, product) {
    const units = Array.isArray(product?.product_units) ? product.product_units : [];
    const productUnitId = normalizeCell(row.product_unit_id);
    const unitBarcode = normalizeCell(row.unit_barcode || row.product_unit_barcode).toLowerCase();
    const unitName = normalizeCell(row.unit_name || row.uom).toLowerCase();

    if (productUnitId) {
        return units.find(unit => String(unit.id) === productUnitId) || null;
    }
    if (unitBarcode) {
        return units.find(unit => normalizeCell(unit.barcode).toLowerCase() === unitBarcode) || null;
    }
    if (unitName) {
        return units.find(unit => normalizeCell(unit.unit_id?.name).toLowerCase() === unitName) || null;
    }
    return null;
}

function openImportPicker() {
    importInputRef.value?.click();
}

function downloadImportTemplate() {
    const link = document.createElement('a');
    link.href = '/purchase_import_template.xlsx';
    link.download = 'purchase_import_template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function onImportExcel(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    isImporting.value = true;
    try {
        await ensureImportLookups();
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetNames = workbook.SheetNames || [];
        const purchasesSheetName = sheetNames.find((name) => normalizeCell(name).toLowerCase() === 'purchases');
        const detailsSheetName = sheetNames.find((name) => normalizeCell(name).toLowerCase() === 'purchase_details');

        let purchaseRows = [];
        let detailRows = [];

        if (purchasesSheetName && detailsSheetName) {
            purchaseRows = XLSX.utils.sheet_to_json(workbook.Sheets[purchasesSheetName], { defval: '', raw: false }).map(normalizeRowKeys);
            detailRows = XLSX.utils.sheet_to_json(workbook.Sheets[detailsSheetName], { defval: '', raw: false }).map(normalizeRowKeys);
        } else {
            const firstSheet = sheetNames[0];
            if (!firstSheet) {
                toast.add({ severity: 'error', summary: 'Import Failed', detail: 'Excel file has no sheet.', life: 3000 });
                return;
            }
            detailRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '', raw: false }).map(normalizeRowKeys);
        }

        const grouped = new Map();

        purchaseRows.forEach((row) => {
            const purchaseRef = normalizeCell(row.purchase_ref || row.ref || row.purchase_no || row.purchase_id);
            if (!purchaseRef) return;
            grouped.set(purchaseRef, {
                header: row,
                details: []
            });
        });

        detailRows.forEach((row) => {
            const purchaseRef = normalizeCell(row.purchase_ref || row.ref || row.purchase_no || row.purchase_id);
            if (!purchaseRef) return;
            if (!grouped.has(purchaseRef)) {
                grouped.set(purchaseRef, { header: row, details: [] });
            }
            grouped.get(purchaseRef).details.push(row);
        });

        if (grouped.size === 0) {
            toast.add({ severity: 'error', summary: 'Import Failed', detail: 'No purchase rows found. Check purchase_ref column.', life: 3500 });
            return;
        }

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const failed = [];
        let successCount = 0;

        console.log('purchase rows: ', purchaseRows);
        console.log('details row: ', detailRows);

        for (const [purchaseRef, value] of grouped.entries()) {
            const header = value.header || {};
            const details = value.details || [];
            console.log(`Processing purchase_ref ${purchaseRef} with header:`, header, 'and details:', details);

            const supplierId = resolveIdByIdOrName(
                useSupplier.supplierList,
                header.supplier_id,
                header.supplier_name || header.supplier
            );
            const warehouseId = resolveIdByIdOrName(
                useWarehouse.warehouseList,
                header.warehouse_id,
                header.warehouse_name || header.warehouse
            );
            const paymentId = resolveIdByIdOrName(
                usePaymentMethod.paymentMethodList,
                header.payment_id,
                header.payment_name || header.payment
            );

            const purchaseDate = moment(fixExcelDate(header.purchase_date)).format('YYYY-MM-DD HH:mm:ss');
            const statusId = toNumber(header.status_id, 7);
            const remark = normalizeCell(header.remark);

            console.log("purchaseDate", header.purchase_date , purchaseDate);

            const products = details.map((detail) => {
                const product = resolveProduct(detail);
                return {
                    raw: detail,
                    product,
                    productUnit: product ? resolveProductUnit(detail, product) : null,
                };
            }).filter((entry) => entry.product).map((entry) => ({
                product_id: entry.product.id,
                product_unit_id: entry.productUnit?.id || null,
                quantity: toNumber(entry.raw.quantity, 0),
                expired_date: moment(fixExcelDate(entry.raw.expired_date)).format('YYYY-MM-DD'),
                purchase_price: toNumber(entry.raw.purchase_price || entry.raw.price, 0)
            })).filter((item) => item.quantity > 0 && item.purchase_price >= 0);

            if (!supplierId || !warehouseId || !purchaseDate || products.length === 0) {
                console.error(`Skipping purchase_ref ${purchaseRef} due to missing required fields.`, {
                    supplierId,
                    warehouseId,
                    purchaseDate,
                    products
                });
                failed.push(purchaseRef);
                continue;
            }

            const payload = {
                supplier_id: supplierId,
                payment_id: paymentId || 1,
                status_id: statusId,
                remark,
                purchase_date: purchaseDate,
                warehouse_id: warehouseId,
                created_by: user.id,
                products
            };

            console.log(`Importing purchase_ref ${purchaseRef} with payload:`, payload);

            await usePurchase.addPurchase(payload);
            if (usePurchase.error.length) {
                console.error(`Failed to import purchase_ref ${purchaseRef}:`, usePurchase.error);
                failed.push(purchaseRef);
                continue;
            }
            successCount += 1;
        }

        console.log('Import completed. Success:', successCount, 'Failed:', failed);

        await fetchPurchaseByDate();

        if (successCount > 0) {
            toast.add({
                severity: 'success',
                summary: 'Import Completed',
                detail: `${successCount} purchase(s) imported successfully.`,
                life: 3500
            });
        }

        if (failed.length > 0) {
            toast.add({
                severity: 'warn',
                summary: 'Some Rows Failed',
                detail: `Failed purchase_ref: ${failed.slice(0, 5).join(', ')}${failed.length > 5 ? ' ...' : ''}`,
                life: 5000
            });
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Import Failed', detail: 'Unable to read Excel file.', life: 3500 });
    } finally {
        isImporting.value = false;
        if (event?.target) event.target.value = '';
    }
}

// End of Excel import helpers

async function exportToExcel() {
    await usePurchase.exportPurchases(getPurchaseFilterPayload());
    exportToXlsx({
        columns: columns.filter(({ key }) => key !== 'details'),
        rows: usePurchase.exportData,
        filename: 'Purchase',
        detailHeaders: ['Product ID', 'Product Name', 'Product Unit ID', 'Unit', 'Unit Qty', 'Base Qty', 'Conversion', 'Price', 'Total'],
        detailField: 'details',
        detailKeys: ['product.id', 'product.name', 'uom.product_unit_id', 'uom.unit_name', 'uom.unit_quantity', 'uom.base_quantity', 'uom.conversion_to_base', 'price', 'total'],
    });
}

</script>



<template>
    <div class="p-4">
        <PageTitle title="Purchase List">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <input
                        ref="importInputRef"
                        type="file"
                        accept=".xlsx,.xls"
                        class="hidden"
                        @change="onImportExcel"
                    />
                    <BaseButton
                        v-if="usePermission.can('Purchase', 'Create')"
                        icon="fa fa-file-excel"
                        :label="isImporting ? 'Importing...' : 'Import Excel'"
                        severity="success"
                        :disabled="isImporting"
                        @click="openImportPicker"
                    />
                    <BaseButton
                        v-if="usePermission.can('Purchase', 'Create')"
                        icon="fa fa-download"
                        label="Download Template"
                        severity="secondary"
                        @click="downloadImportTemplate"
                    />
                    <BaseButton v-if="usePermission.can('Purchase', 'Create')" icon="fa fa-circle-plus" label="Create"
                        severity="primary" @click="changeRoute('/purchase/create')" />
                </div>
            </template>
        </PageTitle>
        <div class="grid grid-cols-5 my-3 gap-x-4">
            <DashboardCard title="Total Purchase" :value="Number(usePurchase.dashboardData.total_invoice).toLocaleString('en-us')" icon="fa fa-receipt" color="green" />
            <DashboardCard title="Total Purchase Amount" :value="Number(usePurchase.dashboardData.total_purchases).toLocaleString('en-us')" icon="fa fa-money-bill" color="blue" />
            <DashboardCard title="Total Cash" :value="Number(usePurchase.dashboardData.total_cash).toLocaleString('en-us')" icon="fa fa-hand-holding-dollar" color="gray" />
            <DashboardCard title="Total Kpay" :value="Number(usePurchase.dashboardData.total_kpay).toLocaleString('en-us')" icon="fa fa-credit-card" color="blue" />
            <DashboardCard title="Total Credit" :value="Number(usePurchase.dashboardData.total_credit).toLocaleString('en-us')" icon="fa fa-wallet" color="purple" />
        </div>
        <DataTable 
            :columns="columns" 
            :rows="purchaseList" 
            :editPath="'Update Purchase'"
            :isLoading="usePurchase.loading"
            :copy-button = "true"
            @copy="copyPurchase"
            @delete="deleteHandle" 
            :defaultSort="{ key: 'created_at', order: 'desc' }"
            :isEdit="!usePermission.can('Purchase', 'Update')" 
            :isDelete="!usePermission.can('Purchase', 'Delete')"
            :isExcelExport="false"
            :paginationMeta="pagination"
            :isPaginate="true"
            :serverPagination="true"
            @pageChange="fetchPurchaseByDate"
        >
            <template #filters>
                <div class="flex gap-2 items-center">
                    <DatePicker
                        v-model="dateRange"
                        selectionMode="range"
                        :manualInput="false"
                        showButtonBar
                        placeholder="Date range"
                        inputClass="h-[35px]"
                        :disabled="true"
                    >
                        <template #buttonbar="{ clearCallback }">
                            <div class="flex justify-between w-full px-2 pb-2 gap-2 flex-wrap items-center">
                                <div class="flex gap-2 flex-wrap">
                                    <BaseButton size="sm" label="Today" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('today')" />
                                    <BaseButton size="sm" label="Yesterday" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('yesterday')" />
                                    <BaseButton size="sm" label="This Week" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisWeek')" />
                                    <BaseButton size="sm" label="This Month" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisMonth')" />
                                    <BaseButton size="sm" label="This Year" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisYear')" />
                                    <BaseButton size="sm" label="All" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('all')" />
                                </div>
                                <div class="flex gap-2 items-center">
                                    <div v-if="isDateLoading" class="flex items-center text-xs text-gray-600 gap-2">
                                        <i class="pi pi-spin pi-spinner"></i>
                                        <span>Loading...</span>
                                    </div>
                                    <BaseButton size="sm" label="Clear" icon="pi pi-times" severity="danger" variant="outlined" :disabled="isDateLoading" @click="clearCallback" />
                                </div>
                            </div>
                        </template>
                    </DatePicker>
                    <!-- Filter Button -->
                    <BaseButton label="Filter" icon="pi pi-filter" severity="primary" @click="purchaseFilter = true" />
                    <!-- Export Button -->
                    <BaseButton label="Export" icon="pi pi-file-excel" severity="primary" variant="outlined" @click="exportToExcel" />
                </div>
            </template>
        </DataTable>
    </div>

    <!-- Filter Modal Dialog -->
    <Dialog v-model:visible="purchaseFilter" :style="{ width: '700px' }" :modal="true" :draggable="false">
        <template #container="{ closeCallback }">
            <div class="p-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-black">Purchase Filter</h3>
                    <BaseButton size="sm" icon="pi pi-times" severity="danger" variant="text" @click="closeCallback" />
                </div>
                <div class="grid grid-cols-2 gap-2 items-center">
                    <div class="flex flex-col gap-1">
                        <BaseLabel label="Date Range" />
                        <DatePicker
                            v-model="dateRange"
                            selectionMode="range"
                            :manualInput="false"
                            showButtonBar
                            placeholder="Date range"
                            inputClass="h-[35px] w-full"
                            :disabled="isDateLoading"
                        >
                            <template #buttonbar="{ clearCallback }">
                                <div class="flex justify-between w-full p-2 gap-2 flex-wrap items-center">
                                    <div class="flex gap-2 flex-wrap">
                                        <BaseButton size="sm" label="Today" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('today')" />
                                        <BaseButton size="sm" label="Yesterday" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('yesterday')" />
                                        <BaseButton size="sm" label="This Week" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisWeek')" />
                                        <BaseButton size="sm" label="This Month" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisMonth')" />
                                        <BaseButton size="sm" label="This Year" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisYear')" />
                                        <BaseButton size="sm" label="All" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('all')" />
                                    </div>
                                    <div class="flex gap-2 items-center">
                                        <div v-if="isDateLoading" class="flex items-center text-xs text-gray-600 gap-2">
                                            <i class="pi pi-spin pi-spinner"></i>
                                            <span>Loading...</span>
                                        </div>
                                        <BaseButton size="sm" label="Clear" icon="pi pi-times" severity="danger" variant="outlined" :disabled="isDateLoading" @click="clearCallback" />
                                    </div>
                                </div>
                            </template>
                        </DatePicker>
                    </div>
                    <div class="flex flex-col gap-1">
                        <BaseLabel label="Invoice" />
                        <BaseInput 
                            size="sm"
                            v-model="invoiceSearchValue"
                            placeholder="Search by invoice"
                            icon="pi pi-search"
                            height="h-[35px]"
                        />
                    </div>
                    <div class="flex flex-col gap-1">
                        <BaseLabel label="Supplier" />
                        <BaseInput 
                            size="sm"
                            v-model="supplierSearchValue"
                            placeholder="Search by supplier name, ID"
                            icon="pi pi-search"
                            height="h-[35px]"
                        />
                    </div>
                    <div class="flex flex-col gap-1">
                        <BaseLabel label="Product" />
                        <BaseInput 
                            size="sm"
                            v-model="productSearch"
                            placeholder="Search by product name, barcode"
                            icon="pi pi-search"
                            height="h-[35px]"
                        />
                    </div>
                    <div class="flex flex-col gap-1">
						<BaseLabel label="Payment Method" />
						<select
							v-model="selectedPayment"
							class="w-full border border-gray-300 rounded-md px-2 py-2 text-sm"
						>
							<option value="">All</option>
                            <option value="1">Cash</option>
                            <option value="2">Credit</option>
                            <option value="3">Wallet</option>
                            <option value="4">Kpay</option>
						</select>
					</div>
                    <div class="flex flex-col gap-1">
						<BaseLabel label="Status" />
						<select
							v-model="selectedStatus"
							class="w-full border border-gray-300 rounded-md px-2 py-2 text-sm"
						>
							<option value="">All</option>
                            <option value="5">Hold</option>
                            <option value="7">Complete</option>
                            <option value="8">Void</option>
						</select>
					</div>
                    <div class="col-span-2 flex items-center justify-end">
                        <BaseButton label="Apply Filter" icon="pi pi-filter" severity="primary" @click="applyRangeAndClose" />
                    </div>
                </div>
            </div>
        </template>
    </Dialog>
</template>
