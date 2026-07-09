<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import moment from 'moment';
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import DetailRow from '@/components/DetailRow.vue';
import Loading from '@/components/Loading.vue';
import { formatPrice, statusBadgeHtml } from '@/utils/const';
import { useProductStore } from '@/stores/useProductStore';

const route = useRoute();
const router = useRouter();
const useProduct = useProductStore();
const product = ref({});
const isInitLoading = ref(true);

const productUnits = computed(() => product.value.product_units || []);
const branchProducts = computed(() => product.value.branch_products || []);
const defaultProductUnit = computed(() => {
  return product.value.default_product_unit?.id
    ? product.value.default_product_unit
    : productUnits.value.find((unit) => unit.is_default_sale_unit)
      || productUnits.value.find((unit) => unit.is_base_unit)
      || productUnits.value[0]
      || null;
});

onMounted(async () => {
  isInitLoading.value = true;
  try {
    await useProduct.fetchProduct(route.query.id);
    product.value = useProduct.productList || {};
  } finally {
    isInitLoading.value = false;
  }
});

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/product');
  }
}

function unitName(productUnit) {
  return productUnit?.unit_id?.name || productUnit?.unit_name || productUnit?.unit?.name || '-';
}

function productStatusName(item) {
  return item?.status?.name || '-';
}

function booleanText(value) {
  return value ? 'Yes' : 'No';
}

function formatDate(value) {
  return value ? moment(value).format('DD-MM-YYYY hh:mm:ss A') : '-';
}
</script>

