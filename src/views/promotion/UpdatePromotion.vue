<script setup>
import { useRoute, useRouter } from 'vue-router';
import { watch, ref, computed, onMounted, onBeforeUnmount } from 'vue';
import moment from 'moment';
import BaseInput from '@/components/BaseInput.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import BaseTextarea from '@/components/BaseTextarea.vue';
import BaseButton from '@/components/BaseButton.vue';
import { errMsgList, getPromotionLifecycleStatusName, getPromotionStatusId, statusBadgeHtml } from '@/utils/const';
import { useToast } from 'primevue';
import { usePromotionStore } from '@/stores/usePromotionStore';
import PageTitle from '@/components/PageTitle.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import Loading from '@/components/Loading.vue';
import { useProductStore } from '@/stores/useProductStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useStatusStore } from '@/stores/useStatusStore';
import {
    productUnitOptions,
    promotionProductPayload,
    promotionUomPayload,
    selectedUnitPrice,
    withPromotionUnit,
} from '@/utils/promotionUom';
import {
    distinctFocRewards,
    focAllocationKey,
    focAllocationPayload,
    mapFocAllocationValidationErrors,
    mergeFocAvailability,
    syncFocAllocationMatrix,
    validateFocAllocationMatrix,
} from '@/utils/focAllocations';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const usePromo = usePromotionStore();
const useProduct = useProductStore();
const useBranch = useBranchStore();
const useInventory = useInventoryStore();
const useStatus = useStatusStore();

const promoId = ref(route.query.id || route.params.id || null);
const userData = ref({});
const formData = ref({
    name: '',
    description: '',
    promoType: 'PRODUCT_DISCOUNT',
    discountType: 'AMOUNT',
    discountValue: 0,
    conditionType: 'ORDER_AMOUNT',
    conditionProductId: '',
    overridePrice: 0,
    branchScopeType: 'ALL',
    warehouseScopeType: 'ALL',
    targetValue: 0,
    rewardProductId: '',
    rewardQty: 1,
    startDate: moment().format('YYYY-MM-DD HH:mm:ss'),
    endDate: moment().add(1, 'days').format('YYYY-MM-DD HH:mm:ss'),
    warehouseId: '',
});
const selectedProducts = ref([]);
const initialPromotionProductsFingerprint = ref('[]');
const focConditionProduct = ref(null);
const focRewardProducts = ref([]);
const focAllocations = ref([]);
const focAllocationErrors = ref({});
const focAllocationGeneralErrors = ref([]);
const isFocAvailabilityLoading = ref(false);
const focAvailabilityError = ref('');
let focAvailabilityTimer = null;
let focAvailabilityRequestId = 0;
const orderDiscountTiers = ref([
    {
        condition_type: 'ORDER_AMOUNT',
        target_value: 0,
        discount_type: 'AMOUNT',
        discount_value: 0,
    }
]);
const promoMode = ref('TIER');
const maxDiscountAmount = ref(0);
const focTiers = ref([
    {
        condition_type: 'ORDER_AMOUNT',
        target_value: 0,
        conditionProductId: '',
        conditionProductUnitId: '',
        rewards: [],
    }
]);
const priceOverrideTiers = ref([
    {
        condition_type: 'ORDER_QTY',
        target_value: 0,
        conditionProductId: '',
        rewards: [],
    }
]);
const loadedPromotionStatusName = ref('Active');
const isProductDialogVisible = ref(false);
const productDialogMode = ref('PRODUCT_DISCOUNT');
const productList = ref([]);
const searchTerm = ref('');
const selectionBuffer = ref([]);
const headerCheckboxRef = ref(null);
const isCheckingAll = ref(false);
const isSelectAllLoading = ref(false);
const focTierEditIndex = ref(null);
const selectedBranch = ref([]);
const persistedBranchIds = ref([]);
const persistedWarehouseIds = ref([]);
const branchSearchTerm = ref('');
const isInitLoading = ref(true);

const errorMsg = ref({
    name: "",
    branch: "",
    promoType: "",
    conditionType: "",
    targetValue: "",
    conditionProductId: "",
    rewardProductId: "",
    rewardQty: "",
    discountType: "",
    discountValue: "",
    products: "",
    startDate: "",
    endDate: "",
});

const promotionTypeOptions = [
    {
        value: 'PRODUCT_DISCOUNT',
        label: 'Product discount',
        description: 'Reduce the price of selected products.',
        icon: 'fa fa-tags',
    },
    {
        value: 'ORDER_DISCOUNT',
        label: 'Order discount',
        description: 'Reward customers when an order reaches a target.',
        icon: 'fa fa-receipt',
    },
    {
        value: 'FOC',
        label: 'Free item (FOC)',
        description: 'Give free products when conditions are met.',
        icon: 'fa fa-gift',
    },
    {
        value: 'PRICE_OVERRIDE',
        label: 'Price override',
        description: 'Sell selected products at a fixed promotional price.',
        icon: 'fa fa-money-bill-wave',
    },
];

const isProductDiscount = computed(() => formData.value.promoType === 'PRODUCT_DISCOUNT');
const isOrderDiscount = computed(() => formData.value.promoType === 'ORDER_DISCOUNT');
const isPriceOverride = computed(() => formData.value.promoType === 'PRICE_OVERRIDE');
const isFOC = computed(() => formData.value.promoType === 'FOC');
const isItemCondition = computed(() => ['ITEM_QTY', 'ITEM_AMOUNT'].includes(formData.value.conditionType));
const isSingleSelectionDialog = computed(() => productDialogMode.value === 'FOC_CONDITION');
const productDialogTitle = computed(() => {
    if (productDialogMode.value === 'FOC_CONDITION') return 'Select Condition Product';
    if (productDialogMode.value === 'FOC_REWARD') return 'Select Reward Products';
    return 'Select Products';
});
const autoPromoStatusName = computed(() => (
    getPromotionLifecycleStatusName(formData.value.startDate, formData.value.endDate)
));
const autoPromoStatusId = computed(() => getPromotionStatusId(useStatus, autoPromoStatusName.value));
const isAppliedPromotion = computed(() => loadedPromotionStatusName.value === 'Applied');
const isInactivePromotion = computed(() => loadedPromotionStatusName.value === 'Inactive');
const locksPromotionRules = computed(() => isAppliedPromotion.value || isInactivePromotion.value);
const selectedPromotionType = computed(() => (
    promotionTypeOptions.find(option => option.value === formData.value.promoType)
));
const priceOverrideTargetQty = computed(() => (
    Number(priceOverrideTiers.value[0]?.target_value) || 0
));
const priceOverrideAverage = computed(() => {
    if (priceOverrideTargetQty.value <= 0) return 0;
    return Math.round((Number(formData.value.overridePrice) || 0) / priceOverrideTargetQty.value);
});
const filteredProducts = computed(() => {
    const q = (searchTerm.value || '').toString().trim().toLowerCase();
    if (!q) return productList.value || [];
    return (productList.value || []).filter(p => {
        const name = (p.name || '').toString().toLowerCase();
        const barcode = (p.barcode || '').toString().toLowerCase();
        return name.includes(q) || barcode.includes(q);
    });
});

function changeRoute(pathname) {
    router.push(pathname);
}

function scrollToSection(sectionId) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearErrors() {
    focAllocationErrors.value = {};
    focAllocationGeneralErrors.value = [];
    errorMsg.value = {
        name: "",
        branch: "",
        promoType: "",
        conditionType: "",
        targetValue: "",
        conditionProductId: "",
        rewardProductId: "",
        rewardQty: "",
        discountType: "",
        discountValue: "",
        products: "",
        startDate: "",
        endDate: "",
    };
}

