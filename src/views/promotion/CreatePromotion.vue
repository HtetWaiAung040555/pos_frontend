<script setup>
import { useRouter } from 'vue-router';
import { watch, ref, computed, onMounted } from 'vue';
import axios from 'axios';
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
import { useStatusStore } from '@/stores/useStatusStore';
import {
    productUnitOptions,
    promotionProductPayload,
    promotionUomPayload,
    selectedUnitPrice,
    withPromotionUnit,
} from '@/utils/promotionUom';

const router = useRouter();
const toast = useToast();
const usePromo = usePromotionStore();
const useProduct = useProductStore();
const useBranch = useBranchStore();
const useStatus = useStatusStore();

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
});
const selectedProducts = ref([]);
const focConditionProduct = ref(null);
const focRewardProducts = ref([]);
const focAllocations = ref([]);
// Tier-based state for ORDER_DISCOUNT and FOC
const orderDiscountTiers = ref([
    {
        condition_type: 'ORDER_AMOUNT',
        target_value: 0,
        discount_type: 'AMOUNT',
        discount_value: 0,
    }
]);
// New fields for promo_mode and max_reward_value
const promoMode = ref('TIER'); // default
const maxDiscountAmount = ref(0); // for ORDER_DISCOUNT only
const focTiers = ref([
    {
        condition_type: 'ORDER_AMOUNT',
        target_value: 0,
        conditionProductId: '',
        conditionProductUnitId: '',
        rewards: [], // [{ id, name, rewardQty, focStockQty, image_url }]
    }
]);
const priceOverrideTiers = ref([
    {
        condition_type: 'ORDER_QTY',
        target_value: 0,
        conditionProductId: '',
        rewards: [], // [{ id, name, rewardPrice, image_url }]
    }
]);
const isProductDialogVisible = ref(false);
const productDialogMode = ref('PRODUCT_DISCOUNT');
const productList = ref([]);
const searchTerm = ref('');
const selectionBuffer = ref([]);
const headerCheckboxRef = ref(null);
const isCheckingAll = ref(false);
const isSelectAllLoading = ref(false);
const selectedBranch = ref([]);
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

const conditionTypeOptions = computed(() => {
    if (isOrderDiscount.value) {
        return [
            { value: 'ORDER_QTY', label: 'ORDER_QTY' },
            { value: 'ORDER_AMOUNT', label: 'ORDER_AMOUNT' },
        ];
    }

    if (isFOC.value) {
        return [
            { value: 'ITEM_QTY', label: 'ITEM_QTY' },
            { value: 'ITEM_AMOUNT', label: 'ITEM_AMOUNT' },
            { value: 'ORDER_QTY', label: 'ORDER_QTY' },
            { value: 'ORDER_AMOUNT', label: 'ORDER_AMOUNT' },
        ];
    }

    return [];
});

const targetLabel = computed(() => {
    switch (formData.value.conditionType) {
        case 'ITEM_QTY':
        case 'ORDER_QTY':
            return 'Target Qty';
        case 'ITEM_AMOUNT':
        case 'ORDER_AMOUNT':
            return 'Target Amount';
        default:
            return 'Target Value';
    }
});

const autoPromoStatusName = computed(() => (
    getPromotionLifecycleStatusName(formData.value.startDate, formData.value.endDate)
));

const autoPromoStatusId = computed(() => getPromotionStatusId(useStatus, autoPromoStatusName.value));

// Change route function
function changeRoute(pathname) {
    router.push(pathname);
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
        productList.value = useProduct.productList;
    } finally {
        isInitLoading.value = false;
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
    const exists = isBranchSelected(branch);

    if (exists) {
        selectedBranch.value = selectedBranch.value.filter(selected => selected.id !== branch.id);
        return;
    }

    selectedBranch.value = [...selectedBranch.value, branch];
}

const filteredProducts = computed(() => {
    const q = (searchTerm.value || '').toString().trim().toLowerCase();
    if (!q) return productList.value || [];
    return (productList.value || []).filter(p => {
        const name = (p.name || '').toString().toLowerCase();
        const barcode = (p.barcode || '').toString().toLowerCase();
        return name.includes(q) || barcode.includes(q);
    });
});

