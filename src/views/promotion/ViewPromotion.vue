<script setup>
import { useRoute, useRouter } from 'vue-router';
import { onMounted, ref, computed } from 'vue';
import moment from 'moment';
import PageTitle from '@/components/PageTitle.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import BaseInput from '@/components/BaseInput.vue';
import BaseSwitch from '@/components/BaseSwitch.vue';
import { usePromotionStore } from '@/stores/usePromotionStore';
import { useProductStore } from '@/stores/useProductStore';
import BaseButton from '@/components/BaseButton.vue';
import { formatPrice, statusBadgeHtml } from '@/utils/const';
import DetailRow from '@/components/DetailRow.vue';

const route = useRoute();
const router = useRouter();
const usePromo = usePromotionStore();
const useProduct = useProductStore();

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
    conditionType: 'ORDER_AMOUNT',
    conditionProductId: '',
    targetValue: 0,
    rewardProductId: '',
    rewardQty: 1,
    startDate: moment().format('YYYY-MM-DD HH:mm:ss'),
    endDate: moment().add(1, 'days').format('YYYY-MM-DD HH:mm:ss'),
    createdBy: null,
    createdAt: null,
    updatedBy: null,
    updatedAt: null,
});
const selectedProducts = ref([]);
const focTiers = ref([]);
const orderDiscountTiers = ref([]);
const promoMode = ref('TIER');
const maxDiscountAmount = ref(0);
const promoStatus = ref(true);
const productList = ref([]);

const isProductDiscount = computed(() => formData.value.promoType === 'PRODUCT_DISCOUNT');
const isOrderDiscount = computed(() => formData.value.promoType === 'ORDER_DISCOUNT');
const isFOC = computed(() => formData.value.promoType === 'FOC');

onMounted(async () => {
    await useProduct.fetchAllProduct();
    productList.value = useProduct.productList || [];
    if (promoId.value) {
        await usePromo.fetchPromo(promoId.value);
        const promo = usePromo.promoList || {};
        formData.value.name = promo.name || '';
        formData.value.description = promo.description || '';
        formData.value.promoType = promo.promo_type || 'PRODUCT_DISCOUNT';
        formData.value.discountType = promo.discount_type || 'AMOUNT';
        formData.value.discountValue = Number(promo.discount_value) || 0;
        formData.value.startDate = promo.start_at || formData.value.startDate;
        formData.value.endDate = promo.end_at || formData.value.endDate;
        formData.value.status = promo.status?.id === 1 || promo.active === true ? 'Active' : 'Inactive';
        formData.value.promoMode = promo.promo_mode || 'TIER';
        formData.value.maxDiscountAmount = Number(promo.max_reward_value) || 0;
        formData.value.createdBy = promo.created_by?.name || '';
        formData.value.createdAt = promo.created_at || null;
        formData.value.updatedBy = promo.updated_by?.name || '';
        formData.value.updatedAt = promo.updated_at || null;
        promoStatus.value = promo.status?.id === 1 || promo.active === true;
        promoMode.value = promo.promo_mode || 'TIER';
        maxDiscountAmount.value = Number(promo.max_reward_value) || 0;
        // PRODUCT_DISCOUNT
        if (promo.promo_type === 'PRODUCT_DISCOUNT') {
            if (Array.isArray(promo.products) && promo.products.length > 0) {
                if (typeof promo.products[0] === 'object') {
                    selectedProducts.value = promo.products.slice();
                } else {
                    selectedProducts.value = promo.products.map(id => productList.value.find(p => p.id === id)).filter(Boolean);
                }
            }
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
    }
});

function getFinalPrice(product) {
    const price = Number(product.price) || 0;
    const val = Number(formData.value.discountValue) || 0;
    if (formData.value.discountType === 'AMOUNT') {
        return Math.max(0, price - val);
    }
    // percentage
    return Math.max(0, price * (1 - val / 100));
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/promotion');
  }
}
</script>

