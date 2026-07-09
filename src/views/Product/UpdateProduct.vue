<script setup>
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import Loading from '@/components/Loading.vue';
import BaseInput from '@/components/BaseInput.vue';
import BaseSwitch from '@/components/BaseSwitch.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import BaseErrorLabel from '@/components/BaseErrorLabel.vue';
import ProductUnitForm from '@/components/ProductUnitForm.vue';
import BranchProductPricingForm from '@/components/BranchProductPricingForm.vue';
import { errMsgList } from '@/utils/const';
import { useProductStore } from '@/stores/useProductStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useUnitStore } from '@/stores/useUnitStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { Select } from 'primevue';
import { buildBranchProducts, normalizeBranchProducts } from '@/utils/branchProductPricing';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const useProduct = useProductStore();
const useCategory = useCategoryStore();
const useUnit = useUnitStore();
const useBranch = useBranchStore();

const formData = ref({
  name: '',
  sec_prop: '',
  price: 0,
  purchasePrice: 0,
  barcode: '',
  image: '',
  image_url: '',
});
const productUnits = ref([]);
const branchProducts = ref([]);
const status = ref(true);
const uomEnabled = ref(true);
const isInitLoading = ref(true);
const userData = ref({});
const errorMsg = ref({
  name: '',
  price: '',
  unit: '',
  branchProducts: '',
});
const uploadImage = ref('');
const selectedCategory = ref('');
const selectedUnit = ref('');

const branchPricingProductUnits = computed(() => {
  if (uomEnabled.value) return productUnits.value;
  if (!selectedUnit.value?.id) return [];

  return [singleProductUnitPayload()];
});

function changeRoute(pathname) {
  router.push(pathname);
}

onMounted(async () => {
  isInitLoading.value = true;
  try {
    userData.value = JSON.parse(localStorage.getItem('user'));
    await Promise.all([
      useProduct.fetchProduct(route.query.id),
      useCategory.fetchAllCategory(),
      useUnit.fetchAllUnit(),
      useBranch.fetchAllBranch(),
    ]);

    const product = useProduct.productList;
    formData.value = {
      name: product.name || '',
      sec_prop: product.sec_prop || '',
      price: product.price || 0,
      purchasePrice: product.purchase_price || 0,
      barcode: product.barcode || '',
      image: '',
      image_url: product.image_url || '',
    };
    uploadImage.value = product.image_url || '';
    status.value = product.status?.id === 1;
    uomEnabled.value = !!product.uom_enabled || !!product.product_units?.length;
    selectedCategory.value = useCategory.categoryList?.find((el) => el.id === product.category_id?.id) || '';
    selectedUnit.value = useUnit.unitList?.find((el) => el.id === product.unit_id?.id) || '';
    productUnits.value = buildProductUnits(product);
    branchProducts.value = buildBranchProducts(product);
  } finally {
    isInitLoading.value = false;
  }
});

function blankPriceRange(price = 0) {
  return {
    id: null,
    min_qty: 0,
    max_qty: '',
    price,
    status_id: 1,
  };
}

function buildFallbackProductUnit(product) {
  return {
    id: null,
    unit_id: product.unit_id?.id || '',
    barcode: product.barcode || '',
    conversion_to_base: 1,
    price: product.price || 0,
    purchase_price: product.purchase_price || 0,
    is_base_unit: true,
    is_default_sale_unit: true,
    status_id: product.status?.id || 1,
    sort_order: 0,
    price_ranges: [blankPriceRange(product.price || 0)],
  };
}

function buildProductUnits(product) {
  if (!product.product_units?.length) {
    return [buildFallbackProductUnit(product)];
  }

  return product.product_units.map((productUnit, index) => ({
    id: productUnit.id,
    unit_id: productUnit.unit_id?.id || '',
    barcode: productUnit.barcode || '',
    conversion_to_base: productUnit.conversion_to_base || 1,
    price: productUnit.price || 0,
    purchase_price: productUnit.purchase_price || 0,
    is_base_unit: !!productUnit.is_base_unit,
    is_default_sale_unit: !!productUnit.is_default_sale_unit,
    status_id: productUnit.status?.id || 1,
    sort_order: productUnit.sort_order ?? index,
    price_ranges: productUnit.price_ranges?.length
      ? productUnit.price_ranges.map((range) => ({
          id: range.id,
          min_qty: range.min_qty,
          max_qty: range.max_qty ?? '',
          price: range.price,
          status_id: range.status?.id || 1,
        }))
      : [blankPriceRange(productUnit.price || 0)],
  }));
}