onMounted(async () => {
    isInitLoading.value = true;
    try {
        userData.value = JSON.parse(localStorage.getItem('user'));
        await Promise.all([
            useProduct.fetchAllProduct(),
            useBranch.fetchAllBranch(),
            useStatus.fetchAllStatus(),
        ]);
        productList.value = useProduct.productList || [];

        if (promoId.value) {
            await usePromo.fetchPromo(promoId.value);
            const promo = usePromo.promoList || {};
            console.log('Fetched promo:', promo);
            // Fill form fields from API response
            formData.value.name = promo.name || '';
            formData.value.description = promo.description || '';
            formData.value.promoType = promo.promo_type || 'PRODUCT_DISCOUNT';
            formData.value.discountType = promo.discount_type || 'AMOUNT';
            formData.value.discountValue = Number(promo.discount_value) || 0;
            formData.value.overridePrice = Number(promo.override_price) || 0;
            formData.value.branchScopeType = promo.promo_type === 'FOC'
                ? 'SELECTED'
                : (promo.branch_scope_type || 'ALL');
            formData.value.warehouseScopeType = promo.warehouse_scope_type || formData.value.branchScopeType;
            formData.value.startDate = promo.start_at || formData.value.startDate;
            formData.value.endDate = promo.end_at || formData.value.endDate;
            loadedPromotionStatusName.value = getPromotionLifecycleStatusName(promo.start_at, promo.end_at);
            promoMode.value = promo.promo_mode || 'TIER';
            maxDiscountAmount.value = Number(promo.max_reward_value) || 0;
            const promotionBranches = Array.isArray(promo.branches) ? promo.branches : [];
            persistedBranchIds.value = promotionBranches
                .map(branch => Number(branch.id))
                .filter(Boolean);
            persistedWarehouseIds.value = (Array.isArray(promo.warehouses) ? promo.warehouses : [])
                .map(warehouse => Number(warehouse.id))
                .filter(Boolean);

            if (formData.value.branchScopeType === 'SELECTED') {
                const allocationBranches = promo.promo_type === 'FOC' && Array.isArray(promo.foc_allocations)
                    ? promo.foc_allocations.map(allocation => allocation.branch).filter(Boolean)
                    : [];
                const branchIds = new Set([
                    ...promotionBranches.map(branch => branch.id),
                    ...(promo.promo_type === 'FOC' && Array.isArray(promo.foc_allocations)
                        ? promo.foc_allocations.map(allocation => allocation.branch_id ?? allocation.branch?.id)
                        : []),
                ].map(Number).filter(Boolean));
                const branchesById = new Map([
                    ...promotionBranches,
                    ...allocationBranches,
                    ...branchOptions.value,
                ].map(branch => [Number(branch.id), branch]));
                selectedBranch.value = Array.from(branchIds)
                    .map(branchId => branchesById.get(branchId))
                    .filter(Boolean);
            }

            // PRODUCT_DISCOUNT
            if (['PRODUCT_DISCOUNT', 'PRICE_OVERRIDE'].includes(promo.promo_type)) {
                if (Array.isArray(promo.products) && promo.products.length > 0) {
                    if (typeof promo.products[0] === 'object') {
                        selectedProducts.value = promo.products.map((promotionProduct) => ({
                            ...withPromotionUnit({
                                ...(productList.value.find(product => product.id === promotionProduct.id) || {}),
                                ...promotionProduct,
                                product_unit_id: promotionProduct.promotion_product_unit_id ?? null,
                                unit_id: promotionProduct.promotion_unit_id ?? null,
                            }, promotionProduct.promotion_product_unit_id),
                            ...(promo.promo_type === 'PRICE_OVERRIDE' ? {
                                max_qty_per_sales_order: promotionProduct.max_qty_per_sales_order ?? null,
                            } : {}),
                        }));
                    } else {
                        selectedProducts.value = promo.products
                            .map(id => withPromotionUnit(productList.value.find(product => product.id === id)))
                            .filter(Boolean)
                            .map(product => ({
                                ...product,
                                ...(promo.promo_type === 'PRICE_OVERRIDE' ? { max_qty_per_sales_order: null } : {}),
                            }));
                    }
                }

                initialPromotionProductsFingerprint.value = promotionProductsFingerprint(
                    selectedProducts.value,
                    promo.promo_type === 'PRICE_OVERRIDE',
                );
            }

            if (promo.promo_type === 'PRICE_OVERRIDE' && Array.isArray(promo.conditions)) {
                const firstCondition = promo.conditions[0] || {};
                priceOverrideTiers.value = [{
                    condition_type: 'ORDER_QTY',
                    target_value: Number(firstCondition.target_value) || 0,
                    conditionProductId: '',
                    rewards: [],
                }];
                syncPriceOverrideMode();
            }

            // ORDER_DISCOUNT
            if (promo.promo_type === 'ORDER_DISCOUNT' && Array.isArray(promo.conditions)) {
                orderDiscountTiers.value = promo.conditions.map((cond, idx) => {
                    const reward = (promo.rewards || []).find(r => r.tier === cond.tier);
                    return {
                        condition_type: cond.condition_type,
                        target_value: Number(cond.target_value),
                        discount_type: reward?.reward_type === 'PERCENT' ? 'PERCENT' : 'AMOUNT',
                        discount_value: Number(reward?.reward_value) || 0,
                    };
                });
            }

            // FOC
            if (promo.promo_type === 'FOC' && Array.isArray(promo.conditions)) {
                focTiers.value = promo.conditions.map((cond, idx) => {
                    const rewards = (promo.rewards || []).filter(r => r.tier === cond.tier && r.reward_type === 'FREE_PRODUCT');
                    return {
                        condition_type: cond.condition_type,
                        target_value: Number(cond.target_value),
                        conditionProductId: cond.product?.id || '',
                        conditionProductUnitId: cond.uom?.product_unit_id || '',
                        rewards: rewards.map(r => ({
                            ...withPromotionUnit({
                                ...(productList.value.find(product => product.id === r.product?.id) || {}),
                                ...(r.product || {}),
                            }, r.uom?.product_unit_id),
                            rewardQty: Number(r.reward_qty) || 1,
                        })),
                    };
                });
            }

            if (promo.promo_type === 'FOC' && Array.isArray(promo.foc_allocations)) {
                focAllocations.value = promo.foc_allocations.map((allocation) => ({
                    allocationId: allocation.id ?? null,
                    branchId: allocation.branch_id ?? allocation.branch?.id,
                    branchName: allocation.branch?.name ?? '',
                    warehouseId: allocation.allocated_warehouse_id ?? allocation.warehouse?.id ?? null,
                    warehouseName: allocation.warehouse?.name ?? '',
                    productId: allocation.product?.id ?? allocation.product_id,
                    productName: allocation.product?.name ?? allocation.name ?? '',
                    imageUrl: allocation.product?.image_url ?? allocation.image_url ?? '',
                    productUnitId: allocation.product_unit_id ?? allocation.uom?.product_unit_id ?? null,
                    allocatedQty: Number(allocation.allocated_qty ?? allocation.uom?.unit_quantity ?? allocation.allocatedQty) || 1,
                    usedQty: Number(allocation.used_qty ?? allocation.uom?.used_quantity ?? 0),
                    availableQty: allocation.available_qty ?? null,
                }));
                syncFocAllocations();
            }
        }
    } finally {
        isInitLoading.value = false;
    }
});

const branchOptions = computed(() => useBranch.branchList || []);

const filteredBranchOptions = computed(() => {
    const query = branchSearchTerm.value.trim().toLowerCase();
    if (!query) return branchOptions.value;

    return branchOptions.value.filter((branch) => (
        branch.name?.toLowerCase().includes(query)
        || branch.warehouse?.name?.toLowerCase().includes(query)
    ));
});

const selectedBranchIds = computed(() => (
    formData.value.branchScopeType === 'ALL'
        ? []
        : selectedBranch.value.map(branch => branch.id)
));

const selectedWarehouseIds = computed(() => {
    if (formData.value.branchScopeType === 'ALL') return [];

    return [
        ...new Set(
            selectedBranch.value
                .map(branch => branch.warehouse?.id)
                .filter(Boolean)
        )
    ];
});

const selectedWarehouseNames = computed(() => {
    const warehouseById = new Map();
    selectedBranch.value.forEach((branch) => {
        const warehouse = branch.warehouse;
        if (warehouse?.id) {
            warehouseById.set(warehouse.id, warehouse.name || `Warehouse #${warehouse.id}`);
        }
    });

    return Array.from(warehouseById.values());
});

const focAllocationRewards = computed(() => distinctFocRewards(focTiers.value));

const sharedWarehouseAllocationGroups = computed(() => {
    const groups = new Map();

    focAllocations.value.forEach((allocation) => {
        if (!allocation.warehouseId) return;
        const key = `${allocation.warehouseId}:${allocation.productId}:${allocation.productUnitId || 'unit'}`;
        const group = groups.get(key) || {
            branchIds: new Set(),
            totalAllocatedQty: 0,
            availableQty: null,
        };
        group.branchIds.add(allocation.branchId);
        group.totalAllocatedQty += Number(allocation.allocatedQty) || 0;
        if (allocation.availableQty != null) group.availableQty = Number(allocation.availableQty);
        groups.set(key, group);
    });

    return groups;
});

function sharedWarehouseGroup(allocation) {
    if (!allocation.warehouseId) return null;
    return sharedWarehouseAllocationGroups.value.get(
        `${allocation.warehouseId}:${allocation.productId}:${allocation.productUnitId || 'unit'}`,
    ) || null;
}

function isSharedWarehouseAllocation(allocation) {
    return (sharedWarehouseGroup(allocation)?.branchIds.size || 0) > 1;
}

function sharedWarehouseExceedsAvailability(allocation) {
    const group = sharedWarehouseGroup(allocation);
    return group?.availableQty != null && group.totalAllocatedQty > group.availableQty;
}

function syncFocAllocations() {
    focAllocations.value = syncFocAllocationMatrix({
        branches: selectedBranch.value,
        rewards: focAllocationRewards.value,
        allocations: focAllocations.value,
    });
    focAllocationErrors.value = {};
    focAllocationGeneralErrors.value = [];
}

function resetFocAvailabilityRows() {
    focAllocations.value = focAllocations.value.map(allocation => ({
        ...allocation,
        availableQty: null,
        availabilityLoaded: false,
    }));
}

async function loadFocAvailability() {
    const requestId = ++focAvailabilityRequestId;
    const rewards = focAllocationRewards.value;

    if (!isFOC.value || selectedBranch.value.length === 0 || rewards.length === 0) {
        isFocAvailabilityLoading.value = false;
        focAvailabilityError.value = '';
        resetFocAvailabilityRows();
        return;
    }

    if (rewards.some(reward => !reward.productUnitId)) {
        isFocAvailabilityLoading.value = false;
        focAvailabilityError.value = 'Select a product unit for every reward before loading availability.';
        resetFocAvailabilityRows();
        return;
    }

    isFocAvailabilityLoading.value = true;
    focAvailabilityError.value = '';
    const availability = await useInventory.fetchFocAvailability({
        branch_ids: selectedBranch.value.map(branch => Number(branch.id)),
        items: rewards.map(reward => ({
            product_id: Number(reward.productId),
            product_unit_id: Number(reward.productUnitId),
        })),
        promotion_id: promoId.value ? Number(promoId.value) : null,
    });

    if (requestId !== focAvailabilityRequestId) return;

    if (availability === null) {
        resetFocAvailabilityRows();
        focAvailabilityError.value = useInventory.focAvailabilityError[0]
            || 'FOC availability could not be loaded. Stock will still be validated when you save.';
        isFocAvailabilityLoading.value = false;
        return;
    }

    const merged = mergeFocAvailability(focAllocations.value, availability);
    focAllocations.value = merged.allocations;
    focAvailabilityError.value = merged.missingCount > 0
        ? `Availability was not returned for ${merged.missingCount} allocation row${merged.missingCount === 1 ? '' : 's'}.`
        : '';
    isFocAvailabilityLoading.value = false;
    validateFocAllocationDraft();
}

function scheduleFocAvailabilityLoad() {
    if (focAvailabilityTimer) clearTimeout(focAvailabilityTimer);
    focAvailabilityRequestId += 1;
    focAvailabilityTimer = setTimeout(() => {
        focAvailabilityTimer = null;
        loadFocAvailability();
    }, 250);
}

function cancelFocAvailabilityLoad() {
    if (focAvailabilityTimer) clearTimeout(focAvailabilityTimer);
    focAvailabilityTimer = null;
    focAvailabilityRequestId += 1;
    isFocAvailabilityLoading.value = false;
    focAvailabilityError.value = '';
}

onBeforeUnmount(() => {
    cancelFocAvailabilityLoad();
});

function validateFocAllocationDraft() {
    const validation = validateFocAllocationMatrix({
        branches: selectedBranch.value,
        rewards: focAllocationRewards.value,
        allocations: focAllocations.value,
    });
    focAllocationErrors.value = validation.byKey;
    focAllocationGeneralErrors.value = validation.general;
}

function applyFocAllocationServerErrors() {
    const mapped = mapFocAllocationValidationErrors(
        usePromo.validationErrors,
        focAllocations.value,
    );
    focAllocationErrors.value = mapped.byKey;
    focAllocationGeneralErrors.value = mapped.general;
}

function validationErrorText(value) {
    if (Array.isArray(value)) return value.map(validationErrorText).filter(Boolean).join(' ');
    if (value && typeof value === 'object') {
        return Object.values(value).map(validationErrorText).filter(Boolean).join(' ');
    }
    return value == null ? '' : String(value);
}

