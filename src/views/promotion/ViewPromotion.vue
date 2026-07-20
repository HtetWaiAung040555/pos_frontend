<script setup>
import { useRoute, useRouter } from 'vue-router';
import { onMounted, ref, computed } from 'vue';
import moment from 'moment';
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import Loading from '@/components/Loading.vue';
import { usePromotionStore } from '@/stores/usePromotionStore';
import { useProductStore } from '@/stores/useProductStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { formatPrice, getPromotionLifecycleStatusName } from '@/utils/const';

const route = useRoute();
const router = useRouter();
const usePromo = usePromotionStore();
const useProduct = useProductStore();
const usePermission = usePermissionStore();

const promoId = ref(route.query.id || route.params.id || null);
const formData = ref({
    name: '',
    description: '',
    promoType: 'PRODUCT_DISCOUNT',
    promoMode: 'TIER',
    status: 'Active',
    discountType: 'AMOUNT',
    discountValue: 0,
    maxDiscountAmount: 0,
    overridePrice: 0,
    branchScopeType: 'ALL',
    warehouseScopeType: 'ALL',
    startDate: moment().format('YYYY-MM-DD HH:mm:ss'),
    endDate: moment().add(1, 'days').format('YYYY-MM-DD HH:mm:ss'),
    createdBy: null,
    createdAt: null,
    updatedBy: null,
    updatedAt: null,
});

const selectedProducts = ref([]);
const focTiers = ref([]);
const focAllocations = ref([]);
const orderDiscountTiers = ref([]);
const priceOverrideTiers = ref([]);
const selectedBranches = ref([]);
const selectedWarehouses = ref([]);
const productList = ref([]);
const isInitLoading = ref(true);

const promotionTypes = {
    PRODUCT_DISCOUNT: {
        label: 'Product discount',
        icon: 'fa fa-tags',
        badge: 'bg-orange-50 text-orange-700 ring-orange-200',
        iconStyle: 'bg-orange-100 text-orange-600',
    },
    ORDER_DISCOUNT: {
        label: 'Order discount',
        icon: 'fa fa-receipt',
        badge: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
        iconStyle: 'bg-cyan-100 text-cyan-600',
    },
    FOC: {
        label: 'Free item (FOC)',
        icon: 'fa fa-gift',
        badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
        iconStyle: 'bg-indigo-100 text-indigo-600',
    },
    PRICE_OVERRIDE: {
        label: 'Price override',
        icon: 'fa fa-money-bill-wave',
        badge: 'bg-violet-50 text-violet-700 ring-violet-200',
        iconStyle: 'bg-violet-100 text-violet-600',
    },
};

const isProductDiscount = computed(() => formData.value.promoType === 'PRODUCT_DISCOUNT');
const isOrderDiscount = computed(() => formData.value.promoType === 'ORDER_DISCOUNT');
const isPriceOverride = computed(() => formData.value.promoType === 'PRICE_OVERRIDE');
const isFOC = computed(() => formData.value.promoType === 'FOC');
const typeMeta = computed(() => promotionTypes[formData.value.promoType] || promotionTypes.PRODUCT_DISCOUNT);
const priceOverrideTargetQty = computed(() => Number(priceOverrideTiers.value[0]?.target_value) || 0);
const priceOverrideAverage = computed(() => (
    priceOverrideTargetQty.value > 0
        ? Math.round((Number(formData.value.overridePrice) || 0) / priceOverrideTargetQty.value)
        : 0
));
const canEdit = computed(() => (
    usePermission.can('Promotion', 'Update') && formData.value.status !== 'Inactive'
));

const lifecycleMeta = computed(() => {
    const status = formData.value.status;
    if (status === 'Applied') {
        return { label: 'Ongoing', icon: 'fa fa-circle-play', classes: 'bg-green-50 text-green-700 ring-green-200' };
    }
    if (status === 'Active') {
        return { label: 'Upcoming', icon: 'fa fa-clock', classes: 'bg-blue-50 text-blue-700 ring-blue-200' };
    }
    return { label: 'Ended', icon: 'fa fa-circle-stop', classes: 'bg-gray-100 text-gray-600 ring-gray-200' };
});

