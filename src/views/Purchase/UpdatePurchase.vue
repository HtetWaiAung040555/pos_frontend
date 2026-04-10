<script setup>

import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useRoute, useRouter } from 'vue-router';
import BaseInput from '@/components/BaseInput.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import BaseLabel from '@/components/BaseLabel.vue';
import moment from 'moment';
import { usePaymentMethodStore } from '@/stores/usePaymentMethodStore';
import { usePurchaseStore } from '@/stores/usePurchaseStore';
import { useProductStore } from '@/stores/useProductStore';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const usePurchase = usePurchaseStore();
const usePaymentMethod = usePaymentMethodStore();
const useProduct = useProductStore();

const userData = ref({});
const selectedProducts = ref([]);
const oldSelectedProducts = ref([]);
const isProductDialogVisible = ref(false);
const productList = ref([]);
const searchTerm = ref('');
const selectionBuffer = ref([]);
const headerCheckboxRef = ref(null);
const isCheckingAll = ref(false);
const isSelectAllLoading = ref(false);
const formData = ref({
    purchaseId: '',
    warehouseId: '',
    supplierId: '',
    paymentId: '1',
    remark: '',
    purchaseDate: moment().format('YYYY-MM-DDTHH:mm'),
    products: [],
});


// Change route function
function changeRoute(pathname) {
    router.push(pathname);
}

function mergeSelectedProducts(details = []) {
    const mergedProducts = new Map();

    details.forEach((p) => {
        const productId = p.product.id;
        const expiredDate = p.inventory.expired_date === null ? '' : moment(p.inventory.expired_date).format('YYYY-MM-DD');
        const existing = mergedProducts.get(productId);

        if (existing) {
            existing.quantity += Number(p.quantity) || 0;
            if (!existing.expiredDate && expiredDate) {
                existing.expiredDate = expiredDate;
            }
            return;
        }

        mergedProducts.set(productId, {
            productId,
            productName: p.product.name,
            quantity: Number(p.quantity) || 0,
            expiredDate,
            purchasePrice: p.price,
            total: p.total,
        });
    });

    return Array.from(mergedProducts.values()).map((product) => ({
        ...product,
        total: Number(product.quantity) * Number(product.purchasePrice),
    }));
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
    selectedProducts.value = mergeSelectedProducts(usePurchase.purchaseList.details);
    oldSelectedProducts.value = JSON.parse(JSON.stringify(selectedProducts.value));
    await usePaymentMethod.fetchAllPaymentMethod();
    await useProduct.fetchAllProduct();
    productList.value = useProduct.productList || [];
});

const filteredProducts = computed(() => {
    const q = (searchTerm.value || '').toString().trim().toLowerCase();
    if (!q) return productList.value || [];
    return (productList.value || []).filter(p => {
        const name = (p.name || '').toString().toLowerCase();
        const barcode = (p.barcode || '').toString().toLowerCase();
        return name.includes(q) || barcode.includes(q);
    });
});

function openProductDialog() {
    const selectedIds = new Set(selectedProducts.value.map(p => p.productId));
    selectionBuffer.value = (productList.value || []).filter(p => selectedIds.has(p.id));
    searchTerm.value = '';
    isProductDialogVisible.value = true;
}

async function toggleProductInBuffer(event, product) {
    const idx = selectionBuffer.value.findIndex(p => p.id === product.id);
    if (idx !== -1) {
        selectionBuffer.value.splice(idx, 1);
        return;
    }
    selectionBuffer.value.push(product);
}

function isBufferSelected(product) {
    return selectionBuffer.value.some(p => p.id === product.id);
}

async function selectAllInBuffer() {
    if (isCheckingAll.value) return;
    isCheckingAll.value = true;
    try {
        const ids = new Set(selectionBuffer.value.map(p => p.id));
        const candidates = (filteredProducts.value || []).filter(p => !ids.has(p.id));
        if (candidates.length === 0) return;
        candidates.forEach(product => {
            if (!selectionBuffer.value.some(s => s.id === product.id)) selectionBuffer.value.push(product);
        });
    } finally {
        isCheckingAll.value = false;
    }
}

function removeFilteredFromBuffer() {
    const filteredIds = new Set((filteredProducts.value || []).map(p => p.id));
    selectionBuffer.value = selectionBuffer.value.filter(p => !filteredIds.has(p.id));
}

const allFilteredSelected = computed(() => {
    const list = filteredProducts.value || [];
    if (list.length === 0) return false;
    return list.every(p => selectionBuffer.value.some(s => s.id === p.id));
});

