<script setup>

    import PageTitle from '@/components/PageTitle.vue';
    import BaseButton from '@/components/BaseButton.vue';
    import BaseCard from '@/components/BaseCard.vue';
    import SubTitle from '@/components/SubTitle.vue';
    import { useRoute, useRouter } from 'vue-router';
    import BaseInput from '@/components/BaseInput.vue';
    import BaseTextarea from '@/components/BaseTextarea.vue';
    import { onMounted, ref, watch } from 'vue';
    import QRCode from 'qrcode';
    import { useToast } from 'primevue/usetoast';
    import BaseSwitch from '@/components/BaseSwitch.vue';
    import BaseLabel from '@/components/BaseLabel.vue';
    import { errMsgList } from '@/utils/const';
    import BaseErrorLabel from '@/components/BaseErrorLabel.vue';
    import { useCustomerStore } from '@/stores/useCustomerStore';
    
    const router = useRouter();
    const route = useRoute();
    const toast = useToast();
    const useCustomer = useCustomerStore();

    const formData = ref({})
    const qrDataUrl = ref('');
    const customerStatus = ref(true);
    const userData = ref({});
    const errorMsg = ref({
        name: "",
    });

    // Change route function
    function changeRoute(pathname) {
        router.push(pathname);
    }

    onMounted(async() => {
        await useCustomer.fetchCustomer(route.query.id);
        formData.value = useCustomer.customerList;
        customerStatus.value = formData.value.status.id === 1 ? true : false;
        userData.value = JSON.parse(localStorage.getItem('user'));

        // generate QR from returned id
        try {
            if (formData.value.id) {
                qrDataUrl.value = await QRCode.toDataURL(formData.value.id, { width: 300 });
            }
        } catch (err) {
            qrDataUrl.value = '';
        }
    });

    // keep QR in sync if id somehow changes
    watch(() => formData.value.id, async (newId) => {
        if (!newId) { qrDataUrl.value = ''; return; }
        try {
            qrDataUrl.value = await QRCode.toDataURL(newId, { width: 300 });
        } catch (err) {
            qrDataUrl.value = '';
        }
    });

    // Create branch function
    async function formSubmit() {
        if (formData.value.name === "") {
            errorMsg.value = {
                name: errMsgList.name,
            }
            return
        }
        let updatedData = {
            name: formData.value.name,
            phone: formData.value.phone,
            address: formData.value.address,
            updated_by: userData.value.id,
            status_id: customerStatus.value? '1' : '2'
        };
        await useCustomer.editCustomer(route.query.id, updatedData);
        if(useCustomer.error) {
            Object.values(useCustomer.error).forEach((err) => {
                err.forEach((msg) => {
                    toast.add({ severity: 'error', summary: 'Error Message', detail: msg, life: 3000 });
                })
            })
            return
        }
        if (useCustomer.customerList) {
            toast.add({ severity: 'success', summary: 'Success Message', detail: 'Customer updated successfully.', life: 3000 });
            router.push('/customer');
        }
    }

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Update Customer">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary" @click="changeRoute('/customer')"  />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3">
            <template #cardElements>
                <!-- Form section subtitle -->
                <SubTitle label="Basic Info" />
                <div class="flex gap-x-2 mt-6">
                    <div class="flex flex-col items-center gap-y-2">
                        <div class="w-[140px] h-[140px] bg-white flex items-center justify-center border">
                            <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR Code" class="max-w-full max-h-full" />
                            <div v-else class="text-xs text-gray-400">QR will appear here</div>
                        </div>
                        <BaseLabel v-if="formData.id" :label="formData.id" class="text-sm" />
                    </div>
                </div>
                <div class="flex gap-x-4 mt-6">
                    <!-- Customer Name Input -->
                    <BaseInput
                        size="sm"
                        v-model="formData.name"
                        label="Name"
                        placeholder="Name"
                        width="300px"
                        height="h-[35px]"
                        :isRequire="true"
                        :error="errorMsg.name"
                    />
                    <!-- Customer Status -->
                    <div class="flex flex-col gap-y-1 w-[200px]">
                        <BaseLabel label="Status" />
                        <BaseSwitch v-model="customerStatus" />
                    </div>
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Phone number input -->
                    <BaseInput
                        size="sm"
                        v-model="formData.phone"
                        label="Phone Number"
                        placeholder="Phone"
                        width="300px"
                        height="h-[35px]"
                    />
                    
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Address input -->
                    <BaseTextarea
                        v-model="formData.address"
                        label="Location"
                        placeholder="Address"
                        autoResize
                    />
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton 
                        label="Update" 
                        :isLoading="useCustomer.loading" :icon="useCustomer.loading? 'fa fa-spinner' : 'fa fa-floppy-disk'" 
                        severity="primary" 
                        @click="formSubmit" 
                        :disabled="useCustomer.loading"  
                    />
                </div>
            </template>
        </BaseCard>
    </div>
</template>
