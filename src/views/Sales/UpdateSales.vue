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
import { useSaleStore } from '@/stores/useSalesStore';
import moment from 'moment';
import { usePaymentMethodStore } from '@/stores/usePaymentMethodStore';
import { useProductStore } from '@/stores/useProductStore';
import axios from 'axios';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const useSales = useSaleStore();
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
    salesId: '',
    warehouseId: '',
    customerId: '',
    paymentId: '1',
    remark: '',
    salesDate: moment().format('YYYY-MM-DDTHH:mm'),
    products: [],
})

  const filteredProducts = computed(() => {
    const q = (searchTerm.value || '').toString().trim().toLowerCase();
    if (!q) return productList.value || [];
    return (productList.value || []).filter(p => {
      const name = (p.name || '').toString().toLowerCase();
      const barcode = (p.barcode || '').toString().toLowerCase();
      return name.includes(q) || barcode.includes(q);
    });
  });

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

  const totalAmount = computed(() => {
    return selectedProducts.value.reduce((sum, p) => {
      const salePrice = p.promotion_id ? Number(p.discount_price) : Number(p.price);
      return sum + (salePrice * Number(p.quantity));
    }, 0);
  });

  const changeAmount = computed(() => Number(formData.value.paidAmount || 0) - Number(totalAmount.value || 0));

// Change route function
function changeRoute(pathname) {
    router.push(pathname);
}

