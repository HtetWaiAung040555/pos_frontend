<script setup>
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useRouter } from 'vue-router';
import BaseInput from '@/components/BaseInput.vue';
import { onMounted, ref } from 'vue';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useToast } from 'primevue/usetoast';
import BaseSwitch from '@/components/BaseSwitch.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import { errMsgList } from '@/utils/const';
import BaseErrorLabel from '@/components/BaseErrorLabel.vue';

const router = useRouter();
const toast = useToast();
const useCategory = useCategoryStore();

const formData = ref(
    {
        name: "",
        status_id: "",
        created_by: "",
        updated_by: ""
    }
)
const categoryStatus = ref(true);
const userData = ref({});

const errorMsg = ref({
    name: ""
});


// Change route function
function changeRoute(pathname) {
    router.push(pathname);
}

onMounted(async () => {
    userData.value = JSON.parse(localStorage.getItem('user'));
});

// Create function
async function formSubmit() {
    if (formData.value.name === "") {
        errorMsg.value = {
            name: errMsgList.name
        };
        return
    } else if ("") {
        return
    }

    formData.value = {
        ...formData.value,
        created_by: userData.value.id,
        status_id: categoryStatus.value ? '1' : '2'
    };

    await useCategory.addCategory(formData.value);

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
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Category created successfully.', life: 3000 });
        router.push('/category');
    }
}
</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Create Category">
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
                        height="h-[35px]" :isRequire="true" :error="errorMsg.name" />
                    <!-- Status -->
                    <div class="flex flex-col gap-y-1 w-[200px]">
                        <BaseLabel label="Status" />
                        <BaseSwitch v-model="categoryStatus" />
                    </div>
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton label="Save" :isLoading="useCategory.loading"
                        :icon="useCategory.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary"
                        @click="formSubmit" :disabled="useCategory.loading" />
                </div>
            </template>
        </BaseCard>
    </div>
</template>