onMounted(async () => {
    isInitLoading.value = true;
    try {
        await useProduct.fetchAllProduct();
        productList.value = useProduct.productList || [];

        if (!promoId.value) return;

        await usePromo.fetchPromo(promoId.value);
        const promo = usePromo.promoList || {};
        formData.value.name = promo.name || '';
        formData.value.description = promo.description || '';
        formData.value.promoType = promo.promo_type || 'PRODUCT_DISCOUNT';
        formData.value.discountType = promo.discount_type || 'AMOUNT';
        formData.value.discountValue = Number(promo.discount_value) || 0;
        formData.value.overridePrice = Number(promo.override_price) || 0;
        formData.value.branchScopeType = promo.branch_scope_type || 'ALL';
        formData.value.warehouseScopeType = promo.warehouse_scope_type || 'ALL';
        formData.value.startDate = promo.start_at || formData.value.startDate;
        formData.value.endDate = promo.end_at || formData.value.endDate;
        formData.value.status = getPromotionLifecycleStatusName(promo.start_at, promo.end_at);
        formData.value.promoMode = promo.promo_mode || 'TIER';
        formData.value.maxDiscountAmount = Number(promo.max_reward_value) || 0;
        formData.value.createdBy = promo.created_by?.name || '';
        formData.value.createdAt = promo.created_at || null;
        formData.value.updatedBy = promo.updated_by?.name || '';
        formData.value.updatedAt = promo.updated_at || null;

        selectedBranches.value = Array.isArray(promo.branches) ? promo.branches.slice() : [];
        selectedWarehouses.value = Array.isArray(promo.warehouses) ? promo.warehouses.slice() : [];

        if (['PRODUCT_DISCOUNT', 'PRICE_OVERRIDE'].includes(promo.promo_type)) {
            if (Array.isArray(promo.products) && promo.products.length > 0) {
                if (typeof promo.products[0] === 'object') {
                    selectedProducts.value = promo.products.map((promotionProduct) => ({
                        ...(productList.value.find(product => product.id === promotionProduct.id) || {}),
                        ...promotionProduct,
                        product_unit_id: promotionProduct.promotion_product_unit_id ?? null,
                        unit_id: promotionProduct.promotion_unit_id ?? null,
                        ...(promo.promo_type === 'PRICE_OVERRIDE' ? {
                            max_qty_per_sales_order: promotionProduct.max_qty_per_sales_order ?? null,
                        } : {}),
                    }));
                } else {
                    selectedProducts.value = promo.products
                        .map(id => productList.value.find(product => product.id === id))
                        .filter(Boolean)
                        .map(product => ({
                            ...product,
                            ...(promo.promo_type === 'PRICE_OVERRIDE' ? { max_qty_per_sales_order: null } : {}),
                        }));
                }
            }
        }

        if (promo.promo_type === 'PRICE_OVERRIDE' && Array.isArray(promo.conditions)) {
            const firstCondition = promo.conditions[0] || {};
            priceOverrideTiers.value = [{
                condition_type: 'ORDER_QTY',
                target_value: Number(firstCondition.target_value) || 0,
            }];
        }

        if (promo.promo_type === 'ORDER_DISCOUNT' && Array.isArray(promo.conditions)) {
            orderDiscountTiers.value = promo.conditions.map((condition) => {
                const reward = (promo.rewards || []).find(item => item.tier === condition.tier);
                return {
                    condition_type: condition.condition_type,
                    target_value: Number(condition.target_value),
                    discount_type: reward?.reward_type === 'PERCENT' ? 'PERCENT' : 'AMOUNT',
                    discount_value: Number(reward?.reward_value) || 0,
                };
            });
        }

        if (promo.promo_type === 'FOC' && Array.isArray(promo.conditions)) {
            focTiers.value = promo.conditions.map((condition) => {
                const rewards = (promo.rewards || []).filter(item => item.tier === condition.tier && item.reward_type === 'FREE_PRODUCT');
                return {
                    condition_type: condition.condition_type,
                    target_value: Number(condition.target_value),
                    conditionProductId: condition.product?.id || '',
                    rewards: rewards.map(reward => ({
                        ...reward.product,
                        rewardQty: Number(reward.reward_qty) || 1,
                    })),
                };
            });
        }

        if (promo.promo_type === 'FOC' && Array.isArray(promo.foc_allocations)) {
            focAllocations.value = promo.foc_allocations.map((allocation) => ({
                id: allocation.id,
                productId: allocation.product?.id ?? allocation.product_id,
                name: allocation.product?.name ?? '',
                image_url: allocation.product?.image_url ?? '',
                allocatedQty: Number(allocation.allocated_qty) || 0,
                usedQty: Number(allocation.used_qty) || 0,
                remainingQty: Number(allocation.remaining_qty) || 0,
                warehouseId: allocation.allocated_warehouse_id ?? null,
            }));
        }
    } finally {
        isInitLoading.value = false;
    }
});

