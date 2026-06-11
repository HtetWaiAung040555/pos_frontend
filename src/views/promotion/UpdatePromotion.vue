<script setup>
import { useRoute, useRouter } from 'vue-router';
import { watch, ref, computed, onMounted } from 'vue';
import axios from 'axios';
import moment from 'moment';
import BaseInput from '@/components/BaseInput.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import BaseButton from '@/components/BaseButton.vue';
import { errMsgList, getPromotionLifecycleStatusName, getPromotionStatusId, statusBadgeHtml } from '@/utils/const';
import { useToast } from 'primevue';
import { usePromotionStore } from '@/stores/usePromotionStore';
import PageTitle from '@/components/PageTitle.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useProductStore } from '@/stores/useProductStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { useStatusStore } from '@/stores/useStatusStore';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const usePromo = usePromotionStore();
const useProduct = useProductStore();
const useBranch = useBranchStore();
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
const focConditionProduct = ref(null);
const focRewardProducts = ref([]);
const focAllocations = ref([]);
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
});

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

function clearErrors() {
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
    };
}

onMounted(async () => {
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
        formData.value.branchScopeType = promo.branch_scope_type || 'ALL';
        formData.value.warehouseScopeType = promo.warehouse_scope_type || formData.value.branchScopeType;
        formData.value.startDate = promo.start_at || formData.value.startDate;
        formData.value.endDate = promo.end_at || formData.value.endDate;
        loadedPromotionStatusName.value = getPromotionLifecycleStatusName(promo.start_at, promo.end_at);
        promoMode.value = promo.promo_mode || 'TIER';
        maxDiscountAmount.value = Number(promo.max_reward_value) || 0;

        if (formData.value.branchScopeType === 'SELECTED' && Array.isArray(promo.branches)) {
            const branchIds = new Set(promo.branches.map(branch => branch.id));
            selectedBranch.value = branchOptions.value.filter(branch => branchIds.has(branch.id));
        }

        // PRODUCT_DISCOUNT
        if (['PRODUCT_DISCOUNT', 'PRICE_OVERRIDE'].includes(promo.promo_type)) {
            if (Array.isArray(promo.products) && promo.products.length > 0) {
                if (typeof promo.products[0] === 'object') {
                    selectedProducts.value = promo.products.slice();
                } else {
                    selectedProducts.value = promo.products.map(id => productList.value.find(p => p.id === id)).filter(Boolean);
                }
            }
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
                    rewards: rewards.map(r => ({
                        ...r.product,
                        rewardQty: Number(r.reward_qty) || 1,
                    })),
                };
            });
        }

        if (promo.promo_type === 'FOC' && Array.isArray(promo.foc_allocations)) {
            focAllocations.value = promo.foc_allocations.map((allocation) => ({
                allocationId: allocation.id ?? null,
                id: allocation.product?.id ?? allocation.product_id,
                name: allocation.product?.name ?? allocation.name ?? '',
                image_url: allocation.product?.image_url ?? allocation.image_url ?? '',
                allocatedQty: Number(allocation.allocated_qty ?? allocation.allocatedQty) || 1,
            }));
        }
    }
});

const branchOptions = computed(() => useBranch.branchList || []);

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