function applyPromotionServerErrors() {
    errorMsg.value.products = validationErrorText(usePromo.validationErrors?.products);
    applyFocAllocationServerErrors();
}

function isBranchSelected(branch) {
    return selectedBranch.value.some(selected => selected.id === branch.id);
}

function toggleBranchSelection(branch) {
    if (locksPromotionRules.value) return;

    const exists = isBranchSelected(branch);

    if (exists) {
        selectedBranch.value = selectedBranch.value.filter(selected => selected.id !== branch.id);
        return;
    }

    selectedBranch.value = [...selectedBranch.value, branch];
}

function selectVisibleBranches() {
    if (locksPromotionRules.value) return;

    const selectedById = new Map(selectedBranch.value.map(branch => [branch.id, branch]));
    filteredBranchOptions.value.forEach(branch => selectedById.set(branch.id, branch));
    selectedBranch.value = Array.from(selectedById.values());
}

function clearBranchSelection() {
    if (locksPromotionRules.value) return;
    selectedBranch.value = [];
}

function requestPromotionTypeChange(nextType) {
    if (locksPromotionRules.value || nextType === formData.value.promoType) return;
    formData.value.promoType = nextType;
}

function openProductDialog(mode = 'PRODUCT_DISCOUNT') {
    if (locksPromotionRules.value) return;

    productDialogMode.value = mode;

    if (mode === 'PRODUCT_DISCOUNT') {
        selectionBuffer.value = selectedProducts.value.slice();
    } else if (mode === 'FOC_CONDITION') {
        selectionBuffer.value = focConditionProduct.value ? [focConditionProduct.value] : [];
    } else if (mode === 'FOC_REWARD') {
        const rewardIds = new Set(focRewardProducts.value.map(p => p.id));
        selectionBuffer.value = (productList.value || []).filter(p => rewardIds.has(p.id));
    }

    searchTerm.value = '';
    isProductDialogVisible.value = true;
}

function toggleProductInBuffer(event, product) {
    if (isSingleSelectionDialog.value) {
        selectionBuffer.value = [product];
        return;
    }

    const idx = selectionBuffer.value.findIndex(p => p.id === product.id);
    // If already selected -> unselect immediately
    if (idx !== -1) {
        selectionBuffer.value.splice(idx, 1);
        return;
    }

    if (productDialogMode.value !== 'PRODUCT_DISCOUNT') {
        selectionBuffer.value.push(product);
        return;
    }

    // Products may participate in different promotion types. The backend remains
    // authoritative for overlapping PRODUCT_DISCOUNT date ranges on save.
    selectionBuffer.value.push(product);
}

function isBufferSelected(product) {
    return selectionBuffer.value.some(p => p.id === product.id);
}

async function selectAllInBuffer() {
    if (isSingleSelectionDialog.value) return;

    if (productDialogMode.value !== 'PRODUCT_DISCOUNT') {
        const ids = new Set(selectionBuffer.value.map(p => p.id));
        const candidates = (filteredProducts.value || []).filter(p => !ids.has(p.id));
        if (candidates.length > 0) {
            selectionBuffer.value = [...selectionBuffer.value, ...candidates];
        }
        return;
    }

    if (isCheckingAll.value) return;
    isCheckingAll.value = true;
    isSelectAllLoading.value = true;
    try {
        const ids = new Set(selectionBuffer.value.map(p => p.id));
        const candidates = (filteredProducts.value || []).filter(p => !ids.has(p.id));
        if (candidates.length === 0) return;
        selectionBuffer.value = [...selectionBuffer.value, ...candidates];
    } finally {
        isCheckingAll.value = false;
        isSelectAllLoading.value = false;
    }
}

function removeFilteredFromBuffer() {
    const filteredIds = new Set((filteredProducts.value || []).map(p => p.id));
    selectionBuffer.value = selectionBuffer.value.filter(p => !filteredIds.has(p.id));
}

const allFilteredSelected = computed(() => {
    const list = filteredProducts.value || [];
    if (list.length === 0) return false;
    return list.every(p => selectionBuffer.value.some(s => s.id === p.id));
});

const someFilteredSelected = computed(() => {
    const list = filteredProducts.value || [];
    if (list.length === 0) return false;
    const some = list.some(p => selectionBuffer.value.some(s => s.id === p.id));
    return some && !allFilteredSelected.value;
});

async function toggleHeaderSelection(event) {
    if (isSingleSelectionDialog.value) return;

    const checked = event.target.checked;
    if (checked) await selectAllInBuffer();
    else removeFilteredFromBuffer();
}

// keep header checkbox indeterminate state in sync
watch([() => selectionBuffer.value, () => productList.value, () => searchTerm.value], () => {
    if (headerCheckboxRef.value) {
        headerCheckboxRef.value.indeterminate = someFilteredSelected.value;
    }
});

function confirmProductSelection() {
    if (productDialogMode.value === 'PRODUCT_DISCOUNT') {
        selectedProducts.value = selectionBuffer.value.map((product) => {
            const selectedProduct = withPromotionUnit(product);

            if (!isPriceOverride.value) return selectedProduct;

            return {
                ...selectedProduct,
                max_qty_per_sales_order: selectedProduct.max_qty_per_sales_order ?? null,
            };
        });
    }

    // FOC tier condition product selection
    if (productDialogMode.value === 'FOC_CONDITION') {
        if (focTierEditIndex.value !== null) {
            const prod = selectionBuffer.value[0] || null;
            focTiers.value[focTierEditIndex.value].conditionProductId = prod ? prod.id : '';
            focTiers.value[focTierEditIndex.value].conditionProductUnitId = prod ? defaultSelectedUnitId(prod) : '';
        }
        focTierEditIndex.value = null;
    }

    // FOC tier reward products selection
    if (productDialogMode.value === 'FOC_REWARD') {
        if (focTierEditIndex.value !== null) {
            const oldRewards = focTiers.value[focTierEditIndex.value].rewards || [];
            const rewardMap = new Map(oldRewards.map(product => [product.id, product]));
            focTiers.value[focTierEditIndex.value].rewards = selectionBuffer.value.map((product) => {
                const existing = rewardMap.get(product.id);
                return {
                    ...withPromotionUnit(product, existing?.productUnitId),
                    rewardQty: Number(existing?.rewardQty) || 1,
                };
            });

            syncFocAllocations();
        }
        focTierEditIndex.value = null;
    }

    // Legacy global FOC (single tier, not used in tier UI)
    // if (productDialogMode.value === 'FOC_CONDITION' && focTierEditIndex.value === null) {
    //     focConditionProduct.value = selectionBuffer.value[0] || null;
    //     formData.value.conditionProductId = focConditionProduct.value?.id || '';
    // }
    // if (productDialogMode.value === 'FOC_REWARD' && focTierEditIndex.value === null) {
    //     const qtyMap = new Map(focRewardProducts.value.map(p => [p.id, Number(p.rewardQty) || 1]));
    //     focRewardProducts.value = selectionBuffer.value.map((product) => ({
    //         ...product,
    //         rewardQty: qtyMap.get(product.id) ?? 1,
    //     }));
    // }

    isProductDialogVisible.value = false;
}

function cancelProductSelection() {
    isProductDialogVisible.value = false;
}

function getFinalPrice(product) {
    const price = selectedUnitPrice(product);
    const val = Number(formData.value.discountValue) || 0;
    if (formData.value.discountType === 'AMOUNT') {
        return Math.max(0, price - val);
    }
    // percentage
    return Math.max(0, price * (1 - val / 100));
}

function setMaxQtyUnlimited(product, isUnlimited) {
    if (isUnlimited) {
        const currentQty = Number(product.max_qty_per_sales_order);
        if (Number.isInteger(currentQty) && currentQty > 0) {
            product.previous_max_qty_per_sales_order = currentQty;
        }
        product.max_qty_per_sales_order = null;
        return;
    }

    const previousQty = Number(product.previous_max_qty_per_sales_order);
    product.max_qty_per_sales_order = Number.isInteger(previousQty) && previousQty > 0
        ? previousQty
        : 1;
}

function hasInvalidMaxQty(product) {
    if (product.max_qty_per_sales_order === null) return false;

    const quantity = Number(product.max_qty_per_sales_order);
    return !Number.isInteger(quantity) || quantity <= 0;
}

function priceOverridePromotionProductPayload(product) {
    return {
        ...promotionProductPayload(product),
        max_qty_per_sales_order: product.max_qty_per_sales_order === null
            ? null
            : Number(product.max_qty_per_sales_order),
    };
}

function promotionProductsFingerprint(products, includeMaxQty = false) {
    const payload = (products || []).map((product) => (
        includeMaxQty
            ? priceOverridePromotionProductPayload(product)
            : promotionProductPayload(product)
    ));

    return JSON.stringify(payload.sort((a, b) => (
        a.product_id - b.product_id
        || Number(a.product_unit_id || 0) - Number(b.product_unit_id || 0)
        || Number(a.unit_id || 0) - Number(b.unit_id || 0)
    )));
}

function promotionProductsChanged(products, includeMaxQty = false) {
    return promotionProductsFingerprint(products, includeMaxQty) !== initialPromotionProductsFingerprint.value;
}

function formatPrice(value) {
    return Number(value).toLocaleString();
}

function defaultSelectedUnitId(product) {
    return withPromotionUnit(product)?.productUnitId || '';
}

function productForTier(tier) {
    const product = productList.value.find(item => item.id == tier.conditionProductId);
    return withPromotionUnit(product, tier.conditionProductUnitId);
}

function onConditionUnitChange(tier) {
    tier.conditionProductUnitId = productForTier(tier)?.productUnitId || '';
}

function onRewardUnitChange(reward) {
    reward.productUnitId = Number(reward.productUnitId || 0) || '';
    syncFocAllocations();
}

// Helper methods for tier product selection
function selectFocTierConditionProduct(idx) {
    if (locksPromotionRules.value) return;

    productDialogMode.value = 'FOC_CONDITION';
    focTierEditIndex.value = idx;
    // Preselect current product if any
    const prodId = focTiers.value[idx].conditionProductId;
    selectionBuffer.value = prodId
        ? [withPromotionUnit(productList.value.find(p => p.id === prodId), focTiers.value[idx].conditionProductUnitId)]
        : [];
    searchTerm.value = '';
    isProductDialogVisible.value = true;
}
function selectFocTierRewardProducts(idx) {
    if (locksPromotionRules.value) return;

    productDialogMode.value = 'FOC_REWARD';
    focTierEditIndex.value = idx;
    // Preselect current rewards if any
    const rewards = focTiers.value[idx].rewards || [];
    selectionBuffer.value = rewards.map(reward => withPromotionUnit(
        productList.value.find(product => product.id === reward.id) || reward,
        reward.productUnitId
    ));
    searchTerm.value = '';
    isProductDialogVisible.value = true;
}

