<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import BaseErrorLabel from '@/components/BaseErrorLabel.vue';
import { categoryCode } from '@/utils/categories';

const props = defineProps({
  modelValue: {
    type: Object,
    default: null,
  },
  options: {
    type: Array,
    default: () => [],
  },
  rootOption: {
    type: Object,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  mode: {
    type: String,
    default: 'create',
    validator: (value) => ['create', 'update', 'product', 'filter'].includes(value),
  },
  footerNote: {
    type: String,
    default: '',
  },
  compact: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue']);

const pickerRef = ref(null);
const triggerRef = ref(null);
const dropdownRef = ref(null);
const searchInputRef = ref(null);
const isOpen = ref(false);
const searchQuery = ref('');
const dropdownStyle = ref({});
const isProductMode = computed(() => props.mode === 'product');
const isFilterMode = computed(() => props.mode === 'filter');
const isChoiceMode = computed(() => isProductMode.value || isFilterMode.value);

const selectedOption = computed(() => {
  if (props.modelValue?.id === null || props.modelValue?.id === undefined) {
    return props.rootOption;
  }

  return props.options.find(
    (option) => String(option.id) === String(props.modelValue?.id),
  ) ?? props.modelValue;
});

const isRootSelected = computed(() => (
  selectedOption.value?.id === null || selectedOption.value?.id === undefined
));

const filteredOptions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return props.options;

  return props.options.filter((option) => (
    [
      option.name,
      categoryCode(option),
      option.path_label,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  ));
});

const selectedPath = computed(() => (
  isRootSelected.value
    ? isProductMode.value
      ? 'Uncategorized'
      : isFilterMode.value
        ? 'All categories'
        : 'Top level'
    : selectedOption.value?.path_label || selectedOption.value?.label || selectedOption.value?.name
));

function parentLevelPath(option) {
  if (!option) return '';

  if (Array.isArray(option.path)) {
    if (option.path.length > 1) return option.path.slice(0, -1).join(' > ');
    if (option.path.length === 1) return 'Top-level category';
  }

  if (option.parent?.name) {
    const code = categoryCode(option.parent);
    return code ? `${option.parent.name} (${code})` : option.parent.name;
  }

  return '';
}

const selectedParentPath = computed(() => parentLevelPath(selectedOption.value));
const selectedMainLabel = computed(() => (
  isChoiceMode.value && !isRootSelected.value
    ? selectedOption.value?.name
    : selectedPath.value
));

const rootActionLabel = computed(() => (
  isProductMode.value
    ? 'Leave uncategorized'
    : isFilterMode.value
      ? 'All categories'
    : props.mode === 'update'
      ? 'Move to root category'
      : 'Create as root category'
));

const fieldLabel = computed(() => (
  isProductMode.value ? 'Category' : isFilterMode.value ? 'Category filter' : 'Parent category'
));
const emptyDescription = computed(() => (
  isProductMode.value
    ? 'No category assigned'
    : isFilterMode.value
      ? 'Show products from every category'
      : 'No parent category'
));
const dividerLabel = computed(() => (
  isProductMode.value
    ? 'Active leaf categories'
    : isFilterMode.value
      ? 'Category hierarchy'
      : 'Existing categories'
));
const effectiveFooterNote = computed(() => (
  props.footerNote
  || (isProductMode.value
    ? 'Only active leaf categories are shown.'
    : isFilterMode.value
      ? 'Parent filters include descendant products.'
      : '')
));

const selectionHelp = computed(() => {
  if (isProductMode.value) {
    if (isRootSelected.value) {
      return 'The product will be saved without a category.';
    }
    if (selectedOption.value?.disabled) {
      return 'The current category is unavailable. Choose an active leaf category or Uncategorized.';
    }
    return 'The product will be assigned to this active leaf category.';
  }

  if (isFilterMode.value) {
    return isRootSelected.value
      ? 'Showing products from every category.'
      : 'Showing products from this category and all of its descendants.';
  }

  if (isRootSelected.value) {
    return 'This category has no parent and will appear at the top level.';
  }

  const subject = props.mode === 'update' ? 'This category' : 'The new category';
  const code = categoryCode(selectedOption.value);
  if (!code) {
    return 'This parent has no code. Enter an explicit category code before saving.';
  }

  return `${subject} will be nested here and its automatic code will use ${code} as the prefix.`;
});

watch(isOpen, async (open) => {
  if (!open) {
    searchQuery.value = '';
    return;
  }

  await nextTick();
  updateDropdownPosition();
  searchInputRef.value?.focus();
});

function updateDropdownPosition() {
  if (!props.compact || !isOpen.value || !triggerRef.value) return;

  const rect = triggerRef.value.getBoundingClientRect();
  const viewportPadding = 8;
  const width = Math.min(420, window.innerWidth - (viewportPadding * 2));
  const left = Math.min(
    Math.max(viewportPadding, rect.left),
    window.innerWidth - width - viewportPadding,
  );

  dropdownStyle.value = {
    top: `${rect.bottom + 5}px`,
    left: `${left}px`,
    width: `${width}px`,
  };
}

function togglePicker() {
  if (props.loading) return;
  isOpen.value = !isOpen.value;
}

function choose(option) {
  if (option?.disabled) return;
  emit('update:modelValue', option);
  isOpen.value = false;
}

function handleOutsideClick(event) {
  if (
    isOpen.value
    && !pickerRef.value?.contains(event.target)
    && !dropdownRef.value?.contains(event.target)
  ) {
    isOpen.value = false;
  }
}

function handleEscape(event) {
  if (event.key === 'Escape') isOpen.value = false;
}

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsideClick);
  document.addEventListener('keydown', handleEscape);
  window.addEventListener('resize', updateDropdownPosition);
  document.addEventListener('scroll', updateDropdownPosition, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsideClick);
  document.removeEventListener('keydown', handleEscape);
  window.removeEventListener('resize', updateDropdownPosition);
  document.removeEventListener('scroll', updateDropdownPosition, true);
});
</script>

