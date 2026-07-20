<script setup>
import { useRouter } from 'vue-router';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import moment from 'moment';
import axios from 'axios';
import BaseInput from '@/components/BaseInput.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseErrorLabel from '@/components/BaseErrorLabel.vue';
import PageTitle from '@/components/PageTitle.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import { errMsgList } from '@/utils/const';
import { normalizeApiError } from '@/utils/NormalizeApiError';
import { useToast } from 'primevue';
import { useBranchStore } from '@/stores/useBranchStore';
import { useProductStore } from '@/stores/useProductStore';
import { usePriceChangeStore } from '@/stores/usePriceChangeStore';
import {
    buildAllTargetRows,
    formatRange,
    isRangeTarget,
    payloadForTargetRow,
    targetLabel,
    toNumber,
    validatePriceChangeDates,
    validatePriceChangeRows,
} from '@/utils/priceChangeTargets';

const router = useRouter();
const toast = useToast();
const usePriceChange = usePriceChangeStore();
const useProduct = useProductStore();
const useBranch = useBranchStore();

const userData = ref({});
const formData = ref({
    description: '',
    type: 'sale',
    startDate: moment().format('YYYY-MM-DDTHH:mm'),
    endDate: '',
    priceValueType: 'INCREASE',
    priceChangeValue: '',
});
const selectedRows = ref([]);
const productList = ref([]);
const isProductSetupLoading = ref(true);
const searchTerm = ref('');
const selectionBuffer = ref([]);
const isProductDialogVisible = ref(false);
const productSearchInput = ref(null);
const productPage = ref(1);
const changedOnly = ref(false);
const expandedProductIds = ref([]);
const productEditorState = ref({});
const rangeModal = ref({
    visible: false,
    title: '',
    rows: [],
});
const errorMsg = ref({
    date: '',
    products: '',
    priceChangeValue: '',
});
const promotionConflictResult = ref(null);
const promotionConflictError = ref('');
const isPromotionConflictChecking = ref(false);
const isPromotionConflictCheckPending = ref(false);
const promotionConflictDialog = ref({
    visible: false,
    result: null,
});

let promotionConflictCheckTimer = null;
let promotionConflictRequestController = null;
let promotionConflictRequestId = 0;

const PRICE_EDITOR_TABS = [
    { value: 'GLOBAL', label: 'Global' },
    { value: 'BRANCH', label: 'Branch' },
    { value: 'RANGE', label: 'Ranges' },
];
const PRODUCT_PAGE_SIZE = 50;

function changeRoute(pathname) {
    router.push(pathname);
}

onMounted(async () => {
    userData.value = JSON.parse(localStorage.getItem('user'));
    try {
        await Promise.all([
            useBranch.fetchAllBranch(),
            useProduct.fetchAllProduct(),
        ]);
    } finally {
        productList.value = useProduct.productList || [];
        isProductSetupLoading.value = false;
    }
});

const branchOptions = computed(() => useBranch.branchList || []);

const changedRows = computed(() => selectedRows.value.filter((row) => Number(row.new_price) !== Number(row.old_price)));

const selectedProductCount = computed(() => new Set(selectedRows.value.map((row) => Number(row.product_id))).size);

function buildPromotionConflictTargets(rows) {
    const seen = new Set();

    return (rows || []).reduce((targets, row) => {
        if (!row?.product_id) return targets;

        const target = {
            product_id: Number(row.product_id),
            branch_id: row.branch_id ? Number(row.branch_id) : null,
            product_unit_id: row.product_unit_id ? Number(row.product_unit_id) : null,
        };
        const key = `${target.product_id}:${target.branch_id || 0}:${target.product_unit_id || 0}`;
        if (seen.has(key)) return targets;

        seen.add(key);
        targets.push(target);
        return targets;
    }, []);
}

const promotionConflictSourceRows = computed(() => (
    changedRows.value.length ? changedRows.value : selectedRows.value
));

const promotionConflictTargets = computed(() => buildPromotionConflictTargets(promotionConflictSourceRows.value));

const promotionConflictCheckSignature = computed(() => JSON.stringify({
    type: formData.value.type,
    start_at: formData.value.startDate || null,
    end_at: formData.value.endDate || null,
    products: promotionConflictTargets.value,
}));

const isPromotionConflictBusy = computed(() => (
    isPromotionConflictChecking.value || isPromotionConflictCheckPending.value
));