function nextBarcode() {
  const prefix = 'KBAM';
  const candidates = [
    useProduct.lastCustomBarcode,
    formData.value.barcode,
    ...productUnits.value.map((unit) => unit.barcode),
  ];
  const serials = candidates
    .map((barcode) => (barcode || '').toString().trim().match(/^KBAM-(\d+)$/))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  const nextSerial = serials.length ? Math.max(...serials) + 1 : 1;
  return `${prefix}-${String(nextSerial).padStart(6, '0')}`;
}

async function ensureLastBarcodeLoaded() {
  if (!useProduct.lastCustomBarcode) {
    await useProduct.getLastCustomBarcode('KBAM');
  }
}

async function generateBarcode(unitIndex = null) {
  await ensureLastBarcodeLoaded();
  const barcode = nextBarcode();
  if (unitIndex === null) {
    formData.value.barcode = barcode;
    return;
  }
  productUnits.value[unitIndex].barcode = barcode;
}

function onImageSelected(event) {
  const file = event.target.files[0];
  formData.value.image = file;
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadImage.value = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

function toNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  return Number(value);
}

function normalizeStatusId(value) {
  return Number(value) === 2 ? 2 : 1;
}

function normalizePriceRanges(ranges) {
  return (ranges || []).map((range) => ({
    ...(range.id ? { id: range.id } : {}),
    min_qty: toNumber(range.min_qty),
    max_qty: range.max_qty === '' || range.max_qty === null ? null : toNumber(range.max_qty),
    price: toNumber(range.price),
    status_id: normalizeStatusId(range.status_id),
  }));
}

function normalizeProductUnits() {
  return productUnits.value.map((unit, index) => ({
    ...(unit.id ? { id: unit.id } : {}),
    unit_id: unit.unit_id,
    barcode: unit.barcode || null,
    conversion_to_base: toNumber(unit.conversion_to_base, 1),
    price: toNumber(unit.price),
    purchase_price: toNumber(unit.purchase_price),
    is_base_unit: !!unit.is_base_unit,
    is_default_sale_unit: !!unit.is_default_sale_unit,
    sort_order: index,
    status_id: normalizeStatusId(unit.status_id),
    price_ranges: normalizePriceRanges(unit.price_ranges),
  }));
}

function singleProductUnitPayload() {
  const existingUnit = productUnits.value.find((unit) => Number(unit.unit_id) === Number(selectedUnit.value?.id))
    || productUnits.value[0]
    || {};

  return {
    ...(existingUnit.id ? { id: existingUnit.id } : {}),
    unit_id: selectedUnit.value?.id || existingUnit.unit_id || '',
    unit_name: selectedUnit.value?.name || '',
    barcode: formData.value.barcode || existingUnit.barcode || null,
    conversion_to_base: toNumber(existingUnit.conversion_to_base, 1),
    price: toNumber(formData.value.price),
    purchase_price: toNumber(formData.value.purchasePrice),
    is_base_unit: true,
    is_default_sale_unit: true,
    sort_order: 0,
    status_id: status.value ? 1 : 2,
    price_ranges: normalizePriceRanges(existingUnit.price_ranges || []),
  };
}

function selectedProductUnit() {
  if (!uomEnabled.value) {
    return {
      unit_id: selectedUnit.value?.id,
      barcode: formData.value.barcode || null,
      price: toNumber(formData.value.price),
      purchase_price: toNumber(formData.value.purchasePrice),
    };
  }

  const units = normalizeProductUnits();
  return units.find((unit) => unit.is_default_sale_unit) || units.find((unit) => unit.is_base_unit) || units[0] || {};
}

function validateForm() {
  errorMsg.value = { name: '', price: '', unit: '', branchProducts: '' };

  if (!formData.value.name) {
    errorMsg.value.name = errMsgList.name;
    return false;
  }

  if (!uomEnabled.value) {
    if (formData.value.price <= 0) {
      errorMsg.value.price = errMsgList.price;
      return false;
    }
    if (!selectedUnit.value) {
      errorMsg.value.unit = errMsgList.unit;
      return false;
    }
    return validateBranchPricing();
  }

  if (!productUnits.value.length) {
    errorMsg.value.unit = 'Please add at least one product unit.';
    return false;
  }

  const invalidUnit = productUnits.value.find((unit) => !unit.unit_id || toNumber(unit.conversion_to_base, 0) <= 0 || toNumber(unit.price, -1) < 0);
  if (invalidUnit) {
    errorMsg.value.unit = 'Each product unit needs a unit, conversion, and valid price.';
    return false;
  }

  const hasBaseUnit = productUnits.value.some((unit) => unit.is_base_unit);
  const hasDefaultSaleUnit = productUnits.value.some((unit) => unit.is_default_sale_unit);
  if (!hasBaseUnit || !hasDefaultSaleUnit) {
    errorMsg.value.unit = 'Select one base unit and one default sale unit.';
    return false;
  }

  return validateBranchPricing();
}