async function toggleProductInBuffer(event, product) {
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

    // Check remote API whether product is already in a promotion
    try {
        const response = await axios.post(`/promotions/checkprice`, {product_id: product.id});
        const data = response.data;
        // If promotion_id is present and not null -> product already in promotion
        if (data && data.promotion_id) {
            // force-uncheck the checkbox visually
            try { if (event && event.target) event.target.checked = false; } catch(e) {}
            toast.add({ severity: 'warn', summary: 'Product In Promotion', detail: `${product.name} is already in a promotion (discount ${data.discount_amount}).`, life: 4000 });
            return;
        }
    } catch (err) {
        // On error, force-uncheck and show a toast and prevent selection to avoid inconsistent state
        try { if (event && event.target) event.target.checked = false; } catch(e) {}
        toast.add({ severity: 'error', summary: 'Check Failed', detail: `Failed to verify promotion for ${product.name}.`, life: 3000 });
        return;
    }

    // If not in promotion, add to buffer
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

    // add only products that are not already in a promotion
    if (isCheckingAll.value) return;
    isCheckingAll.value = true;
    isSelectAllLoading.value = true;
    try {
        const ids = new Set(selectionBuffer.value.map(p => p.id));
        const candidates = (filteredProducts.value || []).filter(p => !ids.has(p.id));
        if (candidates.length === 0) return;

        // API checks 
        const checks = await Promise.allSettled(
            candidates.map(p => axios.post(`/promotions/checkprice`, {product_id: p.id}))
        );

        const skipped = [];
        checks.forEach((res, idx) => {
            const product = candidates[idx];
            if (res.status === 'fulfilled') {
                const data = res.value.data;
                if (data && data.promotion_id) {
                    skipped.push(product);
                } else {
                    // add to buffer if not already present
                    if (!selectionBuffer.value.some(s => s.id === product.id)) selectionBuffer.value.push(product);
                }
            } else {
                skipped.push(product);
            }
        });

        if (skipped.length > 0) {
            const names = skipped.slice(0,5).map(p => p.name).join(', ');
            const more = skipped.length > 5 ? ` and ${skipped.length - 5} more` : '';
            toast.add({ severity: 'warn', summary: 'Some products skipped', detail: `Skipped ${skipped.length} product(s) already in promotion: ${names}${more}`, life: 5000 });
        }
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
        selectedProducts.value = selectionBuffer.value.slice();
    }

    // FOC tier condition product selection
    if (productDialogMode.value === 'FOC_CONDITION') {
        if (focTierEditIndex.value !== null) {
            const prod = selectionBuffer.value[0] || null;
            focTiers.value[focTierEditIndex.value].conditionProductId = prod ? prod.id : '';
        }
        focTierEditIndex.value = null;
    }

    // FOC tier reward products selection
    if (productDialogMode.value === 'FOC_REWARD') {
        if (focTierEditIndex.value !== null) {
            const oldRewards = focTiers.value[focTierEditIndex.value].rewards || [];
            const qtyMap = new Map(oldRewards.map(p => [p.id, Number(p.rewardQty) || 1]));
            focTiers.value[focTierEditIndex.value].rewards = selectionBuffer.value.map(product => ({
                ...product,
                rewardQty: qtyMap.get(product.id) ?? 1,
            }));

            const existingAllocationIds = new Set((focAllocations.value || []).map(p => p.id));
            const newAllocations = selectionBuffer.value
                .filter(product => !existingAllocationIds.has(product.id))
                .map(product => ({
                    ...product,
                    allocatedQty: 1,
                }));

            focAllocations.value = [
                ...(focAllocations.value || []),
                ...newAllocations,
            ];

            console.log('FOC Allocations after reward selection:', focAllocations.value);
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
    const price = Number(product.price) || 0;
    const val = Number(formData.value.discountValue) || 0;
    if (formData.value.discountType === 'AMOUNT') {
        return Math.max(0, price - val);
    }
    // percentage
    return Math.max(0, price * (1 - val / 100));
}

function formatPrice(value) {
    return Number(value).toLocaleString();
}

// Helper methods for tier product selection
function selectFocTierConditionProduct(idx) {
    if (locksPromotionRules.value) return;

    productDialogMode.value = 'FOC_CONDITION';
    focTierEditIndex.value = idx;
    // Preselect current product if any
    const prodId = focTiers.value[idx].conditionProductId;
    selectionBuffer.value = prodId ? [productList.value.find(p => p.id === prodId)] : [];
    searchTerm.value = '';
    isProductDialogVisible.value = true;
}
function selectFocTierRewardProducts(idx) {
    if (locksPromotionRules.value) return;

    productDialogMode.value = 'FOC_REWARD';
    focTierEditIndex.value = idx;
    // Preselect current rewards if any
    const rewards = focTiers.value[idx].rewards || [];
    const rewardIds = new Set(rewards.map(r => r.id));
    selectionBuffer.value = (productList.value || []).filter(p => rewardIds.has(p.id));
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
    formData.value.warehouseScopeType = scopeType;

    if (scopeType === 'ALL') {
        selectedBranch.value = [];
    }
});

watch(() => formData.value.conditionType, (type) => {
    if (!['ITEM_QTY', 'ITEM_AMOUNT'].includes(type)) {
        formData.value.conditionProductId = '';
        focConditionProduct.value = null;
        errorMsg.value.conditionProductId = '';
    }
});


async function formSubmit() {
    clearErrors();

    if (isInactivePromotion.value) {
        toast.add({
            severity: 'warn',
            summary: 'Promotion Locked',
            detail: 'Inactive promotions cannot be updated.',
            life: 3000
        });
        return;
    }

    if (formData.value.name === "") {
        errorMsg.value.name = errMsgList.name;
        return;
    }

    if (isAppliedPromotion.value) {
        if (!promoId.value) {
            toast.add({ severity: 'error', summary: 'Error Message', detail: 'Missing promotion ID.', life: 3000 });
            return;
        }

        const appliedPayload = {
            name: formData.value.name,
            end_at: formData.value.endDate,
            status_id: autoPromoStatusId.value,
            updated_by: userData.value.id,
        };

        await usePromo.editPromo(appliedPayload, promoId.value);

        if (usePromo.error.length) {
            usePromo.error.forEach((msg) => {
                toast.add({
                    severity: 'error',
                    summary: 'Error Message',
                    detail: msg,
                    life: 3000
                });
            });
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

        if (selectedWarehouseIds.value.length === 0) {
            errorMsg.value.branch = 'Selected branch must have a warehouse.';
            return;
        }
    }

    const commonPayload = {
        name: formData.value.name,
        description: formData.value.description,
        promo_type: formData.value.promoType,
        branch_scope_type: formData.value.branchScopeType,
        branch_ids: selectedBranchIds.value,
        warehouse_scope_type: formData.value.branchScopeType === 'ALL' ? 'ALL' : 'SELECTED',
        warehouse_ids: selectedWarehouseIds.value,
        warehouse_id: selectedWarehouseIds.value[0] ?? userData.value.branch.warehouse_id,
        start_at: formData.value.startDate,
        end_at: formData.value.endDate,
        status_id: autoPromoStatusId.value,
        updated_by: userData.value.id,
    };

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
        payload = {
            ...commonPayload,
            discount_type: formData.value.discountType,
            discount_value: Number(formData.value.discountValue),
            products: selectedProducts.value.map(product => product.id),
        };
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
        payload = {
            ...commonPayload,
            promo_type: 'FOC',
            promo_mode: promoMode.value,
            warehouse_id: commonPayload.warehouse_id,
            tiers: focTiers.value.map(tier => ({
                condition: {
                    condition_type: tier.condition_type,
                    target_value: Number(tier.target_value),
                    ...(tier.conditionProductId ? { product_id: Number(tier.conditionProductId) } : {})
                },
                rewards: tier.rewards.map(reward => ({
                    product_id: Number(reward.id),
                    reward_qty: Number(reward.rewardQty),
                })),
            })),
            foc_allocations: focAllocations.value.map(allocation => ({
                ...(allocation.allocationId ? { id: Number(allocation.allocationId) } : {}),
                product_id: Number(allocation.id),
                allocated_qty: Number(allocation.allocatedQty),
            })),
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

        payload = {
            ...commonPayload,
            promo_type: 'PRICE_OVERRIDE',
            promo_mode: 'MIX_MATCH',
            override_price: Number(formData.value.overridePrice),
            products: selectedProducts.value.map(product => product.id),
            tiers: priceOverrideTiers.value.map(tier => ({
                condition: {
                    condition_type: 'ORDER_QTY',
                    target_value: Number(tier.target_value),
                }
            }))
        };
    }

    if (!payload || !promoId.value) {
        toast.add({ severity: 'error', summary: 'Error Message', detail: 'Invalid promotion payload or missing ID.', life: 3000 });
        return;
    }

    await usePromo.editPromo(payload, promoId.value);

    if (usePromo.error.length) {
        usePromo.error.forEach((msg) => {
            toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
            });
        });
        return;
    }

    toast.add({ severity: 'success', summary: 'Success Message', detail: 'Update promotion successfully.', life: 3000 });
    router.push('/promotion');
}
</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Update Promotion">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary"
                        @click="changeRoute('/promotion')" />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3">
            <template #cardElements>
                <SubTitle label="Step 1: Basic Info" />
                <div class="flex gap-x-4 mt-6">
                    <!-- Customer Name Input -->
                    <BaseInput 
                        size="sm" 
                        v-model="formData.name"
                        label="Name"
                        placeholder="Name"
                        width="300px"
                        height="h-[35px]"
                        :isRequire="true"
                        :error="errorMsg.name" 
                        :disabled="isInactivePromotion"
                    />

                    <div class="flex flex-col gap-1 w-[300px]">
                        <BaseLabel label="Promo Type" />
                        <select
                            class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px]"
                            v-model="formData.promoType"
                            :disabled="locksPromotionRules"
                        >
                            <option value="PRODUCT_DISCOUNT">PRODUCT_DISCOUNT</option>
                            <option value="ORDER_DISCOUNT">ORDER_DISCOUNT</option>
                            <option value="FOC">FOC</option>
                            <option value="PRICE_OVERRIDE">PRICE_OVERRIDE</option>
                        </select>
                        <span v-if="errorMsg.promoType" class="text-red-500 text-sm">{{ errorMsg.promoType }}</span>
                    </div>

                    <div class="flex flex-col gap-y-1 w-[200px]">
                        <BaseLabel label="Status" />
                        <div class="h-[35px] flex items-center">
                            <span v-html="statusBadgeHtml(autoPromoStatusName)"></span>
                        </div>
                    </div>
                </div>
                <div class="flex gap-x-4 mt-4" v-if="isOrderDiscount || isFOC">
                    <!-- Promo Mode and Max Discount Amount for ORDER_DISCOUNT and FOC -->
                    <template v-if="isOrderDiscount || isFOC">
                        <div class="flex flex-col gap-1 w-[300px]">
                            <BaseLabel label="Promo Mode" />
                            <select class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px]" v-model="promoMode" :disabled="locksPromotionRules">
                                <option value="TIER">TIER</option>
                                <option value="MULTIPLIER">MULTIPLIER</option>
                            </select>
                        </div>
                    </template>
                    <template v-if="isOrderDiscount">
                        <div class="flex flex-col gap-1 w-[300px]">
                            <BaseLabel label="Max Discount Amount (optional)" />
                            <BaseInput v-model="maxDiscountAmount" type="number" min="0" placeholder="Max Discount Amount" :disabled="locksPromotionRules" />
                        </div>
                    </template>
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Started datetime input -->
                    <BaseInput 
                        size="sm" 
                        v-model="formData.startDate"
                        label="Started Datetime"
                        width="300px"
                        height="h-[35px]" 
                        type="datetime-local"
                        :disabled="locksPromotionRules"
                    />
                    <!-- Ended datetime input -->
                    <BaseInput 
                        size="sm" 
                        v-model="formData.endDate"
                        label="Ended Datetime"
                        width="300px"
                        height="h-[35px]" 
                        type="datetime-local"
                        :disabled="isInactivePromotion"
                    />
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Discount type select -->
                    <!-- Description input -->
                    <BaseInput 
                        v-model="formData.description"
                        label="Description"
                        placeholder="Description" 
                        :disabled="locksPromotionRules"
                    />
                </div>

                <div class="mt-4">
                    <SubTitle label="Branch Scope" class="mt-6 mb-4" />
                    <div class="flex gap-x-4 items-end flex-wrap">
                        <div class="flex flex-col gap-1 w-[300px]">
                            <BaseLabel label="Branch Scope" />
                            <select
                                class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px]"
                                v-model="formData.branchScopeType"
                                :disabled="locksPromotionRules"
                            >
                                <option value="ALL">All Branches</option>
                                <option value="SELECTED">Selected Branches</option>
                            </select>
                        </div>
                        <div v-if="formData.branchScopeType === 'SELECTED'" class="flex flex-col gap-1 min-w-[300px]">
                            <BaseLabel label="Warehouses" />
                            <div class="min-h-[35px] border border-gray-300 rounded-sm px-3 py-2 text-sm bg-gray-50">
                                {{ selectedWarehouseNames.length ? selectedWarehouseNames.join(', ') : '-' }}
                            </div>
                        </div>
                    </div>
                    <span v-if="errorMsg.branch" class="text-red-500 text-sm">{{ errorMsg.branch }}</span>

                    <div v-if="formData.branchScopeType === 'SELECTED'" class="mt-3 max-h-[220px] overflow-y-auto rounded border border-gray-200">
                        <table class="w-full text-sm border-collapse">
                            <thead>
                                <tr class="text-left text-gray-600">
                                    <th class="py-2 px-2 border-b w-[60px]">Select</th>
                                    <th class="py-2 px-2 border-b">Branch</th>
                                    <th class="py-2 px-2 border-b">Warehouse</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="branch in branchOptions" :key="branch.id" class="border-b hover:bg-gray-50">
                                    <td class="py-2 px-2">
                                        <input
                                            type="checkbox"
                                            :checked="isBranchSelected(branch)"
                                            @change="toggleBranchSelection(branch)"
                                            :disabled="locksPromotionRules"
                                        />
                                    </td>
                                    <td class="py-2 px-2">{{ branch.name }}</td>
                                    <td class="py-2 px-2">{{ branch.warehouse?.name || '-' }}</td>
                                </tr>
                                <tr v-if="branchOptions.length === 0">
                                    <td colspan="3" class="py-4 text-center text-gray-500">No branches found</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <template v-if="isProductDiscount || isPriceOverride">
                    <div v-if="isProductDiscount" class="flex gap-x-4 mt-4">
                        <div class="flex flex-col gap-1 w-[300px]">
                            <BaseLabel label="Discount Type" />
                            <select
                                class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px]"
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
                            width="300px"
                            height="h-[35px]" 
                            type="number"
                            :error="errorMsg.discountValue"
                            :disabled="locksPromotionRules"
                        />
                    </div>

                    <div v-if="isPriceOverride">
                        <div class="flex gap-x-4 mt-4">
                            <BaseInput
                                size="sm"
                                v-model="formData.overridePrice"
                                label="Override Price"
                                width="300px"
                                height="h-[35px]"
                                type="number"
                                :disabled="locksPromotionRules"
                            />
                        </div>

                        <SubTitle label="Price Override Conditions" class="mt-6 mb-4" />
                        <div v-for="(tier, idx) in priceOverrideTiers" :key="idx" class="border rounded p-4 mb-4 bg-gray-50">
                            <div class="flex gap-x-4 flex-wrap items-end">
                                <div class="flex flex-col gap-1 w-[200px]">
                                    <BaseLabel label="Condition Type" />
                                    <div class="border p-2 rounded bg-gray-100 h-[35px]">ORDER_QTY</div>
                                </div>
                                <BaseInput size="sm" v-model="tier.target_value" label="Target Value" width="200px" height="h-[35px]" type="number" :disabled="locksPromotionRules" />
                            </div>
                        </div>
                    </div>

                <!-- Selected Product Section -->
                <div class="flex flex-col">
                    <!-- Select Product Button -->
                    <BaseButton 
                        label="Select Products"  
                        class="w-fit mt-4 mb-4"
                        @click="openProductDialog('PRODUCT_DISCOUNT')"
                        :disabled="locksPromotionRules"
                    />
                    <span v-if="errorMsg.products" class="text-red-500 text-sm">{{ errorMsg.products }}</span>
                    <!-- Selected Products Table (scrollable with fixed header) -->
                    <div class="mt-4">
                        <div class="max-h-[350px] overflow-y-auto rounded">
                            <table class="w-full text-sm border-collapse">
                                <thead>
                                    <tr class="text-left text-gray-600">
                                        <th class="py-2 sticky top-0 bg-white z-10 border-b">Image</th>
                                        <th class="py-2 sticky top-0 bg-white z-10 border-b">Product Name</th>
                                        <th class="py-2 text-right sticky top-0 bg-white z-10 border-b">Price</th>
                                        <th class="py-2 text-right sticky top-0 bg-white z-10 border-b">{{ isPriceOverride ? 'Override Price' : 'Final Price' }}</th>
                                        <th class="py-2 sticky top-0 bg-white z-10 border-b">&nbsp;</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="product in selectedProducts" :key="product.id" class="border-b hover:bg-gray-50">
                                        <td class="py-2">
                                            <div class="w-12 h-12 overflow-hidden rounded">
                                                <img :src="product.image_url" alt="product" class="w-full h-full object-cover" />
                                            </div>
                                        </td>
                                        <td class="py-2">{{ product.name }}</td>
                                        <td class="py-2 text-right">{{ formatPrice(product.price || 0) }}</td>
                                        <td class="py-2 text-right">{{ formatPrice(isPriceOverride ? formData.overridePrice : getFinalPrice(product)) }}</td>
                                        <td class="py-2 text-right">
                                            <button class="text-red-600 hover:text-red-800 px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed" :disabled="locksPromotionRules" @click="selectedProducts = selectedProducts.filter(p => p.id !== product.id)"><i class="pi pi-trash"></i></button>
                                        </td>
                                    </tr>
                                    <tr v-if="selectedProducts.length === 0">
                                        <td colspan="5" class="py-4 text-center text-gray-500">No products selected</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                </template>

                <template v-else>
                    <!-- Tier-based UI for ORDER_DISCOUNT -->
                    <div v-if="isOrderDiscount">
                        <SubTitle :label="promoMode === 'MULTIPLIER' ? 'Multiplier' : 'Tiers'" class="mt-6 mb-4" />
                        <div v-for="(tier, idx) in orderDiscountTiers" :key="idx" class="border rounded p-4 mb-4 bg-gray-50">
                            <div class="flex gap-x-4 flex-wrap items-end">
                                <div class="flex flex-col gap-1 w-[200px]">
                                    <BaseLabel label="Condition Type" />
                                    <select class="border p-2 rounded" v-model="tier.condition_type" :disabled="locksPromotionRules">
                                        <option value="ORDER_QTY">ORDER_QTY</option>
                                        <option value="ORDER_AMOUNT">ORDER_AMOUNT</option>
                                    </select>
                                </div>
                                <BaseInput size="sm" v-model="tier.target_value" label="Target Value" width="200px" height="h-[35px]" type="number" :disabled="locksPromotionRules" />
                                <div class="flex flex-col gap-1 w-[200px]">
                                    <BaseLabel label="Discount Type" />
                                    <select class="border p-2 rounded" v-model="tier.discount_type" :disabled="locksPromotionRules">
                                        <option value="AMOUNT">Amount</option>
                                        <option value="PERCENT">Percent</option>
                                    </select>
                                </div>
                                <BaseInput size="sm" v-model="tier.discount_value" label="Reward Value" width="200px" height="h-[35px]" type="number" :disabled="locksPromotionRules" />
                                <BaseButton v-if="orderDiscountTiers.length > 1 && promoMode !== 'MULTIPLIER'" label="Remove" severity="danger" class="ml-2" @click="orderDiscountTiers.splice(idx, 1)" :disabled="locksPromotionRules" />
                            </div>
                        </div>
                        <BaseButton v-if="promoMode !== 'MULTIPLIER'" label="Add Tier" class="mb-4" @click="orderDiscountTiers.push({ condition_type: 'ORDER_AMOUNT', target_value: 0, discount_type: 'AMOUNT', discount_value: 0 })" :disabled="locksPromotionRules" />
                    </div>
                    <!-- Tier-based UI for FOC -->
                    <div v-if="isFOC">
                        <SubTitle :label="promoMode === 'MULTIPLIER' ? 'Multiplier' : 'Tiers'" class="mt-6 mb-4" />
                        <div v-for="(tier, idx) in focTiers" :key="idx" class="border rounded p-4 mb-4 bg-gray-50">
                            <div class="flex gap-x-4 flex-wrap items-end">
                                <div class="flex flex-col gap-1 w-[200px]">
                                    <BaseLabel label="Condition Type" />
                                    <select class="border p-2 rounded" v-model="tier.condition_type" :disabled="locksPromotionRules">
                                        <option value="ITEM_QTY">ITEM_QTY</option>
                                        <option value="ITEM_AMOUNT">ITEM_AMOUNT</option>
                                        <option value="ORDER_QTY">ORDER_QTY</option>
                                        <option value="ORDER_AMOUNT">ORDER_AMOUNT</option>
                                    </select>
                                </div>
                                <div v-if="['ITEM_QTY','ITEM_AMOUNT'].includes(tier.condition_type)" class="flex flex-col gap-1 w-[200px]">
                                    <BaseLabel label="Condition Product" />
                                    <BaseButton :label="tier.conditionProductId ? (productList.find(p => p.id == tier.conditionProductId)?.name || 'Select Product') : 'Select Product'" class="w-full" @click="() => selectFocTierConditionProduct(idx)" :disabled="locksPromotionRules" />
                                </div>
                                <BaseInput size="sm" v-model="tier.target_value" label="Target Value" width="200px" height="h-[35px]" type="number" :disabled="locksPromotionRules" />
                                <BaseButton v-if="focTiers.length > 1 && promoMode !== 'MULTIPLIER'" label="Remove" severity="danger" class="ml-2" @click="focTiers.splice(idx, 1)" :disabled="locksPromotionRules" />
                            </div>
                            <div class="mt-4">
                                <BaseLabel label="Reward Products" />
                                <BaseButton label="Select Reward Products" class="mb-2" @click="() => selectFocTierRewardProducts(idx)" :disabled="locksPromotionRules" />
                                <div class="max-h-[200px] overflow-y-auto rounded border border-gray-200 mt-2">
                                    <table class="w-full text-sm border-collapse">
                                        <thead>
                                            <tr class="text-left text-gray-600">
                                                <th class="py-2 px-2 border-b">Image</th>
                                                <th class="py-2 px-2 border-b">Product Name</th>
                                                <th class="py-2 px-2 border-b text-right">Reward Qty</th>
                                                <th class="py-2 px-2 border-b text-right">&nbsp;</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="reward in tier.rewards" :key="reward.id" class="border-b hover:bg-gray-50">
                                                <td class="py-2 px-2">
                                                    <img class="object-cover w-10 h-10 rounded" :src="reward.image_url" />
                                                </td>
                                                <td class="py-2 px-2">{{ reward.name }}</td>
                                                <td class="py-2 px-2 text-right">
                                                    <input v-model.number="reward.rewardQty" type="number" min="1" class="text-md border border-gray-500 rounded-sm p-2 text-black w-[100px] h-[35px] text-right disabled:bg-gray-100 disabled:cursor-not-allowed" :disabled="locksPromotionRules" />
                                                </td>
                                                <td class="py-2 px-2 text-right">
                                                    <button class="text-red-600 hover:text-red-800 px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed" :disabled="locksPromotionRules" @click="tier.rewards = tier.rewards.filter(p => p.id !== reward.id)"><i class="pi pi-trash"></i></button>
                                                </td>
                                            </tr>
                                            <tr v-if="tier.rewards.length === 0">
                                                <td colspan="4" class="py-4 text-center text-gray-500">No reward products selected</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <BaseButton v-if="promoMode !== 'MULTIPLIER'" label="Add Tier" class="mb-4" @click="focTiers.push({ condition_type: 'ORDER_AMOUNT', target_value: 0, conditionProductId: '', rewards: [] })" :disabled="locksPromotionRules" />
                        <div class="border rounded p-4 mb-4 bg-gray-50">
                            <SubTitle label="FOC Stock" class="mt-6 mb-4" />
                            <div class="max-h-[200px] overflow-y-auto rounded border border-gray-200 mt-2">
                                <table class="w-full text-sm border-collapse">
                                    <thead>
                                        <tr class="text-left text-gray-600">
                                            <th class="py-2 px-2 border-b">Image</th>
                                            <th class="py-2 px-2 border-b">Product Name</th>
                                            <th class="py-2 px-2 border-b text-right">Allocated Qty</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="alloc in focAllocations" :key="alloc.id" class="border-b hover:bg-gray-50">
                                            <td class="py-2 px-2">
                                                <img class="object-cover w-10 h-10 rounded" :src="alloc.image_url" />
                                            </td>
                                            <td class="py-2 px-2">{{ alloc.name }}</td>
                                            <td class="py-2 px-2 text-right">
                                                <input v-model.number="alloc.allocatedQty" type="number" min="1" class="text-md border border-gray-500 rounded-sm p-2 text-black w-[100px] h-[35px] text-right disabled:bg-gray-100 disabled:cursor-not-allowed" :disabled="locksPromotionRules" />
                                            </td>
                                        </tr>
                                        <tr v-if="focAllocations.length === 0">
                                            <td colspan="3" class="py-4 text-center text-gray-500">No allocated products</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </template>

                <!-- Shared Product Selection Modal -->
                <div v-if="isProductDialogVisible" class="fixed inset-0 z-50 flex items-center justify-center">
                    <div class="absolute inset-0 bg-black opacity-50" @click="cancelProductSelection"></div>
                    <div class="bg-white rounded shadow-lg w-[90%] max-w-4xl max-h-[80vh] overflow-hidden z-10 p-4">
                        <div class="flex items-center justify-between py-4 border-b">
                            <SubTitle :label="productDialogTitle" />
                            <div class="text-sm text-gray-600">{{ selectionBuffer.length }} selected</div>
                        </div>
                        <div class="py-4 flex gap-x-2 items-center">
                            <input v-model="searchTerm" placeholder="Search by name or barcode" class="border p-2 rounded w-full" />
                        </div>
                        <div class="py-4 overflow-auto max-h-[50vh]">
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="text-left text-gray-600 border-b">
                                        <th class="py-2">
                                            <div v-if="!isSingleSelectionDialog" class="flex items-center gap-x-2">
                                                <span v-if="isSelectAllLoading && productDialogMode === 'PRODUCT_DISCOUNT'" class="text-sm text-gray-600"><i class="fa fa-spinner fa-spin"></i></span>
                                                <input v-else type="checkbox" :checked="allFilteredSelected" @change="toggleHeaderSelection" ref="headerCheckboxRef" :disabled="isCheckingAll || isSelectAllLoading" />
                                            </div>
                                            <span v-else>Select</span>
                                        </th>
                                        <th>Image</th>
                                        <th class="py-2">Name</th>
                                        <th class="py-2">Barcode</th>
                                        <th class="py-2 text-end">Price</th>
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
                                            <img class="object-cover w-10 h-10 rounded" :src="product.image_url" />
                                        </td>
                                        <td class="py-2">{{ product.name }}</td>
                                        <td class="py-2">{{ product.barcode }}</td>
                                        <td class="py-2 text-end">{{ Number(product.price).toLocaleString() || 0 }}</td>
                                    </tr>
                                    <tr v-if="(filteredProducts || []).length === 0">
                                        <td colspan="4" class="py-4 text-center text-gray-500">No products found</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="flex justify-end gap-x-2 py-4 border-t">
                            <BaseButton 
                                severity="secondary" 
                                label="Cancel"
                                @click="cancelProductSelection" 
                            />
                            <BaseButton 
                                label="Add Product"
                                class="px-4 py-2 bg-blue-600 text-white rounded"
                                @click="confirmProductSelection" 
                            />
                        </div>
                    </div>
                </div>

                <div class="flex justify-end mt-4">
                    <!-- Update Button -->
                    <BaseButton 
                        label="Update" 
                        :isLoading="usePromo.loading"
                        :icon="usePromo.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary"
                        @click="formSubmit" 
                        :disabled="usePromo.loading || isInactivePromotion" 
                    />
                </div>
            </template>
        </BaseCard>
    </div>
</template>
