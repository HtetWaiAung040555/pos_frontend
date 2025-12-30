<script setup>
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useRouter } from 'vue-router';
import BaseInput from '@/components/BaseInput.vue';
import { onMounted, ref } from 'vue';
import { usePaymentMethodStore } from '@/stores/usePaymentMethodStore';
import { useToast } from 'primevue/usetoast';
import BaseSwitch from '@/components/BaseSwitch.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import { errMsgList } from '@/utils/const';

const router = useRouter();
const toast = useToast();
const usePaymentMethod = usePaymentMethodStore();

const formData = ref(
    {
        name: "",
        status_id: "",
        created_by: "",
        updated_by: ""
    }
)
const paymentMethodStatus = ref(true);
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
    } else if ("") {
        return
    }

    formData.value = {
        ...formData.value,
        created_by: userData.value.id,
        status_id: paymentMethodStatus.value ? '1' : '2'
    };

    await usePaymentMethod.addPaymentMethod(formData.value);

    if (usePaymentMethod.error.length) {
        usePaymentMethod.error.forEach((msg) => {
            toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
            });
        });
        return
    }

    if (usePaymentMethod.paymentMethodList) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Payment Method created successfully.', life: 3000 });
        router.push('/payment_method');
    }
}
</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Create Payment Method">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary"
                        @click="changeRoute('/payment_method')" />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3">
            <template #cardElements>
                <!-- Form section subtitle -->
                <SubTitle label="Basic Info" />
                <div class="flex gap-x-4 mt-6">
                    <!-- Payment Method Name Input -->
                    <BaseInput size="sm" v-model="formData.name" label="Name" placeholder="Name" width="300px"
                        height="h-[35px]" :isRequire="true" :error="errorMsg.name" />
                    <!-- Payment Method Status -->
                    <div class="flex flex-col gap-y-1 w-[200px]">
                        <BaseLabel label="Status" />
                        <BaseSwitch v-model="paymentMethodStatus" />
                    </div>
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton label="Save" :isLoading="usePaymentMethod.loading"
                        :icon="usePaymentMethod.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary"
                        @click="formSubmit" :disabled="usePaymentMethod.loading" />
                </div>
            </template>
        </BaseCard>
    </div>
</template>

<style></style>