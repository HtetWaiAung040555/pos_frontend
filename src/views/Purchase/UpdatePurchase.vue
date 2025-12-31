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
import moment from 'moment';
import { usePaymentMethodStore } from '@/stores/usePaymentMethodStore';
import { usePurchaseStore } from '@/stores/usePurchaseStore';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const usePurchase = usePurchaseStore();
const usePaymentMethod = usePaymentMethodStore();

const userData = ref({});
const selectedProducts = ref([]);
const formData = ref({
    purchaseId: '',
    warehouseId: '',
    supplierId: '',
    paymentId: '1',
    remark: '',
    purchaseDate: moment().format('YYYY-MM-DDTHH:mm'),
    products: [],
})

// Change route function
function changeRoute(pathname) {
    router.push(pathname);
}

onMounted(async () => {
    userData.value = JSON.parse(localStorage.getItem('user'));
    await usePurchase.fetchPurchase(route.query.id);
    formData.value = {
        purchaseId: usePurchase.purchaseList.id,
        warehouseId: usePurchase.purchaseList.warehouse.id,
        warehouseName: usePurchase.purchaseList.warehouse.name,
        supplierName: usePurchase.purchaseList.supplier.name,
        supplierId: usePurchase.purchaseList.supplier.id,
        paymentId: usePurchase.purchaseList.payment.id,
        totalAmount: usePurchase.purchaseList.total_amount,
        paidAmount: usePurchase.purchaseList.paid_amount,
        statusId: usePurchase.purchaseList.status.id,
        remark: usePurchase.purchaseList.remark,
        purchaseDate: moment(usePurchase.purchaseList.purchase_date).format('YYYY-MM-DDTHH:mm')
    };
    selectedProducts.value = usePurchase.purchaseList.details.map(p => ({
        productId: p.product.id,
        productName: p.product.name,
        quantity: p.quantity,
        expiredDate: moment(p.inventory.expired_date).format('YYYY-MM-DD'),
        purchasePrice: p.price,
        total: p.total,
        inventoryId: p.inventory.id,
    }));
    await usePaymentMethod.fetchAllPaymentMethod();
});

function onChangeQty(product) {
    product.quantity = Number(product.quantity) || 0;
    if (product.quantity < 0) product.quantity = 0;
}

function onChangePrice(product) {
    product.purchasePrice = Number(product.purchasePrice) || 0;
    if (product.purchasePrice < 0) product.purchasePrice = 0;
}

function onChangeExpiredDate(product) {
    product.expiredDate = product.expiredDate;
}

// Form Submit function
async function formSubmit() {
    let payload = {
        payment_id: formData.value.paymentId,
        paid_amount: formData.value.paidAmount,
        remark: formData.value.remark,
        status_id: formData.value.statusId,
        purchase_date: formData.value.purchaseDate,
        updated_by: userData.value.id,
        products: selectedProducts.value.map(p => ({
            product_id: p.productId,
            quantity: p.quantity,
            expired_date: p.expiredDate,
            purchase_price: p.purchasePrice,
            inventory_id: p.inventoryId
        }))
    }
    await usePurchase.editPurchase(payload, route.query.id);
    if (usePurchase.error.length) {
        usePurchase.error.forEach((msg) => {
            toast.add({
              severity: 'error',
              summary: 'Error Message',
              detail: msg,
              life: 3000
            });
        });
        return;
    }
    toast.add({ severity: 'success', summary: 'Success Message', detail: 'Purchase update successfully.', life: 3000 });
    router.push('/purchase');
}

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Update Purchase">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary"
                        @click="changeRoute('/purchase')" />
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
                    <BaseInput size="sm" v-model="formData.purchaseId" label="Purchase ID"
                        placeholder="Purchase ID" height="h-[35px]" disabled />
                    <!-- Customer -->
                    <BaseInput size="sm" v-model="formData.supplierName" label="Supplier"
                        placeholder="Supplier" height="h-[35px]" disabled />
                    <!-- Warehouse -->
                    <BaseInput size="sm" v-model="formData.warehouseName" label="Warehouse"
                        placeholder="Warehouse" height="h-[35px]" disabled />
                    <!-- Expired date input -->
                    <BaseInput size="sm" v-model="formData.purchaseDate" label="Sales Date"
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
                    <!-- Update Button -->
                    <BaseButton label="Save" :isLoading="usePurchase.loading"
                        :icon="usePurchase.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary"
                        @click="formSubmit" :disabled="usePurchase.loading" />
                </div>
            </template>
        </BaseCard>
        <div class="mt-3 max-h-[250px] overflow-y-auto">
            <table class="text-black w-full border-collapse border border-gray-200">
                <thead class="sticky top-0">
                    <tr class="bg-gray-100 text-right">
                        <th class="px-2 py-2 text-center">Product Name</th>
                        <th class="px-2 py-2 text-center">Expired Date</th>
                        <th class="px-2 py-2">Purchase Price</th>
                        <th class="px-2 py-2">Purchase Qty</th>
                        <th class="px-2 py-2">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr 
                        class="hover:bg-blue-50 text-right" v-for="(product, index) in selectedProducts" :key="product.productId"
                    >
                        <td class="border-b border-gray-200 p-2 text-center">{{ product.productName }}</td>
                        <td class="border-b border-gray-200 p-2 text-center">
                            <input type="date" min="0" class="w-44 text-right px-1 -1 border rounded" v-model="product.expiredDate" @input="onChangeExpiredDate(product)" />
                        </td>
                        <td class="border-b border-gray-200 p-2">
                            <input type="number" min="0" class="w-32 text-right px-1 py-1 border rounded" v-model.number="product.purchasePrice" @input="onChangePrice(product)" />
                        </td>
                        <td class="border-b border-gray-200 p-2">
                            <input type="number" min="0" class="w-20 text-right px-1 py-1 border rounded" v-model.number="product.quantity" @input="onChangeQty(product)" />
                        </td>
                        <td class="border-b border-gray-200 p-2">{{ Number(Number(product.quantity) * Number(product.purchasePrice)).toLocaleString('en-us') }}</td>
                    </tr>
                    <tr 
                        class="text-right"
                    >
                        <td colspan="3" class="border-b border-gray-200 px-2 py-2">
                            <strong>Total:</strong>
                        </td>
                        <td class="border-b border-gray-200 px-2 py-2">
                            <strong>
                                {{ selectedProducts.reduce((sum, product) => sum + (Number(product.quantity)), 0).toLocaleString('en-us') }}
                            </strong>
                        </td>
                        <td class="border-b border-gray-200 px-2 py-2">
                            <strong>
                                {{ selectedProducts.reduce((sum, product) => sum + (Number(product.quantity) * Number(product.purchasePrice)), 0).toLocaleString('en-us') }}
                            </strong>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