function syncPriceOverrideMode() {
    promoMode.value = 'MIX_MATCH';
    formData.value.conditionType = 'ORDER_QTY';
    const firstTier = priceOverrideTiers.value[0] || {};
    priceOverrideTiers.value = [{
        ...firstTier,
        condition_type: 'ORDER_QTY',
        target_value: Number(firstTier.target_value) || 0,
    }];
}

watch(() => formData.value.promoType, (type) => {
    clearErrors();

    if (type !== 'FOC') cancelFocAvailabilityLoad();

    if (type === 'PRODUCT_DISCOUNT') {
        formData.value.discountType = ['AMOUNT', 'PERCENT'].includes(formData.value.discountType)
            ? formData.value.discountType
            : 'AMOUNT';
        return;
    }

    if (type === 'ORDER_DISCOUNT') {
        if (!['ORDER_QTY', 'ORDER_AMOUNT'].includes(formData.value.conditionType)) {
            formData.value.conditionType = 'ORDER_AMOUNT';
        }
        formData.value.discountType = formData.value.discountType === 'PERCENTAGE' ? 'PERCENT' : formData.value.discountType;
        if (!['AMOUNT', 'PERCENT'].includes(formData.value.discountType)) {
            formData.value.discountType = 'AMOUNT';
        }
        return;
    }

    if (type === 'FOC') {
        formData.value.branchScopeType = 'SELECTED';
        if (!['ITEM_QTY', 'ITEM_AMOUNT', 'ORDER_QTY', 'ORDER_AMOUNT'].includes(formData.value.conditionType)) {
            formData.value.conditionType = 'ITEM_QTY';
        }
    }

    if (type === 'PRICE_OVERRIDE') {
        syncPriceOverrideMode();
        return;
    }
}, { immediate: true });

watch(() => formData.value.branchScopeType, (scopeType) => {
    if (isFOC.value && scopeType !== 'SELECTED') {
        formData.value.branchScopeType = 'SELECTED';
        return;
    }

    formData.value.warehouseScopeType = scopeType;

    if (scopeType === 'ALL') {
        selectedBranch.value = [];
    }
});

watch([selectedBranch, focAllocationRewards], () => {
    if (isFOC.value) {
        syncFocAllocations();
        scheduleFocAvailabilityLoad();
    }
}, { deep: true });

watch(() => formData.value.conditionType, (type) => {
    if (!['ITEM_QTY', 'ITEM_AMOUNT'].includes(type)) {
        formData.value.conditionProductId = '';
        focConditionProduct.value = null;
        errorMsg.value.conditionProductId = '';
    }
});


async function formSubmit() {
    clearErrors();

    if (isFOC.value) formData.value.branchScopeType = 'SELECTED';

    if (isInactivePromotion.value) {
        toast.add({
            severity: 'warn',
            summary: 'Promotion Locked',
            detail: 'Inactive promotions cannot be updated.',
            life: 3000
        });
        return;
    }

    if (formData.value.name.trim() === "") {
        errorMsg.value.name = errMsgList.name;
        scrollToSection('promotion-details');
        return;
    }

    if (!formData.value.startDate) {
        errorMsg.value.startDate = 'Start date and time is required.';
        scrollToSection('promotion-details');
        return;
    }

    if (!formData.value.endDate) {
        errorMsg.value.endDate = 'End date and time is required.';
        scrollToSection('promotion-details');
        return;
    }

    if (!moment(formData.value.endDate).isAfter(moment(formData.value.startDate))) {
        errorMsg.value.endDate = 'End date must be later than the start date.';
        scrollToSection('promotion-details');
        return;
    }

    if (isAppliedPromotion.value) {
        if (!promoId.value) {
            toast.add({ severity: 'error', summary: 'Error Message', detail: 'Missing promotion ID.', life: 3000 });
            return;
        }

        const appliedPayload = {
            name: formData.value.name.trim(),
            end_at: formData.value.endDate,
            status_id: autoPromoStatusId.value,
            updated_by: userData.value.id,
        };

        const needsBranchAssignmentRepair = formData.value.branchScopeType === 'SELECTED'
            && persistedBranchIds.value.length === 0;
        const needsWarehouseAssignmentRepair = !isFOC.value
            && formData.value.warehouseScopeType === 'SELECTED'
            && persistedWarehouseIds.value.length === 0;

        if (needsBranchAssignmentRepair && selectedBranchIds.value.length === 0) {
            errorMsg.value.branch = 'The existing selected branches could not be loaded.';
            scrollToSection('promotion-scope');
            return;
        }

        if (
            ((needsBranchAssignmentRepair && !isFOC.value) || needsWarehouseAssignmentRepair)
            && selectedWarehouseIds.value.length === 0
        ) {
            errorMsg.value.branch = 'The warehouses for the existing selected branches could not be loaded.';
            scrollToSection('promotion-scope');
            return;
        }

        if (needsBranchAssignmentRepair) {
            appliedPayload.branch_scope_type = 'SELECTED';
            appliedPayload.branch_ids = selectedBranchIds.value.map(Number);

            if (isFOC.value) {
                if (focAllocations.value.length === 0) {
                    focAllocationGeneralErrors.value = ['The existing FOC allocations could not be loaded.'];
                    scrollToSection('foc-allocation-matrix');
                    return;
                }

                appliedPayload.foc_allocations = focAllocations.value.map(
                    allocation => focAllocationPayload(allocation, true),
                );
            }
        }

        if ((needsBranchAssignmentRepair && !isFOC.value) || needsWarehouseAssignmentRepair) {
            appliedPayload.warehouse_scope_type = 'SELECTED';
            appliedPayload.warehouse_ids = selectedWarehouseIds.value;
            appliedPayload.warehouse_id = selectedWarehouseIds.value[0];
        }

        await usePromo.editPromo(appliedPayload, promoId.value);

        if (usePromo.error.length) {
            applyPromotionServerErrors();
            usePromo.error.forEach((msg) => {
                toast.add({
                    severity: 'error',
                    summary: 'Error Message',
                    detail: msg,
                    life: 3000
                });
            });
            if (errorMsg.value.products) scrollToSection('promotion-rules');
            return;
        }

        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Update promotion successfully.', life: 3000 });
        router.push('/promotion');
        return;
    }

    if (!['PRODUCT_DISCOUNT', 'ORDER_DISCOUNT', 'FOC', 'PRICE_OVERRIDE'].includes(formData.value.promoType)) {
        errorMsg.value.promoType = 'Promo type is required.';
        return;
    }

    if (formData.value.branchScopeType === 'SELECTED') {
        if (selectedBranchIds.value.length === 0) {
            errorMsg.value.branch = 'At least one branch is required.';
            return;
        }

        if (!isFOC.value && selectedWarehouseIds.value.length === 0) {
            errorMsg.value.branch = 'Selected branch must have a warehouse.';
            return;
        }
    }

    const commonPayload = {
        name: formData.value.name.trim(),
        description: formData.value.description.trim(),
        promo_type: formData.value.promoType,
        branch_scope_type: formData.value.branchScopeType,
        branch_ids: selectedBranchIds.value,
        start_at: formData.value.startDate,
        end_at: formData.value.endDate,
        status_id: autoPromoStatusId.value,
        updated_by: userData.value.id,
    };

    if (!isFOC.value) {
        commonPayload.warehouse_scope_type = formData.value.branchScopeType === 'ALL' ? 'ALL' : 'SELECTED';
        commonPayload.warehouse_ids = selectedWarehouseIds.value;
        commonPayload.warehouse_id = selectedWarehouseIds.value[0] ?? userData.value.branch.warehouse_id;
    }

    let payload = null;

    if (isProductDiscount.value) {
        if (formData.value.discountValue <= 0) {
            errorMsg.value.discountValue = errMsgList.discountValue;
            return;
        }
        if (selectedProducts.value.length === 0) {
            errorMsg.value.products = errMsgList.product;
            return;
        }
        const promotionProducts = selectedProducts.value.map(promotionProductPayload);
        payload = {
            ...commonPayload,
            discount_type: formData.value.discountType,
            discount_value: Number(formData.value.discountValue),
        };
        if (promotionProductsChanged(selectedProducts.value)) {
            payload.promotion_products = promotionProducts;
        }
    }

    if (isOrderDiscount.value) {
        for (let i = 0; i < orderDiscountTiers.value.length; i++) {
            const tier = orderDiscountTiers.value[i];
            if (!['ORDER_QTY', 'ORDER_AMOUNT'].includes(tier.condition_type)) {
                toast.add({ severity: 'error', summary: 'Tier Error', detail: `Tier ${i+1}: Condition type is required.`, life: 3000 });
                return;
            }
            if (Number(tier.target_value) <= 0) {
                toast.add({ severity: 'error', summary: 'Tier Error', detail: `Tier ${i+1}: Target value must be greater than 0.`, life: 3000 });
                return;
            }
            if (Number(tier.discount_value) <= 0) {
                toast.add({ severity: 'error', summary: 'Tier Error', detail: `Tier ${i+1}: Discount value must be greater than 0.`, life: 3000 });
                return;
            }
            if (!['AMOUNT', 'PERCENT'].includes(tier.discount_type)) {
                toast.add({ severity: 'error', summary: 'Tier Error', detail: `Tier ${i+1}: Discount type is required.`, life: 3000 });
                return;
            }
        }
        payload = {
            ...commonPayload,
            discount_type: formData.value.discountType,
            promo_type: 'ORDER_DISCOUNT',
            promo_mode: promoMode.value,
            max_reward_value: Number(maxDiscountAmount.value) > 0 ? Number(maxDiscountAmount.value) : undefined,
            tiers: orderDiscountTiers.value.map(tier => ({
                condition: {
                    condition_type: tier.condition_type,
                    target_value: Number(tier.target_value),
                },
                reward: {
                    reward_type: 'DISCOUNT',
                    reward_value: Number(tier.discount_value),
                }
            }))
        };
        if (payload.max_reward_value === undefined) delete payload.max_reward_value;
    }

    if (isFOC.value) {
        for (let i = 0; i < focTiers.value.length; i++) {
            const tier = focTiers.value[i];
            if (!['ITEM_QTY', 'ITEM_AMOUNT', 'ORDER_QTY', 'ORDER_AMOUNT'].includes(tier.condition_type)) {
                toast.add({ severity: 'error', summary: 'Tier Error', detail: `Tier ${i+1}: Condition type is required.`, life: 3000 });
                return;
            }
            if ((tier.condition_type === 'ITEM_QTY' || tier.condition_type === 'ITEM_AMOUNT') && !tier.conditionProductId) {
                toast.add({ severity: 'error', summary: 'Tier Error', detail: `Tier ${i+1}: Condition product is required.`, life: 3000 });
                return;
            }
            if (Number(tier.target_value) <= 0) {
                toast.add({ severity: 'error', summary: 'Tier Error', detail: `Tier ${i+1}: Target value must be greater than 0.`, life: 3000 });
                return;
            }
            if (!tier.rewards || tier.rewards.length === 0) {
                toast.add({ severity: 'error', summary: 'Tier Error', detail: `Tier ${i+1}: At least one reward product is required.`, life: 3000 });
                return;
            }
            const hasInvalidQty = tier.rewards.some((reward) => Number(reward.rewardQty) <= 0);
            if (hasInvalidQty) {
                toast.add({ severity: 'error', summary: 'Tier Error', detail: `Tier ${i+1}: Reward qty must be greater than 0.`, life: 3000 });
                return;
            }
        }

        syncFocAllocations();
        const allocationValidation = validateFocAllocationMatrix({
            branches: selectedBranch.value,
            rewards: focAllocationRewards.value,
            allocations: focAllocations.value,
        });
        focAllocationErrors.value = allocationValidation.byKey;
        focAllocationGeneralErrors.value = allocationValidation.general;
        if (!allocationValidation.valid) {
            toast.add({
                severity: 'error',
                summary: 'FOC Allocation Error',
                detail: allocationValidation.general[0] || 'Correct the highlighted FOC allocation rows.',
                life: 4000,
            });
            scrollToSection('foc-allocation-matrix');
            return;
        }

        payload = {
            ...commonPayload,
            promo_type: 'FOC',
            promo_mode: promoMode.value,
            tiers: focTiers.value.map(tier => ({
                condition: {
                    condition_type: tier.condition_type,
                    target_value: Number(tier.target_value),
                    ...(tier.conditionProductId ? {
                        product_id: Number(tier.conditionProductId),
                        ...promotionUomPayload(productForTier(tier)),
                    } : {})
                },
                rewards: tier.rewards.map(reward => ({
                    product_id: Number(reward.id),
                    reward_qty: Number(reward.rewardQty),
                    ...promotionUomPayload(reward),
                })),
            })),
            foc_allocations: focAllocations.value.map(allocation => focAllocationPayload(allocation, true)),
        };
    }

    if (isPriceOverride.value) {
        if (formData.value.overridePrice <= 0) {
            toast.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Override price must be greater than 0.',
                life: 3000
            });
            return;
        }

        if (selectedProducts.value.length === 0) {
            toast.add({
                severity: 'error',
                summary: 'Error',
                detail: 'At least one product is required.',
                life: 3000
            });
            return;
        }

        const productWithInvalidMaxQty = selectedProducts.value.find(hasInvalidMaxQty);
        if (productWithInvalidMaxQty) {
            errorMsg.value.products = 'Max Qty per Sales Order must be a positive whole number or Unlimited.';
            toast.add({
                severity: 'error',
                summary: 'Invalid Product Quantity Limit',
                detail: `${productWithInvalidMaxQty.name}: enter a positive whole number or select Unlimited.`,
                life: 4000,
            });
            return;
        }

        syncPriceOverrideMode();

        for (let i = 0; i < priceOverrideTiers.value.length; i++) {
            const tier = priceOverrideTiers.value[i];

            if (tier.condition_type !== 'ORDER_QTY') {
                toast.add({
                    severity: 'error',
                    summary: 'Tier Error',
                    detail: `Tier ${i + 1}: Condition type must be ORDER_QTY.`,
                    life: 3000
                });
                return;
            }

            if (Number(tier.target_value) <= 0) {
                toast.add({
                    severity: 'error',
                    summary: 'Tier Error',
                    detail: `Tier ${i + 1}: Target value must be greater than 0.`,
                    life: 3000
                });
                return;
            }
        }

        const promotionProducts = selectedProducts.value.map(priceOverridePromotionProductPayload);
        payload = {
            ...commonPayload,
            promo_type: 'PRICE_OVERRIDE',
            promo_mode: 'MIX_MATCH',
            override_price: Number(formData.value.overridePrice),
            tiers: priceOverrideTiers.value.map(tier => ({
                condition: {
                    condition_type: 'ORDER_QTY',
                    target_value: Number(tier.target_value),
                }
            }))
        };
        if (promotionProductsChanged(selectedProducts.value, true)) {
            payload.promotion_products = promotionProducts;
        }
    }

    if (!payload || !promoId.value) {
        toast.add({ severity: 'error', summary: 'Error Message', detail: 'Invalid promotion payload or missing ID.', life: 3000 });
        return;
    }

    await usePromo.editPromo(payload, promoId.value);

    if (usePromo.error.length) {
        applyPromotionServerErrors();
        usePromo.error.forEach((msg) => {
            toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
            });
        });
        if (errorMsg.value.products) {
            scrollToSection('promotion-rules');
        } else if (focAllocationGeneralErrors.value.length || Object.keys(focAllocationErrors.value).length) {
            scrollToSection('foc-allocation-matrix');
        }
        return;
    }

    toast.add({ severity: 'success', summary: 'Success Message', detail: 'Update promotion successfully.', life: 3000 });
    router.push('/promotion');
}
</script>