function uniquePromotionConflicts(result) {
    const seen = new Set();

    return (result?.conflicts || []).filter((conflict) => {
        if (conflict.blocking !== true) return false;

        const key = [
            conflict.promotion?.id || 0,
            conflict.product_id || 0,
            conflict.branch_id || 0,
            conflict.product_unit_id || 0,
        ].join(':');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

const promotionConflicts = computed(() => uniquePromotionConflicts(promotionConflictResult.value));
const dialogPromotionConflicts = computed(() => uniquePromotionConflicts(promotionConflictDialog.value.result));

const productGroups = computed(() => {
    const groupMap = new Map();
    selectedRows.value.forEach((row) => {
        if (!groupMap.has(row.product_id)) {
            groupMap.set(row.product_id, {
                product_id: row.product_id,
                product_name: row.product_name,
                product_barcode: row.product_barcode,
                image_url: row.image_url,
                rows: [],
            });
        }
        groupMap.get(row.product_id).rows.push(row);
    });

    return [...groupMap.values()].map((group) => {
        const visibleRows = changedOnly.value ? group.rows.filter(isChangedRow) : group.rows;
        const nonRangeRows = visibleRows.filter((row) => !isRangeTarget(row.target_type));
        const rangeRows = visibleRows.filter((row) => isRangeTarget(row.target_type));
        const branchMap = new Map();

        nonRangeRows.filter((row) => row.branch_id).forEach((row) => {
            if (!branchMap.has(row.branch_id)) {
                branchMap.set(row.branch_id, {
                    branch_id: row.branch_id,
                    branch_name: row.branch_name,
                    rows: [],
                });
            }
            branchMap.get(row.branch_id).rows.push(row);
        });

        return {
            ...group,
            visibleRows,
            globalRows: nonRangeRows.filter((row) => !row.branch_id),
            branchGroups: [...branchMap.values()],
            rangeGroups: groupRangeRows(rangeRows),
            changedCount: group.rows.filter(isChangedRow).length,
            totalCount: group.rows.length,
        };
    }).filter((group) => group.visibleRows.length);
});

const filteredProducts = computed(() => {
    const q = (searchTerm.value || '').toString().trim().toLowerCase();
    if (!q) return productList.value || [];
    return (productList.value || []).filter((product) => (
        (product.name || '').toString().toLowerCase().includes(q)
        || (product.barcode || '').toString().toLowerCase().includes(q)
    ));
});

const productPageCount = computed(() => Math.max(1, Math.ceil(filteredProducts.value.length / PRODUCT_PAGE_SIZE)));

const pagedProducts = computed(() => {
    const start = (productPage.value - 1) * PRODUCT_PAGE_SIZE;
    return filteredProducts.value.slice(start, start + PRODUCT_PAGE_SIZE);
});

const productPageStart = computed(() => (
    filteredProducts.value.length ? ((productPage.value - 1) * PRODUCT_PAGE_SIZE) + 1 : 0
));

const productPageEnd = computed(() => Math.min(productPage.value * PRODUCT_PAGE_SIZE, filteredProducts.value.length));

const allPagedProductsSelected = computed(() => (
    pagedProducts.value.length > 0 && pagedProducts.value.every(isBufferSelected)
));

const somePagedProductsSelected = computed(() => (
    !allPagedProductsSelected.value && pagedProducts.value.some(isBufferSelected)
));

watch(searchTerm, () => {
    productPage.value = 1;
});

function focusProductSearch() {
    nextTick(() => productSearchInput.value?.focus());
}

function openProductDialog() {
    if (isProductSetupLoading.value) return;

    const selectedIds = new Set(selectedRows.value.map((row) => Number(row.product_id)));
    selectionBuffer.value = productList.value.filter((product) => selectedIds.has(Number(product.id)));
    searchTerm.value = '';
    productPage.value = 1;
    isProductDialogVisible.value = true;
    focusProductSearch();
}

function addProductToBuffer(product) {
    if (!isBufferSelected(product)) selectionBuffer.value.push(product);
}

function toggleProductInBuffer(product) {
    const idx = selectionBuffer.value.findIndex((item) => Number(item.id) === Number(product.id));
    if (idx >= 0) {
        selectionBuffer.value.splice(idx, 1);
        return;
    }
    selectionBuffer.value.push(product);
}

function removeProductFromBuffer(productId) {
    selectionBuffer.value = selectionBuffer.value.filter((item) => Number(item.id) !== Number(productId));
}

function isBufferSelected(product) {
    return selectionBuffer.value.some((item) => Number(item.id) === Number(product.id));
}

function selectProductFromSearch() {
    const query = searchTerm.value.trim().toLowerCase();
    if (!query) return;

    const exactMatch = filteredProducts.value.find((product) => (
        (product.barcode || '').toString().toLowerCase() === query
        || (product.name || '').toString().toLowerCase() === query
    ));
    const product = exactMatch || (filteredProducts.value.length === 1 ? filteredProducts.value[0] : null);
    if (!product) return;

    addProductToBuffer(product);
    searchTerm.value = '';
    focusProductSearch();
}

function clearProductSearch() {
    searchTerm.value = '';
    focusProductSearch();
}

function togglePagedProducts(event) {
    if (event.target.checked) {
        pagedProducts.value.forEach(addProductToBuffer);
        return;
    }

    const pagedIds = new Set(pagedProducts.value.map((product) => Number(product.id)));
    selectionBuffer.value = selectionBuffer.value.filter((product) => !pagedIds.has(Number(product.id)));
}

function goToPreviousProductPage() {
    if (productPage.value > 1) productPage.value -= 1;
}

function goToNextProductPage() {
    if (productPage.value < productPageCount.value) productPage.value += 1;
}

function confirmProductSelection() {
    const existingByKey = new Map(selectedRows.value.map((row) => [row.rowKey, row]));
    const rows = selectionBuffer.value.flatMap((product) => buildAllTargetRows(product, branchOptions.value));
    const selectedProductIds = new Set(selectionBuffer.value.map((product) => Number(product.id)));
    const customRows = selectedRows.value.filter((row) => row.is_custom && selectedProductIds.has(Number(row.product_id)));

    selectedRows.value = rows.map((row) => {
        const existing = existingByKey.get(row.rowKey);
        return existing ? { ...row, new_price: existing.new_price, min_qty: existing.min_qty, max_qty: existing.max_qty } : row;
    }).concat(customRows);
    if (!expandedProductIds.value.length && selectionBuffer.value.length) {
        expandedProductIds.value = [selectionBuffer.value[0].id];
    }
    isProductDialogVisible.value = false;
}

function cancelProductSelection() {
    isProductDialogVisible.value = false;
}

function removeRow(rowKey) {
    selectedRows.value = selectedRows.value.filter((row) => row.rowKey !== rowKey);
    if (rangeModal.value.visible) {
        rangeModal.value.rows = rangeModal.value.rows.filter((row) => row.rowKey !== rowKey);
    }
}

function resetRow(row) {
    row.new_price = row.old_price;
}

function resetRows(rows) {
    rows.forEach(resetRow);
}

function addCustomRange(row) {
    if (!isRangeTarget(row.target_type)) return;
    const newRow = {
        ...row,
        rowKey: `${row.rowKey}:custom:${Date.now()}`,
        is_custom: true,
        product_unit_price_range_id: null,
        branch_product_unit_price_range_id: null,
        min_qty: 0,
        max_qty: null,
        old_price: row.old_price,
        new_price: row.new_price,
    };
    selectedRows.value.push(newRow);
    if (rangeModal.value.visible) {
        rangeModal.value.rows.push(newRow);
    }
}

function formatPrice(value) {
    return Number(value || 0).toLocaleString('en-us');
}

function isChangedRow(row) {
    return Number(row.new_price) !== Number(row.old_price);
}

function focusNextPriceInput(event) {
    const priceGrid = event.currentTarget.closest('[data-price-grid]');
    if (!priceGrid) return;

    const inputs = [...priceGrid.querySelectorAll('[data-price-input]')];
    const currentIndex = inputs.indexOf(event.currentTarget);
    const nextInput = inputs[currentIndex + 1];
    if (nextInput) {
        nextInput.focus();
        nextInput.select();
    }
}

function productState(productId) {
    const key = String(productId);
    if (!productEditorState.value[key]) {
        productEditorState.value[key] = {
            tab: 'GLOBAL',
            priceValueType: 'INCREASE',
            priceChangeValue: '',
        };
    }
    return productEditorState.value[key];
}

function activeProductTab(productId) {
    return productState(productId).tab;
}

function setProductTab(productId, tab) {
    productState(productId).tab = tab;
}

function productRowsForTab(group, tab = activeProductTab(group.product_id), visibleOnly = true) {
    const sourceRows = visibleOnly ? group.visibleRows : group.rows;
    if (tab === 'GLOBAL') return sourceRows.filter((row) => !row.branch_id && !isRangeTarget(row.target_type));
    if (tab === 'BRANCH') return sourceRows.filter((row) => row.branch_id && !isRangeTarget(row.target_type));
    if (tab === 'RANGE') return sourceRows.filter((row) => isRangeTarget(row.target_type));
    return [];
}

function productTabCount(group, tab) {
    return productRowsForTab(group, tab, false).length;
}

function productTabChangedCount(group, tab) {
    return productRowsForTab(group, tab, false).filter(isChangedRow).length;
}

function currentTabRows(group) {
    return productRowsForTab(group);
}

function currentTabChangedCount(group) {
    return currentTabRows(group).filter(isChangedRow).length;
}

function globalRowsForActiveTab(group) {
    const activeTab = activeProductTab(group.product_id);
    if (activeTab !== 'GLOBAL') return [];
    return group.globalRows;
}

function branchGroupsForActiveTab(group) {
    const activeTab = activeProductTab(group.product_id);
    if (activeTab !== 'BRANCH') return [];
    return group.branchGroups;
}

function rangeGroupsForActiveTab(group) {
    const activeTab = activeProductTab(group.product_id);
    if (activeTab !== 'RANGE') return [];
    return group.rangeGroups;
}

function applyProductQuickChange(group) {
    const state = productState(group.product_id);
    const changeValue = Number(state.priceChangeValue);
    if (!Number.isFinite(changeValue) || changeValue <= 0) return;

    productRowsForTab(group, state.tab, false).forEach((row) => {
        const oldPrice = toNumber(row.old_price);
        row.new_price = state.priceValueType === 'INCREASE'
            ? oldPrice + changeValue
            : Math.max(0, oldPrice - changeValue);
    });
}

function toggleProduct(productId) {
    const id = Number(productId);
    if (expandedProductIds.value.some((item) => Number(item) === id)) {
        expandedProductIds.value = expandedProductIds.value.filter((item) => Number(item) !== id);
        return;
    }
    expandedProductIds.value = [...expandedProductIds.value, id];
}

function isProductExpanded(productId) {
    return expandedProductIds.value.some((item) => Number(item) === Number(productId));
}

function rangeGroupKey(row) {
    return [
        row.target_type,
        row.branch_id || 0,
        row.product_id,
        row.product_unit_id || 0,
        row.branch_product_unit_price_id || 0,
    ].join(':');
}

function groupRangeRows(rows) {
    const groupMap = new Map();
    rows.forEach((row) => {
        const key = rangeGroupKey(row);
        if (!groupMap.has(key)) {
            groupMap.set(key, {
                key,
                target_type: row.target_type,
                product_name: row.product_name,
                branch_name: row.branch_name,
                unit_name: row.unit_name,
                rows: [],
            });
        }
        groupMap.get(key).rows.push(row);
    });

    return [...groupMap.values()].map((group) => ({
        ...group,
        changedCount: group.rows.filter(isChangedRow).length,
        rangeCount: group.rows.length,
    }));
}

function openRangeModal(group) {
    rangeModal.value = {
        visible: true,
        title: `${targetLabel(group.target_type)} / ${group.branch_name} / ${group.unit_name}`,
        rows: group.rows,
    };
}

function closeRangeModal() {
    rangeModal.value = {
        visible: false,
        title: '',
        rows: [],
    };
}

function calculateNewPrices() {
    const changeValue = Number(formData.value.priceChangeValue);
    if (!Number.isFinite(changeValue) || changeValue <= 0) return;

    selectedRows.value.forEach((row) => {
        const oldPrice = toNumber(row.old_price);
        row.new_price = formData.value.priceValueType === 'INCREASE'
            ? oldPrice + changeValue
            : Math.max(0, oldPrice - changeValue);
    });
}

watch([() => formData.value.priceChangeValue, () => formData.value.priceValueType], calculateNewPrices);

function hasCheckablePromotionConflictDates() {
    const startTime = new Date(formData.value.startDate).getTime();
    if (!Number.isFinite(startTime)) return false;

    if (!formData.value.endDate) return true;
    const endTime = new Date(formData.value.endDate).getTime();
    return Number.isFinite(endTime) && endTime > startTime;
}

function cancelPromotionConflictRequest() {
    if (promotionConflictCheckTimer) {
        clearTimeout(promotionConflictCheckTimer);
        promotionConflictCheckTimer = null;
    }

    promotionConflictRequestId += 1;
    promotionConflictRequestController?.abort();
    promotionConflictRequestController = null;
    isPromotionConflictChecking.value = false;
    isPromotionConflictCheckPending.value = false;
}

async function runPromotionConflictCheck(targets, { notifyOnError = false } = {}) {
    if (!targets.length || !hasCheckablePromotionConflictDates()) return null;

    if (promotionConflictCheckTimer) {
        clearTimeout(promotionConflictCheckTimer);
        promotionConflictCheckTimer = null;
    }

    promotionConflictRequestController?.abort();
    const controller = new AbortController();
    const requestId = ++promotionConflictRequestId;
    promotionConflictRequestController = controller;
    isPromotionConflictCheckPending.value = false;
    isPromotionConflictChecking.value = true;
    promotionConflictError.value = '';

    try {
        const response = await axios.post('/pricechanges/check-promotion-conflicts', {
            type: formData.value.type,
            start_at: formData.value.startDate || null,
            end_at: formData.value.endDate || null,
            products: targets,
        }, {
            signal: controller.signal,
        });

        if (requestId !== promotionConflictRequestId) return null;
        promotionConflictResult.value = response.data?.data || null;
        return promotionConflictResult.value;
    } catch (err) {
        if (err?.code === 'ERR_CANCELED' || axios.isCancel(err)) return null;
        if (requestId !== promotionConflictRequestId) return null;

        const messages = normalizeApiError(err);
        promotionConflictError.value = messages.join(' ');
        promotionConflictResult.value = null;
        if (notifyOnError) {
            toast.add({
                severity: 'error',
                summary: 'Promotion Check Failed',
                detail: promotionConflictError.value,
                life: 4000,
            });
        }
        return null;
    } finally {
        if (requestId === promotionConflictRequestId) {
            isPromotionConflictChecking.value = false;
            promotionConflictRequestController = null;
        }
    }
}

function schedulePromotionConflictCheck() {
    cancelPromotionConflictRequest();
    promotionConflictResult.value = null;
    promotionConflictError.value = '';

    if (!promotionConflictTargets.value.length || !hasCheckablePromotionConflictDates()) return;

    isPromotionConflictCheckPending.value = true;
    promotionConflictCheckTimer = setTimeout(() => {
        runPromotionConflictCheck(promotionConflictTargets.value);
    }, 500);
}

function retryPromotionConflictCheck() {
    cancelPromotionConflictRequest();
    promotionConflictResult.value = null;
    promotionConflictError.value = '';
    runPromotionConflictCheck(promotionConflictTargets.value, { notifyOnError: true });
}

function formatPromotionDate(value) {
    if (!value) return 'Ongoing';
    const date = moment(value);
    return date.isValid() ? date.format('MMM D, YYYY h:mm A') : value;
}

function formatPromotionType(value) {
    return (value || 'Promotion').toString().replaceAll('_', ' ');
}

function rowForConflict(conflict) {
    return selectedRows.value.find((row) => (
        Number(row.product_id) === Number(conflict.product_id)
        && Number(row.branch_id || 0) === Number(conflict.branch_id || 0)
        && Number(row.product_unit_id || 0) === Number(conflict.product_unit_id || 0)
    )) || selectedRows.value.find((row) => Number(row.product_id) === Number(conflict.product_id));
}

function promotionConflictTargetLabel(conflict) {
    const row = rowForConflict(conflict);
    const labels = [row?.product_name || `Product #${conflict.product_id}`];
    if (conflict.branch_id) labels.push(row?.branch_name || `Branch #${conflict.branch_id}`);
    if (conflict.product_unit_id) labels.push(row?.unit_name || `Product unit #${conflict.product_unit_id}`);
    return labels.join(' / ');
}

function useSuggestedPromotionStart(value) {
    if (!value) return;
    const date = moment(value);
    if (!date.isValid()) return;

    formData.value.startDate = date.format('YYYY-MM-DDTHH:mm');
    promotionConflictDialog.value.visible = false;
}

function openPromotionConflictDialog(result) {
    promotionConflictDialog.value = {
        visible: true,
        result,
    };
}

function closePromotionConflictDialog() {
    if (usePriceChange.loading) return;
    promotionConflictDialog.value = {
        visible: false,
        result: null,
    };
}

watch(promotionConflictCheckSignature, schedulePromotionConflictCheck, { flush: 'post' });

onBeforeUnmount(() => {
    cancelPromotionConflictRequest();
});

function validateForm() {
    errorMsg.value = { date: '', products: '', priceChangeValue: '' };

    const dateError = validatePriceChangeDates(formData.value.startDate, formData.value.endDate);
    if (dateError) {
        errorMsg.value.date = dateError;
        return false;
    }

    if (!selectedRows.value.length) {
        errorMsg.value.products = errMsgList.product;
        return false;
    }
    if (!changedRows.value.length) {
        errorMsg.value.priceChangeValue = 'Please change at least one new price before saving.';
        return false;
    }

    const rowError = validatePriceChangeRows(changedRows.value);
    if (rowError) {
        errorMsg.value.products = rowError;
        return false;
    }

    return true;
}

function buildPriceChangePayload() {
    return {
        description: formData.value.description,
        type: formData.value.type,
        start_at: formData.value.startDate,
        end_at: formData.value.endDate || null,
        created_by: userData.value.id,
        products: changedRows.value.map(payloadForTargetRow),
    };
}

async function savePriceChange(payload) {
    await usePriceChange.addPriceChange(payload);

    if (usePriceChange.error.length) {
        usePriceChange.error.forEach((msg) => {
            toast.add({ severity: 'error', summary: 'Error Message', detail: msg, life: 3000 });
        });
        return;
    }

    toast.add({ severity: 'success', summary: 'Success Message', detail: 'Create sales price change successfully.', life: 3000 });
    router.push('/sales_price_change');
}

async function formSubmit() {
    if (!validateForm()) return;

    cancelPromotionConflictRequest();
    const result = await runPromotionConflictCheck(
        buildPromotionConflictTargets(changedRows.value),
        { notifyOnError: true },
    );
    if (!result) return;

    if (result.has_conflict === true) {
        openPromotionConflictDialog(result);
        return;
    }

    await savePriceChange(buildPriceChangePayload());
}
</script>

<template>
    <div class="p-3 sm:p-4 lg:p-6">
        <div class="mx-auto w-full max-w-screen-2xl">
            <PageTitle title="Create Sales Price Change">
                <template #titleButtons>
                    <div class="flex gap-x-2 items-center">
                        <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary" @click="changeRoute('/sales_price_change')" />
                    </div>
                </template>
            </PageTitle>

            <BaseCard class="mt-3">
                <template #cardElements>
                    <div class="space-y-4">
                        <section>
                            <div class="flex items-center justify-between border-b border-gray-200 pb-3">
                                <SubTitle label="Price Change Header" />
                                <span class="rounded bg-red-50 px-2 py-1 text-xs text-red-600">* Required</span>
                            </div>
                            <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <BaseInput size="sm" v-model="formData.startDate" label="Started Datetime" height="h-[35px]" type="datetime-local" />
                                <BaseInput size="sm" v-model="formData.endDate" label="Ended Datetime" height="h-[35px]" type="datetime-local" />
                                <div class="md:col-span-2">
                                    <BaseInput v-model="formData.description" label="Description" placeholder="Description" height="h-[35px]" />
                                </div>
                                <div v-if="errorMsg.date" class="md:col-span-2 xl:col-span-4">
                                    <BaseErrorLabel :label="errorMsg.date" />
                                </div>
                            </div>
                        </section>

                        <section v-if="selectedRows.length" class="border-t border-gray-200 pt-4">
                            <div
                                v-if="isPromotionConflictBusy"
                                class="flex items-start gap-3 rounded border border-blue-200 bg-blue-50 p-4 text-blue-800"
                            >
                                <i class="fa fa-spinner mt-0.5 animate-spin"></i>
                                <div>
                                    <div class="font-semibold">Checking promotion conflicts</div>
                                    <div class="mt-1 text-sm">Reviewing the selected products, branches, units, and effective dates.</div>
                                </div>
                            </div>

                            <div
                                v-else-if="promotionConflictError"
                                class="flex flex-col gap-3 rounded border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div class="flex items-start gap-3">
                                    <i class="fa fa-triangle-exclamation mt-0.5"></i>
                                    <div>
                                        <div class="font-semibold">Promotion conflict check unavailable</div>
                                        <div class="mt-1 text-sm">{{ promotionConflictError }}</div>
                                    </div>
                                </div>
                                <BaseButton size="sm" severity="secondary" label="Retry Check" icon="fa fa-rotate" @click="retryPromotionConflictCheck" />
                            </div>

                            <div
                                v-else-if="promotionConflictResult?.has_conflict"
                                class="rounded border border-red-200 bg-red-50 p-4 text-red-900"
                            >
                                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div class="flex items-start gap-3">
                                        <i class="fa fa-circle-xmark mt-0.5 text-red-600"></i>
                                        <div>
                                            <div class="font-semibold">Price change blocked by promotion conflicts</div>
                                            <div class="mt-1 text-sm">Change the affected targets or schedule the price change outside the promotion period.</div>
                                        </div>
                                    </div>
                                    <BaseButton
                                        v-if="promotionConflictResult.suggested_start_at"
                                        size="sm"
                                        label="Use Earliest Safe Start"
                                        icon="fa fa-calendar-check"
                                        @click="useSuggestedPromotionStart(promotionConflictResult.suggested_start_at)"
                                    />
                                </div>

                                <div class="mt-4 max-h-64 space-y-2 overflow-auto">
                                    <div
                                        v-for="conflict in promotionConflicts"
                                        :key="`${conflict.promotion?.id || 0}:${conflict.product_id || 0}:${conflict.branch_id || 0}:${conflict.product_unit_id || 0}`"
                                        class="rounded border border-red-200 bg-white/80 p-3"
                                    >
                                        <div class="flex flex-wrap items-center gap-2">
                                            <span class="font-semibold">{{ conflict.promotion?.name || `Promotion #${conflict.promotion?.id}` }}</span>
                                            <span class="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{{ formatPromotionType(conflict.promotion?.promo_type) }}</span>
                                        </div>
                                        <div class="mt-1 text-sm font-medium">{{ promotionConflictTargetLabel(conflict) }}</div>
                                        <div class="mt-1 text-xs text-red-800">
                                            {{ formatPromotionDate(conflict.promotion?.start_at) }} to {{ formatPromotionDate(conflict.promotion?.end_at) }}
                                        </div>
                                        <div class="mt-1 text-sm">{{ conflict.reason }}</div>
                                    </div>
                                </div>
                            </div>

                            <div
                                v-else-if="promotionConflictResult"
                                class="flex items-start gap-3 rounded border border-green-200 bg-green-50 p-4 text-green-800"
                            >
                                <i class="fa fa-circle-check mt-0.5"></i>
                                <div>
                                    <div class="font-semibold">No promotion conflict found</div>
                                    <div class="mt-1 text-sm">
                                        {{ changedRows.length ? 'Checked the changed price targets.' : 'Checked all targets for the selected products.' }}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section class="border-t border-gray-200 pt-4">
                            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <SubTitle label="Product Price Setup" />
                                <div class="flex flex-wrap items-center gap-2 text-sm">
                                    <span class="text-xs text-gray-500">Select products to show all global and branch price rows</span>
                                    <span class="rounded border border-gray-200 bg-gray-50 px-3 py-1 text-gray-600">
                                        Selected: <strong class="text-black">{{ selectedProductCount }}</strong>
                                    </span>
                                    <span class="rounded border border-blue-100 bg-blue-50 px-3 py-1 text-blue-700">
                                        Changed: <strong>{{ changedRows.length }}</strong>
                                    </span>
                                </div>
                            </div>
                            <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(280px,420px)_auto] md:items-end">
                                <div class="flex flex-col gap-1">
                                    <BaseLabel label="Quick Change Value" />
                                    <div class="flex gap-x-2">
                                        <select v-model="formData.priceValueType" class="h-[35px] w-[120px] rounded border border-gray-500 p-2 text-sm text-black">
                                            <option value="INCREASE">Increase</option>
                                            <option value="DECREASE">Decrease</option>
                                        </select>
                                        <BaseInput size="sm" v-model="formData.priceChangeValue" height="h-[35px]" type="number" />
                                    </div>
                                    <BaseErrorLabel v-if="errorMsg.priceChangeValue" :label="errorMsg.priceChangeValue" />
                                </div>

                                <div class="flex items-end">
                                    <BaseButton
                                        :label="isProductSetupLoading ? 'Loading Products' : 'Select Products'"
                                        :icon="isProductSetupLoading ? 'fa fa-spinner' : 'fa fa-boxes-stacked'"
                                        :isLoading="isProductSetupLoading"
                                        :disabled="isProductSetupLoading"
                                        class="w-full md:w-fit"
                                        @click="openProductDialog"
                                    />
                                </div>
                            </div>
                        </section>

                        <section class="border-t border-gray-200 pt-4">
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <SubTitle label="Selected Product Price List" />
                                <div class="flex items-center gap-3">
                                    <label class="flex items-center gap-2 text-sm text-gray-700">
                                        <input v-model="changedOnly" type="checkbox" class="h-4 w-4" />
                                        Show changed only
                                    </label>
                                    <span class="text-xs text-gray-500">Only changed rows will be saved</span>
                                </div>
                            </div>
                            <BaseErrorLabel v-if="errorMsg.products" :label="errorMsg.products" />

                            <div class="mt-4 space-y-3">
                                <div v-for="group in productGroups" :key="group.product_id" class="overflow-hidden rounded border border-gray-200 bg-white">
                                    <button
                                        class="flex w-full flex-col gap-3 bg-gray-50 p-3 text-left sm:flex-row sm:items-center sm:justify-between"
                                        @click="toggleProduct(group.product_id)"
                                    >
                                        <div class="flex min-w-0 items-center gap-3">
                                            <img class="h-12 w-12 rounded object-cover" :src="group.image_url" />
                                            <div class="min-w-0">
                                                <div class="truncate font-semibold text-black">{{ group.product_name }}</div>
                                                <div class="text-xs text-gray-500">{{ group.product_barcode || '-' }}</div>
                                            </div>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                            <span class="rounded bg-white px-2 py-1">{{ group.totalCount }} price rows</span>
                                            <span class="rounded bg-blue-50 px-2 py-1 text-blue-700">{{ group.changedCount }} changed</span>
                                            <i :class="isProductExpanded(group.product_id) ? 'fa fa-chevron-up' : 'fa fa-chevron-down'"></i>
                                        </div>
                                    </button>

                                    <div v-if="isProductExpanded(group.product_id)" class="space-y-4 p-4">
                                        <div class="rounded border border-gray-200 bg-gray-50 p-3">
                                            <div class="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                                                <div class="min-w-0 flex-1">
                                                    <div class="flex flex-wrap gap-2">
                                                        <button
                                                            v-for="tab in PRICE_EDITOR_TABS"
                                                            :key="tab.value"
                                                            type="button"
                                                            :aria-pressed="activeProductTab(group.product_id) === tab.value"
                                                            :aria-label="`${tab.label} price rows: ${productTabChangedCount(group, tab.value)} changed of ${productTabCount(group, tab.value)}`"
                                                            class="rounded border px-3 py-2 text-sm"
                                                            :class="activeProductTab(group.product_id) === tab.value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'"
                                                            @click="setProductTab(group.product_id, tab.value)"
                                                        >
                                                            <span>{{ tab.label }}</span>
                                                            <span class="ml-2 rounded bg-white px-1.5 py-0.5 text-xs text-gray-600">
                                                                {{ productTabChangedCount(group, tab.value) }} / {{ productTabCount(group, tab.value) }}
                                                            </span>
                                                        </button>
                                                    </div>
                                                    <div class="mt-2 text-xs text-gray-500">
                                                        {{ currentTabRows(group).length }} visible rows in this tab, {{ currentTabChangedCount(group) }} changed
                                                    </div>
                                                </div>

                                                <div class="grid grid-cols-1 gap-2 sm:grid-cols-[120px_140px_auto_auto] sm:items-end">
                                                    <div class="flex flex-col gap-1">
                                                        <BaseLabel label="Quick" />
                                                        <select
                                                            :value="productState(group.product_id).priceValueType"
                                                            class="h-[35px] rounded border border-gray-500 p-2 text-sm text-black"
                                                            @change="productState(group.product_id).priceValueType = $event.target.value"
                                                        >
                                                            <option value="INCREASE">Increase</option>
                                                            <option value="DECREASE">Decrease</option>
                                                        </select>
                                                    </div>
                                                    <div class="flex flex-col gap-1">
                                                        <BaseLabel label="Amount" />
                                                        <input
                                                            :value="productState(group.product_id).priceChangeValue"
                                                            type="number"
                                                            class="h-[35px] rounded border border-gray-500 px-2 text-right text-sm"
                                                            @input="productState(group.product_id).priceChangeValue = $event.target.value"
                                                        />
                                                    </div>
                                                    <BaseButton label="Apply Tab" icon="fa fa-wand-magic-sparkles" @click="applyProductQuickChange(group)" />
                                                    <BaseButton severity="secondary" label="Reset Tab" icon="fa fa-rotate-left" @click="resetRows(productRowsForTab(group, activeProductTab(group.product_id), false))" />
                                                </div>
                                            </div>
                                        </div>

                                        <div v-if="globalRowsForActiveTab(group).length" class="space-y-2">
                                            <div class="text-sm font-semibold text-gray-800">Global Prices</div>
                                            <div data-price-grid class="overflow-hidden rounded border border-gray-200">
                                                <div class="hidden grid-cols-[minmax(220px,1fr)_120px_180px_36px] gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 sm:grid">
                                                    <div>Price Target</div>
                                                    <div class="text-right">Old Price</div>
                                                    <div class="text-right">New Price</div>
                                                    <div></div>
                                                </div>
                                                <div
                                                    v-for="row in globalRowsForActiveTab(group)"
                                                    :key="row.rowKey"
                                                    class="group grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 border-b border-gray-100 px-3 py-2 last:border-b-0 sm:grid-cols-[minmax(220px,1fr)_120px_180px_36px] sm:items-center"
                                                    :class="isChangedRow(row) ? 'bg-blue-50/70' : 'bg-white hover:bg-gray-50'"
                                                >
                                                    <div class="min-w-0">
                                                        <div class="truncate text-sm font-medium text-black">{{ targetLabel(row.target_type) }}</div>
                                                        <div class="truncate text-xs text-gray-500">{{ row.unit_name || '-' }}</div>
                                                    </div>
                                                    <div class="text-right" :title="row.old_price_source ? `Source: ${row.old_price_source}` : ''">
                                                        <div class="text-[11px] text-gray-500 sm:hidden">Old Price</div>
                                                        <div class="font-semibold tabular-nums text-gray-800">{{ formatPrice(row.old_price) }}</div>
                                                    </div>
                                                    <div>
                                                        <label class="mb-1 block text-[11px] text-gray-500 sm:hidden">New Price</label>
                                                        <input
                                                            v-model.number="row.new_price"
                                                            data-price-input
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            inputmode="decimal"
                                                            :aria-label="`New price for ${targetLabel(row.target_type)} ${row.unit_name || ''}`"
                                                            class="h-[34px] w-full rounded border border-gray-300 px-2 text-right tabular-nums outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                                                            @focus="$event.currentTarget.select()"
                                                            @keydown.enter.prevent="focusNextPriceInput"
                                                        />
                                                    </div>
                                                    <button
                                                        v-if="isChangedRow(row)"
                                                        type="button"
                                                        class="flex h-8 w-8 items-center justify-center justify-self-end rounded text-gray-500 hover:bg-white hover:text-gray-800"
                                                        :aria-label="`Reset ${targetLabel(row.target_type)}`"
                                                        title="Reset price"
                                                        @click="resetRow(row)"
                                                    >
                                                        <i class="fa fa-rotate-left"></i>
                                                    </button>
                                                    <div v-else class="h-8 w-8"></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div v-if="branchGroupsForActiveTab(group).length" class="space-y-3">
                                            <div class="text-sm font-semibold text-gray-800">Branch Prices</div>
                                            <div v-for="branchGroup in branchGroupsForActiveTab(group)" :key="branchGroup.branch_id" class="overflow-hidden rounded border border-gray-200">
                                                <div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
                                                    <div class="font-medium text-black">{{ branchGroup.branch_name }}</div>
                                                    <div class="text-xs text-gray-500">{{ branchGroup.rows.length }} prices</div>
                                                </div>
                                                <div data-price-grid>
                                                    <div class="hidden grid-cols-[minmax(220px,1fr)_120px_180px_36px] gap-3 border-b border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 sm:grid">
                                                        <div>Price Target</div>
                                                        <div class="text-right">Old Price</div>
                                                        <div class="text-right">New Price</div>
                                                        <div></div>
                                                    </div>
                                                    <div
                                                        v-for="row in branchGroup.rows"
                                                        :key="row.rowKey"
                                                        class="group grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 border-b border-gray-100 px-3 py-2 last:border-b-0 sm:grid-cols-[minmax(220px,1fr)_120px_180px_36px] sm:items-center"
                                                        :class="isChangedRow(row) ? 'bg-blue-50/70' : 'bg-white hover:bg-gray-50'"
                                                    >
                                                        <div class="min-w-0">
                                                            <div class="truncate text-sm font-medium text-black">{{ targetLabel(row.target_type) }}</div>
                                                            <div class="truncate text-xs text-gray-500">{{ row.unit_name || '-' }}</div>
                                                        </div>
                                                        <div class="text-right" :title="row.old_price_source ? `Source: ${row.old_price_source}` : ''">
                                                            <div class="text-[11px] text-gray-500 sm:hidden">Old Price</div>
                                                            <div class="font-semibold tabular-nums text-gray-800">{{ formatPrice(row.old_price) }}</div>
                                                        </div>
                                                        <div>
                                                            <label class="mb-1 block text-[11px] text-gray-500 sm:hidden">New Price</label>
                                                            <input
                                                                v-model.number="row.new_price"
                                                                data-price-input
                                                                type="number"
                                                                min="0"
                                                                step="any"
                                                                inputmode="decimal"
                                                                :aria-label="`New price for ${targetLabel(row.target_type)} ${row.unit_name || ''}`"
                                                                class="h-[34px] w-full rounded border border-gray-300 px-2 text-right tabular-nums outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                                                                @focus="$event.currentTarget.select()"
                                                                @keydown.enter.prevent="focusNextPriceInput"
                                                            />
                                                        </div>
                                                        <button
                                                            v-if="isChangedRow(row)"
                                                            type="button"
                                                            class="flex h-8 w-8 items-center justify-center justify-self-end rounded text-gray-500 hover:bg-white hover:text-gray-800"
                                                            :aria-label="`Reset ${targetLabel(row.target_type)}`"
                                                            title="Reset price"
                                                            @click="resetRow(row)"
                                                        >
                                                            <i class="fa fa-rotate-left"></i>
                                                        </button>
                                                        <div v-else class="h-8 w-8"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div v-if="rangeGroupsForActiveTab(group).length" class="space-y-2">
                                            <div class="text-sm font-semibold text-gray-800">Range Prices</div>
                                            <div class="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
                                                <div v-for="rangeGroup in rangeGroupsForActiveTab(group)" :key="rangeGroup.key" class="rounded border border-gray-200 p-3">
                                                    <div class="font-medium text-black">{{ targetLabel(rangeGroup.target_type) }}</div>
                                                    <div class="mt-1 text-xs text-gray-500">{{ rangeGroup.branch_name }} / {{ rangeGroup.unit_name }}</div>
                                                    <div class="mt-3 flex items-center justify-between text-sm">
                                                        <span>{{ rangeGroup.rangeCount }} ranges</span>
                                                        <span class="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">{{ rangeGroup.changedCount }} changed</span>
                                                    </div>
                                                    <BaseButton label="Manage Ranges" icon="fa fa-sliders" severity="secondary" class="mt-3 w-full" @click="openRangeModal(rangeGroup)" />
                                                </div>
                                            </div>
                                        </div>

                                        <div v-if="!currentTabRows(group).length" class="rounded border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                                            No visible price rows for this product
                                        </div>
                                    </div>
                                </div>

                                <div v-if="!productGroups.length" class="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                                    No products selected
                                </div>
                            </div>
                        </section>
                    </div>

                    <div class="sticky bottom-0 z-10 mt-4 border-t border-gray-200 bg-white/95 py-4 backdrop-blur">
                        <div class="flex justify-end">
                            <BaseButton
                                :label="promotionConflictResult?.has_conflict ? 'Promotion Conflict' : 'Save'"
                                :isLoading="usePriceChange.loading || isPromotionConflictBusy"
                                :icon="usePriceChange.loading || isPromotionConflictBusy ? 'fa fa-spinner' : 'fa fa-floppy-disk'"
                                severity="primary"
                                class="w-full sm:w-auto"
                                :disabled="usePriceChange.loading || isPromotionConflictBusy || promotionConflictResult?.has_conflict"
                                @click="formSubmit"
                            />
                        </div>
                    </div>
                </template>
            </BaseCard>
        </div>
    </div>

    <div v-if="rangeModal.visible" class="fixed inset-0 z-50 flex items-center justify-center text-black">
        <div class="absolute inset-0 bg-black opacity-50" @click="closeRangeModal"></div>
        <div class="z-10 max-h-[86vh] w-[94%] max-w-5xl overflow-hidden rounded bg-white p-4 shadow-lg">
            <div class="flex flex-col gap-2 border-b py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <SubTitle label="Manage Range Prices" />
                    <div class="mt-1 text-sm text-gray-500">{{ rangeModal.title }}</div>
                </div>
                <BaseButton severity="secondary" label="Close" icon="fa fa-xmark" @click="closeRangeModal" />
            </div>

            <div class="max-h-[58vh] overflow-auto py-4">
                <table class="w-full min-w-[900px] text-sm">
                    <thead>
                        <tr class="border-b bg-gray-50 text-left text-gray-700">
                            <th class="p-2">Applies to Qty</th>
                            <th class="p-2">Min Qty</th>
                            <th class="p-2">Max Qty</th>
                            <th class="p-2 text-right">Old Price</th>
                            <th class="p-2">Old Price Source</th>
                            <th class="p-2 text-right">New Price</th>
                            <th class="p-2 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in rangeModal.rows" :key="row.rowKey" class="border-b hover:bg-gray-50">
                            <td class="p-2">{{ formatRange(row) }}</td>
                            <td class="p-2">
                                <input v-model.number="row.min_qty" type="number" class="h-[32px] w-24 rounded border px-2 text-right" />
                            </td>
                            <td class="p-2">
                                <input v-model.number="row.max_qty" type="number" class="h-[32px] w-24 rounded border px-2 text-right" placeholder="No max" />
                            </td>
                            <td class="p-2 text-right">{{ formatPrice(row.old_price) }}</td>
                            <td class="p-2">
                                <span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">{{ row.old_price_source || '-' }}</span>
                            </td>
                            <td class="p-2 text-right">
                                <input v-model.number="row.new_price" type="number" class="h-[32px] w-28 rounded border px-2 text-right" />
                            </td>
                            <td class="p-2 text-center">
                                <div class="flex justify-center gap-1">
                                    <button class="px-2 py-1 text-gray-600 hover:text-gray-800" @click="resetRow(row)">
                                        <i class="fa fa-rotate-left"></i>
                                    </button>
                                    <button v-if="row.is_custom" class="px-2 py-1 text-red-600 hover:text-red-800" @click="removeRow(row.rowKey)">
                                        <i class="pi pi-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="flex justify-between gap-x-2 border-t py-4">
                <BaseButton
                    v-if="rangeModal.rows.length"
                    severity="secondary"
                    label="Add Range"
                    icon="fa fa-plus"
                    @click="addCustomRange(rangeModal.rows[0])"
                />
                <BaseButton label="Done" @click="closeRangeModal" />
            </div>
        </div>
    </div>

    <div v-if="isProductDialogVisible" class="fixed inset-0 z-50 flex items-center justify-center text-black" @keydown.esc="cancelProductSelection">
        <div class="absolute inset-0 bg-black opacity-50" @click="cancelProductSelection"></div>
        <div class="z-10 flex h-[86vh] w-[94%] max-w-5xl flex-col overflow-hidden rounded bg-white p-4 shadow-lg">
            <div class="flex shrink-0 items-center justify-between border-b py-4">
                <SubTitle label="Select Products" />
                <div class="text-sm text-gray-600">{{ selectionBuffer.length }} selected</div>
            </div>
            <div class="shrink-0 space-y-3 py-3">
                <div class="relative">
                    <input
                        ref="productSearchInput"
                        v-model="searchTerm"
                        placeholder="Search by name or barcode"
                        aria-label="Search products by name or barcode"
                        class="h-[38px] w-full rounded border py-2 pl-3 pr-10"
                        @keydown.enter.prevent="selectProductFromSearch"
                    />
                    <button
                        v-if="searchTerm"
                        type="button"
                        class="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-black"
                        aria-label="Clear product search"
                        title="Clear search"
                        @click="clearProductSearch"
                    >
                        <i class="fa fa-xmark"></i>
                    </button>
                </div>

                <div v-if="selectionBuffer.length" class="rounded border border-blue-100 bg-blue-50 p-2">
                    <div class="flex items-center justify-between gap-3 text-xs text-blue-800">
                        <span class="font-medium">Selected products</span>
                        <span>{{ selectionBuffer.length }}</span>
                    </div>
                    <div class="mt-2 flex gap-2 overflow-x-auto pb-1">
                        <div
                            v-for="product in selectionBuffer"
                            :key="product.id"
                            class="inline-flex shrink-0 items-center gap-2 rounded border border-blue-200 bg-white px-2 py-1 text-sm"
                        >
                            <span class="max-w-48 truncate">{{ product.name }}</span>
                            <button
                                type="button"
                                class="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-red-50 hover:text-red-600"
                                :aria-label="`Remove ${product.name}`"
                                :title="`Remove ${product.name}`"
                                @click="removeProductFromBuffer(product.id)"
                            >
                                <i class="fa fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="min-h-0 flex-1 overflow-auto">
                <table class="w-full min-w-[650px] text-sm">
                    <thead class="sticky top-0 z-[1] bg-white">
                        <tr class="border-b text-left text-gray-600">
                            <th class="py-2">
                                <input
                                    type="checkbox"
                                    :checked="allPagedProductsSelected"
                                    :indeterminate="somePagedProductsSelected"
                                    aria-label="Select visible products"
                                    title="Select visible products"
                                    @change="togglePagedProducts"
                                />
                            </th>
                            <th class="py-2">Image</th>
                            <th class="py-2">Name</th>
                            <th class="py-2">Barcode</th>
                            <th class="py-2 text-right">Global Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="product in pagedProducts"
                            :key="product.id"
                            tabindex="0"
                            :aria-selected="isBufferSelected(product)"
                            class="cursor-pointer border-b border-gray-100 outline-none focus:bg-blue-50"
                            :class="isBufferSelected(product) ? 'bg-blue-50' : 'hover:bg-gray-50'"
                            @click="toggleProductInBuffer(product)"
                            @keydown.enter.prevent="toggleProductInBuffer(product)"
                            @keydown.space.prevent="toggleProductInBuffer(product)"
                        >
                            <td class="py-2">
                                <input
                                    type="checkbox"
                                    :checked="isBufferSelected(product)"
                                    :aria-label="`Select ${product.name}`"
                                    @click.stop
                                    @change="toggleProductInBuffer(product)"
                                />
                            </td>
                            <td class="py-2"><img class="h-10 w-10 rounded object-cover" :src="product.image_url" /></td>
                            <td class="py-2">{{ product.name }}</td>
                            <td class="py-2">{{ product.barcode || '-' }}</td>
                            <td class="py-2 text-right">{{ formatPrice(product.price) }}</td>
                        </tr>
                        <tr v-if="!pagedProducts.length">
                            <td colspan="5" class="py-4 text-center text-gray-500">No products found</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="flex shrink-0 flex-col gap-3 border-t py-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="flex items-center justify-between gap-3 text-sm text-gray-600 sm:justify-start">
                    <span>{{ productPageStart }}-{{ productPageEnd }} of {{ filteredProducts.length }}</span>
                    <div class="flex gap-1">
                        <button
                            type="button"
                            class="flex h-8 w-8 items-center justify-center rounded border border-gray-300 text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                            :disabled="productPage <= 1"
                            aria-label="Previous product page"
                            title="Previous page"
                            @click="goToPreviousProductPage"
                        >
                            <i class="fa fa-chevron-left"></i>
                        </button>
                        <button
                            type="button"
                            class="flex h-8 w-8 items-center justify-center rounded border border-gray-300 text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                            :disabled="productPage >= productPageCount"
                            aria-label="Next product page"
                            title="Next page"
                            @click="goToNextProductPage"
                        >
                            <i class="fa fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
                <div class="flex justify-end gap-x-2">
                    <BaseButton severity="secondary" label="Cancel" @click="cancelProductSelection" />
                    <BaseButton :label="`Show Price List (${selectionBuffer.length})`" @click="confirmProductSelection" />
                </div>
            </div>
        </div>
    </div>

    <div
        v-if="promotionConflictDialog.visible"
        class="fixed inset-0 z-[60] flex items-center justify-center p-4 text-black"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promotion-conflict-dialog-title"
        @keydown.esc="closePromotionConflictDialog"
    >
        <div class="absolute inset-0 bg-black/50" @click="closePromotionConflictDialog"></div>
        <div class="z-10 flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div class="flex items-start gap-3 border-b border-red-200 bg-red-50 p-5">
                <i class="fa fa-circle-xmark mt-1 text-lg text-red-600"></i>
                <div>
                    <h2 id="promotion-conflict-dialog-title" class="text-lg font-semibold">Promotion Conflict</h2>
                    <p class="mt-1 text-sm text-gray-700">
                        This sales price change cannot be saved during the conflicting promotion period.
                    </p>
                </div>
            </div>

            <div class="min-h-0 flex-1 space-y-3 overflow-auto p-5">
                <div
                    v-for="conflict in dialogPromotionConflicts"
                    :key="`${conflict.promotion?.id || 0}:${conflict.product_id || 0}:${conflict.branch_id || 0}:${conflict.product_unit_id || 0}`"
                    class="rounded border border-gray-200 p-4"
                >
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="font-semibold text-gray-900">{{ conflict.promotion?.name || `Promotion #${conflict.promotion?.id}` }}</span>
                        <span class="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{{ formatPromotionType(conflict.promotion?.promo_type) }}</span>
                        <span class="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Blocking</span>
                    </div>
                    <div class="mt-2 text-sm font-medium text-gray-800">{{ promotionConflictTargetLabel(conflict) }}</div>
                    <div class="mt-1 text-xs text-gray-500">
                        {{ formatPromotionDate(conflict.promotion?.start_at) }} to {{ formatPromotionDate(conflict.promotion?.end_at) }}
                    </div>
                    <p class="mt-2 text-sm text-gray-700">{{ conflict.reason }}</p>
                </div>

                <div
                    v-if="promotionConflictDialog.result?.suggested_start_at"
                    class="rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"
                >
                    Earliest safe start: <strong>{{ formatPromotionDate(promotionConflictDialog.result.suggested_start_at) }}</strong>
                </div>
            </div>

            <div class="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end">
                <BaseButton severity="secondary" label="Close" :disabled="usePriceChange.loading" @click="closePromotionConflictDialog" />
                <BaseButton
                    v-if="promotionConflictDialog.result?.suggested_start_at"
                    label="Use Earliest Safe Start"
                    icon="fa fa-calendar-check"
                    @click="useSuggestedPromotionStart(promotionConflictDialog.result.suggested_start_at)"
                />
            </div>
        </div>
    </div>
</template>
