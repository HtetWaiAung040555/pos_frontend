<script setup>
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import BaseInput from '@/components/BaseInput.vue';
import BaseSwitch from '@/components/BaseSwitch.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import BaseErrorLabel from '@/components/BaseErrorLabel.vue';
import ProductUnitForm from '@/components/ProductUnitForm.vue';
import { errMsgList } from '@/utils/const';
import { useProductStore } from '@/stores/useProductStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useUnitStore } from '@/stores/useUnitStore';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { Select } from 'primevue';

const router = useRouter();
const toast = useToast();
const useProduct = useProductStore();
const useCategory = useCategoryStore();
const useUnit = useUnitStore();

const formData = ref({
  name: '',
  sec_prop: '',
  price: 0,
  purchasePrice: 0,
  barcode: '',
  image: '',
});
const productUnits = ref([]);
const status = ref(true);
const uomEnabled = ref(true);
const userData = ref({});
const errorMsg = ref({
  name: '',
  price: '',
  unit: '',
});
const uploadImage = ref('');
const selectedCategory = ref('');
const selectedUnit = ref('');

function changeRoute(pathname) {
  router.push(pathname);
}

onMounted(async () => {
  userData.value = JSON.parse(localStorage.getItem('user'));
  await useProduct.getLastCustomBarcode('KBAM');
  await useUnit.fetchAllUnit();
  selectedUnit.value = useUnit.unitList?.find((el) => el.id === 1) || '';
  productUnits.value = [createProductUnit(selectedUnit.value)];
  await useCategory.fetchAllCategory();
});