const someFilteredSelected = computed(() => {
    const list = filteredProducts.value || [];
    if (list.length === 0) return false;
    const some = list.some(p => selectionBuffer.value.some(s => s.id === p.id));
    return some && !allFilteredSelected.value;
});

async function toggleHeaderSelection(event) {
    const checked = event.target.checked;
    if (checked) await selectAllInBuffer();
    else removeFilteredFromBuffer();
}

watch([() => selectionBuffer.value, () => productList.value, () => searchTerm.value], () => {
    if (headerCheckboxRef.value) {
        headerCheckboxRef.value.indeterminate = someFilteredSelected.value;
    }
});

function confirmProductSelection() {
    const existingMap = new Map(selectedProducts.value.map(p => [p.productId, p]));
    selectedProducts.value = selectionBuffer.value.map(p => {
        const existing = existingMap.get(p.id);
        return {
            productId: p.id,
            productName: p.name,
            quantity: existing ? existing.quantity : 0,
            expiredDate: existing ? existing.expiredDate : '',
            purchasePrice: existing ? existing.purchasePrice : (Number(p.purchase_price) || 0),
            total: existing ? existing.total : 0,
        };
    });
    isProductDialogVisible.value = false;
}

function cancelProductSelection() {
    isProductDialogVisible.value = false;
}

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

function removeProduct(product) {
    selectedProducts.value = selectedProducts.value.filter(p => p.productId !== product.productId);
}

function areSelectedProdsChange() {
  if (!oldSelectedProducts.value || !Array.isArray(oldSelectedProducts.value)) return false;

  const prodMap = new Map();
  oldSelectedProducts.value.forEach((d) => {
    const id = d.productId;
    if (!id) return;
        prodMap.set(id, {
            quantity: Number(d.quantity),
            purchasePrice: Number(d.purchasePrice),
            expiredDate: (d.expiredDate || '').toString(),
        });
  });

  if (prodMap.size !== selectedProducts.value.length) return false;

  for (const p of selectedProducts.value) {
        const oldProd = prodMap.get(p.productId);
        if (oldProd === undefined) return false;

        const oldQty = Number(oldProd.quantity);
        const newQty = Number(p.quantity);
        if (oldQty !== newQty) return false;

        const oldPrice = Number(oldProd.purchasePrice);
        const newPrice = Number(p.purchasePrice);
        if (oldPrice !== newPrice) return false;

        const oldExpiredDate = (oldProd.expiredDate || '').toString();
        const newExpiredDate = (p.expiredDate || '').toString();
        if (oldExpiredDate !== newExpiredDate) return false;
  }

  return true;
}

