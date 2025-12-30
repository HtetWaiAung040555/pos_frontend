<script setup>
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import { useRoute, useRouter } from 'vue-router';
import { onMounted, ref } from 'vue';
import { useCategoryStore } from '@/stores/useCategoryStore';
import BaseCard from '@/components/BaseCard.vue';
import BaseInput from '@/components/BaseInput.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import BaseSwitch from '@/components/BaseSwitch.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useToast } from 'primevue';


const router = useRouter();
const route = useRoute();
const useCategory = useCategoryStore();
const toast = useToast();
const formData = ref({});
const categoryStatus = ref(true);
const userData = ref({});

// Change route function
function changeRoute(pathname) {
    router.push(pathname);
}

onMounted(async () => {
    await useCategory.fetchCategory(route.query.id);
    formData.value = useCategory.categoryList;
    categoryStatus.value = formData.value.status.id === 1 ? true : false;
    userData.value = JSON.parse(localStorage.getItem('user'));
});

// Update function
async function formSubmit() {
    let updatedData = {
        name: formData.value.name,
        status_id: categoryStatus.value ? '1' : '2',
        updated_by: userData.value.id
    }
    await useCategory.editCategory(updatedData, route.query.id);
    if (useCategory.error.length) {
        useCategory.error.forEach((msg) => {
            toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
            });
        });
        return
    }
    if (useCategory.categoryList) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Category updated successfully.', life: 3000 });
        router.push('/category');
    }
}
</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Update Category">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary"
                        @click="changeRoute('/category')" />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3">
            <template #cardElements>
                <!-- Form section subtitle -->
                <SubTitle label="Basic Info" />
                <div class="flex gap-x-4 mt-6">
                    <!-- Name Input -->
                    <BaseInput size="sm" v-model="formData.name" label="Name" placeholder="Name" width="300px"
                        height="h-[35px]" :isRequire="true" />
                    <!-- Status -->
                    <div class="flex flex-col gap-y-1 w-[200px]">
                        <BaseLabel label="Status" />
                        <BaseSwitch v-model="categoryStatus" />
                    </div>
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton label="Update" :isLoading="useCategory.loading"
                        :icon="useCategory.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary"
                        @click="formSubmit" :disabled="useCategory.loading" />
                </div>
            </template>
        </BaseCard>
    </div>
</template>
