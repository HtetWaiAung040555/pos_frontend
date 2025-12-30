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
import moment from 'moment';
import { usePaymentMethodStore } from '@/stores/usePaymentMethodStore';
import { usePurchaseReturnStore } from '@/stores/usePurchaseReturn';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const usePurchaseReturn = usePurchaseReturnStore();
const usePaymentMethod = usePaymentMethodStore();

const userData = ref({});
const selectedProducts = ref([]);
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
    await usePurchaseReturn.fetchPurchaseReturn(route.query.id);
    formData.value = {
        purchaseId: usePurchaseReturn.returnList.purchases.id,
        warehouseId: usePurchaseReturn.returnList.warehouse.id,
        warehouseName: usePurchaseReturn.returnList.warehouse.name,
        supplierName: usePurchaseReturn.returnList.supplier.name,
        supplierId: usePurchaseReturn.returnList.supplier.id,
        paymentId: usePurchaseReturn.returnList.payment_method.id,
        remark: usePurchaseReturn.returnList.remark,
        returnDate: moment(usePurchaseReturn.returnList.return_date).format('YYYY-MM-DDTHH:mm'),
    };
    selectedProducts.value = usePurchaseReturn.returnList.details;
    await usePaymentMethod.fetchAllPaymentMethod();
});

// Form Submit function
async function formSubmit() {
    // Validate return quantities: every product in the list must have returnQty > 0
    if (!selectedProducts.value.length) {
        toast.add({ severity: 'error', summary: 'Validation', detail: 'No products to return.', life: 3000 });
        return;
    }
    const invalid = selectedProducts.value.some(p => !p.quantity || Number(p.quantity) <= 0);
    if (invalid) {
        toast.add({ severity: 'error', summary: 'Validation', detail: 'Return qty must be greater than zero for all products.', life: 3000 });
        return;
    }

    let payload = {
        remark: formData.value.remark,
        return_date: formData.value.returnDate,
        updated_by: userData.value.id,
        payment_id: formData.value.paymentId,
        products: selectedProducts.value.map((product) => ({
            purchase_detail_id: product.purchases_detail.id,
            quantity: product.quantity,
        })),
    }
    await usePurchaseReturn.editPurchaseReturn(payload, route.query.id);
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
    selectedProducts.value.splice(index, 1);
}

// Keep returnQty sane (no negatives) when user types
function onReturnQtyChange(product) {
    product.quantity = Number(product.quantity) || 0;
    if (product.quantity < 0) product.quantity = 0;
    // If returnQty exceeds the original sold quantity, cap it
    const soldQty = Number(product.sales_detail.quantity) || 0;
    if (product.quantity > soldQty) product.quantity = soldQty;
}

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Update Purchase Return">
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
                    <!-- Purchase Id -->
                    <BaseInput size="sm" v-model="formData.purchaseId" label="Sales ID"
                        placeholder="Sales ID" height="h-[35px]" disabled />
                    <!-- Supplier -->
                    <BaseInput size="sm" v-model="formData.supplierName" label="Supplier"
                        placeholder="Supplier" height="h-[35px]" disabled />
                    <!-- Warehouse -->
                    <BaseInput size="sm" v-model="formData.warehouseName" label="Warehouse"
                        placeholder="Warehouse" height="h-[35px]" disabled />
                    <!-- Expired date input -->
                    <BaseInput size="sm" v-model="formData.returnDate" label="Expired Date"
                        height="h-[35px]" type="datetime-local"
                    />
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
                    <BaseButton label="Update" :isLoading="usePurchaseReturn.loading"
                        :icon="usePurchaseReturn.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary"
                        @click="formSubmit" :disabled="usePurchaseReturn.loading" />
                </div>
            </template>
        </BaseCard>
        <div class="mt-3 max-h-[300px] overflow-y-auto">
            <table class="text-black w-full border-collapse border border-gray-200">
                <thead class="sticky top-0">
                    <tr class="bg-gray-100 text-right">
                        <th class="px-2 py-2 text-center">Product Name</th>
                        <th class="px-2 py-2">Purchase Price</th>
                        <th class="px-2 py-2">Purchase Qty</th>
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
                        <td class="border-b border-gray-200 px-2 py-2">{{ product.purchases_detail.quantity }}</td>
                        <td class="border-b border-gray-200 px-2 py-2 text-right">
                            <input type="number" min="0" :max="product.quantity" class="w-20 text-right px-1 py-1 border rounded" v-model.number="product.quantity" @input="onReturnQtyChange(product)" />
                        </td>
                        <td class="border-b border-gray-200 px-2 py-2">{{ (product.quantity * Number(product.price)).toLocaleString('en-us') }}</td>
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
                                {{ selectedProducts.reduce((sum, product) => sum + (Number(product.purchases_detail.quantity)), 0).toLocaleString('en-us') }}
                            </strong>
                        </td>
                        <td class="border-b border-gray-200 px-2 py-2">
                            <strong>
                                {{ selectedProducts.reduce((sum, product) => sum + (Number(product.quantity)), 0).toLocaleString('en-us') }}
                            </strong>
                        </td>
                        <td class="border-b border-gray-200 px-2 py-2">
                            <strong>
                                {{ selectedProducts.reduce((sum, product) => sum + (Number(product.quantity) * product.price), 0).toLocaleString('en-us') }}
                            </strong>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
