<script setup>

import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useRouter } from 'vue-router';
import BaseInput from '@/components/BaseInput.vue';
import BaseTextarea from '@/components/BaseTextarea.vue';
import { onMounted, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import BaseSwitch from '@/components/BaseSwitch.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import { errMsgList } from '@/utils/const';

import { useSupplierStore } from '@/stores/useSupplierStore';

const router = useRouter();
const toast = useToast();

const useSupplier = useSupplierStore();

const formData = ref(
    {
        id: "",
        name: "",
        phone: "",
        address: "",
        status_id: "1",
        // is_default: false,
        created_by: "1",
        updated_by: ""
    }
)

const supplierStatus = ref(true);
const userData = ref({});
const errorMsg = ref({
    name: "",
});

// Change route function
function changeRoute(pathname) {
    router.push(pathname);
}

onMounted(async () => {
    userData.value = JSON.parse(localStorage.getItem('user'));
    try {
        await useSupplier.fetchAllSupplier();
    } catch (err) {
        alert('Failed to fetch supplier list on mount', err);
    }
});


// Create  function
async function formSubmit() {
    if (formData.value.name === "") {
        errorMsg.value = {
            name: errMsgList.name,
        }
        return
    }
    formData.value = {
        ...formData.value,
        created_by: userData.value.id,
        status_id: supplierStatus.value ? '1' : '2'
    };
 
    await useSupplier.addSupplier(formData.value);
    if (useSupplier.error.length) {
        useSupplier.error.forEach((msg) => {
            toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
            });
        });
        return
    }
    if (useSupplier.supplierList) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Supplier created successfully.', life: 3000 });
        router.push('/supplier');
    }
}

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Create Supplier">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary"
                        @click="changeRoute('/supplier')" />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3">
            <template #cardElements>
                <!-- Form section subtitle -->
                <SubTitle label="Basic Info" />
                <div class="flex gap-x-4 mt-6">
                    <!-- Supplier Name Input -->
                    <BaseInput size="sm" v-model="formData.name" label="Name" placeholder="Name" width="300px"
                        height="h-[35px]" :isRequire="true" :error="errorMsg.name" />
                    <!-- Supplier Status -->
                    <div class="flex flex-col gap-y-1 w-[200px]">
                        <BaseLabel label="Status" />
                        <BaseSwitch v-model="supplierStatus" />
                    </div>
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Phone number input -->
                    <BaseInput size="sm" v-model="formData.phone" label="Phone Number" placeholder="Phone" width="300px"
                        height="h-[35px]" />
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Address input -->
                    <BaseTextarea v-model="formData.address" label="Location" placeholder="Address" autoResize />
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton label="Save" :isLoading="useSupplier.loading"
                        :icon="useSupplier.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary"
                        @click="formSubmit" :disabled="useSupplier.loading" />
                </div>
            </template>
        </BaseCard>
    </div>
</template>
