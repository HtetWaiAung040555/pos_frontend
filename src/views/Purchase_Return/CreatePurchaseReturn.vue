<script setup>

import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useRoute, useRouter } from 'vue-router';
import BaseInput from '@/components/BaseInput.vue';
import { onMounted, ref, warn, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import BaseLabel from '@/components/BaseLabel.vue';
import { Select } from 'primevue';
import BaseErrorLabel from '@/components/BaseErrorLabel.vue';
import { errMsgList } from '@/utils/const';
import moment from 'moment';
import { usePaymentMethodStore } from '@/stores/usePaymentMethodStore';
import { usePurchaseReturnStore } from '@/stores/usePurchaseReturn';
import { usePurchaseStore } from '@/stores/usePurchaseStore';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const usePurchase = usePurchaseStore();
const usePurchaseReturn = usePurchaseReturnStore();
const usePaymentMethod = usePaymentMethodStore();

const userData = ref({});
const purchaseList = ref([]);
const selectedPurchase = ref({
    supplier: {
        id: '',
        name: '',
    },
    warehouse: {
        id: '',
        name: '',
    }
});
const selectedProducts = ref([]);
const errorMsg = ref({
    qty: ""
});
const formData = ref({
    purchaseId: '',
    warehouseId: '',
    supplierId: '',
    paymentId: '1',
    remark: '',
    returnDate: moment().format('YYYY-MM-DDTHH:mm'),
    products: [],
})

// Change route function
function changeRoute(pathname) {
    router.push(pathname);
}

onMounted(async () => {
    userData.value = JSON.parse(localStorage.getItem('user'));
    if (route.query.id) {
        await usePurchase.fetchPurchase(route.query.id);
        selectedPurchase.value = usePurchase.purchaseList;
        selectedProducts.value = usePurchase.purchaseList.details;
        formData.value.paymentId = usePurchase.purchaseList.payment_method.id;
    }
    await usePurchase.fetchAllPurchase();
    purchaseList.value = usePurchase.purchaseList;
    await usePaymentMethod.fetchAllPaymentMethod();
});

watch(selectedPurchase, (newPurchase) => {
    if (newPurchase) {
        selectedProducts.value = newPurchase.details.map((detail) => ({
            ...detail,
            returnQty: 0,
        }));
        formData.value.paymentId = newPurchase.payment.id;
    }
});

// Form Submit function
async function formSubmit() {
    // Validate return quantities: every product in the list must have returnQty > 0
    if (!selectedProducts.value.length) {
        toast.add({ severity: 'error', summary: 'Validation', detail: 'No products to return.', life: 3000 });
        return;
    }
    const invalid = selectedProducts.value.some(p => !p.returnQty || Number(p.returnQty) <= 0);
    if (invalid) {
        toast.add({ severity: 'error', summary: 'Validation', detail: 'Return qty must be greater than zero for all products.', life: 3000 });
        return;
    }

    let payload = {
        purchase_id: selectedPurchase.value.id,
        warehouse_id: selectedPurchase.value.warehouse.id,
        supplier_id: selectedPurchase.value.supplier.id,
        payment_id: formData.value.paymentId,
        remark: formData.value.remark,
        return_date: formData.value.returnDate,
        status_id: 7, // set complete status
        created_by: userData.value.id,
        products: selectedProducts.value.map((product) => ({
            purchase_detail_id: product.id,
            quantity: product.returnQty,
        })),
    }
    console.log(payload);
    await usePurchaseReturn.addPurchaseReturn(payload);
    if (usePurchaseReturn.error.length) {
        usePurchaseReturn.error.forEach((msg) => {
            toast.add({
              severity: 'error',
              summary: 'Error Message',
              detail: msg,
              life: 3000
            });
        });
        return;
    }
    toast.add({ severity: 'success', summary: 'Success Message', detail: 'Sales return successfully.', life: 3000 });
    router.push('/purchase_return');
}

// Remove a product row from selectedProducts
function removeProduct(index) {
    console.log(index);
    selectedProducts.value.splice(index, 1);
}

// Keep returnQty sane (no negatives) when user types
function onReturnQtyChange(product) {
    product.returnQty = Number(product.returnQty) || 0;
    if (product.returnQty < 0) product.returnQty = 0;
    // If returnQty exceeds the original sold quantity, cap it
    const soldQty = Number(product.quantity) || 0;
    if (product.returnQty > soldQty) product.returnQty = soldQty;
}

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Create Purchase Return">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary"
                        @click="changeRoute('/purchase_return')" />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3 w-full">
            <template #cardElements>
                <!-- Form section subtitle -->
                <SubTitle label="Basic Info" />
                <div class="grid lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                    <!-- Sales Id -->
                    <!-- Sales Id Select -->
                    <div class="flex flex-col gap-y-1">
                        <BaseLabel 
                            label="Purchase Invoice ID"
                        />
                        <Select 
                            v-model="selectedPurchase" 
                            :options="purchaseList" 
                            showClear
                            filter
                            optionLabel="id"
                            placeholder="Select Purchase Invoice ID"
                            class="w-[300px] h-[35px] items-center" 
                        />
                    </div>
                    <!-- Customer -->
                    <BaseInput size="sm" v-model="selectedPurchase.supplier.name" label="Customer"
                        placeholder="Customer" height="h-[35px]" disabled />
                    <!-- Warehouse -->
                    <BaseInput size="sm" v-model="selectedPurchase.warehouse.name" label="Warehouse"
                        placeholder="Warehouse" height="h-[35px]" disabled />
                    <!-- Expired date input -->
                    <BaseInput size="sm" v-model="formData.returnDate" label="Expired Date"
                        height="h-[35px]" type="datetime-local" />
                    <div class="flex flex-col gap-1">
                        <BaseLabel label="Payment Method:" />
                        <select class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px]"
                            v-model="formData.paymentId">
                            <option v-for="payment in usePaymentMethod.paymentMethodList" :value="payment.id">{{ payment.name }}</option>
                        </select>
                    </div>
                    <!-- Remark input -->
                    <BaseInput class="col-span-2" size="sm" v-model="formData.remark" label="Remark"
                        placeholder="Reason for adjustment" height="h-[35px]" type="text" />
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton label="Save" :isLoading="usePurchase.loading"
                        :icon="usePurchase.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary"
                        @click="formSubmit" :disabled="usePurchase.loading" />
                </div>
            </template>
        </BaseCard>
        <div class="mt-3 max-h-[300px] overflow-y-auto">
            <table class="text-black w-full border-collapse border border-gray-200">
                <thead class="sticky top-0">
                    <tr class="bg-gray-100 text-right">
                        <th class="px-2 py-2 text-center">Product Name</th>
                        <th class="px-2 py-2">Sales Price</th>
                        <th class="px-2 py-2">Sales Qty</th>
                        <th class="px-2 py-2">Return Qty</th>
                        <th class="px-2 py-2">Subtotal</th>
                        <th class="px-2 py-2 text-center">Action</th>
                    </tr>
                </thead>
                <tbody>
                    <tr 
                        class="hover:bg-blue-50 text-right" v-for="(product, index) in selectedProducts" :key="product.id"
                    >
                        <td class="border-b border-gray-200 px-2 py-2 text-center">{{ product.product.name }}</td>
                        <td class="border-b border-gray-200 px-2 py-2">{{ Number(product.price).toLocaleString('en-us') }}</td>
                        <td class="border-b border-gray-200 px-2 py-2">{{ product.quantity }}</td>
                        <td class="border-b border-gray-200 px-2 py-2 text-right">
                            <input type="number" min="0" :max="product.quantity" class="w-20 text-right px-1 py-1 border rounded" v-model.number="product.returnQty" @input="onReturnQtyChange(product)" />
                        </td>
                        <td class="border-b border-gray-200 px-2 py-2">{{ product.returnQty * Number(product.price)}}</td>
                        <td class="border-b border-gray-200 px-2 py-2 text-center">
                            <BaseButton severity="danger" icon="pi pi-trash" variant="text" @click="removeProduct(index)">Delete</BaseButton>
                        </td>
                    </tr>
                    <tr 
                        class="text-right"
                    >
                        <td colspan="2" class="border-b border-gray-200 px-2 py-2 text-center">
                            <strong>Total:</strong>
                        </td>
                        <td class="border-b border-gray-200 px-2 py-2">
                            <strong>
                                {{ selectedProducts.reduce((sum, product) => sum + (Number(product.quantity)), 0).toLocaleString('en-us') }}
                            </strong>
                        </td>
                        <td class="border-b border-gray-200 px-2 py-2">
                            <strong>
                                {{ selectedProducts.reduce((sum, product) => sum + (Number(product.returnQty)), 0).toLocaleString('en-us') }}
                            </strong>
                        </td>
                        <td class="border-b border-gray-200 px-2 py-2">
                            <strong>
                                {{ selectedProducts.reduce((sum, product) => sum + (product.returnQty * product.price), 0).toLocaleString('en-us') }}
                            </strong>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
