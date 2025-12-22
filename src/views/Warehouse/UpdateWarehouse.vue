<script setup>

    import PageTitle from '@/components/PageTitle.vue';
    import BaseButton from '@/components/BaseButton.vue';
    import { useRoute, useRouter } from 'vue-router';
    import { onMounted, ref } from 'vue';
    import BaseCard from '@/components/BaseCard.vue';
    import BaseInput from '@/components/BaseInput.vue';
    import SubTitle from '@/components/SubTitle.vue';
    import { useToast } from 'primevue';
    import { errMsgList } from '@/utils/const';
    import { useWarehouseStore } from '@/stores/useWarehouseStore';

    const router = useRouter();
    const route = useRoute();
    const useWarehouse = useWarehouseStore();
    const toast = useToast();

    const formData = ref({});
    const warehouseStatus = ref(true);
    const userData = ref({});
  
    const errorMsg = ref({
        name: ""
    });

    // Change route function
    function changeRoute(pathname) {
        router.push(pathname);
    }

    onMounted(async () => {
        await useWarehouse.fetchWarehouse(route.query.id);
        formData.value = useWarehouse.warehouseList
        // warehouseStatus.value = formData.value.status.id === 1 ? true : false;
        userData.value = JSON.parse(localStorage.getItem('user'));
        await useWarehouse.fetchAllWarehouse();
    
    });

    // Update function
    async function formSubmit() {
        if (formData.value.name === "") {
            errorMsg.value = {
                name: errMsgList.name
            }
            return
        } else if ("") {
         
        }
        let updatedData = {
            name: formData.value.name,
            phone: formData.value.phone,
            location: formData.value.location,
            status_id: warehouseStatus.value? '1' : '2',
            updated_by: userData.value.id
        }
        await useWarehouse.editWarehouse(updatedData, route.query.id);
        if(useWarehouse.error.length) {
            useWarehouse.error.forEach((msg) => {
                toast.add({
                    severity: 'error',
                    summary: 'Error Message',
                    detail: msg,
                    life: 3000
                });
            });
            return
        }
        if (useWarehouse.warehouseList) {
            toast.add({ severity: 'success', summary: 'Success Message', detail: 'Warehouse updated successfully.', life: 3000 });
            router.push('/warehouse');
        }
    }

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Update Warehouse">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary" @click="changeRoute('/warehouse')"  />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3">
            <template #cardElements>
                <!-- Form section subtitle -->
                <SubTitle label="Basic Info" />
                <div class="flex gap-x-4 mt-6">
                    <!-- name input -->
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
                    <!-- status -->
                    <div class="flex flex-col gap-y-1 w-[200px]">
                        <!-- <BaseLabel label="Status" />
                        <BaseSwitch v-model="warehouseStatus" /> -->
                    </div>
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Phone number input -->
                    <!-- <BaseInput
                        size="sm"
                        v-model="formData.phone"
                        label="Phone Number"
                        placeholder="Phone"
                        width="300px"
                        height="h-[35px]"
                        disabled
                    /> -->
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Address input -->
                    <!-- <BaseTextarea
                        v-model="formData.location"
                        label="Location"
                        placeholder="Address"
                        autoResize
                        disabled
                    /> -->
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save button -->
                    <BaseButton 
                        label="Update" 
                        :isLoading="useWarehouse.loading" 
                        :icon="useWarehouse.loading? 'fa fa-spinner' : 'fa fa-floppy-disk'" 
                        severity="primary" 
                        @click="formSubmit" 
                        :disabled="useWarehouse.loading"  
                    />
                </div>
            </template>
        </BaseCard>
    </div>
</template>
