<script setup>
import { nextTick, ref, watch } from 'vue';
import { Select } from 'primevue';
import BaseButton from '@/components/BaseButton.vue';
import BaseInput from '@/components/BaseInput.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import BaseErrorLabel from '@/components/BaseErrorLabel.vue';

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  units: {
    type: Array,
    default: () => [],
  },
  error: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update:modelValue', 'generate-barcode']);

const rows = ref([]);
let syncingFromParent = false;

function cloneRows(value) {
  return JSON.parse(JSON.stringify(value || []));
}

watch(
  () => props.modelValue,
  (value) => {
    syncingFromParent = true;
    rows.value = cloneRows(value);
    nextTick(() => {
      syncingFromParent = false;
    });
  },
  { immediate: true, deep: true }
);

watch(
  rows,
  (value) => {
    if (!syncingFromParent) {
      emit('update:modelValue', cloneRows(value));
    }
  },
  { deep: true }
);

function blankRange() {
  return {
    id: null,
    min_qty: 0,
    max_qty: '',
    price: 0,
    status_id: 1,
  };
}

function blankUnit() {
  return {
    id: null,
    unit_id: '',
    barcode: '',
    conversion_to_base: 1,
    price: 0,
    purchase_price: 0,
    is_base_unit: rows.value.length === 0,
    is_default_sale_unit: rows.value.length === 0,
    status_id: 1,
    sort_order: rows.value.length,
    price_ranges: [blankRange()],
  };
}

function addUnit() {
  rows.value.push(blankUnit());
}

function removeUnit(index) {
  rows.value.splice(index, 1);
  if (rows.value.length && !rows.value.some((row) => row.is_base_unit)) {
    rows.value[0].is_base_unit = true;
  }
  if (rows.value.length && !rows.value.some((row) => row.is_default_sale_unit)) {
    rows.value[0].is_default_sale_unit = true;
  }
}

function setBaseUnit(index) {
  rows.value = rows.value.map((row, rowIndex) => ({
    ...row,
    is_base_unit: rowIndex === index,
  }));
}

function setDefaultSaleUnit(index) {
  rows.value = rows.value.map((row, rowIndex) => ({
    ...row,
    is_default_sale_unit: rowIndex === index,
  }));
}

function addRange(unitIndex) {
  rows.value[unitIndex].price_ranges.push(blankRange());
}

function removeRange(unitIndex, rangeIndex) {
  rows.value[unitIndex].price_ranges.splice(rangeIndex, 1);
}

function generateBarcode(index) {
  emit('generate-barcode', index);
}
</script>

<template>
  <div class="mt-6">
    <div class="flex items-center justify-between">
      <BaseLabel label="Product Units" />
      <BaseButton icon="fa fa-circle-plus" label="Add Unit" size="sm" severity="primary" @click="addUnit" />
    </div>
    <BaseErrorLabel v-if="error" :label="error" />

    <div v-if="!rows.length" class="mt-3 rounded border border-dashed border-gray-300 p-4 text-sm text-gray-500">
      No units added.
    </div>

    <div v-for="(row, unitIndex) in rows" :key="unitIndex" class="mt-3 rounded border border-gray-200 p-4">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-6">
        <div class="flex flex-col gap-y-1 md:col-span-2">
          <BaseLabel label="Unit" />
          <Select
            v-model="row.unit_id"
            :options="units"
            optionValue="id"
            showClear
            filter
            optionLabel="name"
            placeholder="Select unit"
            class="h-[35px] items-center"
          />
        </div>

        <div class="flex gap-x-2 items-end md:col-span-2">
          <BaseInput size="sm" v-model="row.barcode" label="Barcode" placeholder="Barcode" height="h-[35px]" />
          <BaseButton icon="fa fa-refresh" severity="secondary" class="h-[35px]" @click="generateBarcode(unitIndex)" />
        </div>

        <BaseInput
          size="sm"
          v-model="row.conversion_to_base"
          label="Conversion"
          height="h-[35px]"
          type="number"
        />

        <div class="flex items-end justify-end">
          <BaseButton
            v-if="!row.id"
            icon="fa fa-trash"
            severity="danger"
            variant="outlined"
            class="h-[35px]"
            @click="removeUnit(unitIndex)"
          />
        </div>

        <BaseInput size="sm" v-model="row.price" label="Sales Price" height="h-[35px]" type="number" />
        <BaseInput size="sm" v-model="row.purchase_price" label="Purchase Price" height="h-[35px]" type="number" />

        <div class="flex items-center gap-x-3 pt-6">
          <input
            :id="`base-unit-${unitIndex}`"
            type="radio"
            name="baseUnit"
            class="h-4 w-4"
            :checked="row.is_base_unit"
            @change="setBaseUnit(unitIndex)"
          />
          <label :for="`base-unit-${unitIndex}`" class="text-sm text-black">Base Unit</label>
        </div>

        <div class="flex items-center gap-x-3 pt-6">
          <input
            :id="`default-sale-unit-${unitIndex}`"
            type="radio"
            name="defaultSaleUnit"
            class="h-4 w-4"
            :checked="row.is_default_sale_unit"
            @change="setDefaultSaleUnit(unitIndex)"
          />
          <label :for="`default-sale-unit-${unitIndex}`" class="text-sm text-black">Default Sale Unit</label>
        </div>

        <div class="flex items-center gap-x-3 pt-6">
          <input :id="`unit-active-${unitIndex}`" v-model="row.status_id" type="checkbox" true-value="1" false-value="2" class="h-4 w-4" />
          <label :for="`unit-active-${unitIndex}`" class="text-sm text-black">Active</label>
        </div>
      </div>

      <div class="mt-4 rounded bg-gray-50 p-3">
        <div class="flex items-center justify-between">
          <BaseLabel label="Price Ranges" />
          <BaseButton icon="fa fa-circle-plus" label="Add Range" size="sm" severity="secondary" @click="addRange(unitIndex)" />
        </div>

        <div v-for="(range, rangeIndex) in row.price_ranges" :key="rangeIndex" class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
          <BaseInput size="sm" v-model="range.min_qty" label="Min Qty" height="h-[35px]" type="number" />
          <BaseInput size="sm" v-model="range.max_qty" label="Max Qty" placeholder="No max" height="h-[35px]" type="number" />
          <BaseInput size="sm" v-model="range.price" label="Price" height="h-[35px]" type="number" />
          <div class="flex items-center gap-x-3 pt-6">
            <input :id="`range-active-${unitIndex}-${rangeIndex}`" v-model="range.status_id" type="checkbox" true-value="1" false-value="2" class="h-4 w-4" />
            <label :for="`range-active-${unitIndex}-${rangeIndex}`" class="text-sm text-black">Active</label>
          </div>
          <div class="flex items-end justify-end">
            <BaseButton
              v-if="!range.id"
              icon="fa fa-trash"
              severity="danger"
              variant="outlined"
              class="h-[35px]"
              @click="removeRange(unitIndex, rangeIndex)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
