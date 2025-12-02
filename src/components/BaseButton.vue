<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: { type: String, default: '' },
  icon: { type: String, default: '' },
  severity: { type: String, default: 'primary' }, // primary, secondary, info, danger, contrast
  variant: { type: String, default: 'solid' }, // solid, outlined, text
  rounded: { type: Boolean, default: false },
  size: { type: String, default: 'md' }, // sm, md, lg
  disabled: { type: Boolean, default: false },
  isLoading: {type: Boolean, default: false},
});

const emits = defineEmits(['click']);

// Tailwind classes based on props
const baseClass = computed(() => {
  let classes = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none cursor-pointer';

  // Size
  if (props.size === 'sm') classes += ' px-2 py-1 text-sm';
  if (props.size === 'md') classes += ' px-4 py-2 text-sm';
  if (props.size === 'lg') classes += ' px-5 py-3 text-base';

  // Rounded
  classes += props.rounded ? ' rounded-full' : ' rounded-md';

  // Variant + Severity
  const colors = {
    primary: 'bg-[#007fff] text-white hover:bg-blue-600',
    secondary: 'bg-gray-500 text-white hover:bg-gray-600',
    info: 'bg-sky-500 text-white hover:bg-sky-600',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    contrast: 'bg-black text-white hover:bg-gray-800'
  };

  const outlinedColors = {
    primary: 'border border-[#007fff] text-[#007fff] hover:bg-blue-50',
    secondary: 'border border-gray-500 text-gray-500 hover:bg-gray-50',
    info: 'border border-sky-500 text-sky-500 hover:bg-sky-50',
    danger: 'border border-red-500 text-red-500 hover:bg-red-50',
    contrast: 'border border-black text-black hover:bg-gray-100'
  };

  const textColors = {
    primary: 'text-[#007fff] hover:bg-blue-50',
    secondary: 'text-gray-600 hover:bg-gray-50',
    info: 'text-sky-500 hover:bg-sky-50',
    danger: 'text-red-500 hover:bg-red-50',
    contrast: 'text-black hover:bg-gray-100'
  };

  if (props.variant === 'solid') classes += ` ${colors[props.severity] || colors.primary}`;
  if (props.variant === 'outlined') classes += ` ${outlinedColors[props.severity] || outlinedColors.primary}`;
  if (props.variant === 'text') classes += ` ${textColors[props.severity] || textColors.primary}`;

  // Disabled
  if (props.disabled) classes += ' opacity-50 cursor-not-allowed';

  return classes;
});
</script>

<template>
  <button 
    :class="baseClass"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <i v-if="icon" :class="[icon, label? isLoading? 'mr-2 animate-spin' : 'mr-2' : '']"></i>
    <span v-if="label">{{ label }}</span>
  </button>
</template>