function openProductDialog(mode = 'PRODUCT_DISCOUNT') {
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

// Track which tier is being edited for FOC
const focTierEditIndex = ref(null);
function confirmProductSelection() {
    if (productDialogMode.value === 'PRODUCT_DISCOUNT') {
        selectedProducts.value = selectionBuffer.value.map(product => withPromotionUnit(product));
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

            const selectedRewards = focTiers.value[focTierEditIndex.value].rewards;
            const existingAllocationKeys = new Set((focAllocations.value || []).map(product => `${product.id}:${product.productUnitId || ''}`));
            const newAllocations = selectedRewards
                .filter(product => !existingAllocationKeys.has(`${product.id}:${product.productUnitId || ''}`))
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

    console.log('FOC Rewards after selection:', focTiers.value);
    // console.log('Global FOC Rewards after selection:', focRewardProducts.value);

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
    const allocation = focAllocations.value.find(item => item.id === reward.id);
    if (allocation) allocation.productUnitId = reward.productUnitId;
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

// Helper methods for tier product selection
function selectFocTierConditionProduct(idx) {
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

    if (formData.value.name === "") {
        errorMsg.value.name = errMsgList.name;
        return
    }

    if (!['PRODUCT_DISCOUNT', 'ORDER_DISCOUNT', 'FOC', 'PRICE_OVERRIDE'].includes(formData.value.promoType)) {
        errorMsg.value.promoType = 'Promo type is required.';
        return
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
        created_by: userData.value.id,
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
            promotion_products: selectedProducts.value.map(promotionProductPayload),
        };
    }

    // ORDER_DISCOUNT: tier-based logic
    if (isOrderDiscount.value) {
        // Validate all tiers
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
        // Remove undefined max_reward_value if not set
        if (payload.max_reward_value === undefined) delete payload.max_reward_value;
    }

    // FOC: tier-based logic
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
                }))
            })),
            foc_allocations: focAllocations.value.map(allocation => ({
                product_id: Number(allocation.id),
                allocated_qty: Number(allocation.allocatedQty),
                unit_quantity: Number(allocation.allocatedQty),
                ...promotionUomPayload(allocation),
            }))
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

            promotion_products: selectedProducts.value.map(promotionProductPayload),

            tiers: priceOverrideTiers.value.map(tier => ({
                condition: {
                    condition_type: 'ORDER_QTY',
                    target_value: Number(tier.target_value),
                }
            }))
        };
    }

    if (!payload) {
        toast.add({ severity: 'error', summary: 'Error Message', detail: 'Invalid promotion payload.', life: 3000 });
        return;
    }

    await usePromo.addPromo(payload);

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

    if (usePromo.promoList) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Create promotion successfully.', life: 3000 });
        router.push('/promotion');
    }
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

            <PageTitle title="Create Promotion">
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

            <BaseCard v-if="!isInitLoading" class="mt-3">
                <template #cardElements>
                    <div class="space-y-8">
                        <section>
                            <div class="flex flex-col gap-2 border-b border-gray-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                                <SubTitle label="Promotion Details" />
                                <span class="w-fit rounded bg-red-50 px-2 py-1 text-xs text-red-600">* Required</span>
                            </div>

                            <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <div class="md:col-span-2">
                                    <BaseInput
                                        size="sm"
                                        v-model="formData.name"
                                        label="Promotion Name"
                                        placeholder="Enter promotion name"
                                        height="h-[35px]"
                                        :isRequire="true"
                                        :error="errorMsg.name"
                                    />
                                </div>

                                <div class="flex flex-col gap-1">
                                    <BaseLabel label="Promotion Type" :isRequire="true" />
                                    <select
                                        class="h-[35px] w-full rounded border border-[#cbd5e1] px-2 py-1 text-sm text-black outline-none focus:border-black"
                                        v-model="formData.promoType"
                                    >
                                        <option value="PRODUCT_DISCOUNT">Product Discount</option>
                                        <option value="ORDER_DISCOUNT">Order Discount</option>
                                        <option value="FOC">Free Item (FOC)</option>
                                        <option value="PRICE_OVERRIDE">Price Override</option>
                                    </select>
                                    <span v-if="errorMsg.promoType" class="text-[11px] text-red-500">{{ errorMsg.promoType }}</span>
                                </div>

                                <div class="flex flex-col gap-y-1">
                                    <BaseLabel label="Auto Status" />
                                    <div class="flex h-[35px] items-center rounded border border-gray-200 bg-gray-50 px-3">
                                        <span v-html="statusBadgeHtml(autoPromoStatusName)"></span>
                                    </div>
                                </div>

                                <template v-if="isOrderDiscount || isFOC">
                                    <div class="flex flex-col gap-1">
                                        <BaseLabel label="Promotion Mode" :isRequire="true" />
                                        <select
                                            class="h-[35px] w-full rounded border border-[#cbd5e1] px-2 py-1 text-sm text-black outline-none focus:border-black"
                                            v-model="promoMode"
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
                                        height="h-[35px]"
                                        type="number"
                                        placeholder="Optional"
                                    />
                                </template>

                                <BaseInput
                                    size="sm"
                                    v-model="formData.startDate"
                                    label="Start Date and Time"
                                    height="h-[35px]"
                                    type="datetime-local"
                                />

                                <BaseInput
                                    size="sm"
                                    v-model="formData.endDate"
                                    label="End Date and Time"
                                    height="h-[35px]"
                                    type="datetime-local"
                                />

                                <div class="md:col-span-2 xl:col-span-4">
                                    <BaseTextarea
                                        size="sm"
                                        v-model="formData.description"
                                        label="Description"
                                        placeholder="Optional note for this promotion"
                                        :rows="3"
                                    />
                                </div>
                            </div>
                        </section>

                        <section class="border-t border-gray-200 pt-6">
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <SubTitle label="Branch Scope" />
                                <span class="text-xs text-gray-500">{{ formData.branchScopeType === 'ALL' ? 'All branches' : `${selectedBranch.length} selected` }}</span>
                            </div>

                            <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                                <div class="flex flex-col gap-1">
                                    <BaseLabel label="Branch Scope" :isRequire="true" />
                                    <select
                                        class="h-[35px] w-full rounded border border-[#cbd5e1] px-2 py-1 text-sm text-black outline-none focus:border-black"
                                        v-model="formData.branchScopeType"
                                    >
                                        <option value="ALL">All Branches</option>
                                        <option value="SELECTED">Selected Branches</option>
                                    </select>
                                    <span v-if="errorMsg.branch" class="text-[11px] text-red-500">{{ errorMsg.branch }}</span>
                                </div>

                                <div v-if="formData.branchScopeType === 'SELECTED'" class="flex flex-col gap-1 lg:col-span-2">
                                    <BaseLabel label="Linked Warehouses" />
                                    <div class="min-h-[35px] rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                                        {{ selectedWarehouseNames.length ? selectedWarehouseNames.join(', ') : '-' }}
                                    </div>
                                </div>
                            </div>

                            <div v-if="formData.branchScopeType === 'SELECTED'" class="mt-4 overflow-hidden rounded border border-gray-200">
                                <div class="max-h-[260px] overflow-auto">
                                    <table class="w-full min-w-[560px] border-collapse text-sm">
                                        <thead>
                                            <tr class="text-left text-gray-600">
                                                <th class="sticky top-0 z-10 w-[72px] border-b bg-white px-3 py-2">Select</th>
                                                <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Branch</th>
                                                <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Warehouse</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="branch in branchOptions" :key="branch.id" class="border-b hover:bg-gray-50">
                                                <td class="px-3 py-2">
                                                    <input
                                                        type="checkbox"
                                                        :checked="isBranchSelected(branch)"
                                                        @change="toggleBranchSelection(branch)"
                                                    />
                                                </td>
                                                <td class="px-3 py-2">{{ branch.name }}</td>
                                                <td class="px-3 py-2">{{ branch.warehouse?.name || '-' }}</td>
                                            </tr>
                                            <tr v-if="branchOptions.length === 0">
                                                <td colspan="3" class="px-3 py-5 text-center text-gray-500">No branches found</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>

                        <section class="border-t border-gray-200 pt-6">
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <SubTitle label="Promotion Rules" />
                                <span class="text-xs text-gray-500">{{ formData.promoType.replace('_', ' ') }}</span>
                            </div>

                            <template v-if="isProductDiscount || isPriceOverride">
                                <div v-if="isProductDiscount" class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <div class="flex flex-col gap-1">
                                        <BaseLabel label="Discount Type" :isRequire="true" />
                                        <select
                                            class="h-[35px] w-full rounded border border-[#cbd5e1] px-2 py-1 text-sm text-black outline-none focus:border-black"
                                            v-model="formData.discountType"
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
                                    />
                                </div>

                                <div v-if="isPriceOverride" class="mt-4 space-y-4">
                                    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                        <BaseInput
                                            size="sm"
                                            v-model="formData.overridePrice"
                                            label="Override Price"
                                            height="h-[35px]"
                                            type="number"
                                            :isRequire="true"
                                        />
                                    </div>

                                    <div>
                                        <div class="mb-3 flex items-center justify-between gap-3">
                                            <SubTitle label="Price Override Conditions" />
                                        </div>
                                        <div v-for="(tier, idx) in priceOverrideTiers" :key="idx" class="rounded border border-gray-200 bg-gray-50 p-4">
                                            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                                <div class="flex flex-col gap-1">
                                                    <BaseLabel label="Condition Type" />
                                                    <div class="flex h-[35px] items-center rounded border border-gray-200 bg-white px-2 text-sm text-gray-700">Order Qty</div>
                                                </div>
                                                <BaseInput size="sm" v-model="tier.target_value" label="Target Value" height="h-[35px]" type="number" :isRequire="true" />
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
                                            @click="openProductDialog('PRODUCT_DISCOUNT')"
                                        />
                                    </div>

                                    <div class="mt-4 overflow-hidden rounded border border-gray-200">
                                        <div class="max-h-[360px] overflow-auto">
                                            <table class="w-full min-w-[760px] border-collapse text-sm">
                                                <thead>
                                                    <tr class="text-left text-gray-600">
                                                        <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Image</th>
                                                        <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Product Name</th>
                                                        <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Unit</th>
                                                        <th class="sticky top-0 z-10 border-b bg-white px-3 py-2 text-right">Price</th>
                                                        <th class="sticky top-0 z-10 border-b bg-white px-3 py-2 text-right">{{ isPriceOverride ? 'Override Price' : 'Final Price' }}</th>
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
                                                            <select v-model="product.productUnitId" class="h-[35px] w-full min-w-[130px] rounded border border-gray-300 px-2 py-1 text-sm">
                                                                <option value="">All Units</option>
                                                                <option v-for="unit in productUnitOptions(product)" :key="unit.id" :value="unit.id">
                                                                    {{ unit.unit_id?.name }}
                                                                </option>
                                                            </select>
                                                        </td>
                                                        <td class="px-3 py-2 text-right">{{ formatPrice(selectedUnitPrice(product)) }}</td>
                                                        <td class="px-3 py-2 text-right">{{ formatPrice(isPriceOverride ? formData.overridePrice : getFinalPrice(product)) }}</td>
                                                        <td class="px-3 py-2 text-right">
                                                            <button class="rounded px-2 py-1 text-red-600 hover:bg-red-50 hover:text-red-800" @click="selectedProducts = selectedProducts.filter(p => p.id !== product.id)">
                                                                <i class="pi pi-trash"></i>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    <tr v-if="selectedProducts.length === 0">
                                                        <td colspan="6" class="px-3 py-5 text-center text-gray-500">No products selected</td>
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
                                                    @click="orderDiscountTiers.splice(idx, 1)"
                                                />
                                            </div>
                                            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                                <div class="flex flex-col gap-1">
                                                    <BaseLabel label="Condition Type" :isRequire="true" />
                                                    <select class="h-[35px] rounded border border-[#cbd5e1] px-2 py-1 text-sm text-black outline-none focus:border-black" v-model="tier.condition_type">
                                                        <option value="ORDER_QTY">Order Qty</option>
                                                        <option value="ORDER_AMOUNT">Order Amount</option>
                                                    </select>
                                                </div>
                                                <BaseInput size="sm" v-model="tier.target_value" label="Target Value" height="h-[35px]" type="number" :isRequire="true" />
                                                <div class="flex flex-col gap-1">
                                                    <BaseLabel label="Discount Type" :isRequire="true" />
                                                    <select class="h-[35px] rounded border border-[#cbd5e1] px-2 py-1 text-sm text-black outline-none focus:border-black" v-model="tier.discount_type">
                                                        <option value="AMOUNT">Amount</option>
                                                        <option value="PERCENT">Percent</option>
                                                    </select>
                                                </div>
                                                <BaseInput size="sm" v-model="tier.discount_value" label="Reward Value" height="h-[35px]" type="number" :isRequire="true" />
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
                                                    @click="focTiers.splice(idx, 1)"
                                                />
                                            </div>

                                            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                                <div class="flex flex-col gap-1">
                                                    <BaseLabel label="Condition Type" :isRequire="true" />
                                                    <select class="h-[35px] rounded border border-[#cbd5e1] px-2 py-1 text-sm text-black outline-none focus:border-black" v-model="tier.condition_type">
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
                                                        @click="() => selectFocTierConditionProduct(idx)"
                                                    />
                                                </div>

                                                <div v-if="['ITEM_QTY','ITEM_AMOUNT'].includes(tier.condition_type) && tier.conditionProductId" class="flex flex-col gap-1">
                                                    <BaseLabel label="Condition Unit" />
                                                    <select v-model="tier.conditionProductUnitId" class="h-[35px] rounded border border-[#cbd5e1] px-2 py-1 text-sm text-black outline-none focus:border-black" @change="onConditionUnitChange(tier)">
                                                        <option value="">All Units</option>
                                                        <option v-for="unit in productUnitOptions(productForTier(tier))" :key="unit.id" :value="unit.id">
                                                            {{ unit.unit_id?.name }}
                                                        </option>
                                                    </select>
                                                </div>

                                                <BaseInput size="sm" v-model="tier.target_value" label="Target Value" height="h-[35px]" type="number" :isRequire="true" />
                                            </div>

                                            <div class="mt-5">
                                                <div class="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                    <BaseLabel label="Reward Products" :isRequire="true" />
                                                    <BaseButton
                                                        label="Select Reward Products"
                                                        class="w-full sm:w-auto"
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
                                                                        <select v-model="reward.productUnitId" class="h-[35px] min-w-[120px] rounded border border-gray-300 px-2 py-1 text-sm" @change="onRewardUnitChange(reward)">
                                                                            <option value="">All Units</option>
                                                                            <option v-for="unit in productUnitOptions(reward)" :key="unit.id" :value="unit.id">{{ unit.unit_id?.name }}</option>
                                                                        </select>
                                                                    </td>
                                                                    <td class="px-3 py-2 text-right">
                                                                        <input v-model.number="reward.rewardQty" type="number" min="1" class="h-[35px] w-[100px] rounded border border-gray-300 p-2 text-right text-sm text-black" />
                                                                    </td>
                                                                    <td class="px-3 py-2 text-right">
                                                                        <button class="rounded px-2 py-1 text-red-600 hover:bg-red-50 hover:text-red-800" @click="tier.rewards = tier.rewards.filter(p => p.id !== reward.id)">
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

                                    <div class="mt-6 rounded border border-gray-200 bg-gray-50 p-4">
                                        <SubTitle label="FOC Stock" />
                                        <div class="mt-3 overflow-hidden rounded border border-gray-200 bg-white">
                                            <div class="max-h-[220px] overflow-auto">
                                                <table class="w-full min-w-[620px] border-collapse text-sm">
                                                    <thead>
                                                        <tr class="text-left text-gray-600">
                                                            <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Image</th>
                                                            <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Product Name</th>
                                                            <th class="sticky top-0 z-10 border-b bg-white px-3 py-2">Unit</th>
                                                            <th class="sticky top-0 z-10 border-b bg-white px-3 py-2 text-right">Allocated Qty</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr v-for="alloc in focAllocations" :key="`${alloc.id}-${alloc.productUnitId || 'default'}`" class="border-b hover:bg-gray-50">
                                                            <td class="px-3 py-2">
                                                                <img class="h-10 w-10 rounded object-cover" :src="alloc.image_url" />
                                                            </td>
                                                            <td class="px-3 py-2">{{ alloc.name }}</td>
                                                            <td class="px-3 py-2">
                                                                <select v-model="alloc.productUnitId" class="h-[35px] min-w-[120px] rounded border border-gray-300 px-2 py-1 text-sm">
                                                                    <option value="">All Units</option>
                                                                    <option v-for="unit in productUnitOptions(alloc)" :key="unit.id" :value="unit.id">{{ unit.unit_id?.name }}</option>
                                                                </select>
                                                            </td>
                                                            <td class="px-3 py-2 text-right">
                                                                <input v-model.number="alloc.allocatedQty" type="number" min="1" class="h-[35px] w-[100px] rounded border border-gray-300 p-2 text-right text-sm text-black" />
                                                            </td>
                                                        </tr>
                                                        <tr v-if="focAllocations.length === 0">
                                                            <td colspan="4" class="px-3 py-5 text-center text-gray-500">No allocated products</td>
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

                    <div v-if="isProductDialogVisible" class="fixed inset-0 z-50 flex items-center justify-center p-3">
                        <div class="absolute inset-0 bg-black opacity-50" @click="cancelProductSelection"></div>
                        <div class="z-10 flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded bg-white shadow-lg">
                            <div class="flex items-center justify-between gap-3 border-b px-4 py-3">
                                <SubTitle :label="productDialogTitle" />
                                <div class="text-sm text-gray-600">{{ selectionBuffer.length }} selected</div>
                            </div>

                            <div class="border-b px-4 py-3">
                                <input
                                    v-model="searchTerm"
                                    placeholder="Search by name or barcode"
                                    class="h-[35px] w-full rounded border border-[#cbd5e1] px-3 text-sm outline-none focus:border-black"
                                />
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

                    <div class="sticky bottom-0 z-10 mt-8 border-t border-gray-200 bg-white/95 py-4 backdrop-blur">
                        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <BaseButton
                                label="Save"
                                :isLoading="usePromo.loading"
                                :icon="usePromo.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'"
                                severity="primary"
                                class="w-full sm:w-auto"
                                @click="formSubmit"
                                :disabled="usePromo.loading"
                            />
                        </div>
                    </div>
                </template>
            </BaseCard>
        </div>
    </div>
</template>