<template>
    <div class="p-4 w-full">
        <PageTitle title="View Promotion">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary" @click="goBack" />
                </div>
            </template>
        </PageTitle>
        <BaseCard class="mt-3 w-full">
            <template #cardElements>
                <SubTitle label="Promotion Details" />
                <div class="grid lg:grid-cols-3 gap-x-4 mt-6">
                    <div class="col-span-2 grid grid-cols-2 gap-2 h-fit">
                        <DetailRow label="Name" :value="formData.name" />
                        <DetailRow label="Promo Type" :value="formData.promoType" />
                        <DetailRow v-if="!isProductDiscount" label="Promo Mode" :value="formData.promoMode" />
                        <DetailRow v-if="!isProductDiscount" label="Max Discount" :value="formData.maxDiscountAmount" />
                        <DetailRow label="Start Date" :value="formData.startDate" :formatter="v => moment(v).format('DD-MM-YYYY hh:mm:ss A')" />
                        <DetailRow label="End Date" :value="formData.endDate" :formatter="v => moment(v).format('DD-MM-YYYY hh:mm:ss A')" />
                        <DetailRow v-if="isProductDiscount" label="Discount Type" :value="formData.discountType" />
                        <DetailRow v-if="isProductDiscount" label="Discount Value" :value="formData.discountValue" />
                        <DetailRow label="Description" :value="formData.description" />
                    </div>
                    <div class="grid grid-cols-1 gap-2 h-fit">
                        <DetailRow label="Status:">
                          <span v-html="statusBadgeHtml(formData.status)"></span>
                        </DetailRow>
                        <DetailRow label="Created By" :value="formData.createdBy" />
                        <DetailRow label="Created At" :value="formData.createdAt" :formatter="v => moment(v).format('DD-MM-YYYY hh:mm:ss A')" />
                        <DetailRow label="Updated By" :value="formData.updatedBy" />
                        <DetailRow label="Updated At" :value="formData.updatedAt" :formatter="v => moment(v).format('DD-MM-YYYY hh:mm:ss A')" />
                    </div>
                </div>
                <!-- <div class="flex gap-x-4 mt-6">
                    <BaseInput size="sm" v-model="formData.name" label="Name" width="300px" height="h-[35px]" :readonly="true" />
                    <div class="flex flex-col gap-1 w-[300px]">
                        <BaseLabel label="Promo Type" />
                        <input class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px] bg-gray-100" :value="formData.promoType" readonly />
                    </div>
                    <div class="flex flex-col gap-y-1 w-[200px]">
                        <BaseLabel label="Status" />
                        <BaseSwitch v-model="promoStatus" :disabled="true" />
                    </div>
                </div>
                <div class="flex gap-x-4 mt-4">
                    <template v-if="isOrderDiscount || isFOC">
                        <div class="flex flex-col gap-1 w-[300px]">
                            <BaseLabel label="Promo Mode" />
                            <input class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px] bg-gray-100" :value="promoMode" readonly />
                        </div>
                    </template>
                    <template v-if="isOrderDiscount">
                        <div class="flex flex-col gap-1 w-[300px]">
                            <BaseLabel label="Max Discount Amount (optional)" />
                            <BaseInput v-model="maxDiscountAmount" type="number" min="0" :readonly="true" />
                        </div>
                    </template>
                    <BaseInput size="sm" v-model="formData.startDate" label="Started Datetime" width="300px" height="h-[35px]" type="datetime-local" :readonly="true" />
                    <BaseInput size="sm" v-model="formData.endDate" label="Ended Datetime" width="300px" height="h-[35px]" type="datetime-local" :readonly="true" />
                </div>
                <div class="flex gap-x-4 mt-4">
                    <BaseInput v-model="formData.description" label="Description" :readonly="true" />
                </div> -->
                <template v-if="isProductDiscount">
                    <div class="flex flex-col">
                        <SubTitle label="Selected Products" />
                        <div class="mt-4">
                            <div class="max-h-[350px] overflow-y-auto rounded">
                                <table class="w-full text-sm border-collapse">
                                    <thead>
                                        <tr class="text-left text-gray-600">
                                            <th class="py-2 sticky top-0 bg-white z-10 border-b">Image</th>
                                            <th class="py-2 sticky top-0 bg-white z-10 border-b">Product Name</th>
                                            <th class="py-2 text-right sticky top-0 bg-white z-10 border-b">Price</th>
                                            <th class="py-2 text-right sticky top-0 bg-white z-10 border-b">Final Price</th>
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
                                            <td class="py-2 text-right">{{ formatPrice(product.price) }}</td>
                                            <td class="py-2 text-right">{{ formatPrice(getFinalPrice(product)) }}</td>
                                        </tr>
                                        <tr v-if="selectedProducts.length === 0">
                                            <td colspan="4" class="py-4 text-center text-gray-500">No products selected</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </template>
                <template v-else>
                    <div v-if="isOrderDiscount">
                        <SubTitle :label="promoMode === 'MULTIPLIER' ? 'Multiplier' : 'Tiers'" class="mt-6 mb-4" />
                        <div v-for="(tier, idx) in orderDiscountTiers" :key="idx" class="border rounded p-4 mb-4 bg-gray-50 w-fit">
                            <div class="flex gap-x-4 flex-wrap items-end">
                                <div class="flex flex-col gap-1 w-[200px]">
                                    <BaseLabel label="Condition Type" />
                                    <input class="border p-2 rounded bg-gray-100 w-full" :value="tier.condition_type" readonly />
                                </div>
                                <BaseInput size="sm" v-model="tier.target_value" label="Target Value" width="200px" height="h-[35px]" type="number" :readonly="true" />
                                <div class="flex flex-col gap-1 w-[200px]">
                                    <BaseLabel label="Discount Type" />
                                    <input class="border p-2 rounded bg-gray-100 w-full" :value="tier.discount_type" readonly />
                                </div>
                                <BaseInput size="sm" v-model="tier.discount_value" label="Reward Value" width="200px" height="h-[35px]" type="number" :readonly="true" />
                            </div>
                        </div>
                    </div>
                    <div v-if="isFOC">
                        <SubTitle :label="promoMode === 'MULTIPLIER' ? 'Multiplier' : 'Tiers'" class="mt-6 mb-4" />
                        <div v-for="(tier, idx) in focTiers" :key="idx" class="border rounded p-4 mb-4 bg-gray-50 w-fit">
                            <div class="flex gap-x-4 flex-wrap items-end">
                                <div class="flex flex-col gap-1 w-[200px]">
                                    <BaseLabel label="Condition Type" />
                                    <input class="border p-2 rounded bg-gray-100 w-full" :value="tier.condition_type" readonly />
                                </div>
                                <div v-if="['ITEM_QTY','ITEM_AMOUNT'].includes(tier.condition_type)" class="flex flex-col gap-1 w-[200px]">
                                    <BaseLabel label="Condition Product" />
                                    <input class="border p-2 rounded bg-gray-100 w-full" :value="productList.find(p => p.id == tier.conditionProductId)?.name || ''" readonly />
                                </div>
                                <BaseInput size="sm" v-model="tier.target_value" label="Target Value" width="200px" height="h-[35px]" type="number" :readonly="true" />
                            </div>
                            <div class="mt-4">
                                <BaseLabel label="Reward Products" />
                                <div class="max-h-[200px] overflow-y-auto rounded border border-gray-200 mt-2">
                                    <table class="w-full text-sm border-collapse">
                                        <thead>
                                            <tr class="text-left text-gray-600">
                                                <th class="py-2 px-2 border-b">Image</th>
                                                <th class="py-2 px-2 border-b">Product Name</th>
                                                <th class="py-2 px-2 border-b text-right">Reward Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="reward in tier.rewards" :key="reward.id" class="border-b hover:bg-gray-50">
                                                <td class="py-2 px-2">
                                                    <img class="object-cover w-10 h-10 rounded" :src="reward.image_url" />
                                                </td>
                                                <td class="py-2 px-2">{{ reward.name }}</td>
                                                <td class="py-2 px-2 text-right">
                                                    <input v-model.number="reward.rewardQty" type="number" min="1" class="text-md border border-gray-500 rounded-sm p-2 text-black w-[100px] h-[35px] text-right bg-gray-100" readonly />
                                                </td>
                                            </tr>
                                            <tr v-if="tier.rewards.length === 0">
                                                <td colspan="3" class="py-4 text-center text-gray-500">No reward products selected</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </template>
        </BaseCard>
    </div>
</template>