<template>
  <div ref="pickerRef" class="relative flex min-w-0 flex-col gap-1">
    <label
      id="category-picker-label"
      class="text-sm font-medium text-black"
      :class="{ 'sr-only': compact }"
    >
      {{ fieldLabel }}
    </label>

    <button
      ref="triggerRef"
      type="button"
      class="group flex w-full items-center justify-between border bg-white text-left outline-none transition"
      :class="[
        compact
          ? 'h-[33px] min-h-[33px] gap-2 rounded-md px-2.5 py-1.5'
          : 'min-h-[58px] gap-3 rounded-lg px-3.5 py-2.5',
        error
          ? 'border-red-500 ring-1 ring-red-100'
          : isOpen
            ? 'border-blue-500 ring-2 ring-blue-100'
            : 'border-slate-300 hover:border-slate-400',
        loading ? 'cursor-wait opacity-70' : 'cursor-pointer',
      ]"
      aria-labelledby="category-picker-label"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :disabled="loading"
      @click="togglePicker"
      @keydown.down.prevent="isOpen = true"
    >
      <span class="flex min-w-0 items-center gap-3">
        <span
          class="flex shrink-0 items-center justify-center rounded-lg"
          :class="isProductMode
            ? `${compact ? 'h-6 w-6' : 'h-9 w-9'} bg-violet-50 text-violet-600`
            : isFilterMode
              ? `${compact ? 'h-6 w-6' : 'h-9 w-9'} bg-blue-50 text-blue-600`
              : `${compact ? 'h-6 w-6' : 'h-9 w-9'} ${isRootSelected ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`"
        >
          <i :class="isProductMode ? 'pi pi-tag' : isFilterMode ? 'pi pi-filter' : isRootSelected ? 'pi pi-sitemap' : 'pi pi-folder-open'"></i>
        </span>

        <span class="min-w-0">
          <span
            v-if="!compact"
            class="block truncate text-xs text-slate-500"
            :class="isChoiceMode && !isRootSelected
              ? 'font-normal normal-case tracking-normal'
              : 'font-medium uppercase tracking-wide'"
          >
            {{
              isChoiceMode && !isRootSelected
                ? selectedParentPath || 'Current category'
                : isProductMode
                  ? 'Product category'
                  : isFilterMode
                    ? 'Category filter'
                  : isRootSelected
                    ? 'Root category'
                    : 'Selected parent'
            }}
          </span>
          <span
            class="block truncate text-sm text-slate-900"
            :class="[
              compact ? 'font-medium' : 'mt-0.5',
              !compact && isChoiceMode ? 'font-normal' : !compact ? 'font-semibold' : '',
            ]"
          >
            {{ selectedMainLabel }}
          </span>
        </span>
      </span>

      <span class="flex shrink-0 items-center gap-2">
        <span
          v-if="!compact && !isRootSelected && categoryCode(selectedOption)"
          class="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-600"
        >
          {{ categoryCode(selectedOption) }}
        </span>
        <i
          class="pi pi-chevron-down text-xs text-slate-400 transition-transform"
          :class="{ 'rotate-180': isOpen }"
        ></i>
      </span>
    </button>

    <BaseErrorLabel v-if="error && !compact" :label="error" />
    <p v-else-if="!compact" class="text-xs text-slate-500">{{ selectionHelp }}</p>

    <Teleport to="body" :disabled="!compact">
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="z-[100] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        :class="compact ? 'fixed' : 'absolute left-0 right-0 top-[84px]'"
        :style="compact ? dropdownStyle : undefined"
        role="listbox"
        aria-labelledby="category-picker-label"
      >
      <div class="border-b border-slate-100 bg-slate-50/80 p-3">
        <div class="relative">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400"></i>
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="search"
            class="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="Search category name, path, or code..."
            :aria-label="`Search ${fieldLabel.toLowerCase()}`"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Clear category search"
            @click="searchQuery = ''"
          >
            <i class="pi pi-times text-xs"></i>
          </button>
        </div>
      </div>

      <div class="max-h-[340px] overflow-y-auto p-2">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition"
          :class="isRootSelected
            ? isProductMode
              ? 'border-violet-200 bg-violet-50 text-violet-900'
              : isFilterMode
                ? 'border-blue-200 bg-blue-50 text-blue-900'
                : 'border-blue-200 bg-blue-50 text-blue-900'
            : 'border-transparent hover:border-slate-200 hover:bg-slate-50'"
          role="option"
          :aria-selected="isRootSelected"
          @click="choose(rootOption)"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            :class="isProductMode
              ? 'bg-violet-100 text-violet-600'
              : 'bg-blue-100 text-blue-600'"
          >
            <i :class="isProductMode ? 'pi pi-minus-circle' : isFilterMode ? 'pi pi-th-large' : 'pi pi-sitemap'"></i>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold">{{ rootActionLabel }}</span>
            <span class="block text-xs text-slate-500">{{ emptyDescription }}</span>
          </span>
          <i
            v-if="isRootSelected"
            class="pi pi-check-circle"
            :class="isProductMode ? 'text-violet-600' : 'text-blue-600'"
          ></i>
        </button>

        <div class="my-2 flex items-center gap-2 px-2">
          <span class="h-px flex-1 bg-slate-200"></span>
          <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {{ dividerLabel }}
          </span>
          <span class="h-px flex-1 bg-slate-200"></span>
        </div>

        <div
          v-if="loading"
          class="flex items-center justify-center gap-2 px-3 py-8 text-sm text-slate-500"
        >
          <i class="pi pi-spinner animate-spin"></i>
          Loading categories...
        </div>

        <div
          v-else-if="filteredOptions.length === 0"
          class="px-4 py-8 text-center"
        >
          <span class="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <i class="pi pi-search"></i>
          </span>
          <p class="mt-2 text-sm font-medium text-slate-700">No categories found</p>
          <p class="mt-0.5 text-xs text-slate-500">Try a different name, path, or code.</p>
        </div>

        <button
          v-for="option in filteredOptions"
          v-else
          :key="option.id"
          type="button"
          class="group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition"
          :class="[
            option.disabled
              ? 'cursor-not-allowed bg-slate-50 text-slate-400'
              : String(selectedOption?.id) === String(option.id)
                ? isProductMode
                  ? 'bg-violet-50 text-violet-900'
                  : isFilterMode
                    ? 'bg-blue-50 text-blue-900'
                    : 'bg-blue-50 text-blue-900'
                : 'text-slate-800 hover:bg-slate-50',
          ]"
          :style="isChoiceMode || searchQuery ? undefined : { paddingLeft: `${12 + Math.min(option.depth ?? 0, 8) * 18}px` }"
          :disabled="option.disabled"
          role="option"
          :aria-selected="String(selectedOption?.id) === String(option.id)"
          @click="choose(option)"
        >
          <span
            v-if="!isChoiceMode && !searchQuery && option.depth"
            class="text-sm text-slate-300"
            aria-hidden="true"
          >
            &rdsh;
          </span>
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            :class="option.disabled
              ? 'bg-slate-100 text-slate-400'
              : isProductMode
                ? 'bg-violet-50 text-violet-600'
                : isFilterMode
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-amber-50 text-amber-600'"
          >
            <i :class="option.disabled ? 'pi pi-lock' : isProductMode ? 'pi pi-tag' : 'pi pi-folder'"></i>
          </span>

          <span class="min-w-0 flex-1">
            <span
              v-if="isChoiceMode && parentLevelPath(option)"
              class="mb-1 block truncate text-xs font-normal text-slate-500"
            >
              {{ parentLevelPath(option) }}
            </span>
            <span class="flex min-w-0 items-center gap-2">
              <span
                class="truncate text-sm"
                :class="isChoiceMode ? 'font-normal' : 'font-medium'"
              >
                {{ option.name }}
              </span>
              <span
                v-if="categoryCode(option)"
                class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600"
              >
                {{ categoryCode(option) }}
              </span>
            </span>
            <span
              v-if="!isChoiceMode && (searchQuery || option.disabled)"
              class="mt-0.5 block truncate text-xs"
              :class="option.disabled ? 'text-slate-400' : 'text-slate-500'"
            >
              {{ option.disabled ? `Unavailable: ${option.disabled_reason}` : option.path_label }}
            </span>
            <span
              v-else-if="isChoiceMode && option.disabled"
              class="mt-0.5 block truncate text-xs text-slate-400"
            >
              Unavailable: {{ option.disabled_reason }}
            </span>
          </span>

          <i
            v-if="String(selectedOption?.id) === String(option.id)"
            class="pi pi-check-circle shrink-0"
            :class="isProductMode ? 'text-violet-600' : 'text-blue-600'"
          ></i>
        </button>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-1 border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span>
          {{ filteredOptions.length }} {{ filteredOptions.length === 1 ? 'category' : 'categories' }} shown
        </span>
        <span v-if="effectiveFooterNote">{{ effectiveFooterNote }}</span>
      </div>
      </div>
    </Teleport>
  </div>
</template>
