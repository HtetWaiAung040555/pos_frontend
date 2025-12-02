<script setup>

    import PageTitle from '@/components/PageTitle.vue';
    import BaseButton from '@/components/BaseButton.vue';
    import BaseCard from '@/components/BaseCard.vue';
    import SubTitle from '@/components/SubTitle.vue';
    import { useRoute, useRouter } from 'vue-router';
    import BaseInput from '@/components/BaseInput.vue';
    import { onMounted, ref, watch } from 'vue';
    import { useToast } from 'primevue/usetoast';
    import BaseLabel from '@/components/BaseLabel.vue';
    import { Select } from 'primevue';
    import BaseErrorLabel from '@/components/BaseErrorLabel.vue';
    import { errMsgList } from '@/utils/const';
    import { useWarehouseStore } from '@/stores/useWarehouseStore';
    import { useProductStore } from '@/stores/useProductStore';
    import { useInventoryStore } from '@/stores/useInventoryStore';
    
    const router = useRouter();
    const route = useRoute();
    const toast = useToast();
    const useWarehouse = useWarehouseStore();
    const useProduct = useProductStore();
    const useInventory = useInventoryStore();

    const formData = ref({})
    const userData = ref({});
    const selectedProduct = ref('');
    const selectedWarehouse = ref('');
    const errorMsg = ref({
        name: "",
        warehouse: "",
        product: "",
        qty: ""
    });

    // Change route function
    function changeRoute(pathname) {
        router.push(pathname);
    }

    onMounted(async() => {
        userData.value = JSON.parse(localStorage.getItem('user'));
        await useInventory.fetchStock(route.query.id);
        await useProduct.fetchAllProduct();
        await useWarehouse.fetchAllWarehouse();
        formData.value = useInventory.stockList;
        selectedProduct.value = useProduct.productList.filter(el => el.id === formData.value.product.id)[0];
        selectedWarehouse.value = useWarehouse.warehouseList.filter(el => el.id === formData.value.warehouse.id)[0];
    });


    // Update stock function
    async function formSubmit() {
        if (formData.value.name === "") {
            errorMsg.value = {
                name: errMsgList.name,
                warehouse: "",
                product: "",
                qty: ""
            };
            return
        } else if (formData.value.qty <= 0) {
            errorMsg.value = {
                name: "",
                warehouse: "",
                product: "",
                qty: errMsgList.qty
            };
            return
        } else if (!selectedProduct.value) {
            errorMsg.value = {
                name: "",
                warehouse: "",
                product: errMsgList.product,
                qty: ""
            };
            return
        } else if (!selectedWarehouse.value) {
            errorMsg.value = {
                name: "",
                warehouse: errMsgList.warehouse,
                product: "",
                qty: ""
            };
            return
        }
        let updatedData = {
            name: formData.value.name,
            qty: formData.value.qty,
            product_id: selectedProduct.value.id,
            warehouse_id: selectedWarehouse.value.id,
            updated_by: userData.value.id
        }
        await useInventory.editStock(updatedData, route.query.id);
        if(useInventory.error) {
            Object.values(useInventory.error).forEach((err) => {
                err.forEach((msg) => {
                    toast.add({ severity: 'error', summary: 'Error Message', detail: msg, life: 3000 });
                })
            })
            return
        }
        if (useInventory.stockList) {
            toast.add({ severity: 'success', summary: 'Success Message', detail: 'Update stock successfully.', life: 3000 });
            router.push('/inventory');
        }
    }

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Update Stock">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary" @click="changeRoute('/inventory')"  />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3">
            <template #cardElements>
                <!-- Form section subtitle -->
                <SubTitle label="Basic Info" />
                <div class="flex gap-x-4 mt-6">
                    <!-- User Name Input -->
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
                    <!-- Qty input -->
                    <BaseInput
                        size="sm"
                        v-model="formData.qty"
                        label="Qty"
                        placeholder="Stock Qty"
                        width="300px"
                        height="h-[35px]"
                        type="number"
                        :isRequire="true"
                        :error="errorMsg.qty"
                    />
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Product Select -->
                    <div class="flex flex-col gap-y-1">
                        <BaseLabel 
                            label="Product"
                            :isRequire="true"
                        />
                        <Select 
                            v-model="selectedProduct" 
                            :options="useProduct.productList" 
                            showClear
                            filter
                            optionLabel="name"
                            placeholder="Select a product"
                            class="w-[300px] h-[35px] items-center" 
                        />
                        <BaseErrorLabel v-if="errorMsg.product" :label="errorMsg.product" />
                    </div>
                    <!-- Warehouse Select -->
                    <div class="flex flex-col gap-y-1">
                        <BaseLabel 
                            label="Warehouse"
                            :isRequire="true"
                        />
                        <Select 
                            v-model="selectedWarehouse" 
                            :options="useWarehouse.warehouseList" 
                            showClear
                            filter
                            optionLabel="name"
                            placeholder="Select a warehouse"
                            class="w-[300px] h-[35px] items-center" 
                        />
                        <BaseErrorLabel v-if="errorMsg.warehouse" :label="errorMsg.warehouse" />
                    </div>
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton 
                        label="Update" 
                        :isLoading="useInventory.loading" :icon="useInventory.loading? 'fa fa-spinner' : 'fa fa-floppy-disk'" 
                        severity="primary" 
                        @click="formSubmit" 
                        :disabled="useInventory.loading"  
                    />
                </div>
            </template>
        </BaseCard>
    </div>
</template>