onMounted(async () => {
    userData.value = JSON.parse(localStorage.getItem('user'));
    await useSales.fetchSales(route.query.id);
    formData.value = {
        salesId: useSales.salesList.id,
        warehouseId: useSales.salesList.warehouse.id,
        warehouseName: useSales.salesList.warehouse.name,
        customerName: useSales.salesList.customer.name,
        customerId: useSales.salesList.customer.id,
        paymentId: useSales.salesList.payment_method.id,
        paymentMethodName: useSales.salesList.payment_method.name,
        totalAmount: useSales.salesList.total_amount,
        paidAmount: useSales.salesList.paid_amount,
        changeAmount: useSales.salesList.due_amount,
        statusId: useSales.salesList.status.id,
        remark: useSales.salesList.remark,
        salesDate: moment(useSales.salesList.sale_date).format('YYYY-MM-DDTHH:mm'),
    };
      selectedProducts.value = (useSales.salesList.details || []).map(item => ({
        id: item.product?.id,
        name: item.product?.name,
        barcode: item.product?.barcode,
        image_url: item.product?.image_url,
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        promotion_id: item.promotion?.id || null,
        discount_amount: Number(item.discount_amount) || 0,
        discount_price: Number(item.discount_price) || 0,
        discount_value: Number(item.promotion?.discount_value) || 0,
        discount_type: item.promotion?.discount_type || '',
      }));
      oldSelectedProducts.value = JSON.parse(JSON.stringify(selectedProducts.value));
      await Promise.all([
        usePaymentMethod.fetchAllPaymentMethod(),
        useProduct.fetchAllProduct(),
      ]);
      productList.value = useProduct.productList || [];
});

    function openProductDialog() {
      const selectedIds = new Set(selectedProducts.value.map(p => p.id));
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

    async function confirmProductSelection() {
      const existingMap = new Map(selectedProducts.value.map(p => [p.id, p]));
      const selected = await Promise.all(selectionBuffer.value.map(async (p) => {
        const existing = existingMap.get(p.id);
        const basePrice = Number(existing?.price ?? p.price ?? 0);
        let promoData = {
          promotion_id: null,
          discount_amount: 0,
          discount_value: 0,
          discount_type: '',
        };

        try {
          const checkPromo = await axios.post('/promotions/checkprice', {
            product_id: p.id,
            sale_date: formData.value.salesDate,
          });
          promoData = {
            promotion_id: checkPromo.data?.promotion_id || null,
            discount_amount: Number(checkPromo.data?.discount_amount) || 0,
            discount_value: Number(checkPromo.data?.discount_value) || 0,
            discount_type: checkPromo.data?.discount_type || '',
          };
        } catch {
          promoData = {
            promotion_id: existing?.promotion_id || null,
            discount_amount: Number(existing?.discount_amount) || 0,
            discount_value: Number(existing?.discount_value) || 0,
            discount_type: existing?.discount_type || '',
          };
        }

        return {
          id: p.id,
          name: p.name,
          barcode: p.barcode,
          quantity: Number(existing?.quantity) || 1,
          image_url: p.image_url,
          price: basePrice,
          promotion_id: promoData.promotion_id,
          discount_amount: promoData.discount_amount,
          discount_price: basePrice - promoData.discount_amount,
          discount_value: promoData.discount_value,
          discount_type: promoData.discount_type,
        };
      }));

      selectedProducts.value = selected;
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
      product.discount_price = product.price - (Number(product.discount_amount) || 0);
    }

    function removeProduct(product) {
      selectedProducts.value = selectedProducts.value.filter(p => p.id !== product.id);
    }

    function areSelectedProdsEqual() {
      if (!Array.isArray(oldSelectedProducts.value)) return false;

      const oldMap = new Map();
      oldSelectedProducts.value.forEach((p) => {
        if (!p.id) return;
        oldMap.set(p.id, {
          quantity: Number(p.quantity) || 0,
          price: Number(p.price) || 0,
          promotion_id: p.promotion_id || null,
          discount_amount: Number(p.discount_amount) || 0,
          discount_price: Number(p.discount_price) || 0,
        });
      });

      if (oldMap.size !== selectedProducts.value.length) return false;

      for (const p of selectedProducts.value) {
        const old = oldMap.get(p.id);
        if (!old) return false;
        if ((Number(p.quantity) || 0) !== old.quantity) return false;
        if ((Number(p.price) || 0) !== old.price) return false;
        if ((p.promotion_id || null) !== old.promotion_id) return false;
        if ((Number(p.discount_amount) || 0) !== old.discount_amount) return false;
        if ((Number(p.discount_price) || 0) !== old.discount_price) return false;
      }

      return true;
    }

// Form Submit function
async function formSubmit(isPrint = false) {
      const isProdsEqual = areSelectedProdsEqual();
      const payload = {
        remark: formData.value.remark,
        sale_date: formData.value.salesDate,
        updated_by: userData.value.id,
        payment_id: formData.value.paymentId,
        status_id: formData.value.statusId,
        paid_amount: formData.value.paidAmount,
        total_amount: totalAmount.value,
    }
      if (!isProdsEqual) {
        payload.products = selectedProducts.value.map(p => ({
          product_id: p.id,
          quantity: p.quantity,
          price: p.price,
          promotion_id: p.promotion_id || null,
          discount_amount: p.discount_amount || 0,
          discount_price: p.discount_price || 0,
        }));
      }
    await useSales.editSales(payload, route.query.id);
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
    toast.add({ severity: 'success', summary: 'Success Message', detail: 'Sales update successfully.', life: 3000 });
    if (isPrint) printSlip();
    router.push('/sales');
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
        <PageTitle title="Update Sales">
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
                    <!-- Sales Id Select -->
                    <BaseInput size="sm" v-model="formData.salesId" label="Sales ID"
                        placeholder="Sales ID" height="h-[35px]" disabled />
                    <!-- Customer -->
                    <BaseInput size="sm" v-model="formData.customerName" label="Customer"
                        placeholder="Customer" height="h-[35px]" disabled />
                    <!-- Warehouse -->
                    <BaseInput size="sm" v-model="formData.warehouseName" label="Warehouse"
                        placeholder="Warehouse" height="h-[35px]" disabled />
                    <!-- Expired date input -->
                    <BaseInput size="sm" v-model="formData.salesDate" label="Sales Date"
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
                <div class="flex justify-end mt-4 gap-x-2">
                    <!-- Save Button -->
                    <BaseButton label="Save" :isLoading="useSales.loading"
                        :icon="useSales.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary"
                        @click="formSubmit" :disabled="useSales.loading" />
                    <BaseButton label="Save & Print" :isLoading="useSales.loading"
                        :icon="useSales.loading ? 'fa fa-spinner' : 'fa fa-print'" severity="primary"
                        @click="formSubmit(true)" :disabled="useSales.loading" />
                </div>
            </template>
        </BaseCard>
            <div class="flex flex-col">
              <BaseButton label="Select Products" class="w-fit mt-4 mb-4" @click="openProductDialog()" />
            </div>
        <div class="mt-3 max-h-[250px] overflow-y-auto">
            <table class="text-black w-full border-collapse border border-gray-200">
                <thead class="sticky top-0">
                  <tr class="text-left text-black bg-gray-100">
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
                    class="border-b border-gray-200 hover:bg-blue-50 text-right">
                    <!-- <td class="p-2 text-left">
                      <div class="w-10 h-10 overflow-hidden rounded">
                        <img :src="product.image_url" alt="product" class="w-full h-full object-cover" />
                      </div>
                    </td> -->
                    <td class="p-2 text-left">{{ product.name }}</td>
                    <td class="p-2 text-left">{{ product.barcode }}</td>
                    <td class="p-2 text-right">
                      <input type="number" min="0" class="w-32 text-right px-1 py-1 border rounded"
                        v-model.number="product.price" @input="onChangePrice(product)" />
                    </td>
                    <td class="p-2 text-right">
                      {{ product.promotion_id ? product.discount_value + (product.discount_type === 'percent' ? '%' : '') : 0 }}
                    </td>
                    <td class="p-2 text-right">
                      {{ product.promotion_id ? Number(product.discount_price).toLocaleString() : Number(product.price).toLocaleString() }}
                    </td>
                    <td class="p-2 text-right">
                      <input type="number" min="0" class="w-20 text-right px-1 py-1 border rounded"
                        v-model.number="product.quantity" @input="onChangeQty(product)" />
                    </td>
                    <td class="p-2 text-right">
                      {{ (product.promotion_id ? Number(product.discount_price) : Number(product.price)) * Number(product.quantity) }}
                    </td>
                    <td class="p-2 text-right">
                      <button class="text-red-600 hover:text-red-800 px-2 py-1" @click="removeProduct(product)">
                        <i class="pi pi-trash"></i>
                      </button>
                    </td>
                    </tr>
                  <tr v-if="selectedProducts.length === 0">
                    <td colspan="9" class="py-4 text-center text-gray-500">No products selected</td>
                  </tr>
                </tbody>
            </table>
        </div>
            <div v-if="isProductDialogVisible" class="fixed inset-0 z-50 flex items-center justify-center">
              <div class="absolute inset-0 bg-black opacity-50" @click="cancelProductSelection"></div>
              <div class="bg-white rounded shadow-lg w-[90%] max-w-4xl max-h-[80vh] overflow-hidden z-10 p-4">
                <div class="flex items-center justify-between mb-2 border-b">
                  <SubTitle label="Select Products" />
                  <div class="text-sm text-black">{{ selectionBuffer.length }} selected</div>
                </div>
                <div class="mb-2 flex gap-x-2 items-center">
                  <BaseInput v-model="searchTerm" placeholder="Search by name or barcode" />
                </div>
                <div class="mb-2 overflow-auto max-h-[50vh]">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="text-left text-black border-b">
                        <th class="py-2">
                          <div class="flex items-center gap-x-2">
                            <span v-if="isSelectAllLoading" class="text-sm text-black"><i class="fa fa-spinner fa-spin"></i></span>
                            <input v-else type="checkbox" :checked="allFilteredSelected" @change="toggleHeaderSelection"
                              ref="headerCheckboxRef" :disabled="isCheckingAll || isSelectAllLoading" />
                          </div>
                        </th>
                        <th>Image</th>
                        <th class="py-2">Name</th>
                        <th class="py-2">Barcode</th>
                        <th class="py-2 text-end">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="product in filteredProducts" :key="product.id" class="hover:bg-blue-50 text-black border-b">
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
                  <BaseButton label="Add Product" class="px-4 py-2 bg-blue-600 text-white rounded" @click="confirmProductSelection" />
                </div>
              </div>
            </div>
        <!-- Total Amounts -->
        <div class="mt-3 text-black font-semibold flex justify-end">
            <div class="grid items-center gap-x-3" style="grid-template-columns: auto 0.5rem minmax(140px,220px);">
                <span class="whitespace-nowrap">Total Amount</span>
                <span class="text-right">:</span>
                <span class="font-bold text-right">{{ Number(totalAmount).toLocaleString('en-us') }}</span>
            </div>
        </div>
        <!-- Paid Amount -->
        <div class="mt-3 text-black font-semibold flex justify-end">
            <div class="grid items-center gap-x-3" style="grid-template-columns: auto 0.5rem minmax(140px,220px);">
                <span class="whitespace-nowrap">Paid Amount</span>
                <span class="text-right">:</span>
                <span class="font-bold text-right">{{ Number(formData.paidAmount).toLocaleString('en-us') }}</span>
            </div>
        </div>
        <!-- Change Amount -->
        <div class="mt-3 text-black font-semibold flex justify-end">
            <div class="grid items-center gap-x-3" style="grid-template-columns: auto 0.5rem minmax(140px,220px);">
                <span class="whitespace-nowrap">Change Amount</span>
                <span class="text-right">:</span>
            <span class="font-bold text-right">{{ Number(changeAmount).toLocaleString('en-us') }}</span>
            </div>
        </div>
    </div>
    <!-- Slip Section -->
    <div
        class="mb-3 flex-[1.8] max-w-md w-full mx-auto p-6 bg-white shadow-lg border border-gray-300 rounded-sm text-sm font-mono text-black"
        id="slip-section">
        <!-- Header -->
        <header style="
            text-align: center;
            padding-bottom: 6px;
            margin-bottom: 6px;
            border-bottom: 1px solid black;
          ">
          <h1 class="text-lg font-bold">FUSION MART</h1>
          <div>{{ userData.branch?.location }}</div>
          <div>{{ userData.branch?.phone }}</div>
        </header>

        <!-- Receipt Info -->
        <div style="
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px dashed black;
          ">
          <div>
            <div>
              <span style="font-weight: bold;">Receipt:</span> {{ formData.salesId }}
            </div>
            <div><span style="font-weight: bold;">Counter:</span> {{ useSales.salesList.counter }}</div>
          </div>
          <div style="text-align: left;">
            <div><span style="font-weight: bold;">Cashier:</span> {{ useSales.salesList.created_by }}</div>
            <div><span style="font-weight: bold;">Date:</span> {{ moment(formData.salesDate).format('DD/MM/YY HH:mm:ss') }}</div>
          </div>
        </div>

        <!-- Items Table -->
        <table style="
            width: 100%;
            font-size: 12px;
            border-bottom: 1px solid #dee2e6;
            margin-bottom: 8px;
          ">
          <thead>
            <tr style="
                font-weight: bold;
                text-align: left;
              ">
              <th style="padding: 2px 0;">Description</th>
              <th style="padding: 2px 0; text-align: center;">Qty</th>
              <th style="padding: 2px 0; text-align: right;">Price</th>
              <th style="padding: 2px 0; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="useSales.loading">
              <td colspan="4" class="text-center">
                <i class="fa fa-spinner animate-spin"></i>
              </td>
            </tr>
            <tr v-for="item in selectedProducts" :key="item.id" style="border-top: 1px solid #dee2e6;">
              <td style="padding: 2px 0; width: 150px;">
                <div style="
                  display: flex;
                  flex-direction: column;
                ">
                  <span style="
                    overflow: hidden;
                    display: -webkit-box;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2;
                  ">
                    {{ item.name }}
                  </span>
                  <span v-if="item.promotion_id" style="font-size: 12px;">
                    Dis[-{{ item.discount_type === 'AMOUNT' ? Number(item.discount_value).toLocaleString()+" Ks." : item.discount_value+'%' }}]
                  </span>
                </div>
              </td>
              <td style="padding: 2px 0; text-align: center;">{{ item.quantity }}</td>
              <td style="padding: 2px 0; text-align: right;">
                <div class="flex flex-col">
                  <span>{{ Number(item.price).toLocaleString() }}</span>
                </div>
              </td>
              <td style="padding: 2px 0; text-align: right;">
                <div style="
                  display: flex;
                  flex-direction: column;
                ">
                  <span>{{ (item.quantity * item.price).toLocaleString() }}</span>
                  <span v-if="item.promotion_id">- {{ (item.quantity * item.discount_amount).toLocaleString() }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Totals -->
        <div style="text-align: right; margin-bottom: 16px;">
          <div style="
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
            ">
            <span>SUBTOTAL</span>
            <span>Ks. {{Number(totalAmount).toLocaleString() }}</span>
          </div>
          <!-- <div class="flex justify-between">
            <span>TAX ({{ data.taxRate }}%)</span>
            <span>{{ data.currency + tax.toLocaleString() }}</span>
          </div> -->
          <div style="
              display: flex;
              justify-content: space-between;
              font-size: large;
              font-weight: bold;
              border-top: 1px solid black;
              padding-top: 4px;
            ">
            <span>TOTAL</span>
            <span>Ks. {{Number(totalAmount).toLocaleString() }}</span>
            <!-- <span>{{ data.currency + (subtotal + tax).toLocaleString() }}</span> -->
          </div>
          <!-- Pay Amount -->
          <div style="
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
            ">
            <span>Pay Amt ({{ formData.paymentMethodName }})</span>
            <span>Ks. {{ Number(formData.paidAmount).toLocaleString() }}</span>
          </div>
          <!-- Change Amount -->
          <div style="
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
            ">
            <span>Change Amt</span>
            <span>Ks. {{ + Number(changeAmount).toLocaleString() }}</span>
          </div>
        </div>


        <!-- Footer -->
        <footer style="
            text-align: center;
            border-top: 1px dashed black;
            padding-top: 8px;
            font-size: 12px;
          ">
          <div>Thanks for shopping with us!</div>
          <div>Keep this receipt for your records</div>
        </footer>
      </div>
</template>
