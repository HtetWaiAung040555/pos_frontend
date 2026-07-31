<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import moment from 'moment';
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import Loading from '@/components/Loading.vue';
import { formatPrice } from '@/utils/const';
import { categoryLabel } from '@/utils/categories';
import { useProductStore } from '@/stores/useProductStore';
import { usePermissionStore } from '@/stores/usePermissionStore';

const route = useRoute();
const router = useRouter();
const useProduct = useProductStore();
const usePermission = usePermissionStore();
const product = ref({});
const isInitLoading = ref(true);
const imageLoadFailed = ref(false);

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

const globalPriceRanges = computed(() => productUnits.value.flatMap((unit) => (
  (unit.price_ranges || []).map((range, index) => ({
    ...range,
    _key: range.id || `${unit.id || unitName(unit)}-${index}`,
    _unitName: unitName(unit),
  }))
)));

const branchUnitPrices = computed(() => branchProducts.value.flatMap((branchProduct) => (
  (branchProduct.unit_prices || []).map((unitPrice, index) => ({
    ...unitPrice,
    _key: unitPrice.id || `${branchProduct.id}-${index}`,
    _branchName: branchProduct.branch?.name || '-',
    _unitName: branchUnitName(unitPrice),
  }))
)));

const branchPriceRanges = computed(() => branchProducts.value.flatMap((branchProduct) => (
  (branchProduct.unit_prices || []).flatMap((unitPrice) => (
    (unitPrice.price_ranges || []).map((range, index) => ({
      ...range,
      _key: range.id || `${branchProduct.id}-${unitPrice.id}-${index}`,
      _branchName: branchProduct.branch?.name || '-',
      _unitName: branchUnitName(unitPrice),
    }))
  ))
)));

const primarySalesPrice = computed(() => defaultProductUnit.value?.price ?? product.value.price ?? 0);
const primaryPurchasePrice = computed(() => defaultProductUnit.value?.purchase_price ?? product.value.purchase_price ?? 0);
const primaryBarcode = computed(() => defaultProductUnit.value?.barcode || product.value.barcode || '-');

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

function editProduct() {
  router.push({ name: 'Update Product', query: { id: product.value.id } });
}

function unitName(productUnit) {
  return productUnit?.unit_id?.name || productUnit?.unit_name || productUnit?.unit?.name || '-';
}

function branchUnitName(unitPrice) {
  return unitPrice?.unit_name || unitPrice?.product_unit?.unit_name || unitPrice?.product_unit?.unit_id?.name || unitPrice?.unit?.name || '-';
}

function statusName(item) {
  return item?.status?.name || '-';
}

function statusClasses(name) {
  const normalized = String(name || '').toLowerCase();
  if (normalized.includes('inactive') || normalized.includes('void')) return 'bg-gray-100 text-gray-600 ring-gray-200';
  if (normalized.includes('active') || normalized.includes('complete')) return 'bg-green-50 text-green-700 ring-green-200';
  if (normalized.includes('hold')) return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-blue-50 text-blue-700 ring-blue-200';
}

function formatDate(value) {
  return value ? moment(value).format('DD MMM YYYY, hh:mm A') : '-';
}

