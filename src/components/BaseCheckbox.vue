<script setup>
  import { computed } from "vue";

  const props = defineProps({
    modelValue: {
      type: Boolean,
      default: false,
    },
    label: {
      type: String,
      default: "",
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    size: {
      type: String,
      default: "md", // sm, md, lg
    },
  });

  const emit = defineEmits(["update:modelValue"]);

  const sizeClasses = computed(() => {
    switch (props.size) {
      case "sm":
        return "w-3 h-3";
      case "lg":
        return "w-6 h-6";
      default:
        return "w-4 h-4"; // md
    }
  });
</script>

<template>
  <label class="flex items-center gap-2 cursor-pointer select-none">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      :class="`rounded border-gray-800 ${sizeClasses}`"
      @change="$emit('update:modelValue', $event.target.checked)"
    />
    <span class="text-sm font-medium text-black">{{ label }}</span>
  </label>
</template>
