<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '' },
  formatter: { type: Function, default: null },
})

const displayValue = computed(() => {
  if (props.formatter) return props.formatter(props.value)
  if (typeof props.value === 'number') return Number(props.value).toLocaleString('en-us')
  return props.value
})
</script>

<template>
  <div class="grid grid-cols-3 items-top">
    <span class="col-span-1">{{ label }}</span>
    <span class="col-span-2 font-semibold text-black">
      <slot>: {{ displayValue }}</slot>
    </span>
  </div>
</template>