function formatQuantity(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function maxQuantity(value) {
  return value === null || value === '' || value === undefined ? 'No limit' : formatQuantity(value);
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}
</script>

<template>
  <div class="p-3 sm:p-4 lg:p-6">
    <div class="mx-auto w-full max-w-screen-2xl">
      <div v-if="isInitLoading" class="fixed inset-0 z-50 flex items-center justify-center bg-opacity-30">
        <div class="flex flex-col items-center rounded-xl bg-white p-8 shadow-xl">
          <Loading variant="page" loadingWidth="w-[56px]" />
        </div>
      </div>

      <PageTitle title="Product details">
        <template #titleButtons>
          <div class="flex items-center gap-2">
            <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary" @click="goBack" />
            <BaseButton
              v-if="product.id && usePermission.can('Product', 'Update')"
              icon="fa fa-pen"
              label="Edit product"
              severity="primary"
              @click="editProduct"
            />
          </div>
        </template>
      </PageTitle>

      <template v-if="!isInitLoading && product.id">
        <section class="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div class="grid grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-[160px_minmax(0,1fr)]">
            <div class="flex justify-center lg:justify-start">
              <div class="flex h-36 w-36 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 lg:h-40 lg:w-40">
                <img
                  v-if="product.image_url && !imageLoadFailed"
                  :src="product.image_url"
                  :alt="product.name"
                  class="h-full w-full object-cover"
                  @error="imageLoadFailed = true"
                />
                <div v-else class="flex flex-col items-center gap-2 text-gray-400">
                  <i class="fa fa-box-open text-4xl"></i>
                  <span class="text-xs">No photo</span>
                </div>
              </div>
            </div>

            <div class="min-w-0">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0">
                  <div class="mb-2 flex flex-wrap items-center gap-2">
                    <span class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      {{ categoryLabel(product.category_id) || 'Uncategorized' }}
                    </span>
                    <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset" :class="statusClasses(product.status?.name)">
                      <span class="mr-1.5 h-1.5 w-1.5 rounded-full bg-current"></span>
                      {{ product.status?.name || 'Unknown' }}
                    </span>
                  </div>
                  <h1 class="break-words text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl">{{ product.name }}</h1>
                  <p v-if="product.sec_prop" class="mt-1 text-sm text-gray-500">{{ product.sec_prop }}</p>
                </div>
                <span class="shrink-0 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">Product #{{ product.id }}</span>
              </div>

              <dl class="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 border-t border-gray-100 pt-5 sm:grid-cols-3">
                <div>
                  <dt class="text-xs font-medium uppercase tracking-wide text-gray-400">Default unit</dt>
                  <dd class="mt-1 text-sm font-semibold text-gray-900">{{ defaultProductUnit ? unitName(defaultProductUnit) : product.unit_id?.name || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium uppercase tracking-wide text-gray-400">Default barcode</dt>
                  <dd class="mt-1 truncate font-mono text-sm font-medium text-gray-900">{{ primaryBarcode }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium uppercase tracking-wide text-gray-400">Pricing structure</dt>
                  <dd class="mt-1 text-sm font-semibold text-gray-900">Multi-unit</dd>
                </div>
              </dl>
            </div>
          </div>

          <div class="grid grid-cols-2 border-t border-gray-200 bg-gray-50/60 lg:grid-cols-4">
            <div class="border-b border-r border-gray-200 p-4 lg:border-b-0 sm:p-5">
              <p class="text-xs font-medium text-gray-500">Default sales price</p>
              <p class="mt-1 text-xl font-semibold text-gray-950">{{ formatPrice(primarySalesPrice) }}</p>
            </div>
            <div class="border-b border-gray-200 p-4 lg:border-b-0 lg:border-r sm:p-5">
              <p class="text-xs font-medium text-gray-500">Default purchase cost</p>
              <p class="mt-1 text-xl font-semibold text-gray-950">{{ formatPrice(primaryPurchasePrice) }}</p>
            </div>
            <div class="border-r border-gray-200 p-4 sm:p-5">
              <p class="text-xs font-medium text-gray-500">Product units</p>
              <p class="mt-1 text-xl font-semibold text-gray-950">{{ productUnits.length }}</p>
            </div>
            <div class="p-4 sm:p-5">
              <p class="text-xs font-medium text-gray-500">Branch overrides</p>
              <p class="mt-1 text-xl font-semibold text-gray-950">{{ branchProducts.length }}</p>
            </div>
          </div>
        </section>

        <section class="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div class="flex flex-col gap-2 border-b border-gray-200 bg-gray-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 class="text-base font-semibold text-gray-950">Units & global pricing</h2>
              <p class="mt-0.5 text-xs text-gray-500">Conversions, barcodes, standard prices, and quantity tiers.</p>
            </div>
            <span class="w-fit rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200">{{ productUnits.length }} units</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full min-w-[900px] text-sm text-gray-700">
              <thead class="border-b border-gray-200 bg-white text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th class="px-4 py-3 text-left font-medium">Unit</th>
                  <th class="px-4 py-3 text-left font-medium">Barcode</th>
                  <th class="px-4 py-3 text-right font-medium">Conversion</th>
                  <th class="px-4 py-3 text-right font-medium">Sales price</th>
                  <th class="px-4 py-3 text-right font-medium">Purchase cost</th>
                  <th class="px-4 py-3 text-left font-medium">Role</th>
                  <th class="px-4 py-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="(unit, index) in productUnits" :key="unit.id || index" class="transition hover:bg-blue-50/50">
                  <td class="px-4 py-3.5 font-semibold text-gray-950">{{ unitName(unit) }}</td>
                  <td class="px-4 py-3.5 font-mono text-xs text-gray-600">{{ unit.barcode || '-' }}</td>
                  <td class="px-4 py-3.5 text-right tabular-nums">{{ formatQuantity(unit.conversion_to_base) }}</td>
                  <td class="px-4 py-3.5 text-right font-medium tabular-nums text-gray-950">{{ formatPrice(unit.price || 0) }}</td>
                  <td class="px-4 py-3.5 text-right tabular-nums">{{ formatPrice(unit.purchase_price || 0) }}</td>
                  <td class="px-4 py-3.5">
                    <div class="flex flex-wrap gap-1.5">
                      <span v-if="unit.is_base_unit" class="rounded bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700">Base</span>
                      <span v-if="unit.is_default_sale_unit" class="rounded bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">Default sale</span>
                      <span v-if="!unit.is_base_unit && !unit.is_default_sale_unit" class="text-xs text-gray-400">Additional</span>
                    </div>
                  </td>
                  <td class="px-4 py-3.5 text-center">
                    <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset" :class="statusClasses(statusName(unit))">{{ statusName(unit) }}</span>
                  </td>
                </tr>
                <tr v-if="!productUnits.length">
                  <td colspan="7" class="px-4 py-10 text-center text-sm text-gray-500">No product units found.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="border-t border-gray-200">
            <div class="flex items-center justify-between px-4 py-3 sm:px-5">
              <h3 class="text-sm font-semibold text-gray-900">Global quantity price tiers</h3>
              <span class="text-xs text-gray-500">{{ globalPriceRanges.length }} tiers</span>
            </div>
            <div v-if="globalPriceRanges.length" class="overflow-x-auto border-t border-gray-100">
              <table class="w-full min-w-[650px] text-sm text-gray-700">
                <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th class="px-4 py-3 text-left font-medium">Unit</th>
                    <th class="px-4 py-3 text-right font-medium">Minimum qty</th>
                    <th class="px-4 py-3 text-right font-medium">Maximum qty</th>
                    <th class="px-4 py-3 text-right font-medium">Tier price</th>
                    <th class="px-4 py-3 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="range in globalPriceRanges" :key="range._key" class="hover:bg-blue-50/50">
                    <td class="px-4 py-3 font-medium text-gray-900">{{ range._unitName }}</td>
                    <td class="px-4 py-3 text-right tabular-nums">{{ formatQuantity(range.min_qty) }}</td>
                    <td class="px-4 py-3 text-right tabular-nums">{{ maxQuantity(range.max_qty) }}</td>
                    <td class="px-4 py-3 text-right font-medium tabular-nums text-gray-950">{{ formatPrice(range.price || 0) }}</td>
                    <td class="px-4 py-3 text-center">
                      <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset" :class="statusClasses(statusName(range))">{{ statusName(range) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="border-t border-gray-100 px-4 py-8 text-center text-sm text-gray-500">No global quantity price tiers configured.</div>
          </div>
        </section>

        <section class="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div class="flex flex-col gap-2 border-b border-gray-200 bg-gray-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 class="text-base font-semibold text-gray-950">Branch price overrides</h2>
              <p class="mt-0.5 text-xs text-gray-500">Location-specific unit prices and quantity tiers.</p>
            </div>
            <span class="w-fit rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200">{{ branchProducts.length }} branches</span>
          </div>

          <div v-if="branchUnitPrices.length" class="overflow-x-auto">
            <table class="w-full min-w-[700px] text-sm text-gray-700">
              <thead class="border-b border-gray-200 bg-white text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th class="px-4 py-3 text-left font-medium">Branch</th>
                  <th class="px-4 py-3 text-left font-medium">Unit</th>
                  <th class="px-4 py-3 text-right font-medium">Branch price</th>
                  <th class="px-4 py-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="unitPrice in branchUnitPrices" :key="unitPrice._key" class="hover:bg-blue-50/50">
                  <td class="px-4 py-3.5 font-semibold text-gray-950">{{ unitPrice._branchName }}</td>
                  <td class="px-4 py-3.5">{{ unitPrice._unitName }}</td>
                  <td class="px-4 py-3.5 text-right font-medium tabular-nums text-gray-950">
                    {{ hasValue(unitPrice.price) ? formatPrice(unitPrice.price) : 'Use global price' }}
                  </td>
                  <td class="px-4 py-3.5 text-center">
                    <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset" :class="statusClasses(statusName(unitPrice))">{{ statusName(unitPrice) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="px-4 py-10 text-center">
            <div class="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <i class="fa fa-store"></i>
            </div>
            <p class="mt-3 text-sm font-medium text-gray-700">No branch price overrides</p>
            <p class="mt-1 text-xs text-gray-500">All branches currently use the global unit prices.</p>
          </div>

          <div v-if="branchUnitPrices.length" class="border-t border-gray-200">
            <div class="flex items-center justify-between px-4 py-3 sm:px-5">
              <h3 class="text-sm font-semibold text-gray-900">Branch quantity price tiers</h3>
              <span class="text-xs text-gray-500">{{ branchPriceRanges.length }} tiers</span>
            </div>
            <div v-if="branchPriceRanges.length" class="overflow-x-auto border-t border-gray-100">
              <table class="w-full min-w-[800px] text-sm text-gray-700">
                <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th class="px-4 py-3 text-left font-medium">Branch</th>
                    <th class="px-4 py-3 text-left font-medium">Unit</th>
                    <th class="px-4 py-3 text-right font-medium">Minimum qty</th>
                    <th class="px-4 py-3 text-right font-medium">Maximum qty</th>
                    <th class="px-4 py-3 text-right font-medium">Tier price</th>
                    <th class="px-4 py-3 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="range in branchPriceRanges" :key="range._key" class="hover:bg-blue-50/50">
                    <td class="px-4 py-3 font-semibold text-gray-950">{{ range._branchName }}</td>
                    <td class="px-4 py-3">{{ range._unitName }}</td>
                    <td class="px-4 py-3 text-right tabular-nums">{{ formatQuantity(range.min_qty) }}</td>
                    <td class="px-4 py-3 text-right tabular-nums">{{ maxQuantity(range.max_qty) }}</td>
                    <td class="px-4 py-3 text-right font-medium tabular-nums text-gray-950">{{ formatPrice(range.price || 0) }}</td>
                    <td class="px-4 py-3 text-center">
                      <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset" :class="statusClasses(statusName(range))">{{ statusName(range) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="border-t border-gray-100 px-4 py-8 text-center text-sm text-gray-500">No branch quantity price tiers configured.</div>
          </div>
        </section>

        <section class="mt-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 class="text-sm font-semibold text-gray-950">Record history</h2>
          <dl class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-lg bg-gray-50 px-3 py-3">
              <dt class="text-xs text-gray-500">Created by</dt>
              <dd class="mt-1 text-sm font-medium text-gray-900">{{ product.created_by?.name || '-' }}</dd>
            </div>
            <div class="rounded-lg bg-gray-50 px-3 py-3">
              <dt class="text-xs text-gray-500">Created at</dt>
              <dd class="mt-1 text-sm font-medium text-gray-900">{{ formatDate(product.created_at) }}</dd>
            </div>
            <div class="rounded-lg bg-gray-50 px-3 py-3">
              <dt class="text-xs text-gray-500">Last updated by</dt>
              <dd class="mt-1 text-sm font-medium text-gray-900">{{ product.updated_by?.name || '-' }}</dd>
            </div>
            <div class="rounded-lg bg-gray-50 px-3 py-3">
              <dt class="text-xs text-gray-500">Last updated at</dt>
              <dd class="mt-1 text-sm font-medium text-gray-900">{{ formatDate(product.updated_at) }}</dd>
            </div>
          </dl>
        </section>
      </template>

      <section v-else-if="!isInitLoading" class="mt-3 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <i class="fa fa-box-open text-xl"></i>
        </div>
        <h2 class="mt-4 text-base font-semibold text-gray-900">Product not found</h2>
        <p class="mt-1 text-sm text-gray-500">The product may have been removed or is unavailable.</p>
        <BaseButton class="mt-5" label="Return to products" severity="secondary" @click="router.push('/product')" />
      </section>
    </div>
  </div>
</template>
