<script setup>
import { useRouter } from 'vue-router';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import moment from 'moment';
import axios from 'axios';
import * as XLSX from 'xlsx';
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
    normalizeCell,
    readNormalizedSheetRows,
    readWorkbookFromFile,
} from '@/utils/excelImport';
import {
    PRICE_CHANGE_TARGETS,
    buildAllTargetRows,
    formatRange,
    isBranchTarget,
    isRangeTarget,
    isUomTarget,
    payloadForTargetRow,
    productUnits,
    targetLabel,
    toNumber,
    unitName,
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
const importInputRef = ref(null);
const isImporting = ref(false);
const importPreview = ref({
    visible: false,
    fileName: '',
    rows: [],
});
const changedOnly = ref(false);
const expandedProductIds = ref([]);
const productEditorState = ref({});
const rangeModal = ref({
    visible: false,
    title: '',
    rows: [],
});
const branchPicker = ref({
    visible: false,
    productId: null,
    search: '',
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
const IMPORT_SHEET_NAMES = ['Price Changes', 'Price_Changes', 'Sales Price Changes'];
const IMPORT_COLUMNS = [
    'barcode',
    'unit_name',
    'target_type',
    'branch_name',
    'min_qty',
    'max_qty',
    'new_price',
];
const CREATE_PRICE_CHANGE_TARGETS = PRICE_CHANGE_TARGETS.filter((target) => target.value !== 'GLOBAL_PRODUCT_PRICE');
const SUPPORTED_TARGET_TYPES = new Set(CREATE_PRICE_CHANGE_TARGETS.map((target) => target.value));

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
const importValidRows = computed(() => importPreview.value.rows.filter((row) => !row.errors.length));
const importErrorCount = computed(() => importPreview.value.rows.filter((row) => row.errors.length).length);
const importWarningCount = computed(() => importPreview.value.rows.filter((row) => row.warnings.length).length);

function buildCreateTargetRows(product) {
    return buildAllTargetRows(product, branchOptions.value)
        .filter((row) => row.target_type !== 'GLOBAL_PRODUCT_PRICE');
}

function primaryProductUnit(product) {
    const units = productUnits(product);
    const configuredDefaultId = product?.default_product_unit?.id || product?.default_product_unit_id;

    return units.find((unit) => configuredDefaultId && Number(unit.id || unit.product_unit_id) === Number(configuredDefaultId))
        || units.find((unit) => unit.is_default_sale_unit)
        || units.find((unit) => unit.is_base_unit)
        || units[0]
        || null;
}

function syncedGlobalProductRow(globalUomRow) {
    const product = productList.value.find((item) => Number(item.id) === Number(globalUomRow.product_id));
    const primaryUnit = primaryProductUnit(product);
    const primaryUnitId = primaryUnit?.id || primaryUnit?.product_unit_id;
    if (!product || !primaryUnitId || Number(globalUomRow.product_unit_id) !== Number(primaryUnitId)) return null;

    return {
        ...globalUomRow,
        rowKey: `SYNCED_GLOBAL_PRODUCT_PRICE:${product.id}`,
        target_type: 'GLOBAL_PRODUCT_PRICE',
        branch_id: null,
        branch_name: '-',
        branch_product_id: null,
        product_unit_id: null,
        branch_product_unit_price_id: null,
        product_unit_price_range_id: null,
        branch_product_unit_price_range_id: null,
        unit_name: '-',
        min_qty: null,
        max_qty: null,
        old_price: toNumber(product.price),
        new_price: toNumber(globalUomRow.new_price),
        old_price_source: 'Synced from primary UOM price',
        is_synced: true,
    };
}

function isPrimaryGlobalUomRow(row) {
    return row?.target_type === 'GLOBAL_UOM_PRICE' && !!syncedGlobalProductRow(row);
}

function rowsWithSyncedGlobalProductPrices(rows) {
    const visibleRows = (rows || []).filter((row) => row.target_type !== 'GLOBAL_PRODUCT_PRICE');
    const syncedProductIds = new Set();
    const result = [...visibleRows];

    visibleRows
        .filter((row) => row.target_type === 'GLOBAL_UOM_PRICE')
        .forEach((row) => {
            const syncedRow = syncedGlobalProductRow(row);
            if (!syncedRow || syncedProductIds.has(Number(syncedRow.product_id))) return;
            syncedProductIds.add(Number(syncedRow.product_id));
            result.push(syncedRow);
        });

    return result;
}

const changedRows = computed(() => selectedRows.value.filter((row) => (
    isRowAvailableForEditing(row) && Number(row.new_price) !== Number(row.old_price)
)));

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

const promotionConflictSourceRows = computed(() => rowsWithSyncedGlobalProductPrices(
    changedRows.value.length
        ? changedRows.value
        : selectedRows.value.filter(isRowAvailableForEditing),
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
        const editableRows = group.rows.filter(isRowAvailableForEditing);
        const visibleRows = changedOnly.value ? editableRows.filter(isChangedRow) : editableRows;
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
            branchGroups: [...branchMap.values()].map((branchGroup) => ({
                ...branchGroup,
                inheritedCount: branchGroup.rows.filter((row) => row.inherits_global_price).length,
                createCount: branchGroup.rows.filter((row) => row.will_create_branch_price).length,
            })),
            rangeGroups: groupRangeRows(rangeRows),
            changedCount: editableRows.filter(isChangedRow).length,
            totalCount: editableRows.length,
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
    const rows = selectionBuffer.value.flatMap(buildCreateTargetRows);
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

function normalizeImportLookup(value) {
    return normalizeCell(value).toLowerCase();
}

function normalizeImportTargetType(value) {
    return normalizeCell(value).toUpperCase().replace(/[\s-]+/g, '_');
}

function parseImportNumber(value, label, errors, { required = false } = {}) {
    const rawValue = normalizeCell(value);
    if (!rawValue) {
        if (required) errors.push(`${label} is required.`);
        return null;
    }

    const parsed = Number(rawValue.replace(/,/g, ''));
    if (!Number.isFinite(parsed)) {
        errors.push(`${label} must be a valid number.`);
        return null;
    }
    if (parsed < 0) {
        errors.push(`${label} cannot be negative.`);
        return null;
    }
    return parsed;
}

function importBarcode(row) {
    return normalizeCell(
        row.barcode
        || row.unit_barcode
        || row.product_unit_barcode
        || row.product_barcode
    );
}

function resolveImportBarcode(row, errors) {
    const barcode = importBarcode(row);
    if (!barcode) {
        errors.push('Barcode is required.');
        return null;
    }

    const normalizedBarcode = barcode.toLowerCase();
    const unitMatches = [];
    productList.value.forEach((product) => {
        productUnits(product).forEach((productUnit) => {
            if (normalizeImportLookup(productUnit.barcode) !== normalizedBarcode) return;
            unitMatches.push({ product, productUnit });
        });
    });

    if (unitMatches.length > 1) {
        errors.push(`Unit barcode "${barcode}" is not unique.`);
        return null;
    }

    const productMatches = productList.value.filter((product) => (
        normalizeImportLookup(product.barcode) === normalizedBarcode
    ));
    if (unitMatches.length === 1) {
        const matchedProductId = Number(unitMatches[0].product?.id || 0);
        const conflictingProducts = productMatches.filter((product) => Number(product.id || 0) !== matchedProductId);
        if (conflictingProducts.length) {
            errors.push(`Barcode "${barcode}" is used by more than one product or product unit.`);
            return null;
        }
        return unitMatches[0];
    }

    if (!productMatches.length) {
        errors.push(`Barcode "${barcode}" was not found in any product or product unit.`);
        return null;
    }
    if (productMatches.length > 1) {
        errors.push(`Product barcode "${barcode}" is not unique.`);
        return null;
    }
    return {
        product: productMatches[0],
        productUnit: null,
    };
}

function resolveImportBranch(row, targetType, errors) {
    if (!isBranchTarget(targetType)) return null;

    const branchName = normalizeCell(row.branch_name || row.branch);
    if (!branchName) {
        errors.push('Branch name is required for a branch target.');
        return null;
    }

    const matches = branchOptions.value.filter((branch) => (
        normalizeImportLookup(branch.name) === branchName.toLowerCase()
    ));
    if (!matches.length) {
        errors.push(`Branch "${branchName}" was not found. Download a fresh template if it was renamed.`);
        return null;
    }
    if (matches.length > 1) {
        errors.push(`Branch name "${branchName}" is not unique.`);
        return null;
    }
    return matches[0];
}

function resolveImportProductUnit(row, barcodeMatch, targetType, errors, warnings) {
    if (!isUomTarget(targetType)) return null;

    const product = barcodeMatch?.product;
    const importedUnitName = normalizeCell(row.unit_name || row.uom);
    const barcodeProductUnit = barcodeMatch?.productUnit;
    if (barcodeProductUnit) {
        const resolvedUnitName = unitName(barcodeProductUnit);
        if (importedUnitName && normalizeImportLookup(resolvedUnitName) !== importedUnitName.toLowerCase()) {
            warnings.push(`Unit name "${importedUnitName}" does not match the barcode; current unit "${resolvedUnitName}" will be used.`);
        }

        const productUnitId = barcodeProductUnit.id || barcodeProductUnit.product_unit_id;
        if (!productUnitId) {
            errors.push(`Unit barcode "${importBarcode(row)}" does not have a configured product unit ID.`);
            return null;
        }
        return barcodeProductUnit;
    }

    if (!importedUnitName) {
        errors.push('Unit name is required when the barcode does not identify a specific product unit.');
        return null;
    }

    const matches = productUnits(product).filter((productUnit) => (
        normalizeImportLookup(unitName(productUnit)) === importedUnitName.toLowerCase()
    ));
    if (!matches.length) {
        errors.push(`Unit "${importedUnitName}" was not found for this product. Download a fresh template if it was renamed.`);
        return null;
    }
    if (matches.length > 1) {
        errors.push(`Unit name "${importedUnitName}" is not unique for this product.`);
        return null;
    }

    const productUnitId = matches[0].id || matches[0].product_unit_id;
    if (!productUnitId) {
        errors.push(`Unit "${importedUnitName}" does not have a configured product unit ID.`);
        return null;
    }
    return matches[0];
}

function sameOptionalNumber(left, right) {
    const leftBlank = left === '' || left === null || left === undefined;
    const rightBlank = right === '' || right === null || right === undefined;
    if (leftBlank || rightBlank) return leftBlank && rightBlank;
    return Number(left) === Number(right);
}

function rowMatchesImportTarget(row, { product, targetType, branch, productUnit, minQty, maxQty }) {
    if (Number(row.product_id) !== Number(product?.id)) return false;
    if (row.target_type !== targetType) return false;
    if (Number(row.branch_id || 0) !== Number(branch?.id || 0)) return false;

    const productUnitId = productUnit?.id || productUnit?.product_unit_id || 0;
    if (Number(row.product_unit_id || 0) !== Number(productUnitId)) return false;
    if (!isRangeTarget(targetType)) return true;

    return Number(row.min_qty) === Number(minQty)
        && sameOptionalNumber(row.max_qty, maxQty);
}

function resolveImportTargetRow(importContext, errors) {
    const {
        product,
        targetType,
        branch,
        productUnit,
        minQty,
        maxQty,
        newPrice,
        excelRow,
    } = importContext;

    const existingFormRow = selectedRows.value.find((row) => rowMatchesImportTarget(row, importContext));
    if (existingFormRow) {
        return {
            ...existingFormRow,
            new_price: newPrice,
        };
    }

    const candidates = buildCreateTargetRows(product).filter((row) => (
        row.target_type === targetType
        && Number(row.branch_id || 0) === Number(branch?.id || 0)
        && Number(row.product_unit_id || 0) === Number(productUnit?.id || productUnit?.product_unit_id || 0)
    ));

    const exactTarget = candidates.find((row) => (
        !isRangeTarget(targetType)
        || (Number(row.min_qty) === Number(minQty) && sameOptionalNumber(row.max_qty, maxQty))
    ));
    if (exactTarget) {
        return {
            ...exactTarget,
            new_price: newPrice,
        };
    }

    if (!isRangeTarget(targetType)) {
        errors.push('The requested price target could not be resolved for this product.');
        return null;
    }

    const baseRange = candidates[0];
    if (!baseRange) {
        errors.push('The requested range target could not be resolved for this product and unit.');
        return null;
    }

    return {
        ...baseRange,
        rowKey: `${baseRange.rowKey}:import:${excelRow}`,
        is_custom: true,
        product_unit_price_range_id: null,
        branch_product_unit_price_range_id: null,
        will_create_branch_price: !!branch?.id,
        min_qty: minQty,
        max_qty: maxQty,
        new_price: newPrice,
    };
}

function importTargetKey(row) {
    return [
        row.product?.id || 0,
        row.targetType,
        row.branch?.id || 0,
        row.productUnit?.id || row.productUnit?.product_unit_id || 0,
        isRangeTarget(row.targetType) ? row.minQty : '-',
        isRangeTarget(row.targetType) ? (row.maxQty ?? 'open') : '-',
    ].join(':');
}

function rangeBoundaryKey(row) {
    return `${Number(row.min_qty)}:${row.max_qty === null || row.max_qty === undefined || row.max_qty === '' ? 'open' : Number(row.max_qty)}`;
}

function rangeImportGroupKey(row) {
    return [
        row.product?.id || 0,
        row.targetType,
        row.branch?.id || 0,
        row.productUnit?.id || row.productUnit?.product_unit_id || 0,
    ].join(':');
}

function appendRangeLayoutErrors(importRows) {
    const groups = new Map();
    importRows
        .filter((row) => !row.errors.length && isRangeTarget(row.targetType))
        .forEach((row) => {
            const key = rangeImportGroupKey(row);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(row);
        });

    groups.forEach((groupRows) => {
        const sample = groupRows[0];
        const importedBoundaries = new Set(groupRows.map((row) => rangeBoundaryKey(row.resolvedRow)));
        const existingRangeMap = new Map();
        buildCreateTargetRows(sample.product)
            .concat(selectedRows.value)
            .filter((row) => (
                row.target_type === sample.targetType
                && Number(row.product_id) === Number(sample.product.id)
                && Number(row.branch_id || 0) === Number(sample.branch?.id || 0)
                && Number(row.product_unit_id || 0) === Number(sample.productUnit?.id || sample.productUnit?.product_unit_id || 0)
                && (row.product_unit_price_range_id || row.branch_product_unit_price_range_id || row.is_custom)
                && !importedBoundaries.has(rangeBoundaryKey(row))
            ))
            .forEach((row) => existingRangeMap.set(rangeBoundaryKey(row), { row, importRow: null }));

        const layout = [...existingRangeMap.values()]
            .concat(groupRows.map((importRow) => ({ row: importRow.resolvedRow, importRow })))
            .sort((left, right) => Number(left.row.min_qty) - Number(right.row.min_qty));

        for (let index = 0; index < layout.length - 1; index += 1) {
            const current = layout[index];
            const next = layout[index + 1];
            const currentHasNoMaximum = current.row.max_qty === null
                || current.row.max_qty === undefined
                || current.row.max_qty === '';
            const affectedImportRows = [current.importRow, next.importRow].filter(Boolean);

            if (currentHasNoMaximum) {
                affectedImportRows.forEach((row) => {
                    const message = 'Only the final quantity range can have a blank max qty.';
                    if (!row.errors.includes(message)) row.errors.push(message);
                });
                continue;
            }

            if (Number(current.row.max_qty) >= Number(next.row.min_qty)) {
                affectedImportRows.forEach((row) => {
                    const message = 'Quantity ranges overlap an existing or imported range.';
                    if (!row.errors.includes(message)) row.errors.push(message);
                });
            }
        }
    });
}

function buildImportPreviewRow(rawRow, index) {
    const errors = [];
    const warnings = [];
    const excelRow = index + 2;
    const targetType = normalizeImportTargetType(rawRow.target_type || rawRow.target);

    if (!SUPPORTED_TARGET_TYPES.has(targetType)) {
        errors.push(`Target type "${normalizeCell(rawRow.target_type || rawRow.target)}" is not supported.`);
    }

    const barcodeMatch = resolveImportBarcode(rawRow, errors);
    const product = barcodeMatch?.product || null;
    const branch = targetType ? resolveImportBranch(rawRow, targetType, errors) : null;
    const productUnit = barcodeMatch && targetType
        ? resolveImportProductUnit(rawRow, barcodeMatch, targetType, errors, warnings)
        : null;
    const importedNewPrice = normalizeCell(rawRow.new_price) ? rawRow.new_price : rawRow.price;
    const newPrice = parseImportNumber(importedNewPrice, 'New price', errors, { required: true });
    const minQty = isRangeTarget(targetType)
        ? parseImportNumber(rawRow.min_qty, 'Min qty', errors, { required: true })
        : null;
    const maxQty = isRangeTarget(targetType)
        ? parseImportNumber(rawRow.max_qty, 'Max qty', errors)
        : null;

    if (isRangeTarget(targetType) && minQty !== null && maxQty !== null && maxQty < minQty) {
        errors.push('Max qty must be greater than or equal to min qty.');
    }
    if (!isBranchTarget(targetType) && normalizeCell(rawRow.branch_name || rawRow.branch)) {
        warnings.push('Branch name is ignored for a global target.');
    }
    if (!isUomTarget(targetType) && normalizeCell(rawRow.unit_name || rawRow.uom)) {
        warnings.push('Unit name is ignored for a product-level target.');
    }
    if (!isRangeTarget(targetType) && (normalizeCell(rawRow.min_qty) || normalizeCell(rawRow.max_qty))) {
        warnings.push('Min qty and max qty are ignored for a non-range target.');
    }

    const importContext = {
        product,
        targetType,
        branch,
        productUnit,
        minQty,
        maxQty,
        newPrice,
        excelRow,
    };
    const resolvedRow = errors.length ? null : resolveImportTargetRow(importContext, errors);
    if (resolvedRow && Number(resolvedRow.old_price) === Number(newPrice)) {
        warnings.push('New price matches the current price and will not be saved unless it is changed.');
    }
    const existingFormRow = resolvedRow
        ? selectedRows.value.find((row) => rowMatchesImportTarget(row, importContext))
        : null;
    if (
        existingFormRow
        && Number(existingFormRow.new_price) !== Number(existingFormRow.old_price)
        && Number(existingFormRow.new_price) !== Number(newPrice)
    ) {
        warnings.push(`This import will replace the unsaved form price ${formatPrice(existingFormRow.new_price)}.`);
    }

    return {
        excelRow,
        rawRow,
        errors,
        warnings,
        product,
        branch,
        productUnit,
        targetType,
        minQty,
        maxQty,
        newPrice,
        resolvedRow,
    };
}

function openImportPicker() {
    if (isProductSetupLoading.value || isImporting.value) return;
    importInputRef.value?.click();
}

function closeImportPreview() {
    importPreview.value = {
        visible: false,
        fileName: '',
        rows: [],
    };
}

function worksheetFromRows(rows, widths) {
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = widths.map((width) => ({ wch: width }));
    if (rows[0]?.length) {
        worksheet['!autofilter'] = {
            ref: `A1:${XLSX.utils.encode_col(rows[0].length - 1)}1`,
        };
    }
    return worksheet;
}

function downloadImportTemplate() {
    if (isProductSetupLoading.value) return;

    const workbook = XLSX.utils.book_new();
    const importSheet = worksheetFromRows([IMPORT_COLUMNS], [20, 18, 25, 22, 12, 12, 16]);
    XLSX.utils.book_append_sheet(workbook, importSheet, 'Price Changes');

    const instructions = [
        ['Sales Price Change Import'],
        ['Enter one price target per row in the Price Changes sheet. Do not rename the column headers.'],
        ['Download a fresh template when product units or branch names have changed.'],
        [],
        ['Column', 'Required when', 'Rule'],
        ['barcode', 'Every row', 'Use the unit barcode from Product Units. A legacy product barcode is also accepted.'],
        ['unit_name', 'Optional with unit barcode', 'Used as a check; required only when the barcode does not identify a specific unit.'],
        ['target_type', 'Every row', 'Use a supported target type from Target Types.'],
        ['branch_name', 'Branch targets', 'Exact, unique branch name from Branches.'],
        ['min_qty', 'Range targets', 'Number greater than or equal to zero.'],
        ['max_qty', 'Optional range field', 'Blank means no maximum; only the final range may be blank.'],
        ['new_price', 'Every row', 'Number greater than or equal to zero.'],
    ];
    XLSX.utils.book_append_sheet(
        workbook,
        worksheetFromRows(instructions, [24, 24, 70]),
        'Instructions',
    );

    const productUnitRows = [['barcode', 'product_name', 'unit_name', 'current_price']];
    productList.value.forEach((product) => {
        productUnits(product).forEach((productUnit) => {
            productUnitRows.push([
                normalizeCell(productUnit.barcode || product.barcode),
                normalizeCell(product.name),
                unitName(productUnit),
                toNumber(productUnit.price, product.price || 0),
            ]);
        });
    });
    XLSX.utils.book_append_sheet(
        workbook,
        worksheetFromRows(productUnitRows, [20, 32, 22, 16]),
        'Product Units',
    );

    const branchRows = [['branch_name'], ...branchOptions.value.map((branch) => [normalizeCell(branch.name)])];
    XLSX.utils.book_append_sheet(workbook, worksheetFromRows(branchRows, [30]), 'Branches');

    const targetRows = [
        ['target_type', 'description'],
        ...CREATE_PRICE_CHANGE_TARGETS.map((target) => [target.value, target.label]),
    ];
    XLSX.utils.book_append_sheet(workbook, worksheetFromRows(targetRows, [28, 42]), 'Target Types');

    XLSX.writeFile(workbook, 'sales_price_change_import_template.xlsx');
}

async function onImportExcel(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    if (!/\.xlsx?$/i.test(file.name)) {
        toast.add({
            severity: 'error',
            summary: 'Import Failed',
            detail: 'Please select an .xlsx or .xls file.',
            life: 3500,
        });
        if (event?.target) event.target.value = '';
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        toast.add({
            severity: 'error',
            summary: 'Import Failed',
            detail: 'The Excel file must be 5 MB or smaller.',
            life: 3500,
        });
        if (event?.target) event.target.value = '';
        return;
    }

    isImporting.value = true;
    try {
        const workbook = await readWorkbookFromFile(file);
        const rows = readNormalizedSheetRows(workbook, IMPORT_SHEET_NAMES).filter((row) => (
            IMPORT_COLUMNS.some((column) => normalizeCell(row[column]))
            || importBarcode(row)
        ));
        if (!rows.length) {
            toast.add({
                severity: 'error',
                summary: 'Import Failed',
                detail: 'No price change rows were found in the Price Changes sheet.',
                life: 4000,
            });
            return;
        }

        const previewRows = rows.map(buildImportPreviewRow);
        const seenTargets = new Map();
        previewRows.forEach((row) => {
            if (!row.resolvedRow) return;
            const key = importTargetKey(row);
            if (seenTargets.has(key)) {
                row.errors.push(`Duplicates Excel row ${seenTargets.get(key)}.`);
                return;
            }
            seenTargets.set(key, row.excelRow);
        });
        appendRangeLayoutErrors(previewRows);

        importPreview.value = {
            visible: true,
            fileName: file.name,
            rows: previewRows,
        };
    } catch (error) {
        console.error('Sales price change Excel import failed.', error);
        toast.add({
            severity: 'error',
            summary: 'Import Failed',
            detail: 'Unable to read this Excel file. Download a fresh template and try again.',
            life: 4000,
        });
    } finally {
        isImporting.value = false;
        if (event?.target) event.target.value = '';
    }
}

function preferredTabForTarget(targetType) {
    if (isRangeTarget(targetType)) return 'RANGE';
    if (isBranchTarget(targetType)) return 'BRANCH';
    return 'GLOBAL';
}

function confirmPriceChangeImport() {
    if (importErrorCount.value || !importValidRows.value.length) return;

    const nextRows = selectedRows.value.map((row) => ({ ...row }));
    const importedProducts = new Map();
    importValidRows.value.forEach((row) => importedProducts.set(Number(row.product.id), row.product));

    const rowsByKey = new Map(nextRows.map((row) => [row.rowKey, row]));
    importedProducts.forEach((product) => {
        buildCreateTargetRows(product).forEach((row) => {
            if (rowsByKey.has(row.rowKey)) return;
            const clonedRow = { ...row };
            nextRows.push(clonedRow);
            rowsByKey.set(clonedRow.rowKey, clonedRow);
        });
    });

    const initializedProductTabs = new Set();
    importValidRows.value.forEach((importRow) => {
        const resolvedRow = { ...importRow.resolvedRow };
        const existingRow = rowsByKey.get(resolvedRow.rowKey);
        if (existingRow) {
            existingRow.new_price = resolvedRow.new_price;
            existingRow.min_qty = resolvedRow.min_qty;
            existingRow.max_qty = resolvedRow.max_qty;
        } else {
            nextRows.push(resolvedRow);
            rowsByKey.set(resolvedRow.rowKey, resolvedRow);
        }

        const state = productState(importRow.product.id);
        if (importRow.branch?.id && !state.branchIds.some((id) => Number(id) === Number(importRow.branch.id))) {
            state.branchIds = [...state.branchIds, Number(importRow.branch.id)];
        }
        if (!initializedProductTabs.has(Number(importRow.product.id))) {
            state.tab = preferredTabForTarget(importRow.targetType);
            initializedProductTabs.add(Number(importRow.product.id));
        }
    });

    selectedRows.value = nextRows;
    expandedProductIds.value = [
        ...new Set([
            ...expandedProductIds.value.map(Number),
            ...importedProducts.keys(),
        ]),
    ];
    errorMsg.value.products = '';

    const appliedCount = importValidRows.value.length;
    closeImportPreview();
    toast.add({
        severity: 'success',
        summary: 'Import Applied',
        detail: `${appliedCount} price change row(s) added to the form for review.`,
        life: 3500,
    });
}

function formatImportRange(row) {
    if (!isRangeTarget(row.targetType)) return '-';
    return row.maxQty === null || row.maxQty === undefined
        ? `${row.minQty} and above`
        : `${row.minQty} to ${row.maxQty}`;
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
        will_create_branch_price: !!row.branch_id,
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
            branchIds: [],
        };
    }
    return productEditorState.value[key];
}

function selectedBranchIds(productId) {
    return productEditorState.value[String(productId)]?.branchIds || [];
}

function isBranchSelected(productId, branchId) {
    return selectedBranchIds(productId).some((id) => Number(id) === Number(branchId));
}

function isRowAvailableForEditing(row) {
    return !row.branch_id || isBranchSelected(row.product_id, row.branch_id);
}

const branchPickerOptions = computed(() => {
    const productId = Number(branchPicker.value.productId);
    if (!productId) return [];

    const branchesById = new Map();
    branchOptions.value.forEach((branch) => {
        if (branch?.id) branchesById.set(String(branch.id), branch);
    });
    selectedRows.value
        .filter((row) => Number(row.product_id) === productId && row.branch_id)
        .forEach((row) => {
            if (!branchesById.has(String(row.branch_id))) {
                branchesById.set(String(row.branch_id), {
                    id: row.branch_id,
                    name: row.branch_name,
                });
            }
        });

    const query = branchPicker.value.search.trim().toLowerCase();
    return [...branchesById.values()].map((branch) => {
        const branchRows = selectedRows.value.filter((row) => (
            Number(row.product_id) === productId
            && Number(row.branch_id) === Number(branch.id)
        ));
        return {
            ...branch,
            isAdded: isBranchSelected(productId, branch.id),
            hasExistingPrice: branchRows.some((row) => (
                row.branch_product_id
                || row.branch_product_unit_price_id
                || row.branch_product_unit_price_range_id
            )),
        };
    }).filter((branch) => (
        !query || (branch.name || '').toString().toLowerCase().includes(query)
    ));
});

const branchPickerProductName = computed(() => (
    selectedRows.value.find((row) => Number(row.product_id) === Number(branchPicker.value.productId))?.product_name || 'Product'
));

function openBranchPicker(productId) {
    branchPicker.value = {
        visible: true,
        productId,
        search: '',
    };
}

function closeBranchPicker() {
    branchPicker.value = {
        visible: false,
        productId: null,
        search: '',
    };
}

function addBranchToProduct(branchId) {
    const productId = branchPicker.value.productId;
    if (!productId || !branchId || isBranchSelected(productId, branchId)) return;

    const state = productState(productId);
    state.branchIds = [...state.branchIds, Number(branchId)];
    closeBranchPicker();
}

function removeBranchFromProduct(productId, branchId) {
    selectedRows.value = selectedRows.value.filter((row) => {
        const belongsToBranch = Number(row.product_id) === Number(productId)
            && Number(row.branch_id) === Number(branchId);
        if (!belongsToBranch) return true;
        if (row.is_custom) return false;

        resetRow(row);
        return true;
    });
    const state = productState(productId);
    state.branchIds = state.branchIds.filter((id) => Number(id) !== Number(branchId));
}

function activeProductTab(productId) {
    return productState(productId).tab;
}

function setProductTab(productId, tab) {
    productState(productId).tab = tab;
}

function productRowsForTab(group, tab = activeProductTab(group.product_id), visibleOnly = true) {
    const sourceRows = (visibleOnly ? group.visibleRows : group.rows).filter(isRowAvailableForEditing);
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
                branch_id: row.branch_id,
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
        inheritedCount: group.rows.filter((row) => row.inherits_global_price).length,
        createCount: group.rows.filter((row) => row.will_create_branch_price).length,
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

    selectedRows.value.filter(isRowAvailableForEditing).forEach((row) => {
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

    const rowError = validatePriceChangeRows(rowsWithSyncedGlobalProductPrices(changedRows.value));
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
        products: rowsWithSyncedGlobalProductPrices(changedRows.value).map(payloadForTargetRow),
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
        buildPromotionConflictTargets(rowsWithSyncedGlobalProductPrices(changedRows.value)),
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
                                    <span class="text-xs text-gray-500">Select products manually or import product price targets from Excel</span>
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

                                <div class="flex flex-wrap items-end gap-2">
                                    <input
                                        ref="importInputRef"
                                        type="file"
                                        accept=".xlsx,.xls"
                                        class="hidden"
                                        @change="onImportExcel"
                                    />
                                    <BaseButton
                                        label="Download Template"
                                        icon="fa fa-download"
                                        severity="secondary"
                                        :disabled="isProductSetupLoading"
                                        class="w-full sm:w-auto"
                                        @click="downloadImportTemplate"
                                    />
                                    <BaseButton
                                        :label="isImporting ? 'Reading Excel' : 'Import Excel'"
                                        :icon="isImporting ? 'fa fa-spinner' : 'fa fa-file-excel'"
                                        severity="success"
                                        :isLoading="isImporting"
                                        :disabled="isProductSetupLoading || isImporting"
                                        class="w-full sm:w-auto"
                                        @click="openImportPicker"
                                    />
                                    <BaseButton
                                        :label="isProductSetupLoading ? 'Loading Products' : 'Select Products'"
                                        :icon="isProductSetupLoading ? 'fa fa-spinner' : 'fa fa-boxes-stacked'"
                                        :isLoading="isProductSetupLoading"
                                        :disabled="isProductSetupLoading"
                                        class="w-full sm:w-auto"
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
                                            <div>
                                                <div class="text-sm font-semibold text-gray-800">Global UOM Prices</div>
                                                <div class="mt-0.5 text-xs text-gray-500">
                                                    Changing the primary UOM price also synchronizes the product's global price automatically.
                                                </div>
                                            </div>
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
                                                        <div class="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                                                            <span>{{ row.unit_name || '-' }}</span>
                                                            <span v-if="isPrimaryGlobalUomRow(row)" class="rounded bg-violet-50 px-1.5 py-0.5 font-medium text-violet-700">
                                                                Primary · syncs product price
                                                            </span>
                                                        </div>
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

                                        <div v-if="activeProductTab(group.product_id) === 'BRANCH'" class="space-y-3">
                                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <div class="text-sm font-semibold text-gray-800">Branch Prices</div>
                                                    <div class="mt-0.5 text-xs text-gray-500">Only added branches are included in this price change.</div>
                                                </div>
                                                <BaseButton label="Add Branch" icon="fa fa-plus" class="w-full sm:w-auto" @click="openBranchPicker(group.product_id)" />
                                            </div>
                                            <div v-for="branchGroup in branchGroupsForActiveTab(group)" :key="branchGroup.branch_id" class="overflow-hidden rounded border border-gray-200">
                                                <div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
                                                    <div class="font-medium text-black">{{ branchGroup.branch_name }}</div>
                                                    <div class="flex items-center gap-2">
                                                        <div class="text-xs text-gray-500">{{ branchGroup.rows.length }} prices</div>
                                                        <button
                                                            type="button"
                                                            class="flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-red-50 hover:text-red-600"
                                                            :aria-label="`Remove ${branchGroup.branch_name}`"
                                                            title="Remove branch"
                                                            @click="removeBranchFromProduct(group.product_id, branchGroup.branch_id)"
                                                        >
                                                            <i class="fa fa-xmark"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div v-if="branchGroup.createCount" class="border-b border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
                                                    No branch price configured for {{ branchGroup.createCount === branchGroup.rows.length ? 'this branch' : 'some targets' }}.
                                                    Current values inherit the global price. A branch price will be created when this price change becomes effective.
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
                                                            <div v-if="row.inherits_global_price" class="text-[11px] leading-4 text-blue-700">{{ row.old_price_source }}</div>
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
                                            <div v-if="!branchGroupsForActiveTab(group).length" class="rounded border border-dashed border-gray-300 px-4 py-6 text-center">
                                                <div class="text-sm font-medium text-gray-700">No branch added</div>
                                                <div class="mt-1 text-xs text-gray-500">Add a branch to configure its product and UOM prices.</div>
                                            </div>
                                        </div>

                                        <div v-if="activeProductTab(group.product_id) === 'RANGE'" class="space-y-2">
                                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <div class="text-sm font-semibold text-gray-800">Range Prices</div>
                                                    <div class="mt-0.5 text-xs text-gray-500">Branch ranges appear after their branch is added.</div>
                                                </div>
                                                <BaseButton label="Add Branch" icon="fa fa-plus" severity="secondary" class="w-full sm:w-auto" @click="openBranchPicker(group.product_id)" />
                                            </div>
                                            <div class="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
                                                <div v-for="rangeGroup in rangeGroupsForActiveTab(group)" :key="rangeGroup.key" class="rounded border border-gray-200 p-3">
                                                    <div class="font-medium text-black">{{ targetLabel(rangeGroup.target_type) }}</div>
                                                    <div class="mt-1 text-xs text-gray-500">{{ rangeGroup.branch_name }} / {{ rangeGroup.unit_name }}</div>
                                                    <div v-if="rangeGroup.createCount" class="mt-2 text-xs leading-4 text-blue-700">
                                                        Uses the inherited base price. Branch range prices will be created when this change becomes effective.
                                                    </div>
                                                    <div class="mt-3 flex items-center justify-between text-sm">
                                                        <span>{{ rangeGroup.rangeCount }} ranges</span>
                                                        <span class="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">{{ rangeGroup.changedCount }} changed</span>
                                                    </div>
                                                    <BaseButton label="Manage Ranges" icon="fa fa-sliders" severity="secondary" class="mt-3 w-full" @click="openRangeModal(rangeGroup)" />
                                                </div>
                                            </div>
                                        </div>

                                        <div v-if="activeProductTab(group.product_id) !== 'BRANCH' && !currentTabRows(group).length" class="rounded border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
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

    <div
        v-if="branchPicker.visible"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 text-black"
        role="dialog"
        aria-modal="true"
        aria-labelledby="branch-picker-title"
        @keydown.esc="closeBranchPicker"
    >
        <div class="absolute inset-0 bg-black opacity-50" @click="closeBranchPicker"></div>
        <div class="z-10 flex max-h-[82vh] w-full max-w-xl flex-col overflow-hidden rounded bg-white p-4 shadow-lg">
            <div class="flex items-start justify-between gap-3 border-b pb-3">
                <div class="min-w-0">
                    <div id="branch-picker-title" class="text-lg font-semibold">Add Branch Price</div>
                    <div class="mt-1 truncate text-sm text-gray-500">{{ branchPickerProductName }}</div>
                </div>
                <button
                    type="button"
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-black"
                    aria-label="Close branch picker"
                    title="Close"
                    @click="closeBranchPicker"
                >
                    <i class="fa fa-xmark"></i>
                </button>
            </div>

            <div class="relative py-3">
                <input
                    v-model="branchPicker.search"
                    type="search"
                    placeholder="Search branches"
                    aria-label="Search branches"
                    class="h-[38px] w-full rounded border border-gray-300 px-3 pr-10 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                />
                <i class="fa fa-magnifying-glass pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            </div>

            <div class="min-h-0 space-y-2 overflow-y-auto">
                <button
                    v-for="branch in branchPickerOptions"
                    :key="branch.id"
                    type="button"
                    class="flex w-full items-center justify-between gap-3 rounded border border-gray-200 px-3 py-3 text-left disabled:cursor-default disabled:bg-gray-50"
                    :class="branch.isAdded ? 'text-gray-500' : 'hover:border-blue-300 hover:bg-blue-50'"
                    :disabled="branch.isAdded"
                    @click="addBranchToProduct(branch.id)"
                >
                    <div class="min-w-0">
                        <div class="truncate font-medium">{{ branch.name }}</div>
                        <div class="mt-0.5 text-xs" :class="branch.hasExistingPrice ? 'text-gray-500' : 'text-blue-700'">
                            {{ branch.hasExistingPrice ? 'Existing branch pricing' : 'Currently inherits global prices' }}
                        </div>
                    </div>
                    <span v-if="branch.isAdded" class="rounded bg-gray-200 px-2 py-1 text-xs">Added</span>
                    <i v-else class="fa fa-plus text-blue-600"></i>
                </button>
                <div v-if="!branchPickerOptions.length" class="rounded border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                    No branches found
                </div>
            </div>
        </div>
    </div>

    <div
        v-if="importPreview.visible"
        class="fixed inset-0 z-[70] flex items-center justify-center p-4 text-black"
        role="dialog"
        aria-modal="true"
        aria-labelledby="price-change-import-title"
        @keydown.esc="closeImportPreview"
    >
        <div class="absolute inset-0 bg-black/50" @click="closeImportPreview"></div>
        <div class="z-10 flex max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div class="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 id="price-change-import-title" class="text-lg font-semibold">Review Excel Import</h2>
                    <p class="mt-1 text-sm text-gray-500">{{ importPreview.fileName }}</p>
                </div>
                <button
                    type="button"
                    class="flex h-8 w-8 shrink-0 items-center justify-center self-end rounded text-gray-500 hover:bg-gray-100 hover:text-black sm:self-auto"
                    aria-label="Close import preview"
                    title="Close"
                    @click="closeImportPreview"
                >
                    <i class="fa fa-xmark"></i>
                </button>
            </div>

            <div class="grid grid-cols-2 gap-3 border-b bg-gray-50 p-4 sm:grid-cols-4">
                <div class="rounded border border-gray-200 bg-white p-3">
                    <div class="text-xs uppercase tracking-wide text-gray-500">Total rows</div>
                    <div class="mt-1 text-xl font-semibold">{{ importPreview.rows.length }}</div>
                </div>
                <div class="rounded border border-green-200 bg-green-50 p-3 text-green-800">
                    <div class="text-xs uppercase tracking-wide">Ready</div>
                    <div class="mt-1 text-xl font-semibold">{{ importValidRows.length }}</div>
                </div>
                <div class="rounded border border-red-200 bg-red-50 p-3 text-red-800">
                    <div class="text-xs uppercase tracking-wide">Invalid</div>
                    <div class="mt-1 text-xl font-semibold">{{ importErrorCount }}</div>
                </div>
                <div class="rounded border border-amber-200 bg-amber-50 p-3 text-amber-800">
                    <div class="text-xs uppercase tracking-wide">With warnings</div>
                    <div class="mt-1 text-xl font-semibold">{{ importWarningCount }}</div>
                </div>
            </div>

            <div class="min-h-0 flex-1 overflow-auto">
                <table class="w-full min-w-[1120px] text-sm">
                    <thead class="sticky top-0 z-[1] bg-white">
                        <tr class="border-b text-left text-gray-600">
                            <th class="p-3">Excel row</th>
                            <th class="p-3">Product</th>
                            <th class="p-3">Target</th>
                            <th class="p-3">Branch / Unit</th>
                            <th class="p-3">Range</th>
                            <th class="p-3 text-right">Current price</th>
                            <th class="p-3 text-right">New price</th>
                            <th class="p-3 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <template v-for="row in importPreview.rows" :key="row.excelRow">
                            <tr class="border-b border-gray-100 align-top" :class="row.errors.length ? 'bg-red-50/40' : ''">
                                <td class="p-3 font-medium">{{ row.excelRow }}</td>
                                <td class="p-3">
                                    <div class="font-medium">{{ row.product?.name || 'Unresolved product' }}</div>
                                    <div class="mt-0.5 text-xs text-gray-500">{{ importBarcode(row.rawRow) || '-' }}</div>
                                </td>
                                <td class="p-3">{{ row.targetType ? targetLabel(row.targetType) : '-' }}</td>
                                <td class="p-3">
                                    <div>{{ row.branch?.name || (isBranchTarget(row.targetType) ? '-' : 'All branches') }}</div>
                                    <div class="mt-0.5 text-xs text-gray-500">{{ row.productUnit ? unitName(row.productUnit) : (isUomTarget(row.targetType) ? '-' : 'Product level') }}</div>
                                </td>
                                <td class="p-3">{{ formatImportRange(row) }}</td>
                                <td class="p-3 text-right tabular-nums">{{ row.resolvedRow ? formatPrice(row.resolvedRow.old_price) : '-' }}</td>
                                <td class="p-3 text-right font-medium tabular-nums">{{ row.newPrice === null ? '-' : formatPrice(row.newPrice) }}</td>
                                <td class="p-3 text-center">
                                    <span v-if="row.errors.length" class="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700">Invalid</span>
                                    <span v-else-if="row.warnings.length" class="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">Warning</span>
                                    <span v-else class="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700">Ready</span>
                                </td>
                            </tr>
                            <tr v-if="row.errors.length || row.warnings.length" class="border-b border-gray-200">
                                <td colspan="8" class="px-3 pb-3 pt-1">
                                    <div v-for="message in row.errors" :key="`error:${message}`" class="mt-1 text-sm text-red-700">
                                        <i class="fa fa-circle-xmark mr-1"></i>{{ message }}
                                    </div>
                                    <div v-for="message in row.warnings" :key="`warning:${message}`" class="mt-1 text-sm text-amber-700">
                                        <i class="fa fa-triangle-exclamation mr-1"></i>{{ message }}
                                    </div>
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>

            <div class="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
                <p class="text-sm" :class="importErrorCount ? 'text-red-700' : 'text-gray-500'">
                    {{ importErrorCount
                        ? 'Fix every invalid row and import the file again. No rows have been added to the form.'
                        : 'Ready rows will be added to the form for review. Saving still runs the normal validation and promotion checks.' }}
                </p>
                <div class="flex shrink-0 justify-end gap-2">
                    <BaseButton severity="secondary" label="Close" @click="closeImportPreview" />
                    <BaseButton
                        :label="`Apply ${importValidRows.length} Row${importValidRows.length === 1 ? '' : 's'}`"
                        icon="fa fa-check"
                        :disabled="importErrorCount > 0 || !importValidRows.length"
                        @click="confirmPriceChangeImport"
                    />
                </div>
            </div>
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
