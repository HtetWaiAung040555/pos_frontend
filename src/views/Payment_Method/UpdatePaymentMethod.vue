<script setup>
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import { useRoute, useRouter } from 'vue-router';
import { onMounted, ref } from 'vue';
import { usePaymentMethodStore } from '@/stores/usePaymentMethodStore';
import BaseCard from '@/components/BaseCard.vue';
import BaseInput from '@/components/BaseInput.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import BaseSwitch from '@/components/BaseSwitch.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useToast } from 'primevue';


const router = useRouter();
const route = useRoute();
const usePaymentMethod = usePaymentMethodStore();
const toast = useToast();
const formData = ref({});
const paymentMethodStatus = ref(true);
const userData = ref({});

// Change route function
function changeRoute(pathname) {
    router.push(pathname);
}

onMounted(async () => {
    await usePaymentMethod.fetchPaymentMethod(route.query.id);
    formData.value = usePaymentMethod.paymentMethodList;
    paymentMethodStatus.value = formData.value.status.id === 1 ? true : false;
    userData.value = JSON.parse(localStorage.getItem('user'));
});

// Update function
async function formSubmit() {
    let updatedData = {
        name: formData.value.name,
        status_id: paymentMethodStatus.value ? '1' : '2',
        updated_by: userData.value.id
    }
    await usePaymentMethod.editPaymentMethod(updatedData, route.query.id);
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
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Payment method updated successfully.', life: 3000 });
        router.push('/payment_method');
    }
}
</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Update Payment Method">
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
                    <!-- Name Input -->
                    <BaseInput size="sm" v-model="formData.name" label="Name" placeholder="Name" width="300px"
                        height="h-[35px]" :isRequire="true" />
                    <!-- Status -->
                    <div class="flex flex-col gap-y-1 w-[200px]">
                        <BaseLabel label="Status" />
                        <BaseSwitch v-model="paymentMethodStatus" />
                    </div>
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton label="Update" :isLoading="usePaymentMethod.loading"
                        :icon="usePaymentMethod.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary"
                        @click="formSubmit" :disabled="usePaymentMethod.loading" />
                </div>
            </template>
        </BaseCard>
    </div>
</template>
