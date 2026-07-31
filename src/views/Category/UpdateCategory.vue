<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue';
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import BaseInput from '@/components/BaseInput.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import BaseSwitch from '@/components/BaseSwitch.vue';
import CategoryPicker from '@/components/CategoryPicker.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { categoryCode, getParentCategoryOptions } from '@/utils/categories';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const useCategory = useCategoryStore();
const rootOption = Object.freeze({ id: null, label: 'No parent (root)', code: null });

const formData = ref({
  name: '',
  code: '',
  sort_order: 1,
});
const selectedParent = ref(rootOption);
const originalParentId = ref(null);
const categoryStatus = ref(true);
const userData = ref({});
const errorMsg = ref({
  name: '',
  parent_id: '',
  code: '',
});

const hasExplicitCode = computed(() => Boolean(String(formData.value.code ?? '').trim()));
const parentOptions = computed(() => (
  getParentCategoryOptions(useCategory.categoryList, {
    editingId: route.query.id,
    allowUncoded: hasExplicitCode.value,
  })
));
const parentChanged = computed(() => (
  String(selectedParent.value?.id ?? '') !== String(originalParentId.value ?? '')
));
const hasChildren = computed(() => (useCategory.category?.children?.length ?? 0) > 0);

onMounted(async () => {
  userData.value = JSON.parse(localStorage.getItem('user')) || {};
  await Promise.all([
    useCategory.fetchAllCategory(),
    useCategory.fetchCategory(route.query.id),
  ]);

  if (useCategory.error.length || !useCategory.category) {
    showStoreErrors();
    return;
  }

  const category = useCategory.category;
  formData.value = {
    name: category.name ?? '',
    code: categoryCode(category),
    sort_order: category.sort_order ?? 1,
  };
  categoryStatus.value = Number(category.status_id ?? category.status?.id ?? 1) === 1;
  originalParentId.value = category.parent_id ?? null;
  selectedParent.value = parentOptions.value.find(
    (option) => String(option.id ?? '') === String(category.parent_id ?? ''),
  ) ?? rootOption;
});

function changeRoute(pathname) {
  router.push(pathname);
}

function selectParent(parent) {
  selectedParent.value = parent;
  errorMsg.value.parent_id = '';
}

function showStoreErrors() {
  toast.add({
    severity: 'error',
    summary: 'Category could not be saved',
    detail: useCategory.error.join(' | '),
    life: 12000,
  });
}

async function formSubmit() {
  errorMsg.value = { name: '', parent_id: '', code: '' };
  const name = String(formData.value.name ?? '').trim();
  const code = String(formData.value.code ?? '').trim();
  const parent = selectedParent.value ?? rootOption;

  if (!name) {
    errorMsg.value.name = 'Name is required.';
    return;
  }

  if (parent.id !== null && !categoryCode(parent) && !code) {
    errorMsg.value.parent_id = 'Enter an explicit code before selecting an uncoded parent.';
    return;
  }

  if (parentChanged.value && !code) {
    errorMsg.value.code = 'Enter the category code explicitly when moving a category.';
    return;
  }

  const payload = {
    parent_id: parent.id ?? null,
    name,
    sort_order: Number(formData.value.sort_order ?? 0),
    status_id: categoryStatus.value ? 1 : 2,
    updated_by: userData.value.id,
  };

  // Sending the string explicitly preserves leading zeroes during a move.
  if (code) payload.code = code;

  await useCategory.editCategory(payload, route.query.id);

  if (useCategory.error.length) {
    showStoreErrors();
    return;
  }

  toast.add({
    severity: 'success',
    summary: 'Category updated',
    detail: 'The category was updated successfully.',
    life: 3000,
  });
  router.push('/category');
}
</script>

<template>
  <div class="p-4">
    <PageTitle title="Update Category">
      <template #titleButtons>
        <BaseButton
          icon="fa fa-chevron-left"
          label="Back"
          severity="secondary"
          @click="changeRoute('/category')"
        />
      </template>
    </PageTitle>

    <BaseCard class="mt-3">
      <template #cardElements>
        <SubTitle label="Basic Info" />

        <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <BaseInput
            v-model="formData.name"
            size="sm"
            label="Name"
            placeholder="Category name"
            height="h-[40px]"
            :isRequire="true"
            :error="errorMsg.name"
          />

          <CategoryPicker
            class="min-w-0 md:col-span-2 md:min-w-[560px] xl:col-span-2"
            :model-value="selectedParent"
            :options="parentOptions"
            :root-option="rootOption"
            :loading="useCategory.loading"
            :error="errorMsg.parent_id"
            mode="update"
            footer-note="This category and its descendants are excluded."
            @update:model-value="selectParent"
          />

          <BaseInput
            v-model="formData.sort_order"
            size="sm"
            type="number"
            min="0"
            step="1"
            label="Sort order"
            placeholder="1"
            height="h-[40px]"
          />

          <div class="flex flex-col gap-y-1">
            <BaseInput
              v-model="formData.code"
              size="sm"
              type="text"
              label="Code"
              placeholder="Enter a unique code"
              height="h-[40px]"
              :error="errorMsg.code"
            />
            <span class="text-xs text-gray-500">
              Codes are text values; leading zeroes are preserved.
            </span>
          </div>

          <div class="flex flex-col gap-y-1">
            <BaseLabel label="Status" />
            <div class="flex h-[40px] items-center">
              <BaseSwitch v-model="categoryStatus" />
            </div>
          </div>
        </div>

        <div
          v-if="parentChanged"
          class="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Moving does not recode this category automatically. Review the code before saving.
          <span v-if="hasChildren"> Descendant codes will also remain unchanged.</span>
        </div>

        <div class="mt-6 flex justify-end">
          <BaseButton
            label="Update"
            :isLoading="useCategory.loading"
            :icon="useCategory.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'"
            severity="primary"
            :disabled="useCategory.loading"
            @click="formSubmit"
          />
        </div>
      </template>
    </BaseCard>
  </div>
</template>