// Form Submit function
async function formSubmit() {
    const isProdsChange = areSelectedProdsChange();
    const payload = {
        payment_id: formData.value.paymentId,
        paid_amount: formData.value.paidAmount,
        remark: formData.value.remark,
        status_id: formData.value.statusId,
        purchase_date: formData.value.purchaseDate,
        updated_by: userData.value.id,
    }
    if (!isProdsChange) {
        payload.products = selectedProducts.value.map(p => ({
            product_id: p.productId,
            quantity: p.quantity,
            purchase_price: p.purchasePrice,
            expired_date: p.expiredDate || null,
        }));
    }
    await usePurchase.editPurchase(payload, route.query.id);
    if (usePurchase.error.length) {
        usePurchase.error.forEach((msg) => {
            console.error(msg);
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
                    <BaseInput size="sm" v-model="formData.purchaseDate" label="Purchase Date"
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
        <!-- Selected Product Section -->
        <div class="flex flex-col">
            <!-- Select Product Button -->
            <BaseButton 
                label="Select Products" 
                class="w-fit mt-4 mb-4" 
                :icon="usePurchase.loading || usePaymentMethod.loading || useProduct.loading ? 'fa fa-spinner' : ''"
                :isLoading="usePurchase.loading || usePaymentMethod.loading || useProduct.loading"
                :disabled="usePurchase.loading || usePaymentMethod.loading || useProduct.loading"
                @click="openProductDialog()" 
            />
        </div>
        <div class="mt-3 max-h-[250px] overflow-y-auto">
            <table class="text-black w-full border-collapse border border-gray-200">
                <thead class="sticky top-0">
                    <tr class="bg-gray-100 text-right">
                        <th class="px-2 py-2 text-center">Product Name</th>
                        <th class="px-2 py-2 text-center">Expired Date</th>
                        <th class="px-2 py-2">Purchase Qty</th>
                        <th class="px-2 py-2">Purchase Price</th>
                        <th class="px-2 py-2">Total</th>
                        <th class="px-2 py-2">&nbsp;</th>
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
                            <input type="number" min="0" class="w-20 text-right px-1 py-1 border rounded" v-model.number="product.quantity" @input="onChangeQty(product)" />
                        </td>
                        <td class="border-b border-gray-200 p-2">
                            <input type="number" min="0" class="w-32 text-right px-1 py-1 border rounded" v-model.number="product.purchasePrice" @input="onChangePrice(product)" />
                        </td>
                        <td class="border-b border-gray-200 p-2">{{ Number(Number(product.quantity) * Number(product.purchasePrice)).toLocaleString('en-us') }}</td>
                        <td class="border-b border-gray-200 p-2 text-right">
                            <button class="text-red-600 hover:text-red-800 px-2 py-1" @click="removeProduct(product)">
                                <i class="pi pi-trash"></i>
                            </button>
                        </td>
                    </tr>
                    <tr 
                        class="text-right"
                    >
                        <td colspan="2" class="border-b border-gray-200 px-2 py-2">
                            <strong>Total:</strong>
                        </td>
                        <td class="border-b border-gray-200 px-2 py-2">
                            <strong>
                                {{ selectedProducts.reduce((sum, product) => sum + (Number(product.quantity)), 0).toLocaleString('en-us') }}
                            </strong>
                        </td>
                        <td>&nbsp;</td>
                        <td class="border-b border-gray-200 px-2 py-2">
                            <strong>
                                {{ selectedProducts.reduce((sum, product) => sum + (Number(product.quantity) * Number(product.purchasePrice)), 0).toLocaleString('en-us') }}
                            </strong>
                        </td>
                        <td>&nbsp;</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <!-- Product Selection Modal -->
        <div v-if="isProductDialogVisible" class="fixed inset-0 z-50 flex items-center justify-center">
            <div class="absolute inset-0 bg-black opacity-50" @click="cancelProductSelection"></div>
            <div class="bg-white rounded shadow-lg w-[90%] max-w-4xl max-h-[80vh] overflow-hidden z-10 p-4 gap-y-2 flex flex-col">
                <div class="flex items-center justify-between py-4 border-b">
                    <SubTitle label="Select Products" />
                    <div class="text-sm text-black">{{ selectionBuffer.length }} selected</div>
                </div>
                <div class="flex gap-x-2 items-center">
                    <BaseInput v-model="searchTerm" placeholder="Search by name or barcode" />
                </div>
                <div class="overflow-auto max-h-[50vh]">
                    <table class="w-full text-sm text-black border-collapse">
                        <thead>
                            <tr class="text-left text-black border-b">
                                <th class="py-2">
                                    <div class="flex items-center gap-x-2">
                                        <span v-if="isSelectAllLoading" class="text-sm text-black"><i
                                                class="fa fa-spinner fa-spin"></i></span>
                                        <input v-else type="checkbox" :checked="allFilteredSelected"
                                            @change="toggleHeaderSelection" ref="headerCheckboxRef"
                                            :disabled="isCheckingAll || isSelectAllLoading" />
                                    </div>
                                </th>
                                <th>Image</th>
                                <th class="py-2">Name</th>
                                <th class="py-2">Barcode</th>
                                <th class="py-2 text-end">Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="product in filteredProducts" :key="product.id" class="hover:bg-blue-50">
                                <td class="py-2">
                                    <input type="checkbox" :checked="isBufferSelected(product)"
                                        @change="toggleProductInBuffer($event, product)" />
                                </td>
                                <td class="py-2">
                                    <img class="object-cover w-10 h-10 rounded" :src="product.image_url" />
                                </td>
                                <td class="py-2">{{ product.name }}</td>
                                <td class="py-2">{{ product.barcode }}</td>
                                <td class="py-2 text-end">{{ Number(product.purchase_price).toLocaleString() || 0 }}</td>
                            </tr>
                            <tr v-if="(filteredProducts || []).length === 0">
                                <td colspan="4" class="py-4 text-center text-gray-500">No products found</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="flex justify-end gap-x-2 py-4 border-t">
                    <BaseButton severity="secondary" label="Cancel" @click="cancelProductSelection" />
                    <BaseButton label="Add Product" class="px-4 py-2 bg-blue-600 text-white rounded"
                        @click="confirmProductSelection" />
                </div>
            </div>
        </div>
    </div>
</template>
