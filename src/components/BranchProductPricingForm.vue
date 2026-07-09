<script setup>
import { nextTick, ref, watch } from 'vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseInput from '@/components/BaseInput.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import BaseErrorLabel from '@/components/BaseErrorLabel.vue';

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  branches: {
    type: Array,
    default: () => [],
  },
  productUnits: {
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

const emit = defineEmits(['update:modelValue']);

const rows = ref([]);
let syncingFromParent = false;

function cloneRows(value) {
  return JSON.parse(JSON.stringify(value || []));
}

watch(
  () => props.modelValue,
  (value) => {
    syncingFromParent = true;
    rows.value = cloneRows(value).map((row) => ensureUnitPrices(row));
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

watch(
  () => props.productUnits,
  () => {
    rows.value = rows.value.map((row) => ensureUnitPrices(row));
  },
  { deep: true }
);

function unitLookup(unitId) {
  return props.units.find((unit) => Number(unit.id) === Number(unitId));
}

function unitName(productUnit) {
  if (productUnit?.unit_name) return productUnit.unit_name;
  if (productUnit?.unit_id?.name) return productUnit.unit_id.name;
  return unitLookup(productUnit?.unit_id)?.name || '-';
}

function unitKey(productUnit, index = 0) {
  return productUnit?.id ? `product-unit-${productUnit.id}` : `unit-${productUnit?.unit_id || index}`;
}

function blankRange() {
  return {
    id: null,
    min_qty: 0,
    max_qty: '',
    price: '',
    status_id: 1,
  };
}

function blankUnitPrice(productUnit) {
  return {
    id: null,
    product_unit_id: productUnit?.id || null,
    unit_id: productUnit?.unit_id?.id || productUnit?.unit_id || '',
    unit_name: unitName(productUnit),
    price: '',
    status_id: 1,
    price_ranges: [],
  };
}

function findUnitPrice(row, productUnit) {
  return (row.unit_prices || []).find((unitPrice) => {
    if (productUnit?.id && Number(unitPrice.product_unit_id) === Number(productUnit.id)) return true;
    return Number(unitPrice.unit_id) === Number(productUnit?.unit_id?.id || productUnit?.unit_id || 0);
  });
}

function ensureUnitPrices(row) {
  const unitPrices = props.productUnits.map((productUnit, index) => {
    const existing = findUnitPrice(row, productUnit);
    return {
      ...blankUnitPrice(productUnit),
      ...(existing || {}),
      product_unit_id: productUnit?.id || existing?.product_unit_id || null,
      unit_id: productUnit?.unit_id?.id || productUnit?.unit_id || existing?.unit_id || '',
      unit_name: unitName(productUnit) || existing?.unit_name || '-',
      price_ranges: existing?.price_ranges?.length
        ? existing.price_ranges.map((range) => ({ ...range, max_qty: range.max_qty ?? '' }))
        : [],
      _key: unitKey(productUnit, index),
      _global_price: productUnit?.price ?? 0,
    };
  });

  return {
    id: row.id || null,
    branch_id: row.branch_id || row.branch?.id || '',
    branch: row.branch || branchById(row.branch_id),
    price: row.price ?? null,
    old_price: row.old_price ?? null,
    status_id: row.status?.id || row.status_id || 1,
    unit_prices: unitPrices,
  };
}

function branchById(branchId) {
  return props.branches.find((branch) => Number(branch.id) === Number(branchId)) || null;
}

function isBranchSelected(branch) {
  return rows.value.some((row) => Number(row.branch_id) === Number(branch.id));
}

function isSavedBranch(branch) {
  return rows.value.some((row) => Number(row.branch_id) === Number(branch.id) && row.id);
}

function toggleBranch(branch, checked) {
  if (checked) {
    if (!isBranchSelected(branch)) {
      rows.value.push(ensureUnitPrices({
        branch_id: branch.id,
        branch,
        status_id: 1,
        unit_prices: [],
      }));
    }
    return;
  }

  if (isSavedBranch(branch)) return;
  rows.value = rows.value.filter((row) => Number(row.branch_id) !== Number(branch.id));
}

function addRange(unitPrice) {
  unitPrice.price_ranges.push(blankRange());
}

function removeRange(unitPrice, rangeIndex) {
  unitPrice.price_ranges.splice(rangeIndex, 1);
}

function branchName(row) {
  return row.branch?.name || branchById(row.branch_id)?.name || '-';
}
</script>

<template>
  <div class="mt-6">
    <div class="flex items-center justify-between">
      <BaseLabel label="Branch Assignment" />
      <span class="text-xs text-gray-500">{{ rows.length }} selected</span>
    </div>
    <BaseErrorLabel v-if="error" :label="error" />

    <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
      <label
        v-for="branch in branches"
        :key="branch.id"
        class="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm"
        :class="isBranchSelected(branch) ? 'bg-blue-50 border-blue-200' : 'bg-white'"
      >
        <span class="flex items-center gap-x-2">
          <input
            type="checkbox"
            class="h-4 w-4"
            :checked="isBranchSelected(branch)"
            :disabled="isSavedBranch(branch)"
            @change="toggleBranch(branch, $event.target.checked)"
          />
          <span>{{ branch.name }}</span>
        </span>
        <span v-if="isSavedBranch(branch)" class="text-xs text-gray-500">Saved</span>
      </label>
    </div>

    <div v-if="!rows.length" class="mt-3 rounded border border-dashed border-gray-300 p-4 text-sm text-gray-500">
      No branches selected.
    </div>

    <div v-for="row in rows" :key="row.id || row.branch_id" class="mt-4 rounded border border-gray-200">
      <div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div>
          <div class="font-medium text-black">{{ branchName(row) }}</div>
          <div class="text-xs text-gray-500">Branch UOM Prices</div>
        </div>
        <div class="flex items-center gap-x-2 text-sm">
          <input :id="`branch-active-${row.branch_id}`" v-model="row.status_id" type="checkbox" true-value="1" false-value="2" class="h-4 w-4" />
          <label :for="`branch-active-${row.branch_id}`">Active</label>
        </div>
      </div>

      <div class="p-4">
        <div v-if="!row.unit_prices.length" class="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-500">
          Add product UOM rows first to configure branch prices.
        </div>

        <div v-for="unitPrice in row.unit_prices" :key="unitPrice._key" class="mb-4 rounded border border-gray-100 p-3 last:mb-0">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <BaseLabel label="Unit" />
              <div class="mt-1 h-[35px] rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm">
                {{ unitPrice.unit_name }}
              </div>
            </div>
            <BaseInput size="sm" :modelValue="unitPrice._global_price" label="Global UOM Price" height="h-[35px]" type="number" disabled />
            <BaseInput size="sm" v-model="unitPrice.price" label="Branch Sales Price" placeholder="Use global price" height="h-[35px]" type="number" />
            <div class="flex items-center gap-x-3 pt-6">
              <input :id="`branch-unit-active-${row.branch_id}-${unitPrice._key}`" v-model="unitPrice.status_id" type="checkbox" true-value="1" false-value="2" class="h-4 w-4" />
              <label :for="`branch-unit-active-${row.branch_id}-${unitPrice._key}`" class="text-sm text-black">Active</label>
            </div>
          </div>

          <div class="mt-3 rounded bg-gray-50 p-3">
            <div class="flex items-center justify-between">
              <BaseLabel label="Branch UOM Price Ranges" />
              <BaseButton icon="fa fa-circle-plus" label="Add Range" size="sm" severity="secondary" @click="addRange(unitPrice)" />
            </div>

            <div v-if="!unitPrice.price_ranges.length" class="mt-2 text-xs text-gray-500">
              No branch ranges.
            </div>

            <div v-for="(range, rangeIndex) in unitPrice.price_ranges" :key="range.id || rangeIndex" class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
              <BaseInput size="sm" v-model="range.min_qty" label="Min Qty" height="h-[35px]" type="number" />
              <BaseInput size="sm" v-model="range.max_qty" label="Max Qty" placeholder="No max" height="h-[35px]" type="number" />
              <BaseInput size="sm" v-model="range.price" label="Price" height="h-[35px]" type="number" />
              <div class="flex items-center gap-x-3 pt-6">
                <input :id="`branch-range-active-${row.branch_id}-${unitPrice._key}-${rangeIndex}`" v-model="range.status_id" type="checkbox" true-value="1" false-value="2" class="h-4 w-4" />
                <label :for="`branch-range-active-${row.branch_id}-${unitPrice._key}-${rangeIndex}`" class="text-sm text-black">Active</label>
              </div>
              <div class="flex items-end justify-end">
                <BaseButton
                  v-if="!range.id"
                  icon="fa fa-trash"
                  severity="danger"
                  variant="outlined"
                  class="h-[35px]"
                  @click="removeRange(unitPrice, rangeIndex)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
