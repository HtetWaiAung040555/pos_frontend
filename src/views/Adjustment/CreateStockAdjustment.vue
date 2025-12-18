<script setup>

import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useRoute, useRouter } from 'vue-router';
import BaseInput from '@/components/BaseInput.vue';
import { onMounted, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import BaseLabel from '@/components/BaseLabel.vue';
import { Select } from 'primevue';
import BaseErrorLabel from '@/components/BaseErrorLabel.vue';
import { errMsgList } from '@/utils/const';
import { useInventoryStore } from '@/stores/useInventoryStore';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const useInventory = useInventoryStore();

const userData = ref({});
const stockList = ref([]);
const selectedInventory = ref({
    adjustType: '1',
    newQty: 0,
    reason: "",
    product: {
        id: null,
        name: "",
    },
    warehouse: {
        id: null,
        name: "",
    }
});
const errorMsg = ref({
    qty: ""
});
const oldQty = ref(0);

// Change route function
function changeRoute(pathname) {
    router.push(pathname);
}

onMounted(async () => {
    userData.value = JSON.parse(localStorage.getItem('user'));
    if (route.query.id) {
        await useInventory.fetchStock(route.query.id);
        selectedInventory.value = {
            ...useInventory.stockList,
            adjustType: '1',
            newQty: 0,
            reason: "",
        };
    }
    await useInventory.fetchAllStock();
    stockList.value = useInventory.stockList;
    oldQty.value = useInventory.stockList.qty;
});


// Update stock function
async function formSubmit() {
    if (selectedInventory.value.qty <= 0) {
        errorMsg.value = {
            qty: errMsgList.qty
        };
        return
    }
    let payload = {
        inventory_id: selectedInventory.value.id,
        qty: selectedInventory.value.adjustType === '1'? Number(selectedInventory.value.newQty) : -Number(selectedInventory.value.newQty),
        reason: selectedInventory.value.reason || "Stock adjustment",
        created_by: userData.value.id,
    }
    await useInventory.adjustStock(payload);
    if (useInventory.error.length) {
        useInventory.error.forEach((msg) => {
            toast.add({
              severity: 'error',
              summary: 'Error Message',
              detail: msg,
              life: 3000
            });
        });
        return;
    }
    toast.add({ severity: 'success', summary: 'Success Message', detail: 'Stock adjustment successfully.', life: 3000 });
    router.push('/stock_adjustment');
}

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Stock Adjustment">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary"
                        @click="changeRoute('/stock_adjustment')" />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3 w-full">
            <template #cardElements>
                <!-- Form section subtitle -->
                <SubTitle label="Basic Info" />
                <div class="grid lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                    <!-- Inventory -->
                    <BaseInput size="sm" v-model="selectedInventory.id" label="Inventory Id"
                        placeholder="Inventory Id" height="h-[35px]" disabled />
                    <!-- Product -->
                    <BaseInput size="sm" v-model="selectedInventory.product.name" label="Product"
                        placeholder="Product" height="h-[35px]" disabled />
                    <!-- Warehouse -->
                    <BaseInput size="sm" v-model="selectedInventory.warehouse.name" label="Warehouse"
                        placeholder="Warehouse" height="h-[35px]" disabled />
                    <!-- Expired date input -->
                    <BaseInput size="sm" v-model="selectedInventory.expired_date" label="Expired Date"
                        height="h-[35px]" type="date" disabled />
                    <!-- Old Qty input -->
                    <BaseInput size="sm" v-model="selectedInventory.qty" label="Old Qty" placeholder="Stock Qty"
                        height="h-[35px]" type="number" disabled />
                    <div class="flex flex-col gap-1">
                        <BaseLabel label="Adjustment Type:" />
                        <select class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px]"
                            v-model="selectedInventory.adjustType">
                            <option value="1">Gain</option>
                            <option value="2">Loss</option>
                        </select>
                    </div>
                    <!-- New Qty input -->
                    <BaseInput size="sm" v-model="selectedInventory.newQty" label="New Qty" placeholder="Stock Qty"
                        height="h-[35px]" type="number" :isRequire="true" :error="errorMsg.qty" />
                    <!-- Reason input -->
                    <BaseInput class="col-span-2" size="sm" v-model="selectedInventory.reason" label="Reason"
                        placeholder="Reason for adjustment" height="h-[35px]" type="text" />
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton label="Save" :isLoading="useInventory.loading"
                        :icon="useInventory.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary"
                        @click="formSubmit" :disabled="useInventory.loading" />
                </div>
            </template>
        </BaseCard>
        <div class="mt-3 max-h-[300px] overflow-y-auto">
            <table class="text-black w-full border-collapse border border-gray-200">
                <thead class="sticky top-0">
                    <tr class="bg-gray-100 text-left">
                        <th class="px-2 py-2">Inv ID</th>
                        <th class="px-2 py-2">Product</th>
                        <th class="px-2 py-2">Warehouse</th>
                        <th class="px-2 py-2 text-right">Qty</th>
                        <th class="px-2 py-2">Expired Date</th>
                    </tr>
                </thead>
                <tbody>
                    <tr 
                        class="cursor-pointer hover:bg-blue-50" v-for="inventory in stockList" :key="inventory.id" 
                        @click="selectedInventory = { ...inventory, adjustType: '1', newQty: 0, reason: '' }"
                    >
                        <td class="border-b border-gray-200 px-2 py-2">{{ inventory.id }}</td>
                        <td class="border-b border-gray-200 px-2 py-2">{{ inventory.product.name }}</td>
                        <td class="border-b border-gray-200 px-2 py-2">{{ inventory.warehouse.name }}</td>
                        <td class="border-b border-gray-200 px-2 py-2 text-right">{{ inventory.qty }}</td>
                        <td class="border-b border-gray-200 px-2 py-2">{{ inventory.expired_date }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