function createProductUnit(unit = '') {
  return {
    id: null,
    unit_id: unit?.id || '',
    barcode: '',
    conversion_to_base: 1,
    price: formData.value.price || 0,
    purchase_price: formData.value.purchasePrice || 0,
    is_base_unit: true,
    is_default_sale_unit: true,
    status_id: 1,
    sort_order: 0,
    price_ranges: [
      {
        id: null,
        min_qty: 0,
        max_qty: '',
        price: formData.value.price || 0,
        status_id: 1,
      },
    ],
  };
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

function generateBarcode(unitIndex = null) {
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
  errorMsg.value = { name: '', price: '', unit: '' };

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
    return true;
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

  return true;
}

function resetForm() {
  formData.value = {
    name: '',
    sec_prop: '',
    price: 0,
    purchasePrice: 0,
    barcode: '',
    image: '',
  };
  selectedCategory.value = '';
  selectedUnit.value = useUnit.unitList?.find((el) => el.id === 1) || '';
  productUnits.value = [createProductUnit(selectedUnit.value)];
  uploadImage.value = '';
  status.value = true;
  uomEnabled.value = true;
}

async function formSubmit(isNew) {
  if (!validateForm()) return;

  const primaryUnit = selectedProductUnit();
  const fd = new FormData();
  fd.append('name', formData.value.name);
  fd.append('unit_id', primaryUnit.unit_id || '');
  fd.append('sec_prop', formData.value.sec_prop || '');
  fd.append('category_id', selectedCategory.value?.id || '');
  fd.append('price', primaryUnit.price ?? 0);
  fd.append('purchase_price', primaryUnit.purchase_price ?? 0);
  fd.append('barcode', primaryUnit.barcode || '');
  fd.append('uom_enabled', uomEnabled.value ? '1' : '0');
  fd.append('status_id', status.value ? '1' : '2');
  fd.append('created_by', userData.value.id);

  if (uomEnabled.value) {
    fd.append('product_units', JSON.stringify(normalizeProductUnits()));
  }

  if (formData.value.image) fd.append('image', formData.value.image);

  await useProduct.addProduct(fd);
  if (useProduct.error.length) {
    useProduct.error.forEach((msg) => {
      toast.add({ severity: 'error', summary: 'Error Message', detail: msg, life: 3000 });
    });
    return;
  }

  if (useProduct.productList) {
    toast.add({ severity: 'success', summary: 'Success Message', detail: 'Product created successfully.', life: 3000 });
    if (isNew) {
      resetForm();
      router.push('/product/create');
      return;
    }
    router.push('/product');
  }
}
</script>

<template>
  <div class="p-4">
    <PageTitle title="Create Product">
      <template #titleButtons>
        <div class="flex gap-x-2 items-center">
          <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary" @click="changeRoute('/product')" />
        </div>
      </template>
    </PageTitle>

    <BaseCard class="mt-3">
      <template #cardElements>
        <SubTitle label="Basic Info" />
        <div class="flex gap-x-4 mt-6">
          <div class="relative w-20 h-20 rounded-md">
            <input id="productImage" type="file" accept="image/*" class="w-full hidden z-10" @change="onImageSelected" />
            <label
              for="productImage"
              :class="uploadImage ? '' : 'border-2 border-dashed border-gray-300'"
              class="flex cursor-pointer w-full h-full absolute text-3xl items-center justify-center rounded-md"
            >
              <i v-if="!uploadImage" class="fa fa-image"></i>
            </label>
            <img v-if="uploadImage" :src="uploadImage" :alt="formData.name" class="object-cover w-full h-full rounded-md" />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 mt-4 md:grid-cols-2">
          <BaseInput size="sm" v-model="formData.name" label="Name" placeholder="Name" height="h-[35px]" :isRequire="true" :error="errorMsg.name" />
          <div class="flex flex-col gap-y-1">
            <BaseLabel label="Status" />
            <BaseSwitch v-model="status" />
          </div>
          <div class="flex flex-col gap-y-1">
            <BaseLabel label="Category" />
            <Select v-model="selectedCategory" :options="useCategory.categoryList" showClear filter optionLabel="name" placeholder="Select category" class="h-[35px] items-center" />
          </div>
          <BaseInput size="sm" v-model="formData.sec_prop" label="Secondary Property" placeholder="Red, Green, Blue, ..." height="h-[35px]" />
          <div class="flex flex-col gap-y-1">
            <BaseLabel label="Multi-unit UOM" />
            <BaseSwitch v-model="uomEnabled" />
          </div>
        </div>

        <ProductUnitForm
          v-if="uomEnabled"
          v-model="productUnits"
          :units="useUnit.unitList || []"
          :error="errorMsg.unit"
          @generate-barcode="generateBarcode"
        />

        <div v-else class="grid grid-cols-1 gap-4 mt-6 md:grid-cols-2">
          <div class="flex flex-col gap-y-1">
            <BaseLabel label="Unit" />
            <Select v-model="selectedUnit" :options="useUnit.unitList" showClear filter optionLabel="name" placeholder="Select unit" class="h-[35px] items-center" />
            <BaseErrorLabel v-if="errorMsg.unit" :label="errorMsg.unit" />
          </div>
          <div class="flex gap-x-2 items-end">
            <BaseInput size="sm" v-model="formData.barcode" label="Barcode" placeholder="Barcode" height="h-[35px]" />
            <BaseButton icon="fa fa-refresh" severity="secondary" class="h-[35px]" @click="generateBarcode()" />
          </div>
          <BaseInput size="sm" v-model="formData.price" label="Sales Price" height="h-[35px]" type="number" :isRequire="true" :error="errorMsg.price" />
          <BaseInput size="sm" v-model="formData.purchasePrice" label="Purchase Price" height="h-[35px]" type="number" />
        </div>

        <div class="flex justify-end gap-x-2 mt-4">
          <BaseButton
            label="Save & New"
            variant="outlined"
            :isLoading="useProduct.loading"
            :icon="useProduct.loading ? 'fa fa-spinner' : 'fa fa-file-arrow-up'"
            severity="primary"
            :disabled="useProduct.loading"
            @click="formSubmit(true)"
          />
          <BaseButton
            label="Save"
            :isLoading="useProduct.loading"
            :icon="useProduct.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'"
            severity="primary"
            :disabled="useProduct.loading"
            @click="formSubmit(false)"
          />
        </div>
      </template>
    </BaseCard>
  </div>
</template>
