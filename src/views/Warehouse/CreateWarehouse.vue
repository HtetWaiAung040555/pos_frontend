<script setup>

    import PageTitle from '@/components/PageTitle.vue';
    import BaseButton from '@/components/BaseButton.vue';
    import BaseCard from '@/components/BaseCard.vue';
    import SubTitle from '@/components/SubTitle.vue';
    import { useRouter } from 'vue-router';
    import BaseInput from '@/components/BaseInput.vue';
    import BaseTextarea from '@/components/BaseTextarea.vue';
    import { onMounted, ref } from 'vue';
    import { useToast } from 'primevue/usetoast';
    import BaseSwitch from '@/components/BaseSwitch.vue';
    import BaseLabel from '@/components/BaseLabel.vue';
    import { errMsgList } from '@/utils/const';
    import { useWarehouseStore } from '@/stores/useWarehouseStore';
    
    const router = useRouter();
    const toast = useToast();
    const useWarehouse = useWarehouseStore();

    const formData = ref(
      {
        name: "",
        // phone: "",
        // location: "",
        // status_id: "",
        created_by: "",
        updated_by: ""
      }
    )
    const warehouseStatus = ref(true);
    const userData = ref({});
    const errorMsg = ref({
        name: ""
    });

    // Change route function
    function changeRoute(pathname) {
        router.push(pathname);
    }

    onMounted(async() => {
        userData.value = JSON.parse(localStorage.getItem('user'));
        await useWarehouse.fetchAllWarehouse();
    });

    // Create warehouse function
    async function formSubmit() {
        if (formData.value.name === "") {
            errorMsg.value = {
                name: errMsgList.name,
            }
            return
        } else if ("") {          
            return
        }
        
        formData.value = {
            ...formData.value,
            created_by: userData.value.id,
            status_id: warehouseStatus.value? '1' : '2'
        };

        await useWarehouse.addWarehouse(formData.value);
        
        if(useWarehouse.error) {
            Object.values(useWarehouse.error).forEach((err) => {
                err.forEach((msg) => {
                    toast.add({ severity: 'error', summary: 'Error Message', detail: msg, life: 3000 });
                })
            })
            return
        }
        if (useWarehouse.warehouseList) {
            toast.add({ severity: 'success', summary: 'Success Message', detail: 'Warehouse created successfully.', life: 3000 });
            router.push('/warehouse');
        }
    }

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Create Warehouse">
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
                    <!-- Warehouse Name Input -->
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
                    <!-- Warehouse Status -->
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
                        disabled=""
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
                    <!-- Save Button -->
                    <BaseButton 
                        label="Save" 
                        :isLoading="useWarehouse.loading" :icon="useWarehouse.loading? 'fa fa-spinner' : 'fa fa-floppy-disk'" 
                        severity="primary" 
                        @click="formSubmit" 
                        :disabled="useWarehouse.loading"  
                    />
                </div>
            </template>
        </BaseCard>
    </div>
</template>
