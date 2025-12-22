<script setup>

import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useRouter } from 'vue-router';
import BaseInput from '@/components/BaseInput.vue';
import BaseTextarea from '@/components/BaseTextarea.vue';
import { onMounted, ref } from 'vue';
import { useBranchStore } from '@/stores/useBranchStore';
import { useToast } from 'primevue/usetoast';
import BaseSwitch from '@/components/BaseSwitch.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import { errMsgList } from '@/utils/const';
import { useWarehouseStore } from '@/stores/useWarehouseStore';
import { Select } from 'primevue';
import BaseErrorLabel from '@/components/BaseErrorLabel.vue';

const router = useRouter();
const toast = useToast();
const useBranch = useBranchStore();
const useWarehouse = useWarehouseStore();

const formData = ref(
    {
        name: "",
        phone: "",
        location: "",
        warehouse_id: "",
        status_id: "1",
        created_by: "1",
        updated_by: ""
    }
)
const branchStatus = ref(true);
const selectedWarehouse = ref('');
const userData = ref({});
const errorMsg = ref({
    name: "",
    warehouse: "",
});

// Change route function
function changeRoute(pathname) {
    router.push(pathname);
}

onMounted(async () => {
    userData.value = JSON.parse(localStorage.getItem('user'));
    await useWarehouse.fetchAllWarehouse();
});

// Create branch function
async function formSubmit() {
    if (formData.value.name === "") {
        errorMsg.value = {
            name: errMsgList.name,
            warehouse: ""
        }
        return
    } else if (!selectedWarehouse.value) {
        errorMsg.value = {
            name: "",
            warehouse: errMsgList.warehouse
        }
        return
    }
    formData.value = {
        ...formData.value,
        warehouse_id: selectedWarehouse.value.id,
        created_by: userData.value.id,
        status_id: branchStatus.value ? '1' : '2'
    };
    await useBranch.addBranch(formData.value);
    if (useBranch.error.length) {
        useBranch.error.forEach((msg) => {
            toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
            });
        });
        return
    }
    if (useBranch.branchList) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Branch created successfully.', life: 3000 });
        router.push('/branch');
    }
}

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Create Branch">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary"
                        @click="changeRoute('/branch')" />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3">
            <template #cardElements>
                <!-- Form section subtitle -->
                <SubTitle label="Basic Info" />
                <div class="flex gap-x-4 mt-6">
                    <!-- Branch Name Input -->
                    <BaseInput size="sm" v-model="formData.name" label="Name" placeholder="Name" width="300px"
                        height="h-[35px]" :isRequire="true" :error="errorMsg.name" />
                    <!-- Branch Status -->
                    <div class="flex flex-col gap-y-1 w-[200px]">
                        <BaseLabel label="Status" />
                        <BaseSwitch v-model="branchStatus" />
                    </div>
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Phone number input -->
                    <BaseInput size="sm" v-model="formData.phone" label="Phone Number" placeholder="Phone" width="300px"
                        height="h-[35px]" />
                    <!-- Warehouse Select -->
                    <div class="flex flex-col gap-y-1">
                        <BaseLabel label="Warehouse" :isRequire="true" />
                        <Select v-model="selectedWarehouse" :options="useWarehouse.warehouseList" showClear filter
                            optionLabel="name" placeholder="Select a warehouse"
                            class="w-[300px] h-[35px] items-center" />
                        <BaseErrorLabel v-if="errorMsg.warehouse" :label="errorMsg.warehouse" />
                    </div>
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Address input -->
                    <BaseTextarea v-model="formData.location" label="Location" placeholder="Address" autoResize />
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton label="Save" :isLoading="useBranch.loading"
                        :icon="useBranch.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary"
                        @click="formSubmit" :disabled="useBranch.loading" />
                </div>
            </template>
        </BaseCard>
    </div>
</template>