function validateBranchPricing() {
  const invalidRange = branchProducts.value.some((branchProduct) => (
    (branchProduct.unit_prices || []).some((unitPrice) => (
      (unitPrice.price === '' || unitPrice.price === null || unitPrice.price === undefined)
      && (unitPrice.price_ranges || []).some((range) => range.price !== '' && range.price !== null && range.price !== undefined)
    ))
  ));

  if (invalidRange) {
    errorMsg.value.branchProducts = 'Enter a branch sales price before adding branch price ranges.';
    return false;
  }

  return true;
}

async function formSubmit() {
  if (!validateForm()) return;

  const primaryUnit = selectedProductUnit();
  const fd = new FormData();
  fd.append('_method', 'PUT');
  fd.append('name', formData.value.name);
  fd.append('unit_id', primaryUnit.unit_id || '');
  fd.append('category_id', selectedCategory.value?.id || '');
  fd.append('sec_prop', formData.value.sec_prop || '');
  fd.append('price', primaryUnit.price ?? 0);
  fd.append('purchase_price', primaryUnit.purchase_price ?? 0);
  fd.append('barcode', primaryUnit.barcode || '');
  fd.append('uom_enabled', uomEnabled.value ? '1' : '0');
  fd.append('status_id', status.value ? '1' : '2');
  fd.append('updated_by', userData.value.id);

  const branchProductsPayload = normalizeBranchProducts(branchProducts.value);
  if (uomEnabled.value || branchProductsPayload.length) {
    const unitsPayload = uomEnabled.value ? normalizeProductUnits() : [singleProductUnitPayload()];
    const defaultUnit = uomEnabled.value
      ? productUnits.value.find((unit) => unit.is_default_sale_unit)
      : singleProductUnitPayload();

    fd.append('product_units', JSON.stringify(unitsPayload));
    if (defaultUnit?.id) {
      fd.append('default_product_unit_id', defaultUnit.id);
    }
  }

  if (branchProductsPayload.length) {
    fd.append('branch_products', JSON.stringify(branchProductsPayload));
  }

  if (formData.value.image && typeof formData.value.image !== 'string') fd.append('image', formData.value.image);

  await useProduct.editProduct(route.query.id, fd);
  if (useProduct.error.length) {
    useProduct.error.forEach((msg) => {
      toast.add({ severity: 'error', summary: 'Error Message', detail: msg, life: 3000 });
    });
    return;
  }

  if (useProduct.productList) {
    toast.add({ severity: 'success', summary: 'Success Message', detail: 'Product updated successfully.', life: 3000 });
    router.push('/product');
  }
}
</script>

