<script setup>
import { computed, ref, watch, onMounted } from "vue";

const props = defineProps({
  modelValue: {
    type: String,
    default: "",
  },
  label: {
    type: String,
    default: "",
  },
  placeholder: {
    type: String,
    default: "",
  },
  size: {
    type: String,
    default: "md", // sm, md, lg
  },
  rows: {
    type: Number,
    default: 3,
  },
  error: {
    type: String,
    default: "",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  readonly: {
    type: Boolean,
    default: false,
  },
  width: {
    type: String,
    default: "100%", // "100%", "300px", "w-64"
  },
  height: {
    type: String,
    default: "", // "200px", "h-40"
  },
  autoResize: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue"]);
const textareaRef = ref(null);

const sizeClasses = computed(() => {
  switch (props.size) {
    case "sm":
      return "px-2 py-1 text-sm";
    case "lg":
      return "px-4 py-3 text-lg";
    default:
      return "px-3 py-2 text-base"; // md
  }
});

const borderClasses = computed(() => {
  if (props.error) {
    return "border-red-500";
  }
  return "border-gray-300";
});

const styleWidth = computed(() => {
  return props.width.includes("w-") ? "" : props.width;
});

const styleHeight = computed(() => {
  return props.height.includes("h-") ? "" : props.height;
});

// Auto-resize behavior
const resizeTextarea = () => {
  if (props.autoResize && textareaRef.value) {
    textareaRef.value.style.height = "auto";
    textareaRef.value.style.height = textareaRef.value.scrollHeight + "px";
  }
};

watch(() => props.modelValue, resizeTextarea);
onMounted(resizeTextarea);
</script>

<template>
  <div class="flex flex-col gap-1" :style="{ width: styleWidth }" :class="width.includes('w-') ? width : ''">
    <!-- Label -->
    <label v-if="label" class="text-sm font-medium text-black">
      {{ label }}
    </label>

    <!-- Textarea -->
    <textarea
      ref="textareaRef"
      :rows="rows"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :style="{ height: styleHeight }"
      :class="`
        border rounded outline-none transition resize-none
        ${sizeClasses} ${borderClasses}
        ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
        ${height.includes('h-') ? height : ''}
      `"
      @input="$emit('update:modelValue', $event.target.value)"
    ></textarea>

    <!-- Error Message -->
    <p v-if="error" class="text-sm text-red-500">
      {{ error }}
    </p>
  </div>
</template>