function formatDate(value) {
    return value ? moment(value).format('DD MMM YYYY, hh:mm A') : '-';
}

function formatConditionType(type) {
    const labels = {
        ORDER_QTY: 'Order quantity',
        ORDER_AMOUNT: 'Order amount',
        ITEM_QTY: 'Item quantity',
        ITEM_AMOUNT: 'Item amount',
    };
    return labels[type] || String(type || '-').replaceAll('_', ' ');
}

function formatTargetValue(tier) {
    const value = Number(tier.target_value) || 0;
    return ['ORDER_AMOUNT', 'ITEM_AMOUNT'].includes(tier.condition_type)
        ? `Ks. ${formatPrice(value)}`
        : formatPrice(value);
}

function formatDiscountValue(tier) {
    const value = Number(tier.discount_value) || 0;
    return tier.discount_type === 'PERCENT' ? `${formatPrice(value)}%` : `Ks. ${formatPrice(value)}`;
}

function getFinalPrice(product) {
    const price = productPrice(product);
    const value = Number(formData.value.discountValue) || 0;
    if (formData.value.discountType === 'AMOUNT') return Math.max(0, price - value);
    return Math.max(0, price * (1 - value / 100));
}

function productUnit(product) {
    const promotionProductUnitId = Number(product.promotion_product_unit_id || product.product_unit_id || 0);
    const unit = (product.product_units || []).find(item => Number(item.id) === promotionProductUnitId);
    return unit?.unit_id?.name || product.unit_id?.name || product.unit?.name || 'All units';
}

function productPrice(product) {
    const promotionProductUnitId = Number(product.promotion_product_unit_id || product.product_unit_id || 0);
    const unit = (product.product_units || []).find(item => Number(item.id) === promotionProductUnitId);
    return Number(unit?.price ?? product.price ?? 0);
}

function listNames(items) {
    if (!items || items.length === 0) return '-';
    return items.map(item => item.name || `#${item.id}`).join(', ');
}

function warehouseName(warehouseId) {
    const warehouse = selectedWarehouses.value.find(item => item.id == warehouseId);
    return warehouse?.name || (warehouseId ? `Warehouse #${warehouseId}` : '-');
}

function stockUsagePercent(allocation) {
    if (allocation.allocatedQty <= 0) return 0;
    return Math.min(100, Math.round((allocation.usedQty / allocation.allocatedQty) * 100));
}

function goBack() {
    if (window.history.length > 1) router.back();
    else router.push('/promotion');
}

function editPromotion() {
    if (!canEdit.value) return;
    router.push({ name: 'Update Promotion', query: { id: promoId.value } });
}
</script>