<template>
    <div class="p-3 sm:p-4 lg:p-6">
        <div class="mx-auto w-full max-w-screen-2xl">
            <div v-if="isInitLoading" class="fixed inset-0 z-50 flex items-center justify-center bg-opacity-30">
                <div class="flex flex-col items-center rounded-lg bg-white p-8 shadow-lg">
                    <Loading variant="page" loadingWidth="w-[56px]" />
                </div>
            </div>

            <PageTitle title="Update Promotion">
                <template #titleButtons>
                    <div class="flex gap-x-2 items-center">
                        <BaseButton
                            icon="fa fa-chevron-left"
                            label="Back"
                            severity="secondary"
                            @click="changeRoute('/promotion')"
                        />
                    </div>
                </template>
            </PageTitle>

            <BaseCard v-if="!isInitLoading" class="mt-4 !w-full !overflow-visible !rounded-2xl !p-0 !shadow-sm">
                <template #cardElements>
                    <div class="sticky top-0 z-20 overflow-x-auto rounded-t-2xl border-b border-slate-200 bg-white/95 px-4 py-3 [scrollbar-width:none] backdrop-blur [&::-webkit-scrollbar]:hidden sm:px-6">
                        <div class="mx-auto flex min-w-[560px] max-w-5xl items-center">
                            <button class="group flex flex-1 items-center gap-3 text-left" type="button" @click="scrollToSection('promotion-details')">
                                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">1</span>
                                <span>
                                    <span class="block text-sm font-semibold text-slate-900">Promotion</span>
                                    <span class="block text-xs text-slate-500">Type & schedule</span>
                                </span>
                            </button>
                            <span class="mx-3 h-px w-10 bg-slate-200 sm:w-20"></span>
                            <button class="group flex flex-1 items-center gap-3 text-left" type="button" @click="scrollToSection('promotion-scope')">
                                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600">2</span>
                                <span>
                                    <span class="block text-sm font-semibold text-slate-900">Availability</span>
                                    <span class="block text-xs text-slate-500">Branch scope</span>
                                </span>
                            </button>
                            <span class="mx-3 h-px w-10 bg-slate-200 sm:w-20"></span>
                            <button class="group flex flex-1 items-center gap-3 text-left" type="button" @click="scrollToSection('promotion-rules')">
                                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600">3</span>
                                <span>
                                    <span class="block text-sm font-semibold text-slate-900">Rules</span>
                                    <span class="block text-xs text-slate-500">Benefits & products</span>
                                </span>
                            </button>
                        </div>
                    </div>

                    <div class="space-y-10 p-4 sm:p-6 lg:p-8">
                        <section id="promotion-details" class="scroll-mt-24">
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <div class="flex items-center gap-3">
                                        <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><i class="fa fa-bullhorn"></i></span>
                                        <SubTitle label="Promotion details" />
                                    </div>
                                    <p class="mt-1 pl-12 text-sm text-slate-500">Review the offer customers see and update its schedule.</p>
                                </div>
                                <div class="flex flex-wrap items-center gap-2">
                                    <span v-if="locksPromotionRules" class="w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"><i class="fa fa-lock mr-1"></i>{{ isInactivePromotion ? 'Inactive · read only' : 'Applied · rules locked' }}</span>
                                    <span class="w-fit rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">* Required fields</span>
                                </div>
                            </div>

                            <div class="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
                                <div class="lg:col-span-2">
                                    <BaseInput
                                        size="sm"
                                        v-model="formData.name"
                                        label="Promotion Name"
                                        placeholder="e.g. Weekend 10% off"
                                        height="h-10"
                                        :isRequire="true"
                                        :error="errorMsg.name"
                                        :disabled="isInactivePromotion"
                                    />
                                </div>

                                <div class="flex flex-col gap-y-1">
                                    <BaseLabel label="Auto Status" />
                                    <div class="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3">
                                        <span v-html="statusBadgeHtml(autoPromoStatusName)"></span>
                                    </div>
                                </div>

                                <div class="lg:col-span-3">
                                    <BaseLabel label="Promotion Type" :isRequire="true" />
                                    <div class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                        <button
                                            v-for="option in promotionTypeOptions"
                                            :key="option.value"
                                            type="button"
                                            :disabled="locksPromotionRules"
                                            class="relative flex min-h-[112px] gap-3 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60"
                                            :class="formData.promoType === option.value ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500' : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm'"
                                            @click="requestPromotionTypeChange(option.value)"
                                        >
                                            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" :class="formData.promoType === option.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'">
                                                <i :class="option.icon"></i>
                                            </span>
                                            <span>
                                                <span class="block text-sm font-semibold text-slate-900">{{ option.label }}</span>
                                                <span class="mt-1 block text-xs leading-5 text-slate-500">{{ option.description }}</span>
                                            </span>
                                            <i v-if="formData.promoType === option.value" class="fa fa-circle-check absolute right-3 top-3 text-blue-600"></i>
                                        </button>
                                    </div>
                                    <span v-if="errorMsg.promoType" class="mt-1 block text-[11px] text-red-500">{{ errorMsg.promoType }}</span>
                                </div>

                                <template v-if="isOrderDiscount || isFOC">
                                    <div class="flex flex-col gap-1">
                                        <BaseLabel label="Promotion Mode" :isRequire="true" />
                                        <select
                                            class="h-10 w-full rounded-md border border-[#cbd5e1] px-3 py-1 text-sm text-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                                            v-model="promoMode"
                                            :disabled="locksPromotionRules"
                                        >
                                            <option value="TIER">Tier</option>
                                            <option value="MULTIPLIER">Multiplier</option>
                                        </select>
                                    </div>
                                </template>

                                <template v-if="isOrderDiscount">
                                    <BaseInput
                                        size="sm"
                                        v-model="maxDiscountAmount"
                                        label="Max Discount Amount"
                                        height="h-10"
                                        type="number"
                                        placeholder="Optional"
                                        :disabled="locksPromotionRules"
                                    />
                                </template>

                                <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-3">
                                    <BaseInput
                                        size="sm"
                                        v-model="formData.startDate"
                                        label="Start Date and Time"
                                        height="h-10"
                                        type="datetime-local"
                                        :isRequire="true"
                                        :error="errorMsg.startDate"
                                        :disabled="locksPromotionRules"
                                    />

                                    <BaseInput
                                        size="sm"
                                        v-model="formData.endDate"
                                        label="End Date and Time"
                                        height="h-10"
                                        type="datetime-local"
                                        :min="formData.startDate"
                                        :isRequire="true"
                                        :error="errorMsg.endDate"
                                        :disabled="isInactivePromotion"
                                    />
                                </div>

                                <div class="lg:col-span-3">
                                    <BaseTextarea
                                        size="sm"
                                        v-model="formData.description"
                                        label="Description"
                                        placeholder="Optional internal note about this promotion"
                                        :rows="2"
                                        :disabled="locksPromotionRules"
                                    />
                                </div>
                            </div>
                        </section>

                        <section id="promotion-scope" class="scroll-mt-24 border-t border-slate-200 pt-8">
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <div class="flex items-center gap-3">
                                        <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><i class="fa fa-store"></i></span>
                                        <SubTitle label="Availability" />
                                    </div>
                                    <p class="mt-1 pl-12 text-sm text-slate-500">Review which branches can apply this promotion.</p>
                                </div>
                                <span class="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                                    {{ formData.branchScopeType === 'ALL' ? 'All branches' : `${selectedBranch.length} selected` }}
                                </span>
                            </div>

                            <div v-if="!isFOC" class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <button
                                    type="button"
                                    :disabled="locksPromotionRules"
                                    class="flex items-center gap-3 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60"
                                    :class="formData.branchScopeType === 'ALL' ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500' : 'border-slate-200 hover:border-blue-300'"
                                    @click="formData.branchScopeType = 'ALL'"
                                >
                                    <span class="flex h-9 w-9 items-center justify-center rounded-lg" :class="formData.branchScopeType === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'"><i class="fa fa-earth-asia"></i></span>
                                    <span class="flex-1">
                                        <span class="block text-sm font-semibold text-slate-900">All branches</span>
                                        <span class="block text-xs text-slate-500">Make the promotion available everywhere.</span>
                                    </span>
                                    <i v-if="formData.branchScopeType === 'ALL'" class="fa fa-circle-check text-blue-600"></i>
                                </button>

                                <button
                                    type="button"
                                    :disabled="locksPromotionRules"
                                    class="flex items-center gap-3 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60"
                                    :class="formData.branchScopeType === 'SELECTED' ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500' : 'border-slate-200 hover:border-blue-300'"
                                    @click="formData.branchScopeType = 'SELECTED'"
                                >
                                    <span class="flex h-9 w-9 items-center justify-center rounded-lg" :class="formData.branchScopeType === 'SELECTED' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'"><i class="fa fa-location-dot"></i></span>
                                    <span class="flex-1">
                                        <span class="block text-sm font-semibold text-slate-900">Selected branches</span>
                                        <span class="block text-xs text-slate-500">Limit the promotion to specific locations.</span>
                                    </span>
                                    <i v-if="formData.branchScopeType === 'SELECTED'" class="fa fa-circle-check text-blue-600"></i>
                                </button>
                            </div>
                            <div v-else class="mt-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                                <i class="fa fa-circle-info mt-0.5"></i>
                                <div>
                                    <p class="font-semibold">FOC promotions require selected branches.</p>
                                    <p class="mt-0.5 text-xs text-blue-700">Warehouse assignment is derived from each branch and remains read-only.</p>
                                </div>
                            </div>
                            <span v-if="errorMsg.branch" class="mt-2 block text-xs text-red-500">{{ errorMsg.branch }}</span>

                            <div v-if="formData.branchScopeType === 'SELECTED'" class="mt-5 overflow-hidden rounded-xl border border-slate-200">
                                <div class="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
                                    <div class="relative flex-1">
                                        <i class="fa fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
                                        <input v-model="branchSearchTerm" type="search" placeholder="Search branches or warehouses" class="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <button type="button" :disabled="locksPromotionRules" class="h-9 rounded-md px-3 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50" @click="selectVisibleBranches">Select visible</button>
                                        <button type="button" :disabled="locksPromotionRules" class="h-9 rounded-md px-3 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50" @click="clearBranchSelection">Clear</button>
                                    </div>
                                </div>

                                <div class="max-h-[300px] overflow-auto p-3">
                                    <div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                                        <label
                                            v-for="branch in filteredBranchOptions"
                                            :key="branch.id"
                                            class="flex items-start gap-3 rounded-lg border p-3 transition"
                                            :class="[
                                                isBranchSelected(branch) ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200',
                                                locksPromotionRules ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-blue-300 hover:bg-blue-50/40',
                                            ]"
                                        >
                                            <input type="checkbox" class="mt-1 h-4 w-4 accent-blue-600" :checked="isBranchSelected(branch)" :disabled="locksPromotionRules" @change="toggleBranchSelection(branch)" />
                                            <span class="min-w-0">
                                                <span class="block truncate text-sm font-medium text-slate-900">{{ branch.name }}</span>
                                                <span class="mt-0.5 block truncate text-xs text-slate-500"><i class="fa fa-warehouse mr-1"></i>{{ branch.warehouse?.name || 'No warehouse linked' }}</span>
                                            </span>
                                        </label>
                                        <div v-if="filteredBranchOptions.length === 0" class="col-span-full py-8 text-center text-sm text-slate-500">No matching branches found.</div>
                                    </div>
                                </div>

                                <div v-if="!isFOC" class="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                                    <span class="font-medium text-slate-700">Linked warehouses:</span>
                                    {{ selectedWarehouseNames.length ? selectedWarehouseNames.join(', ') : 'None yet' }}
                                </div>
                            </div>
                        </section>

                        <section id="promotion-rules" class="scroll-mt-24 border-t border-slate-200 pt-8">
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <div class="flex items-center gap-3">
                                        <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><i class="fa fa-sliders"></i></span>
                                        <SubTitle label="Promotion rules" />
                                    </div>
                                    <p class="mt-1 pl-12 text-sm text-slate-500">Review the qualifying condition and customer reward.</p>
                                </div>
                                <span class="w-fit rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{{ selectedPromotionType?.label }}</span>
                            </div>

                            <template v-if="isProductDiscount || isPriceOverride">
                                <div v-if="isProductDiscount" class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <div class="flex flex-col gap-1">
                                        <BaseLabel label="Discount Type" :isRequire="true" />
                                        <select
                                            class="h-[35px] w-full rounded border border-[#cbd5e1] px-2 py-1 text-sm text-black outline-none focus:border-black disabled:bg-gray-100 disabled:cursor-not-allowed"
                                            v-model="formData.discountType"
                                            :disabled="locksPromotionRules"
                                        >
                                            <option value="AMOUNT">Amount</option>
                                            <option value="PERCENT">Percent</option>
                                        </select>
                                    </div>
                                    <BaseInput
                                        size="sm"
                                        v-model="formData.discountValue"
                                        label="Discount Value"
                                        height="h-[35px]"
                                        type="number"
                                        :isRequire="true"
                                        :error="errorMsg.discountValue"
                                        :disabled="locksPromotionRules"
                                    />
                                </div>

                                <div v-if="isPriceOverride" class="mt-4 space-y-4">
                                    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                        <BaseInput
                                            size="sm"
                                            v-model="formData.overridePrice"
                                            label="Total Deal Price"
                                            height="h-[35px]"
                                            type="number"
                                            min="0"
                                            :isRequire="true"
                                            :disabled="locksPromotionRules"
                                        />
                                    </div>

                                    <div>
                                        <div class="mb-3 flex items-center justify-between gap-3">
                                            <SubTitle label="Deal Conditions" />
                                        </div>
                                        <div v-for="(tier, idx) in priceOverrideTiers" :key="idx" class="rounded border border-gray-200 bg-gray-50 p-4">
                                            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                                <div class="flex flex-col gap-1">
                                                    <BaseLabel label="Condition Type" />
                                                    <div class="flex h-[35px] items-center rounded border border-gray-200 bg-white px-2 text-sm text-gray-700">Order Qty</div>
                                                </div>
                                                <BaseInput size="sm" v-model="tier.target_value" label="Required Quantity" height="h-[35px]" type="number" min="1" :isRequire="true" :disabled="locksPromotionRules" />
                                            </div>
                                        </div>
                                    </div>

                                    <div class="overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                                        <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div class="flex items-start gap-3">
                                                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white"><i class="fa fa-tags"></i></span>
                                                <div>
                                                    <p class="text-xs font-semibold uppercase tracking-wide text-blue-600">Mix & Match Deal</p>
                                                    <p v-if="priceOverrideTargetQty > 0 && Number(formData.overridePrice) > 0" class="mt-1 text-lg font-semibold text-slate-900">
                                                        Any {{ priceOverrideTargetQty }} eligible products for Ks. {{ formatPrice(formData.overridePrice) }}
                                                    </p>
                                                    <p v-else class="mt-1 text-sm font-medium text-slate-700">Enter a required quantity and total deal price to preview the offer.</p>
                                                    <p class="mt-1 text-xs text-slate-500">Customers can mix any products selected below.</p>
                                                </div>
                                            </div>
                                            <div v-if="priceOverrideAverage > 0" class="rounded-lg border border-white/80 bg-white/80 px-4 py-2 text-left sm:text-right">
                                                <p class="text-xs text-slate-500">Average per item</p>
                                                <p class="text-base font-semibold tabular-nums text-slate-900">Ks. {{ formatPrice(priceOverrideAverage) }}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="mt-6">
                                    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <SubTitle label="Products" />
                                            <span v-if="errorMsg.products" class="text-[11px] text-red-500">{{ errorMsg.products }}</span>
                                        </div>
                                        <BaseButton
                                            label="Select Products"
                                            class="w-full sm:w-auto"
                                            :disabled="locksPromotionRules"
                                            @click="openProductDialog('PRODUCT_DISCOUNT')"
                                        />
                                    </div>

                                    <div class="mt-4 overflow-hidden rounded border border-gray-200">
                                        <div class="max-h-[360px] overflow-auto">
                                            <table class="w-full min-w-[1040px] border-collapse text-sm">
                                                <thead>
                                                    <tr class="text-left text-gray-600">
                                                        <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Image</th>
                                                        <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Product Name</th>
                                                        <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Unit</th>
                                                        <th class="sticky top-0 z-10 border-b bg-white px-3 py-2 text-right">Price</th>
                                                        <th class="sticky top-0 z-10 border-b bg-white px-3 py-2 text-right">{{ isPriceOverride ? 'Override Price' : 'Final Price' }}</th>
                                                        <th v-if="isPriceOverride" class="sticky top-0 z-10 border-b bg-white px-3 py-2">Max Qty per Sales Order</th>
                                                        <th class="sticky top-0 z-10 w-[56px] border-b bg-white px-3 py-2"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr v-for="product in selectedProducts" :key="product.id" class="border-b hover:bg-gray-50">
                                                        <td class="px-3 py-2">
                                                            <div class="h-12 w-12 overflow-hidden rounded">
                                                                <img :src="product.image_url" alt="product" class="h-full w-full object-cover" />
                                                            </div>
                                                        </td>
                                                        <td class="px-3 py-2">{{ product.name }}</td>
                                                        <td class="px-3 py-2">
                                                            <select v-model="product.productUnitId" class="h-[35px] w-full min-w-[130px] rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed" :disabled="locksPromotionRules">
                                                                <option value="">All Units</option>
                                                                <option v-for="unit in productUnitOptions(product)" :key="unit.id" :value="unit.id">
                                                                    {{ unit.unit_id?.name }}
                                                                </option>
                                                            </select>
                                                        </td>
                                                        <td class="px-3 py-2 text-right">{{ formatPrice(selectedUnitPrice(product)) }}</td>
                                                        <td class="px-3 py-2 text-right">{{ formatPrice(isPriceOverride ? formData.overridePrice : getFinalPrice(product)) }}</td>
                                                        <td v-if="isPriceOverride" class="px-3 py-2">
                                                            <div class="flex min-w-[260px] items-center gap-3">
                                                                <input
                                                                    v-model.number="product.max_qty_per_sales_order"
                                                                    type="number"
                                                                    min="1"
                                                                    step="1"
                                                                    :disabled="locksPromotionRules || product.max_qty_per_sales_order === null"
                                                                    :aria-label="`Max Qty per Sales Order for ${product.name}`"
                                                                    class="h-[35px] w-24 rounded border border-gray-300 px-2 py-1 text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
                                                                />
                                                                <label class="flex items-center gap-2 whitespace-nowrap text-sm text-gray-700" :class="locksPromotionRules ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'">
                                                                    <input
                                                                        type="checkbox"
                                                                        :checked="product.max_qty_per_sales_order === null"
                                                                        :disabled="locksPromotionRules"
                                                                        @change="setMaxQtyUnlimited(product, $event.target.checked)"
                                                                    />
                                                                    Unlimited
                                                                </label>
                                                            </div>
                                                        </td>
                                                        <td class="px-3 py-2 text-right">
                                                            <button class="rounded px-2 py-1 text-red-600 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40" :disabled="locksPromotionRules" @click="selectedProducts = selectedProducts.filter(p => p.id !== product.id)">
                                                                <i class="pi pi-trash"></i>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    <tr v-if="selectedProducts.length === 0">
                                                        <td :colspan="isPriceOverride ? 7 : 6" class="px-3 py-5 text-center text-gray-500">No products selected</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </template>

                            <template v-else>
                                <div v-if="isOrderDiscount" class="mt-4">
                                    <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <SubTitle :label="promoMode === 'MULTIPLIER' ? 'Multiplier Rule' : 'Discount Tiers'" />
                                        <BaseButton
                                            v-if="promoMode !== 'MULTIPLIER'"
                                            label="Add Tier"
                                            class="w-full sm:w-auto"
                                            :disabled="locksPromotionRules"
                                            @click="orderDiscountTiers.push({ condition_type: 'ORDER_AMOUNT', target_value: 0, discount_type: 'AMOUNT', discount_value: 0 })"
                                        />
                                    </div>

                                    <div class="space-y-3">
                                        <div v-for="(tier, idx) in orderDiscountTiers" :key="idx" class="rounded border border-gray-200 bg-gray-50 p-4">
                                            <div class="mb-3 flex items-center justify-between gap-3">
                                                <span class="text-sm font-medium text-gray-700">Tier {{ idx + 1 }}</span>
                                                <BaseButton
                                                    v-if="orderDiscountTiers.length > 1 && promoMode !== 'MULTIPLIER'"
                                                    label="Remove"
                                                    severity="danger"
                                                    size="sm"
                                                    :disabled="locksPromotionRules"
                                                    @click="orderDiscountTiers.splice(idx, 1)"
                                                />
                                            </div>
                                            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                                <div class="flex flex-col gap-1">
                                                    <BaseLabel label="Condition Type" :isRequire="true" />
                                                    <select class="h-[35px] rounded border border-[#cbd5e1] px-2 py-1 text-sm text-black outline-none focus:border-black disabled:bg-gray-100 disabled:cursor-not-allowed" v-model="tier.condition_type" :disabled="locksPromotionRules">
                                                        <option value="ORDER_QTY">Order Qty</option>
                                                        <option value="ORDER_AMOUNT">Order Amount</option>
                                                    </select>
                                                </div>
                                                <BaseInput size="sm" v-model="tier.target_value" label="Target Value" height="h-[35px]" type="number" :isRequire="true" :disabled="locksPromotionRules" />
                                                <div class="flex flex-col gap-1">
                                                    <BaseLabel label="Discount Type" :isRequire="true" />
                                                    <select class="h-[35px] rounded border border-[#cbd5e1] px-2 py-1 text-sm text-black outline-none focus:border-black disabled:bg-gray-100 disabled:cursor-not-allowed" v-model="tier.discount_type" :disabled="locksPromotionRules">
                                                        <option value="AMOUNT">Amount</option>
                                                        <option value="PERCENT">Percent</option>
                                                    </select>
                                                </div>
                                                <BaseInput size="sm" v-model="tier.discount_value" label="Reward Value" height="h-[35px]" type="number" :isRequire="true" :disabled="locksPromotionRules" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div v-if="isFOC" class="mt-4">
                                    <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <SubTitle :label="promoMode === 'MULTIPLIER' ? 'Multiplier Rule' : 'FOC Tiers'" />
                                        <BaseButton
                                            v-if="promoMode !== 'MULTIPLIER'"
                                            label="Add Tier"
                                            class="w-full sm:w-auto"
                                            :disabled="locksPromotionRules"
                                            @click="focTiers.push({ condition_type: 'ORDER_AMOUNT', target_value: 0, conditionProductId: '', conditionProductUnitId: '', rewards: [] })"
                                        />
                                    </div>

                                    <div class="space-y-4">
                                        <div v-for="(tier, idx) in focTiers" :key="idx" class="rounded border border-gray-200 bg-gray-50 p-4">
                                            <div class="mb-3 flex items-center justify-between gap-3">
                                                <span class="text-sm font-medium text-gray-700">Tier {{ idx + 1 }}</span>
                                                <BaseButton
                                                    v-if="focTiers.length > 1 && promoMode !== 'MULTIPLIER'"
                                                    label="Remove"
                                                    severity="danger"
                                                    size="sm"
                                                    :disabled="locksPromotionRules"
                                                    @click="focTiers.splice(idx, 1)"
                                                />
                                            </div>

                                            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                                <div class="flex flex-col gap-1">
                                                    <BaseLabel label="Condition Type" :isRequire="true" />
                                                    <select class="h-[35px] rounded border border-[#cbd5e1] px-2 py-1 text-sm text-black outline-none focus:border-black disabled:bg-gray-100 disabled:cursor-not-allowed" v-model="tier.condition_type" :disabled="locksPromotionRules">
                                                        <option value="ITEM_QTY">Item Qty</option>
                                                        <option value="ITEM_AMOUNT">Item Amount</option>
                                                        <option value="ORDER_QTY">Order Qty</option>
                                                        <option value="ORDER_AMOUNT">Order Amount</option>
                                                    </select>
                                                </div>

                                                <div v-if="['ITEM_QTY','ITEM_AMOUNT'].includes(tier.condition_type)" class="flex flex-col gap-1">
                                                    <BaseLabel label="Condition Product" :isRequire="true" />
                                                    <BaseButton
                                                        :label="tier.conditionProductId ? (productList.find(p => p.id == tier.conditionProductId)?.name || 'Select Product') : 'Select Product'"
                                                        class="h-[35px] w-full justify-center overflow-hidden"
                                                        :disabled="locksPromotionRules"
                                                        @click="() => selectFocTierConditionProduct(idx)"
                                                    />
                                                </div>

                                                <div v-if="['ITEM_QTY','ITEM_AMOUNT'].includes(tier.condition_type) && tier.conditionProductId" class="flex flex-col gap-1">
                                                    <BaseLabel label="Condition Unit" />
                                                    <select v-model="tier.conditionProductUnitId" class="h-[35px] rounded border border-[#cbd5e1] px-2 py-1 text-sm text-black outline-none focus:border-black disabled:bg-gray-100 disabled:cursor-not-allowed" :disabled="locksPromotionRules" @change="onConditionUnitChange(tier)">
                                                        <option value="">All Units</option>
                                                        <option v-for="unit in productUnitOptions(productForTier(tier))" :key="unit.id" :value="unit.id">
                                                            {{ unit.unit_id?.name }}
                                                        </option>
                                                    </select>
                                                </div>

                                                <BaseInput size="sm" v-model="tier.target_value" label="Target Value" height="h-[35px]" type="number" :isRequire="true" :disabled="locksPromotionRules" />
                                            </div>

                                            <div class="mt-5">
                                                <div class="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                    <BaseLabel label="Reward Products" :isRequire="true" />
                                                    <BaseButton
                                                        label="Select Reward Products"
                                                        class="w-full sm:w-auto"
                                                        :disabled="locksPromotionRules"
                                                        @click="() => selectFocTierRewardProducts(idx)"
                                                    />
                                                </div>

                                                <div class="overflow-hidden rounded border border-gray-200 bg-white">
                                                    <div class="max-h-[220px] overflow-auto">
                                                        <table class="w-full min-w-[680px] border-collapse text-sm">
                                                            <thead>
                                                                <tr class="text-left text-gray-600">
                                                                    <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Image</th>
                                                                    <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Product Name</th>
                                                                    <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Unit</th>
                                                                    <th class="sticky top-0 z-10 border-b bg-white px-3 py-2 text-right">Reward Qty</th>
                                                                    <th class="sticky top-0 z-10 w-[56px] border-b bg-white px-3 py-2"></th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                <tr v-for="reward in tier.rewards" :key="reward.id" class="border-b hover:bg-gray-50">
                                                                    <td class="px-3 py-2">
                                                                        <img class="h-10 w-10 rounded object-cover" :src="reward.image_url" />
                                                                    </td>
                                                                    <td class="px-3 py-2">{{ reward.name }}</td>
                                                                    <td class="px-3 py-2">
                                                                        <select v-model="reward.productUnitId" class="h-[35px] min-w-[120px] rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed" :disabled="locksPromotionRules" @change="onRewardUnitChange(reward)">
                                                                            <option value="">All Units</option>
                                                                            <option v-for="unit in productUnitOptions(reward)" :key="unit.id" :value="unit.id">{{ unit.unit_id?.name }}</option>
                                                                        </select>
                                                                    </td>
                                                                    <td class="px-3 py-2 text-right">
                                                                        <input v-model.number="reward.rewardQty" type="number" min="1" class="h-[35px] w-[100px] rounded border border-gray-300 p-2 text-right text-sm text-black disabled:bg-gray-100 disabled:cursor-not-allowed" :disabled="locksPromotionRules" />
                                                                    </td>
                                                                    <td class="px-3 py-2 text-right">
                                                                        <button class="rounded px-2 py-1 text-red-600 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40" :disabled="locksPromotionRules" @click="tier.rewards = tier.rewards.filter(p => p.id !== reward.id)">
                                                                            <i class="pi pi-trash"></i>
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                                <tr v-if="tier.rewards.length === 0">
                                                                    <td colspan="5" class="px-3 py-5 text-center text-gray-500">No reward products selected</td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div id="foc-allocation-matrix" class="mt-6 scroll-mt-24 rounded border border-gray-200 bg-gray-50 p-4">
                                        <SubTitle label="FOC allocation by branch" />
                                        <p class="mt-1 text-xs text-gray-500">The complete branch and reward-unit matrix is submitted on every normal update. Warehouse and usage values are read-only.</p>

                                        <div v-if="focAllocationGeneralErrors.length" class="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                            <p v-for="message in focAllocationGeneralErrors" :key="message">{{ message }}</p>
                                        </div>
                                        <div v-if="focAvailabilityError" class="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                            <i class="fa fa-triangle-exclamation mr-1"></i>{{ focAvailabilityError }}
                                        </div>

                                        <div class="mt-3 overflow-hidden rounded border border-gray-200 bg-white">
                                            <div class="max-h-[340px] overflow-auto">
                                                <table class="w-full min-w-[1120px] border-collapse text-sm">
                                                    <thead>
                                                        <tr class="text-left text-gray-600">
                                                            <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Branch</th>
                                                            <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Warehouse</th>
                                                            <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Reward Product</th>
                                                            <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Unit</th>
                                                            <th class="sticky top-0 z-10 border-b bg-white px-3 py-2 text-right">Available Qty</th>
                                                            <th class="sticky top-0 z-10 border-b bg-white px-3 py-2 text-right">Used Qty</th>
                                                            <th class="sticky top-0 z-10 border-b bg-white px-3 py-2 text-right">Allocated Qty</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr v-for="alloc in focAllocations" :key="focAllocationKey(alloc)" class="border-b align-top hover:bg-gray-50">
                                                            <td class="px-3 py-3 font-medium text-gray-900">{{ alloc.branchName }}</td>
                                                            <td class="px-3 py-3">
                                                                <p>{{ alloc.warehouseName }}</p>
                                                                <template v-if="isSharedWarehouseAllocation(alloc)">
                                                                    <span class="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Shared warehouse</span>
                                                                    <p class="mt-1 text-[11px] text-gray-500">Combined draft: {{ sharedWarehouseGroup(alloc).totalAllocatedQty }} {{ alloc.unitName }}</p>
                                                                    <p v-if="sharedWarehouseExceedsAvailability(alloc)" class="mt-1 text-[11px] text-red-600">Combined draft exceeds the reported availability.</p>
                                                                </template>
                                                            </td>
                                                            <td class="px-3 py-3">
                                                                <div class="flex items-center gap-2">
                                                                    <img v-if="alloc.imageUrl" class="h-9 w-9 rounded object-cover" :src="alloc.imageUrl" alt="" />
                                                                    <span>{{ alloc.productName }}</span>
                                                                </div>
                                                            </td>
                                                            <td class="px-3 py-3">{{ alloc.unitName }}</td>
                                                            <td class="px-3 py-3 text-right">
                                                                <span v-if="isFocAvailabilityLoading" class="text-xs text-blue-600"><i class="fa fa-spinner fa-spin mr-1"></i>Loading</span>
                                                                <span v-else-if="alloc.availabilityLoaded" :class="Number(alloc.availableQty) <= 0 ? 'font-semibold text-red-600' : 'font-medium text-emerald-700'">{{ alloc.availableQty }}</span>
                                                                <span v-else class="text-xs text-gray-500">Unavailable</span>
                                                            </td>
                                                            <td class="px-3 py-3 text-right font-medium text-gray-700">{{ alloc.usedQty }}</td>
                                                            <td class="px-3 py-3 text-right">
                                                                <input
                                                                    v-model.number="alloc.allocatedQty"
                                                                    type="number"
                                                                    min="1"
                                                                    step="1"
                                                                    :max="alloc.availabilityLoaded ? alloc.availableQty : undefined"
                                                                    :disabled="locksPromotionRules || isFocAvailabilityLoading || (alloc.availabilityLoaded && Number(alloc.availableQty) <= 0)"
                                                                    :class="focAllocationErrors[focAllocationKey(alloc)] ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'"
                                                                    class="h-[35px] w-[120px] rounded border p-2 text-right text-sm text-black outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
                                                                    @input="validateFocAllocationDraft"
                                                                />
                                                                <p v-if="focAllocationErrors[focAllocationKey(alloc)]" class="mt-1 max-w-[280px] text-left text-[11px] text-red-600">
                                                                    {{ focAllocationErrors[focAllocationKey(alloc)] }}
                                                                </p>
                                                            </td>
                                                        </tr>
                                                        <tr v-if="focAllocations.length === 0">
                                                            <td colspan="7" class="px-3 py-6 text-center text-gray-500">Select branches and reward product units to build the allocation matrix.</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </section>
                    </div>

                    <div v-if="isProductDialogVisible" class="fixed inset-0 z-50 flex items-center justify-center p-3" role="dialog" aria-modal="true" :aria-label="productDialogTitle">
                        <div class="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]" @click="cancelProductSelection"></div>
                        <div class="z-10 flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                            <div class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
                                <div>
                                    <SubTitle :label="productDialogTitle" />
                                    <p class="mt-0.5 text-xs text-slate-500">Search by product name or scan a barcode.</p>
                                </div>
                                <div class="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{{ selectionBuffer.length }} selected</div>
                            </div>

                            <div class="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
                                <div class="relative">
                                    <i class="fa fa-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400"></i>
                                    <input
                                        v-model="searchTerm"
                                        autofocus
                                        placeholder="Search by name or barcode"
                                        class="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                            </div>

                            <div class="min-h-0 flex-1 overflow-auto px-4 py-3">
                                <table class="w-full min-w-[640px] text-sm">
                                    <thead>
                                        <tr class="border-b text-left text-gray-600">
                                            <th class="sticky top-0 z-10 bg-white py-2">
                                                <div v-if="!isSingleSelectionDialog" class="flex items-center gap-x-2">
                                                    <span v-if="isSelectAllLoading && productDialogMode === 'PRODUCT_DISCOUNT'" class="text-sm text-gray-600"><i class="fa fa-spinner fa-spin"></i></span>
                                                    <input v-else type="checkbox" :checked="allFilteredSelected" @change="toggleHeaderSelection" ref="headerCheckboxRef" :disabled="isCheckingAll || isSelectAllLoading" />
                                                </div>
                                                <span v-else>Select</span>
                                            </th>
                                            <th class="sticky top-0 z-10 bg-white py-2">Image</th>
                                            <th class="sticky top-0 z-10 bg-white py-2">Name</th>
                                            <th class="sticky top-0 z-10 bg-white py-2">Barcode</th>
                                            <th class="sticky top-0 z-10 bg-white py-2 text-end">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="product in filteredProducts" :key="product.id" class="hover:bg-gray-50">
                                            <td class="py-2">
                                                <input
                                                    :type="isSingleSelectionDialog ? 'radio' : 'checkbox'"
                                                    :name="isSingleSelectionDialog ? 'single-product-select' : undefined"
                                                    :checked="isBufferSelected(product)"
                                                    @change="toggleProductInBuffer($event, product)"
                                                />
                                            </td>
                                            <td class="py-2">
                                                <img class="h-10 w-10 rounded object-cover" :src="product.image_url" />
                                            </td>
                                            <td class="py-2">{{ product.name }}</td>
                                            <td class="py-2">{{ product.barcode }}</td>
                                            <td class="py-2 text-end">{{ Number(product.price).toLocaleString() || 0 }}</td>
                                        </tr>
                                        <tr v-if="(filteredProducts || []).length === 0">
                                            <td colspan="5" class="py-5 text-center text-gray-500">No products found</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div class="flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end">
                                <BaseButton
                                    severity="secondary"
                                    label="Cancel"
                                    class="w-full sm:w-auto"
                                    @click="cancelProductSelection"
                                />
                                <BaseButton
                                    label="Add Product"
                                    class="w-full sm:w-auto"
                                    @click="confirmProductSelection"
                                />
                            </div>
                        </div>
                    </div>

                    <div class="sticky bottom-0 z-20 rounded-b-2xl border-t border-slate-200 bg-white/95 px-4 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur sm:px-6">
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div class="min-w-0">
                                <p class="truncate text-sm font-semibold text-slate-900">{{ formData.name || 'Untitled promotion' }}</p>
                                <p class="text-xs text-slate-500">
                                    {{ selectedPromotionType?.label }} · {{ formData.branchScopeType === 'ALL' ? 'All branches' : `${selectedBranch.length} branches` }}
                                    <span v-if="selectedProducts.length"> · {{ selectedProducts.length }} products</span>
                                </p>
                            </div>
                            <BaseButton
                                label="Update Promotion"
                                :isLoading="usePromo.loading"
                                :icon="usePromo.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'"
                                severity="primary"
                                class="min-h-10 w-full px-6 sm:w-auto"
                                @click="formSubmit"
                                :disabled="usePromo.loading || isInactivePromotion"
                            />
                        </div>
                    </div>
                </template>
            </BaseCard>
        </div>
    </div>
</template>
