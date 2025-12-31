<script setup>

import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useRoute, useRouter } from 'vue-router';
import BaseInput from '@/components/BaseInput.vue';
import { computed, onMounted, ref, warn, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import BaseLabel from '@/components/BaseLabel.vue';
import moment from 'moment';
import { usePaymentMethodStore } from '@/stores/usePaymentMethodStore';
import { useWarehouseStore } from '@/stores/useWarehouseStore';
import BaseErrorLabel from '@/components/BaseErrorLabel.vue';
import { Select } from 'primevue';
import { useProductStore } from '@/stores/useProductStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useSaleStore } from '@/stores/useSalesStore';
import axios from 'axios';

const router = useRouter();
const toast = useToast();
const useSales = useSaleStore();
const usePaymentMethod = usePaymentMethodStore();
const useCustomer = useCustomerStore();
const useWarehouse = useWarehouseStore();
const useProduct = useProductStore();

const userData = ref({});
const customerSelect = ref(null)
const selectedProducts = ref([]);
const isProductDialogVisible = ref(false);
const productList = ref([]);
const searchTerm = ref('');
const selectionBuffer = ref([]);
const headerCheckboxRef = ref(null);
const isCheckingAll = ref(false);
const isSelectAllLoading = ref(false);
const selectedCustomer = ref([]);
const selectedWarehouse = ref([]);
const formData = ref({
    salesId: '',
    warehouseId: '',
    customerId: '',
    paymentId: '1',
    remark: '',
    salesDate: moment().format('YYYY-MM-DDTHH:mm'),
    statusId: 5, // default to 'Hold' status
    products: [],
})
const errorMsg = ref({
    customer: "",
    warehouse: "",
});

// Change route function
function changeRoute(pathname) {
    router.push(pathname);
}

onMounted(async () => {
    userData.value = JSON.parse(localStorage.getItem('user'));
    await useCustomer.fetchAllCustomer();
    await useWarehouse.fetchAllWarehouse();
    await usePaymentMethod.fetchAllPaymentMethod();
    await useProduct.fetchAllProduct();
    productList.value = useProduct.productList || [];
    selectedCustomer.value = useCustomer.customerList.filter(c => c.is_default)[0];
    selectedWarehouse.value = useWarehouse.warehouseList.filter(w => w.id === userData.value.branch.warehouse_id)[0];
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
    // create a shallow copy buffer to allow canceling
    selectionBuffer.value = selectedProducts.value.slice();
    searchTerm.value = '';
    isProductDialogVisible.value = true;
}

async function toggleProductInBuffer(event, product) {
    const idx = selectionBuffer.value.findIndex(p => p.id === product.id);
    // If already selected -> unselect immediately
    if (idx !== -1) {
        selectionBuffer.value.splice(idx, 1);
        return;
    }

    // Directly add product to buffer (no promotion checks needed for purchases)
    selectionBuffer.value.push(product);
}

function isBufferSelected(product) {
    return selectionBuffer.value.some(p => p.id === product.id);
}

async function selectAllInBuffer() {
    // Add all filtered products to buffer (no promotion checks for purchases)
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

// keep header checkbox indeterminate state in sync
watch([() => selectionBuffer.value, () => productList.value, () => searchTerm.value], () => {
    if (headerCheckboxRef.value) {
        headerCheckboxRef.value.indeterminate = someFilteredSelected.value;
    }
});

async function confirmProductSelection() {
    selectionBuffer.value.forEach(async (p) => {
        const checkPromo = await axios.get(`/promotions/checkprice/${p.id}`);
        if (checkPromo.data.promotion_id) {
            selectedProducts.value = [
                ...selectedProducts.value,
                {
                    id: p.id,
                    productName: p.name,
                    barcode: p.barcode,
                    quantity: 1,
                    image: p.image_url,
                    price: Number(p.price),
                    promotionId: checkPromo.data.promotion_id,
                    discountAmount: checkPromo.data.discount_amount,
                    discountPrice: p.price - checkPromo.data.discount_amount,
                    discountValue: checkPromo.data.discount_value,
                    discountType: checkPromo.data.discount_type,
                }
            ]
        } else {
            selectedProducts.value = [
                ...selectedProducts.value,
                {
                    id: p.id,
                    productName: p.name,
                    barcode: p.barcode,
                    quantity: 1,
                    image: p.image_url,
                    price: Number(p.price),
                    promotionId: null,
                    discountAmount: 0,
                    discountPrice: 0,
                    discountValue: 0,
                    discountType: '',
                }
            ]
        }
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
    product.price = Number(product.price) || 0;
    if (product.price < 0) product.price = 0;
}

// Form Submit function
async function formSubmit(isPrint = false) {
    let payload = {
        customer_id: selectedCustomer.value.id,
        payment_id: formData.value.paymentId,
        status_id: formData.value.statusId,
        remark: formData.value.remark,
        sale_date: formData.value.salesDate,
        warehouse_id: selectedWarehouse.value.id,
        created_by: userData.value.id,
        paid_amount: 0,
        products: selectedProducts.value.map(p => ({
            product_id: p.id,
            quantity: p.quantity,
            price: p.price,
            promotion_id: p.promotionId || null,
            discount_amount: p.discountAmount || 0,
            discount_price: p.discountPrice || 0,
        }))
    }
    await useSales.addSales(payload);
    if (useSales.error.length) {
        useSales.error.forEach((msg) => {
            toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
            });
        });
        return;
    }
    if (useSales.salesList) {
        let updatedSales = {
            payment_id: formData.value.paymentId,
            status_id: 7, // set to 'Completed' after creation
            paid_amount: useSales.salesList.total_amount,
            remark: formData.value.remark,
            sale_date: formData.value.salesDate,
            updated_by: userData.value.id,
        };
        await useSales.editSales(updatedSales, useSales.salesList.id);
        if (useSales.error.length) {
            useSales.error.forEach((msg) => {
                toast.add({
                    severity: 'error',
                    summary: 'Error Message',
                    detail: msg,
                    life: 3000
                });
            });
            return;
        }
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Sales create successfully.', life: 3000 });
        if (isPrint) printSlip();
        router.push('/sales');
    }
    
}

function onCustomerFilter(e) {
  const query = e.value?.trim()
  if (!query) return

  // Barcode scanners usually end with Enter → full ID present
  const matched = useCustomer.customerList.find(
    c => String(c.id) === query
  )

  if (matched) {
    selectedCustomer.value = matched

    // Clear filter input
    customerSelect.value?.resetFilter()

    // Return focus to barcode scanning (important for Android)
    nextTick(() => {
      document.activeElement?.blur()
    })
  }
}

// Print only the slip section between the markers
function printSlip() {
  const slip = document.getElementById('slip-section');
  if (!slip) {
    alert('Slip section not found');
    return;
  }

  // Build minimal printable document
  const printWindow = window.open('', '', 'width=400,height=600')
  if (!printWindow) {
    alert('Unable to open print window. Please allow popups.');
    return;
  }

  const doc = printWindow.document;
  const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Receipt</title>
          <style>
            /* ============ PRINT STYLES FOR 80MM THERMAL RECEIPT ============ */
            @page {
              size: 384px auto;
              margin: 5mm;
            }

            body {
              width: 384px;
              font-family: 'Courier New', monospace;
              font-size: 11px;
              color: #000;
              margin: 0 auto;
              padding: 0;
              line-height: 1.3;
            }

            

            /* Hide anything extra in print */
            @media print {
              body {
                width: 80mm;
              }
            }
          </style>
        </head>
        <body>
          ${slip.innerHTML}
        </body>
      </html>
    `;

  doc.open();
  doc.write(html);
  doc.close();

  // Wait a short time to ensure images/fonts load
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    // Optionally close window after printing
    // printWindow.close();
  }, 500);
}

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Create Sales">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary"
                        @click="changeRoute('/sales')" />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3 w-full">
            <template #cardElements>
                <!-- Form section subtitle -->
                <SubTitle label="Basic Info" />
                <div class="grid lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                    <!-- Customer -->
                    <div class="flex flex-col gap-y-1">
                        <BaseLabel label="Customer" :isRequire="true" />
                        <Select
                            ref="customerSelect"
                            v-model="selectedCustomer"
                            :options="useCustomer.customerList"
                            filter
                            showClear
                            optionLabel="id"
                            placeholder="Select a customer"
                            class="h-[35px] items-center"
                            @filter="onCustomerFilter"
                        >
                            <template #value="{ value }">
                                <div v-if="value" class="flex flex-col">
                                <span>{{ value.id }} | {{ value.name }}</span>
                                </div>
                            </template>

                            <template #option="{ option }">
                                <div class="flex flex-col">
                                <span>{{ option.id }} | {{ option.name }}</span>
                                </div>
                            </template>
                        </Select>
                        <BaseErrorLabel v-if="errorMsg.customer" :label="errorMsg.customer" />
                    </div>
                    <!-- Warehouse -->
                    <div class="flex flex-col gap-y-1">
                        <BaseLabel label="Warehouse" :isRequire="true" />
                        <Select v-model="selectedWarehouse" :options="useWarehouse.warehouseList" showClear filter
                            optionLabel="name" placeholder="Select a warehouse"
                            class="h-[35px] items-center" />
                        <BaseErrorLabel v-if="errorMsg.warehouse" :label="errorMsg.warehouse" />
                    </div>
                    <!-- Sales date input -->
                    <BaseInput size="sm" v-model="formData.salesDate" label="Sales Date" height="h-[35px]"
                        type="datetime-local" />
                    <div class="flex flex-col gap-1">
                        <BaseLabel label="Payment Method:" />
                        <select class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px]"
                            v-model="formData.paymentId">
                            <option v-for="payment in usePaymentMethod.paymentMethodList" :value="payment.id">{{
                                payment.name }}</option>
                        </select>
                    </div>
                    <!-- Remark input -->
                    <BaseInput class="col-span-2" size="sm" v-model="formData.remark" label="Remark"
                        placeholder="Reason for adjustment" height="h-[35px]" type="text" />
                </div>
                <!-- Selected Product Section -->
                <div class="flex flex-col">
                    <!-- Select Product Button -->
                    <BaseButton label="Select Products" class="w-fit mt-4 mb-4" @click="openProductDialog()" />
                    <!-- Selected Products Table (scrollable with fixed header) -->
                    <div class="mt-4">
                        <div class="max-h-[350px] overflow-y-auto rounded">
                            <table class="w-full text-sm border-collapse border border-gray-200">
                                <thead class="sticky top-0">
                                    <tr class="text-left text-black bg-gray-100">
                                        <th class="p-2">Image</th>
                                        <th class="p-2">Product Name</th>
                                        <th class="p-2">Barcode</th>
                                        <th class="p-2 text-right">Unit Price</th>
                                        <th class="p-2 text-right">Discount</th>
                                        <th class="p-2 text-right">Price</th>
                                        <th class="p-2 text-right">Qty</th>
                                        <th class="p-2 text-right">Total</th>
                                        <th class="p-2">&nbsp;</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="product in selectedProducts" :key="product.id"
                                        class="border-b border-gray-200 hover:bg-blue-50">
                                        <td class="p-2">
                                            <div class="w-12 h-12 overflow-hidden rounded">
                                                <img :src="product.image" alt="product"
                                                    class="w-full h-full object-cover" />
                                            </div>
                                        </td>
                                        <td class="p-2">{{ product.productName }}</td>
                                        <td class="p-2">{{ product.barcode }}</td>
                                        <td class="p-2 text-right">
                                            <input type="number" min="0" class="w-32 text-right px-1 py-1 border rounded" v-model.number="product.price" @input="onChangePrice(product)" />
                                            <!-- {{ Number(product.price).toLocaleString() }} -->
                                        </td>
                                        <td class="p-2 text-right">
                                            {{ product.promotionId ? product.discountValue + (product.discountType === 'percent' ? '%' : '') : 0 }}
                                        </td>
                                        <td class="p-2 text-right">
                                            {{ product.promotionId ? Number(product.discountPrice).toLocaleString() : Number(product.price).toLocaleString() }}
                                        </td>
                                        <td class="p-2 text-right">
                                            <input type="number" min="0" class="w-20 text-right px-1 py-1 border rounded" v-model.number="product.quantity" @input="onChangeQty(product)" />
                                        </td>
                                        <td class="p-2 text-right">{{ product.promotionId ? Number(product.discountPrice) * product.quantity : Number(product.price) * product.quantity }}</td>
                                        <td class="p-2 text-right">
                                            <button class="text-red-600 hover:text-red-800 px-2 py-1"
                                                @click="selectedProducts = selectedProducts.filter(p => p.id !== product.id)"><i
                                                    class="pi pi-trash"></i></button>
                                        </td>
                                    </tr>
                                    <tr v-if="selectedProducts.length === 0">
                                        <td colspan="5" class="py-4 text-center text-gray-500">No products selected</td>
                                    </tr>
                                    <tr class="border-b border-gray-200 font-bold bg-gray-100">
                                        <td colspan="6" class="p-2 text-right">Grand Total</td>
                                        <td class="p-2 text-right">
                                            {{
                                                selectedProducts.reduce((sum, p) => {
                                                    return sum + Number(p.quantity);
                                                }, 0).toLocaleString()
                                            }}
                                        </td>
                                        <td class="p-2 text-right">
                                            {{
                                                selectedProducts.reduce((sum, p) => {
                                                    const price = p.promotionId ? p.discountPrice : p.price;
                                                    return sum + (Number(price) * p.quantity);
                                                }, 0).toLocaleString()
                                            }}
                                        </td>
                                        <td>&nbsp;</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <!-- Product Selection Modal -->
                <div v-if="isProductDialogVisible" class="fixed inset-0 z-50 flex items-center justify-center">
                    <div class="absolute inset-0 bg-black opacity-50" @click="cancelProductSelection"></div>
                    <div class="bg-white rounded shadow-lg w-[90%] max-w-4xl max-h-[80vh] overflow-hidden z-10 p-4">
                        <div class="flex items-center justify-between py-4 border-b">
                            <SubTitle label="Select Products" />
                            <div class="text-sm text-black">{{ selectionBuffer.length }} selected</div>
                        </div>
                        <div class="py-4 flex gap-x-2 items-center">
                            <input v-model="searchTerm" placeholder="Search by name or barcode"
                                class="border p-2 rounded w-full" />
                        </div>
                        <div class="py-4 overflow-auto max-h-[50vh]">
                            <table class="w-full text-sm">
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
                                        <td class="py-2 text-end">{{ Number(product.price).toLocaleString() || 0 }}</td>
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
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton label="Save" :isLoading="useSales.loading"
                        :icon="useSales.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary"
                        @click="formSubmit" :disabled="useSales.loading" />
                </div>
            </template>
        </BaseCard>
    </div>
</template>