<template>
  <div class="p-3 sm:p-4 lg:p-6">
    <div class="mx-auto w-full max-w-screen-2xl">
      <div v-if="isInitLoading" class="fixed inset-0 z-50 flex items-center justify-center bg-opacity-30">
        <div class="bg-white rounded-lg shadow-lg p-8 flex flex-col items-center">
          <Loading variant="page" loadingWidth="w-[56px]" />
        </div>
      </div>

      <PageTitle title="Update Product">
        <template #titleButtons>
          <div class="flex gap-x-2 items-center">
            <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary" @click="changeRoute('/product')" />
          </div>
        </template>
      </PageTitle>

      <BaseCard v-if="!isInitLoading" class="mt-3">
        <template #cardElements>
          <div class="space-y-8">
            <section>
              <div class="flex flex-col gap-5 lg:flex-row lg:items-start">
                <div class="w-full lg:w-[220px] xl:w-[260px]">
                  <BaseLabel label="Product Photo" />
                  <div class="mt-2 flex items-center gap-4 lg:block">
                    <div class="relative h-24 w-24 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50 sm:h-28 sm:w-28 lg:h-36 lg:w-36">
                      <input id="productImage" type="file" accept="image/*" class="hidden" @change="onImageSelected" />
                      <label
                        for="productImage"
                        class="absolute inset-0 flex cursor-pointer items-center justify-center text-2xl text-gray-400"
                        :class="uploadImage ? '' : 'border-2 border-dashed border-gray-300'"
                      >
                        <i v-if="!uploadImage" class="fa fa-image"></i>
                      </label>
                      <img v-if="uploadImage" :src="uploadImage" :alt="formData.name" class="h-full w-full object-cover" />
                    </div>
                    <label for="productImage" class="inline-flex h-[35px] cursor-pointer items-center rounded border border-gray-300 px-3 text-sm text-black hover:bg-gray-50 lg:mt-3">
                      Change Image
                    </label>
                  </div>
                </div>

                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-3 border-b border-gray-200 pb-3">
                    <SubTitle label="Product Info" />
                    <span class="rounded bg-red-50 px-2 py-1 text-xs text-red-600">* Required</span>
                  </div>

                  <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div class="md:col-span-2 xl:col-span-2">
                      <BaseInput size="sm" v-model="formData.name" label="Name" placeholder="Name" height="h-[35px]" :isRequire="true" :error="errorMsg.name" />
                    </div>

                    <div class="flex flex-col gap-y-1">
                      <BaseLabel label="Status" />
                      <div class="flex h-[35px] items-center">
                        <BaseSwitch v-model="status" />
                      </div>
                    </div>

                    <div class="flex flex-col gap-y-1">
                      <BaseLabel label="Category" />
                      <Select v-model="selectedCategory" :options="useCategory.categoryList" showClear filter optionLabel="name" placeholder="Select category" class="h-[35px] items-center" />
                    </div>

                    <BaseInput size="sm" v-model="formData.sec_prop" label="Secondary Property" placeholder="Red, Green, Blue, ..." height="h-[35px]" />

                    <div class="flex flex-col gap-y-1">
                      <BaseLabel label="Multi-unit UOM" />
                      <div class="flex h-[35px] items-center">
                        <BaseSwitch v-model="uomEnabled" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section class="border-t border-gray-200 pt-6">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <SubTitle label="UOM & Prices" />
                <span class="text-xs text-gray-500">{{ uomEnabled ? 'Multi-unit pricing' : 'Single-unit pricing' }}</span>
              </div>

              <ProductUnitForm
                v-if="uomEnabled"
                v-model="productUnits"
                :units="useUnit.unitList || []"
                :error="errorMsg.unit"
                @generate-barcode="generateBarcode"
              />

              <div v-else class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div class="flex flex-col gap-y-1">
                  <BaseLabel label="Unit" :isRequire="true" />
                  <Select v-model="selectedUnit" :options="useUnit.unitList" showClear filter optionLabel="name" placeholder="Select unit" class="h-[35px] items-center" />
                  <BaseErrorLabel v-if="errorMsg.unit" :label="errorMsg.unit" />
                </div>
                <div class="flex gap-x-2 items-end">
                  <BaseInput size="sm" v-model="formData.barcode" label="Barcode" placeholder="Barcode" height="h-[35px]" />
                  <BaseButton icon="fa fa-refresh" severity="secondary" class="h-[35px] shrink-0" @click="generateBarcode()" />
                </div>
                <BaseInput size="sm" v-model="formData.price" label="Sales Price" height="h-[35px]" type="number" :isRequire="true" :error="errorMsg.price" />
                <BaseInput size="sm" v-model="formData.purchasePrice" label="Purchase Price" height="h-[35px]" type="number" />
              </div>
            </section>

            <section class="border-t border-gray-200 pt-6">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <SubTitle label="Branch Pricing" />
                <span class="text-xs text-gray-500">Optional</span>
              </div>
              <BranchProductPricingForm
                v-model="branchProducts"
                :branches="useBranch.branchList || []"
                :productUnits="branchPricingProductUnits"
                :units="useUnit.unitList || []"
                :error="errorMsg.branchProducts"
              />
            </section>
          </div>

          <div class="sticky bottom-0 z-10 mt-8 border-t border-gray-200 bg-white/95 py-4 backdrop-blur">
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <BaseButton
                label="Update"
                :isLoading="useProduct.loading"
                :icon="useProduct.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'"
                severity="primary"
                class="w-full sm:w-auto"
                :disabled="useProduct.loading"
                @click="formSubmit"
              />
            </div>
          </div>
        </template>
      </BaseCard>
    </div>
  </div>
</template>
