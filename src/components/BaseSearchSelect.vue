<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  modelValue: Object,
  options: Array,
  optionLabel: { type: String, default: 'name' },
  optionValue: { type: String, default: 'id' },
  placeholder: String
});

const emit = defineEmits(['update:modelValue']);

const open = ref(false);
const search = ref('');
const input = ref(null);

// ---------- FILTER ----------
const filteredOptions = computed(() => {
  const q = search.value.toLowerCase();
  return props.options.filter(o =>
    String(o[props.optionValue]).toLowerCase().includes(q) ||
    o[props.optionLabel].toLowerCase().includes(q)
  );
});

// ---------- SELECT ----------
function select(item) {
  emit('update:modelValue', item);
  search.value = `${item[props.optionValue]}`;
  open.value = false;
}

// ---------- BARCODE SCANNER SUPPORT ----------
let barcodeBuffer = '';
let barcodeTimer = null;

function handleBarcode(e) {
  if (e.key === 'Enter') {
    const code = e.target.value;
    barcodeBuffer = '';
    if (!code) return;
    // Find customer by barcode (ID)
    const customer = props.options.find(
      c => String(c[props.optionValue]) === code
    );
    if (customer) {
      select(customer);
    }
    return;
  }
}

watch(
  () => props.modelValue,
  val => {
    if (val) {
      search.value = `${val[props.optionValue]}`;
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="relative w-[220px]">
    <!-- Input -->
    <input
      ref="input"
      type="text"
      class="w-full h-[32px] border border-gray-400 rounded-sm px-2 text-sm"
      :placeholder="placeholder"
      v-model="search"
      @focus="open = true"
      @keyup.enter="handleBarcode"
    />

    <!-- Dropdown -->
    <div
      v-if="open"
      class="absolute z-50 bg-white border border-gray-300 py-2 w-[250px] max-h-60 overflow-auto shadow-md rounded-md mt-1"
    >
      <div
        v-for="item in filteredOptions"
        :key="item[optionValue]"
        class="p-2 text-sm border-b border-gray-200 cursor-pointer hover:bg-gray-100"
        @click="select(item)"
      >
        {{ item[optionValue] }} | {{ item[optionLabel] }}
      </div>

      <div v-if="filteredOptions.length === 0" class="p-2 text-gray-400 text-sm">
        No customer found
      </div>
    </div>
  </div>
</template>