<template>
    <div class="p-3 sm:p-4 lg:p-6">
        <div class="mx-auto w-full max-w-screen-2xl">
            <div v-if="isInitLoading" class="fixed inset-0 z-50 flex items-center justify-center bg-opacity-30">
                <div class="flex flex-col items-center rounded-xl bg-white p-8 shadow-lg">
                    <Loading variant="page" loadingWidth="w-[56px]" />
                </div>
            </div>

            <PageTitle :title="formData.name || 'Promotion details'">
                <template #titleButtons>
                    <div class="promotion-view-actions flex items-center gap-2">
                        <BaseButton
                            v-if="canEdit"
                            icon="fa fa-pen-to-square"
                            label="Edit promotion"
                            variant="outlined"
                            severity="info"
                            title="Edit promotion"
                            aria-label="Edit promotion"
                            @click="editPromotion"
                        />
                        <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary" title="Back" aria-label="Back" @click="goBack" />
                    </div>
                </template>
            </PageTitle>

            <template v-if="!isInitLoading">
                <section class="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div class="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                        <div class="flex min-w-0 items-start gap-4">
                            <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" :class="typeMeta.iconStyle">
                                <i :class="typeMeta.icon"></i>
                            </span>
                            <div class="min-w-0">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset" :class="typeMeta.badge">{{ typeMeta.label }}</span>
                                    <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset" :class="lifecycleMeta.classes">
                                        <i :class="lifecycleMeta.icon"></i>{{ lifecycleMeta.label }}
                                    </span>
                                </div>
                                <h1 class="mt-2 truncate text-xl font-semibold text-slate-950">{{ formData.name }}</h1>
                                <p class="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{{ formData.description || 'No description was added for this promotion.' }}</p>
                            </div>
                        </div>
                        <span class="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-500 shadow-sm ring-1 ring-slate-200">Promotion #{{ promoId }}</span>
                    </div>

                    <div class="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
                        <div class="p-4 sm:p-5">
                            <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Starts</p>
                            <p class="mt-1 text-sm font-semibold text-slate-900">{{ formatDate(formData.startDate) }}</p>
                        </div>
                        <div class="p-4 sm:p-5">
                            <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Ends</p>
                            <p class="mt-1 text-sm font-semibold text-slate-900">{{ formatDate(formData.endDate) }}</p>
                        </div>
                        <div class="p-4 sm:p-5">
                            <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Branch availability</p>
                            <p class="mt-1 text-sm font-semibold text-slate-900">{{ formData.branchScopeType === 'ALL' ? 'All branches' : `${selectedBranches.length} selected` }}</p>
                            <p v-if="formData.branchScopeType === 'SELECTED'" class="mt-0.5 truncate text-xs text-slate-500">{{ listNames(selectedBranches) }}</p>
                        </div>
                        <div class="p-4 sm:p-5">
                            <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Warehouse availability</p>
                            <p class="mt-1 text-sm font-semibold text-slate-900">{{ formData.warehouseScopeType === 'ALL' ? 'All warehouses' : `${selectedWarehouses.length} selected` }}</p>
                            <p v-if="formData.warehouseScopeType === 'SELECTED'" class="mt-0.5 truncate text-xs text-slate-500">{{ listNames(selectedWarehouses) }}</p>
                        </div>
                    </div>
                </section>

                <section class="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                    <div class="flex items-center gap-3">
                        <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><i class="fa fa-sliders"></i></span>
                        <div>
                            <h2 class="text-base font-semibold text-slate-900">Promotion rules</h2>
                            <p class="text-xs text-slate-500">The condition and benefit applied at checkout.</p>
                        </div>
                    </div>

                    <div v-if="isProductDiscount" class="mt-5 rounded-xl border border-orange-200 bg-orange-50/60 p-4">
                        <p class="text-xs font-semibold uppercase tracking-wide text-orange-700">Product discount</p>
                        <p class="mt-1 text-lg font-semibold text-slate-900">
                            {{ formData.discountType === 'PERCENT' ? `${formatPrice(formData.discountValue)}% off` : `Ks. ${formatPrice(formData.discountValue)} off` }}
                        </p>
                        <p class="mt-1 text-xs text-slate-500">Applied to {{ selectedProducts.length }} eligible {{ selectedProducts.length === 1 ? 'product' : 'products' }}.</p>
                    </div>

                    <div v-if="isPriceOverride" class="mt-5 overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-blue-50">
                        <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p class="text-xs font-semibold uppercase tracking-wide text-violet-700">Mix & Match Deal</p>
                                <p class="mt-1 text-lg font-semibold text-slate-900">Any {{ priceOverrideTargetQty }} eligible products for Ks. {{ formatPrice(formData.overridePrice) }}</p>
                                <p class="mt-1 text-xs text-slate-500">Customers can mix products from the eligible list below.</p>
                            </div>
                            <div class="rounded-lg bg-white/80 px-4 py-2 ring-1 ring-white">
                                <p class="text-xs text-slate-500">Average per item</p>
                                <p class="text-base font-semibold text-slate-900">Ks. {{ formatPrice(priceOverrideAverage) }}</p>
                            </div>
                        </div>
                    </div>

                    <div v-if="isOrderDiscount" class="mt-5">
                        <div class="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span class="rounded-full bg-cyan-50 px-2.5 py-1 font-medium text-cyan-700">{{ formData.promoMode === 'MULTIPLIER' ? 'Multiplier' : `${orderDiscountTiers.length} tiers` }}</span>
                            <span v-if="formData.maxDiscountAmount > 0">Maximum discount: Ks. {{ formatPrice(formData.maxDiscountAmount) }}</span>
                        </div>
                        <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            <article v-for="(tier, index) in orderDiscountTiers" :key="index" class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div class="flex items-center justify-between gap-3">
                                    <span class="text-sm font-semibold text-slate-900">Tier {{ index + 1 }}</span>
                                    <span class="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">{{ formatConditionType(tier.condition_type) }}</span>
                                </div>
                                <div class="mt-4 grid grid-cols-2 gap-4">
                                    <div><p class="text-xs text-slate-500">Customer reaches</p><p class="mt-1 font-semibold text-slate-900">{{ formatTargetValue(tier) }}</p></div>
                                    <div><p class="text-xs text-slate-500">Customer receives</p><p class="mt-1 font-semibold text-cyan-700">{{ formatDiscountValue(tier) }} off</p></div>
                                </div>
                            </article>
                            <p v-if="orderDiscountTiers.length === 0" class="col-span-full rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No tiers configured.</p>
                        </div>
                    </div>

                    <div v-if="isFOC" class="mt-5 space-y-4">
                        <article v-for="(tier, index) in focTiers" :key="index" class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p class="text-sm font-semibold text-slate-900">Tier {{ index + 1 }} · {{ formatConditionType(tier.condition_type) }}</p>
                                    <p class="mt-1 text-xs text-slate-500">
                                        Target: {{ formatTargetValue(tier) }}
                                        <span v-if="tier.conditionProductId"> · {{ productList.find(product => product.id == tier.conditionProductId)?.name || 'Selected product' }}</span>
                                    </p>
                                </div>
                                <span class="w-fit rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{{ tier.rewards.length }} rewards</span>
                            </div>
                            <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                <div v-for="reward in tier.rewards" :key="reward.id" class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                                    <img :src="reward.image_url" alt="" class="h-10 w-10 rounded-lg bg-slate-100 object-cover" />
                                    <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-slate-900">{{ reward.name }}</p><p class="text-xs text-slate-500">Reward quantity: {{ reward.rewardQty }}</p></div>
                                </div>
                                <p v-if="tier.rewards.length === 0" class="col-span-full text-sm text-slate-500">No reward products configured.</p>
                            </div>
                        </article>
                        <p v-if="focTiers.length === 0" class="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No tiers configured.</p>
                    </div>
                </section>

                <section v-if="isProductDiscount || isPriceOverride" class="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                    <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><i class="fa fa-boxes-stacked"></i></span>
                            <div><h2 class="text-base font-semibold text-slate-900">Eligible products</h2><p class="text-xs text-slate-500">{{ selectedProducts.length }} products included in this promotion.</p></div>
                        </div>
                    </div>

                    <div class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <article v-for="product in selectedProducts" :key="product.id" class="flex min-w-0 gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/20">
                            <img :src="product.image_url" alt="" class="h-14 w-14 shrink-0 rounded-lg bg-slate-100 object-cover" />
                            <div class="min-w-0 flex-1">
                                <p class="truncate text-sm font-semibold text-slate-900">{{ product.name }}</p>
                                <p class="mt-0.5 text-xs text-slate-500">{{ productUnit(product) }}</p>
                                <div class="mt-2 flex flex-wrap items-end justify-between gap-2">
                                    <div>
                                        <p class="text-[11px] text-slate-400">Regular price</p>
                                        <p class="text-sm font-medium text-slate-700">Ks. {{ formatPrice(productPrice(product)) }}</p>
                                    </div>
                                    <div v-if="isProductDiscount" class="text-right">
                                        <p class="text-[11px] text-slate-400">Final price</p>
                                        <p class="text-sm font-semibold text-orange-700">Ks. {{ formatPrice(getFinalPrice(product)) }}</p>
                                    </div>
                                    <div v-else class="text-right">
                                        <p class="text-[11px] text-slate-400">Per-order limit</p>
                                        <p class="text-sm font-semibold text-violet-700">{{ product.max_qty_per_sales_order == null ? 'Unlimited' : product.max_qty_per_sales_order }}</p>
                                    </div>
                                </div>
                            </div>
                        </article>
                        <p v-if="selectedProducts.length === 0" class="col-span-full rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No eligible products.</p>
                    </div>
                </section>

                <section v-if="isFOC" class="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                    <div class="flex items-center gap-3">
                        <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><i class="fa fa-warehouse"></i></span>
                        <div><h2 class="text-base font-semibold text-slate-900">FOC stock allocation</h2><p class="text-xs text-slate-500">Allocated, used, and remaining reward inventory.</p></div>
                    </div>
                    <div class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <article v-for="allocation in focAllocations" :key="allocation.id" class="rounded-xl border border-slate-200 p-4">
                            <div class="flex items-center gap-3"><img :src="allocation.image_url" alt="" class="h-11 w-11 rounded-lg bg-slate-100 object-cover" /><div class="min-w-0"><p class="truncate text-sm font-semibold text-slate-900">{{ allocation.name }}</p><p class="text-xs text-slate-500">{{ warehouseName(allocation.warehouseId) }}</p></div></div>
                            <div class="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-emerald-500" :style="{ width: `${stockUsagePercent(allocation)}%` }"></div></div>
                            <div class="mt-3 grid grid-cols-3 gap-2 text-center"><div><p class="text-[11px] text-slate-400">Allocated</p><p class="text-sm font-semibold">{{ allocation.allocatedQty }}</p></div><div><p class="text-[11px] text-slate-400">Used</p><p class="text-sm font-semibold">{{ allocation.usedQty }}</p></div><div><p class="text-[11px] text-slate-400">Remaining</p><p class="text-sm font-semibold text-emerald-700">{{ allocation.remainingQty }}</p></div></div>
                        </article>
                        <p v-if="focAllocations.length === 0" class="col-span-full rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No stock was allocated.</p>
                    </div>
                </section>

                <section class="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                    <div class="flex items-center gap-3"><span class="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><i class="fa fa-clock-rotate-left"></i></span><h2 class="text-base font-semibold text-slate-900">Record history</h2></div>
                    <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div><p class="text-xs text-slate-500">Created by</p><p class="mt-1 text-sm font-semibold text-slate-900">{{ formData.createdBy || '-' }}</p></div>
                        <div><p class="text-xs text-slate-500">Created at</p><p class="mt-1 text-sm font-semibold text-slate-900">{{ formatDate(formData.createdAt) }}</p></div>
                        <div><p class="text-xs text-slate-500">Last updated by</p><p class="mt-1 text-sm font-semibold text-slate-900">{{ formData.updatedBy || '-' }}</p></div>
                        <div><p class="text-xs text-slate-500">Last updated at</p><p class="mt-1 text-sm font-semibold text-slate-900">{{ formatDate(formData.updatedAt) }}</p></div>
                    </div>
                </section>
            </template>
        </div>
    </div>
</template>

<style scoped>
@media (max-width: 639px) {
    .promotion-view-actions :deep(button) {
        padding-left: 10px;
        padding-right: 10px;
    }

    .promotion-view-actions :deep(button span) {
        display: none;
    }

    .promotion-view-actions :deep(button i) {
        margin-right: 0;
    }
}
</style>