<template>
  <div class="p-4">
    <div v-if="isInitLoading" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="flex flex-col items-center rounded-lg bg-white p-8 shadow-lg">
        <Loading variant="page" loadingWidth="w-[56px]" />
      </div>
    </div>

    <PageTitle title="View Product">
      <template #titleButtons>
        <div class="flex gap-x-2 items-center">
          <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary" @click="goBack" />
        </div>
      </template>
    </PageTitle>

    <template v-if="!isInitLoading">
      <BaseCard class="mt-3 w-full">
        <template #cardElements>
          <SubTitle label="Product Details" />
          <div class="flex justify-center mb-2">
            <img :src="product.image_url" :alt="product.name" class="object-cover w-32 h-32 rounded border border-gray-200" />
          </div>
          <div class="grid lg:grid-cols-3 gap-x-4 mt-6">
            <div class="col-span-2 grid grid-cols-2 gap-2 h-fit">
              <DetailRow label="Product ID" :value="product.id" />
              <DetailRow label="Name" :value="product.name" />
              <DetailRow label="Barcode" :value="product.barcode || '-'" />
              <DetailRow label="Category" :value="product.category_id?.name || '-'" />
              <DetailRow label="Secondary Property" :value="product.sec_prop || '-'" />
              <DetailRow label="UOM" :value="product.uom_enabled ? 'Multi-unit' : 'Single-unit'" />
              <DetailRow label="Base Unit" :value="defaultProductUnit ? unitName(defaultProductUnit) : product.unit_id?.name || '-'" />
              <DetailRow label="Sales Price" :value="product.price" :formatter="formatPrice" />
              <DetailRow label="Purchase Price" :value="product.purchase_price" :formatter="formatPrice" />
            </div>
            <div class="grid grid-cols-1 gap-2 h-fit">
              <DetailRow label="Status">
                <span v-html="statusBadgeHtml(product.status?.name)"></span>
              </DetailRow>
              <DetailRow label="Created By" :value="product.created_by?.name || '-'" />
              <DetailRow label="Created At" :value="product.created_at" :formatter="formatDate" />
              <DetailRow label="Updated By" :value="product.updated_by?.name || '-'" />
              <DetailRow label="Updated At" :value="product.updated_at" :formatter="formatDate" />
            </div>
          </div>
        </template>
      </BaseCard>

    <BaseCard class="mt-3 w-full">
      <template #cardElements>
        <SubTitle label="Product Units" />
        <div class="mt-4 overflow-x-auto">
          <table class="text-black w-full border-collapse border border-gray-200">
            <thead>
              <tr class="bg-gray-100 text-right">
                <th class="p-2 text-center w-[50px]">#</th>
                <th class="p-2 text-left">Unit</th>
                <th class="p-2 text-left">Barcode</th>
                <th class="p-2">Conversion</th>
                <th class="p-2">Sales Price</th>
                <th class="p-2">Purchase Price</th>
                <th class="p-2 text-center">Base Unit</th>
                <th class="p-2 text-center">Default Sale Unit</th>
                <th class="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(unit, index) in productUnits" :key="unit.id || index" class="hover:bg-blue-50 text-right">
                <td class="border-b border-gray-200 p-2 text-center">{{ index + 1 }}.</td>
                <td class="border-b border-gray-200 p-2 text-left">{{ unitName(unit) }}</td>
                <td class="border-b border-gray-200 p-2 text-left">{{ unit.barcode || '-' }}</td>
                <td class="border-b border-gray-200 p-2">{{ Number(unit.conversion_to_base || 0).toLocaleString('en-us') }}</td>
                <td class="border-b border-gray-200 p-2">{{ formatPrice(unit.price || 0) }}</td>
                <td class="border-b border-gray-200 p-2">{{ formatPrice(unit.purchase_price || 0) }}</td>
                <td class="border-b border-gray-200 p-2 text-center">{{ booleanText(unit.is_base_unit) }}</td>
                <td class="border-b border-gray-200 p-2 text-center">{{ booleanText(unit.is_default_sale_unit) }}</td>
                <td class="border-b border-gray-200 p-2 text-center">
                  <span v-html="statusBadgeHtml(productStatusName(unit))"></span>
                </td>
              </tr>
              <tr v-if="productUnits.length === 0">
                <td colspan="9" class="py-4 text-center text-gray-500">No product units found</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </BaseCard>

    <BaseCard class="mt-3 w-full">
      <template #cardElements>
        <SubTitle label="Price Ranges" />
        <div class="mt-4 overflow-x-auto">
          <table class="text-black w-full border-collapse border border-gray-200">
            <thead>
              <tr class="bg-gray-100 text-right">
                <th class="p-2 text-center w-[50px]">#</th>
                <th class="p-2 text-left">Unit</th>
                <th class="p-2">Min Qty</th>
                <th class="p-2">Max Qty</th>
                <th class="p-2">Price</th>
                <th class="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="unit in productUnits" :key="unit.id">
                <tr v-for="(range, index) in unit.price_ranges || []" :key="range.id || `${unit.id}-${index}`" class="hover:bg-blue-50 text-right">
                  <td class="border-b border-gray-200 p-2 text-center">{{ index + 1 }}.</td>
                  <td class="border-b border-gray-200 p-2 text-left">{{ unitName(unit) }}</td>
                  <td class="border-b border-gray-200 p-2">{{ Number(range.min_qty || 0).toLocaleString('en-us') }}</td>
                  <td class="border-b border-gray-200 p-2">{{ range.max_qty === null ? '+' : Number(range.max_qty || 0).toLocaleString('en-us') }}</td>
                  <td class="border-b border-gray-200 p-2">{{ formatPrice(range.price || 0) }}</td>
                  <td class="border-b border-gray-200 p-2 text-center">
                    <span v-html="statusBadgeHtml(productStatusName(range))"></span>
                  </td>
                </tr>
              </template>
              <tr v-if="productUnits.every((unit) => !(unit.price_ranges || []).length)">
                <td colspan="6" class="py-4 text-center text-gray-500">No price ranges found</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </BaseCard>

    <BaseCard class="mt-3 w-full">
      <template #cardElements>
        <SubTitle label="Branch UOM Prices" />
        <div class="mt-4 overflow-x-auto">
          <table class="text-black w-full border-collapse border border-gray-200">
            <thead>
              <tr class="bg-gray-100 text-right">
                <th class="p-2 text-center w-[50px]">#</th>
                <th class="p-2 text-left">Branch</th>
                <th class="p-2 text-left">Unit</th>
                <th class="p-2">Branch Price</th>
                <th class="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="branchProduct in branchProducts" :key="branchProduct.id">
                <tr
                  v-for="(unitPrice, index) in branchProduct.unit_prices || []"
                  :key="unitPrice.id || `${branchProduct.id}-${index}`"
                  class="hover:bg-blue-50 text-right"
                >
                  <td class="border-b border-gray-200 p-2 text-center">{{ index + 1 }}.</td>
                  <td class="border-b border-gray-200 p-2 text-left">{{ branchProduct.branch?.name || '-' }}</td>
                  <td class="border-b border-gray-200 p-2 text-left">{{ unitPrice.unit_name || unitPrice.product_unit?.unit_name || unitPrice.unit?.name || '-' }}</td>
                  <td class="border-b border-gray-200 p-2">{{ formatPrice(unitPrice.price || 0) }}</td>
                  <td class="border-b border-gray-200 p-2 text-center">
                    <span v-html="statusBadgeHtml(productStatusName(unitPrice))"></span>
                  </td>
                </tr>
              </template>
              <tr v-if="branchProducts.every((branchProduct) => !(branchProduct.unit_prices || []).length)">
                <td colspan="5" class="py-4 text-center text-gray-500">No branch UOM prices found</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </BaseCard>

    <BaseCard class="mt-3 w-full">
      <template #cardElements>
        <SubTitle label="Branch UOM Price Ranges" />
        <div class="mt-4 overflow-x-auto">
          <table class="text-black w-full border-collapse border border-gray-200">
            <thead>
              <tr class="bg-gray-100 text-right">
                <th class="p-2 text-center w-[50px]">#</th>
                <th class="p-2 text-left">Branch</th>
                <th class="p-2 text-left">Unit</th>
                <th class="p-2">Min Qty</th>
                <th class="p-2">Max Qty</th>
                <th class="p-2">Price</th>
                <th class="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="branchProduct in branchProducts" :key="branchProduct.id">
                <template v-for="unitPrice in branchProduct.unit_prices || []" :key="unitPrice.id">
                  <tr
                    v-for="(range, index) in unitPrice.price_ranges || []"
                    :key="range.id || `${unitPrice.id}-${index}`"
                    class="hover:bg-blue-50 text-right"
                  >
                    <td class="border-b border-gray-200 p-2 text-center">{{ index + 1 }}.</td>
                    <td class="border-b border-gray-200 p-2 text-left">{{ branchProduct.branch?.name || '-' }}</td>
                    <td class="border-b border-gray-200 p-2 text-left">{{ unitPrice.unit_name || unitPrice.product_unit?.unit_name || unitPrice.unit?.name || '-' }}</td>
                    <td class="border-b border-gray-200 p-2">{{ Number(range.min_qty || 0).toLocaleString('en-us') }}</td>
                    <td class="border-b border-gray-200 p-2">{{ range.max_qty === null ? '+' : Number(range.max_qty || 0).toLocaleString('en-us') }}</td>
                    <td class="border-b border-gray-200 p-2">{{ formatPrice(range.price || 0) }}</td>
                    <td class="border-b border-gray-200 p-2 text-center">
                      <span v-html="statusBadgeHtml(productStatusName(range))"></span>
                    </td>
                  </tr>
                </template>
              </template>
              <tr v-if="branchProducts.every((branchProduct) => (branchProduct.unit_prices || []).every((unitPrice) => !(unitPrice.price_ranges || []).length))">
                <td colspan="7" class="py-4 text-center text-gray-500">No branch price ranges found</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </BaseCard>
    </template>
  </div>
</template>
