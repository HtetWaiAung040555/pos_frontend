<script setup>
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import Loading from '@/components/Loading.vue';
import BaseInput from '@/components/BaseInput.vue';
import BaseSwitch from '@/components/BaseSwitch.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import ProductUnitForm from '@/components/ProductUnitForm.vue';
import BranchProductPricingForm from '@/components/BranchProductPricingForm.vue';
import { errMsgList } from '@/utils/const';
import { useProductStore } from '@/stores/useProductStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useUnitStore } from '@/stores/useUnitStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { computed, nextTick, onMounted, ref } from 'vue';
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
const nameInput = ref(null);
const unitSection = ref(null);
const branchSection = ref(null);
const imageInput = ref(null);
const branchPricingOpen = ref(false);

const selectedBranchCount = computed(() => branchProducts.value.length);
const branchPricingProductUnits = computed(() => productUnits.value);

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
    selectedCategory.value = useCategory.categoryList?.find((el) => el.id === product.category_id?.id) || '';
    productUnits.value = buildProductUnits(product);
    branchProducts.value = buildBranchProducts(product);
    branchPricingOpen.value = branchProducts.value.length > 0;
  } finally {
    isInitLoading.value = false;
    await nextTick();
    nameInput.value?.focus();
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

function resetImageSelection() {
  formData.value.image = '';
  uploadImage.value = formData.value.image_url || '';
  if (imageInput.value) imageInput.value.value = '';
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

function selectedProductUnit() {
  const units = normalizeProductUnits();
  return units.find((unit) => unit.is_default_sale_unit) || units.find((unit) => unit.is_base_unit) || units[0] || {};
}

function validateForm() {
  errorMsg.value = { name: '', price: '', unit: '', branchProducts: '' };
  let isValid = true;

  if (!formData.value.name?.trim()) {
    errorMsg.value.name = errMsgList.name;
    isValid = false;
  }

  if (!productUnits.value.length) {
    errorMsg.value.unit = 'Please add at least one product unit.';
    isValid = false;
  } else {
    const invalidUnit = productUnits.value.find((unit) => !unit.unit_id || toNumber(unit.conversion_to_base, 0) <= 0 || toNumber(unit.price, -1) < 0);
    if (invalidUnit) {
      errorMsg.value.unit = 'Each product unit needs a unit, conversion, and valid price.';
      isValid = false;
    }

    const hasBaseUnit = productUnits.value.some((unit) => unit.is_base_unit);
    const hasDefaultSaleUnit = productUnits.value.some((unit) => unit.is_default_sale_unit);
    if (!hasBaseUnit || !hasDefaultSaleUnit) {
      errorMsg.value.unit = 'Select one base unit and one default sale unit.';
      isValid = false;
    }
  }

  if (!validateBranchPricing()) {
    branchPricingOpen.value = true;
    isValid = false;
  }

  if (!isValid) focusFirstError();
  return isValid;
}

async function focusFirstError() {
  await nextTick();
  if (errorMsg.value.name) {
    nameInput.value?.focus();
    return;
  }

  const target = errorMsg.value.unit || errorMsg.value.price
    ? unitSection.value
    : branchSection.value;
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

function handleKeyboardSave(event) {
  if (!(event.ctrlKey || event.metaKey) || event.key !== 'Enter') return;
  event.preventDefault();
  formSubmit();
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
  fd.append('uom_enabled', '1');
  fd.append('status_id', status.value ? '1' : '2');
  fd.append('updated_by', userData.value.id);

  const branchProductsPayload = normalizeBranchProducts(branchProducts.value);
  const unitsPayload = normalizeProductUnits();
  const defaultUnit = productUnits.value.find((unit) => unit.is_default_sale_unit);
  fd.append('product_units', JSON.stringify(unitsPayload));
  if (defaultUnit?.id) {
    fd.append('default_product_unit_id', defaultUnit.id);
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
          <div class="space-y-5" @keydown="handleKeyboardSave">
            <section class="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div class="flex flex-col gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div class="flex items-center gap-3">
                  <span class="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">1</span>
                  <div>
                    <SubTitle label="Product details" />
                    <p class="mt-0.5 text-xs text-gray-500">Update the information used at checkout.</p>
                  </div>
                </div>
                <span class="text-xs text-gray-500"><span class="text-red-500">*</span> Required field</span>
              </div>

              <div class="grid grid-cols-1 gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_200px]">
                <div class="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                  <div class="md:col-span-2">
                    <BaseInput ref="nameInput" size="sm" v-model="formData.name" label="Product name" placeholder="e.g. Premium Arabica Coffee" height="h-[40px]" :isRequire="true" :error="errorMsg.name" />
                  </div>

                  <div class="flex flex-col gap-y-1">
                    <BaseLabel label="Category" />
                    <Select v-model="selectedCategory" :options="useCategory.categoryList" showClear filter optionLabel="name" placeholder="Choose a category" class="h-[40px] items-center" />
                  </div>

                  <BaseInput size="sm" v-model="formData.sec_prop" label="Variant / secondary name" placeholder="e.g. Red, Large, 500 ml" height="h-[40px]" />

                  <div class="md:col-span-2">
                    <BaseLabel label="Product status" />
                    <div
                      class="mt-1 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition sm:max-w-xs"
                      :class="status ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'"
                    >
                      <span>
                        <span class="block text-sm font-medium" :class="status ? 'text-green-800' : 'text-gray-700'">{{ status ? 'Active' : 'Inactive' }}</span>
                        <span class="block text-xs text-gray-500">{{ status ? 'Available for sale' : 'Hidden at checkout' }}</span>
                      </span>
                      <BaseSwitch v-model="status" />
                    </div>
                  </div>
                </div>

                <div class="border-t border-gray-100 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                  <BaseLabel label="Product photo" />
                  <div class="mt-2 flex items-center gap-4 lg:flex-col lg:items-stretch">
                    <label for="productImage" class="group relative h-28 w-28 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 lg:h-36 lg:w-full">
                      <input ref="imageInput" id="productImage" type="file" accept="image/*" class="sr-only" @change="onImageSelected" />
                      <img v-if="uploadImage" :src="uploadImage" :alt="formData.name || 'Product preview'" class="h-full w-full object-cover" />
                      <span v-else class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400 transition group-hover:text-blue-600">
                        <i class="fa fa-cloud-arrow-up text-2xl"></i>
                        <span class="text-xs font-medium">Upload photo</span>
                      </span>
                      <span v-if="uploadImage" class="absolute inset-x-0 bottom-0 bg-black/60 py-1.5 text-center text-xs text-white opacity-0 transition group-hover:opacity-100">Change photo</span>
                    </label>
                    <div class="text-xs text-gray-500">
                      <p>JPG or PNG</p>
                      <button v-if="formData.image" type="button" class="mt-2 font-medium text-blue-600 hover:text-blue-700" @click="resetImageSelection">Restore current photo</button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section ref="unitSection" class="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div class="border-b border-gray-100 bg-gray-50/70 px-4 py-3 sm:px-5">
                <div class="flex items-center gap-3">
                  <span class="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">2</span>
                  <div>
                    <SubTitle label="Units & pricing" />
                    <p class="mt-0.5 text-xs text-gray-500">Manage every unit this product can be purchased or sold in.</p>
                  </div>
                </div>
              </div>

              <div class="p-4 sm:p-5">
                <div class="mb-4 flex gap-3 rounded-lg bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
                  <i class="fa fa-circle-info mt-0.5"></i>
                  <span>The base unit uses a conversion of 1. Add units such as box or carton and enter how many base units each contains.</span>
                </div>

                <ProductUnitForm
                  v-model="productUnits"
                  class="!mt-0"
                  :units="useUnit.unitList || []"
                  :error="errorMsg.unit"
                  @generate-barcode="generateBarcode"
                />
              </div>
            </section>

            <section ref="branchSection" class="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <button type="button" class="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-gray-50 sm:px-5" @click="branchPricingOpen = !branchPricingOpen">
                <span class="flex min-w-0 items-center gap-3">
                  <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">3</span>
                  <span>
                    <span class="flex items-center gap-2">
                      <span class="text-sm font-semibold text-gray-900">Branch price overrides</span>
                      <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">Optional</span>
                    </span>
                    <span class="mt-0.5 block text-xs text-gray-500">Set a different price for specific locations.</span>
                  </span>
                </span>
                <span class="flex shrink-0 items-center gap-3 text-xs text-gray-500">
                  <span v-if="selectedBranchCount">{{ selectedBranchCount }} selected</span>
                  <i class="fa fa-chevron-down transition-transform" :class="branchPricingOpen ? 'rotate-180' : ''"></i>
                </span>
              </button>
              <div v-if="branchPricingOpen" class="border-t border-gray-100 p-4 sm:p-5">
                <BranchProductPricingForm
                  v-model="branchProducts"
                  class="!mt-0"
                  :branches="useBranch.branchList || []"
                  :productUnits="branchPricingProductUnits"
                  :units="useUnit.unitList || []"
                  :error="errorMsg.branchProducts"
                />
              </div>
            </section>
          </div>

          <div class="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-8px_20px_-16px_rgba(15,23,42,0.35)] backdrop-blur sm:-mx-5 sm:px-5">
            <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p class="hidden text-xs text-gray-500 md:block">
                <kbd class="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-sans">Ctrl</kbd>
                +
                <kbd class="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-sans">Enter</kbd>
                to update
              </p>
              <BaseButton
                label="Update product"
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
