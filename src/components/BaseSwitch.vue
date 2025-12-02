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
  size: {
    type: String,
    default: "md", // sm, md, lg
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  activeColor: {
    type: String,
    default: "bg-[#007fff]",
  },
  inactiveColor: {
    type: String,
    default: "bg-gray-300",
  },
});

const emit = defineEmits(["update:modelValue"]);

const sizeClasses = computed(() => {
  switch (props.size) {
    case "sm":
      return {
        track: "w-8 h-4",
        thumb: "w-4 h-4",
        translate: "translate-x-4",
      };
    case "lg":
      return {
        track: "w-14 h-7",
        thumb: "w-7 h-7",
        translate: "translate-x-7",
      };
    default:
      return {
        track: "w-11 h-6",
        thumb: "w-6 h-6",
        translate: "translate-x-5",
      };
  }
});

const toggle = () => {
  if (!props.disabled) {
    emit("update:modelValue", !props.modelValue);
  }
};
</script>

<template>
  <div class="flex items-center gap-2 cursor-pointer select-none">
    <!-- Switch -->
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :disabled="disabled"
      @click="toggle"
      :class="[
        'relative rounded-full transition-colors duration-300 focus:outline-none',
        sizeClasses.track,
        modelValue ? activeColor : inactiveColor,
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      ]"
    >
      <!-- Thumb -->
      <span
        :class="[
          'absolute left-0 top-0 bg-[#F8FAFC] rounded-full shadow transform transition-transform duration-300',
          sizeClasses.thumb,
          modelValue ? sizeClasses.translate : 'translate-x-0'
        ]"
      ></span>
    </button>

    <!-- Label -->
    <span v-if="label" class="text-sm font-medium text-black">
      {{ label }}
    </span>
  </div>
</template>
