<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import BaseInput from '@/components/BaseInput.vue';
import BaseSwitch from '@/components/BaseSwitch.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import CategoryPicker from '@/components/CategoryPicker.vue';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { categoryCode, getParentCategoryOptions } from '@/utils/categories';
import { errMsgList } from '@/utils/const';

const router = useRouter();
const toast = useToast();
const useCategory = useCategoryStore();
const rootOption = Object.freeze({ id: null, label: 'No parent (root)', code: null });

const formData = ref({
  name: '',
  code: '',
  sort_order: 1,
});
const selectedParent = ref(rootOption);
const categoryStatus = ref(true);
const userData = ref({});
const errorMsg = ref({
  name: '',
  parent_id: '',
});

const hasExplicitCode = computed(() => Boolean(String(formData.value.code ?? '').trim()));
const parentOptions = computed(() => (
  getParentCategoryOptions(useCategory.categoryList, {
    allowUncoded: hasExplicitCode.value,
  })
));

onMounted(async () => {
  userData.value = JSON.parse(localStorage.getItem('user')) || {};
  await useCategory.fetchAllCategory();
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
  errorMsg.value = { name: '', parent_id: '' };
  const name = String(formData.value.name ?? '').trim();
  const code = String(formData.value.code ?? '').trim();
  const parent = selectedParent.value ?? rootOption;

  if (!name) {
    errorMsg.value.name = errMsgList.name;
    return;
  }

  if (parent.id !== null && !categoryCode(parent) && !code) {
    errorMsg.value.parent_id = 'Enter an explicit code before selecting an uncoded parent.';
    return;
  }

  const payload = {
    parent_id: parent.id ?? null,
    name,
    sort_order: Number(formData.value.sort_order ?? 0),
    status_id: categoryStatus.value ? 1 : 2,
    created_by: userData.value.id,
  };

  // Omitting code lets the backend generate the next hierarchical code.
  if (code) payload.code = code;

  await useCategory.addCategory(payload);

  if (useCategory.error.length) {
    showStoreErrors();
    return;
  }

  toast.add({
    severity: 'success',
    summary: 'Category created',
    detail: 'The category was created successfully.',
    life: 3000,
  });
  router.push('/category');
}
</script>

<template>
  <div class="p-4">
    <PageTitle title="Create Category">
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
              placeholder="Generated automatically"
              height="h-[40px]"
            />
            <span class="text-xs text-gray-500">
              Leave blank for automatic generation. Codes are saved as text, including leading zeroes.
            </span>
          </div>

          <div class="flex flex-col gap-y-1">
            <BaseLabel label="Status" />
            <div class="flex h-[40px] items-center">
              <BaseSwitch v-model="categoryStatus" />
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <BaseButton
            label="Save"
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
