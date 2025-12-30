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
import { useSaleStore } from '@/stores/useSalesStore';
import moment from 'moment';
import { usePaymentMethodStore } from '@/stores/usePaymentMethodStore';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const useSales = useSaleStore();
const usePaymentMethod = usePaymentMethodStore();

const userData = ref({});
const selectedProducts = ref([]);
const formData = ref({
    salesId: '',
    warehouseId: '',
    customerId: '',
    paymentId: '1',
    remark: '',
    salesDate: moment().format('YYYY-MM-DDTHH:mm'),
    products: [],
})

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
    selectedProducts.value = useSales.salesList.details;
    await usePaymentMethod.fetchAllPaymentMethod();
});

// Form Submit function
async function formSubmit(isPrint = false) {
    let payload = {
        remark: formData.value.remark,
        sale_date: formData.value.salesDate,
        updated_by: userData.value.id,
        payment_id: formData.value.paymentId,
        status_id: formData.value.statusId,
        paid_amount: formData.value.paidAmount,
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
        <div class="mt-3 max-h-[250px] overflow-y-auto">
            <table class="text-black w-full border-collapse border border-gray-200">
                <thead class="sticky top-0">
                    <tr class="bg-gray-100 text-right">
                        <th class="px-2 py-2 text-center">Product Name</th>
                        <th class="px-2 py-2">Unit Price</th>
                        <th class="px-2 py-2">Discount Amt</th>
                        <th class="px-2 py-2">Sales Price</th>
                        <th class="px-2 py-2">Sales Qty</th>
                        <th class="px-2 py-2">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    <tr 
                        class="hover:bg-blue-50 text-right" v-for="(product, index) in selectedProducts" :key="product.id"
                    >
                        <td class="border-b border-gray-200 px-2 py-2 text-center">{{ product.product.name }}</td>
                        <td class="border-b border-gray-200 px-2 py-2">{{ Number(product.price).toLocaleString('en-us') }}</td>
                        <td class="border-b border-gray-200 px-2 py-2">{{ Number(product.discount_amount).toLocaleString('en-us') }}</td>
                        <td class="border-b border-gray-200 px-2 py-2">{{ Number(product.discount_price).toLocaleString('en-us') }}</td>
                        <td class="border-b border-gray-200 px-2 py-2">{{ product.quantity }}</td>
                        <td class="border-b border-gray-200 px-2 py-2">{{ Number(product.total).toLocaleString('en-us') }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <!-- Total Amounts -->
        <div class="mt-3 text-black font-semibold flex justify-end">
            <div class="grid items-center gap-x-3" style="grid-template-columns: auto 0.5rem minmax(140px,220px);">
                <span class="whitespace-nowrap">Total Amount</span>
                <span class="text-right">:</span>
                <span class="font-bold text-right">{{ Number(formData.totalAmount).toLocaleString('en-us') }}</span>
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
                <span class="font-bold text-right">{{ Number(formData.changeAmount).toLocaleString('en-us') }}</span>
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
            <div><span style="font-weight: bold;">Counter:</span> {{ userData.counter?.name }}</div>
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
                    {{ item.product.name }}
                  </span>
                  <span v-if="item.promotion.id" style="font-size: 12px;">
                    Dis[-{{ item.promotion.discount_type === 'AMOUNT' ? Number(item.promotion.discount_value).toLocaleString()+" Ks." : item.discount_value+'%' }}]
                  </span>
                </div>
              </td>
              <td style="padding: 2px 0; text-align: center;">{{ item.quantity }}</td>
              <td style="padding: 2px 0; text-align: right;">
                <div class="flex flex-col">
                  <span>{{ Number(item.product.price).toLocaleString() }}</span>
                </div>
              </td>
              <td style="padding: 2px 0; text-align: right;">
                <div style="
                  display: flex;
                  flex-direction: column;
                ">
                  <span>{{ (item.quantity * item.product.price).toLocaleString() }}</span>
                  <span v-if="item.promotion.id">- {{ (item.quantity * item.discount_amount).toLocaleString() }}</span>
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
            <span>$ {{Number(formData.totalAmount).toLocaleString() }}</span>
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
            <span>$ {{Number(formData.totalAmount).toLocaleString() }}</span>
            <!-- <span>{{ data.currency + (subtotal + tax).toLocaleString() }}</span> -->
          </div>
          <!-- Pay Amount -->
          <div style="
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
            ">
            <span>Pay Amt ({{ formData.paymentMethodName }})</span>
            <span>$ {{ Number(formData.paidAmount).toLocaleString() }}</span>
          </div>
          <!-- Change Amount -->
          <div style="
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
            ">
            <span>Change Amt</span>
            <span>$ {{ + Number(formData.changeAmount).toLocaleString() }}</span>
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
