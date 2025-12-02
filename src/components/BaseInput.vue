<script setup>
import { ref, computed, defineExpose } from "vue";
import BaseErrorLabel from "./BaseErrorLabel.vue";

const props = defineProps({
  modelValue: {
    type: [String, Number],
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
  type: {
    type: String,
    default: "text", // text, password, email, number, etc.
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
    default: "100%",
  },
  height: {
    type: String,
    default: "",
  },
  icon: {
    type: String,
    default: "", // e.g. "fa fa-search" or "fa fa-user"
  },
  passwordToggle: {
    type: Boolean,
    default: false, // if true, shows eye icon to toggle
  },
  isRequire: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["update:modelValue"]);

const showPassword = ref(false);
const inputEl = ref(null);

function focus(){
  inputEl.value?.focus();
}

defineExpose({
  focus,
  inputEl
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case "sm":
      return "px-2 py-1 text-sm";
    case "lg":
      return "px-4 py-3 text-lg";
    default:
      return "px-3 py-2 text-base";
  }
});

const borderClasses = computed(() => {
  return props.error ? "border-red-500" : "border-[#cbd5e1]";
});

const styleWidth = computed(() => {
  return props.width.includes("w-") ? "" : props.width;
});

const styleHeight = computed(() => {
  return props.height.includes("h-") ? "" : props.height;
});

const inputType = computed(() => {
  if (props.passwordToggle) {
    return showPassword.value ? "text" : "password";
  }
  return props.type;
});

function togglePassword() {
  showPassword.value = !showPassword.value;
}
</script>

<template>
  <div
    class="flex flex-col gap-1 relative"
    :style="{ width: styleWidth }"
    :class="width.includes('w-') ? width : ''"
  >
    <!-- Label -->
    <div v-if="label" class="flex items-center gap-x-1 py-0 text-sm font-medium text-black">
      <span>{{ label }}</span> 
      <i v-if="isRequire" class="fa fa-asterisk text-red-500 text-[9px]"></i>
    </div>


    <!-- Input Wrapper with icon support -->
    <div 
      class="relative"
      
    >
      <!-- Input -->
      <input
        ref="inputEl"
        :type="inputType"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :style="{ height: styleHeight }"
        :class="`
          border rounded text-[14px] outline-none transition text-black placeholder:text-[13px] placeholder:text-[#7f858b] focus:border-black w-full
          ${sizeClasses} ${borderClasses}
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
          ${height.includes('h-') ? height : ''}
          ${icon || passwordToggle ? 'pr-10' : ''}
        `"
        autocomplete="off"
        @input="$emit('update:modelValue', $event.target.value)"
      />

      <!-- Left Icon -->
      <i
        v-if="icon && !passwordToggle"
        :class="`${icon} absolute right-3 top-1/2 -translate-y-1/2 text-gray-400`"
      ></i>

      <!-- Password Toggle -->
      <button
        v-if="passwordToggle"
        type="button"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
        @click="togglePassword"
      >
        <i :class="showPassword? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
      </button>
    </div>

    <!-- Error Message -->
    <BaseErrorLabel v-if="error" :label="error" />
  </div>
</template>
