<script setup>
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useRouter } from 'vue-router';
import BaseInput from '@/components/BaseInput.vue';
import { onMounted, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import BaseSwitch from '@/components/BaseSwitch.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import { errMsgList } from '@/utils/const';
import { useUnitStore } from '@/stores/useUnitStore';

const router = useRouter();
const toast = useToast();
const useUnit = useUnitStore();

const formData = ref(
    {
        name: "",
        status_id: "",
        created_by: "",
        updated_by: ""
    }
)
const unitStatus = ref(true);
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

// Create Payment Method function
async function formSubmit() {
    if (formData.value.name === "") {
        errorMsg.value = {
            name: errMsgList.name
        };
        return
    } 

    formData.value = {
        ...formData.value,
        created_by: userData.value.id,
        status_id: unitStatus.value ? '1' : '2'
    };

    await useUnit.addUnit(formData.value);

    if (useUnit.error.length) {
        useUnit.error.forEach((msg) => {
            toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
            });
        });
        return
    }

    if (useUnit.unitList) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Unit created successfully.', life: 3000 });
        router.push('/unit');
    }
}
</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Create Unit">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary"
                        @click="changeRoute('/unit')" />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3">
            <template #cardElements>
                <!-- Form section subtitle -->
                <SubTitle label="Basic Info" />
                <div class="flex gap-x-4 mt-6">
                    <!-- Unit Name Input -->
                    <BaseInput size="sm" v-model="formData.name" label="Name" placeholder="Name" width="300px"
                        height="h-[35px]" :isRequire="true" :error="errorMsg.name" />
                    <!-- Unit Status -->
                    <div class="flex flex-col gap-y-1 w-[200px]">
                        <BaseLabel label="Status" />
                        <BaseSwitch v-model="unitStatus" />
                    </div>
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton label="Save" :isLoading="useUnit.loading"
                        :icon="useUnit.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary"
                        @click="formSubmit" :disabled="useUnit.loading" />
                </div>
            </template>
        </BaseCard>
    </div>
</template>

<style></style>