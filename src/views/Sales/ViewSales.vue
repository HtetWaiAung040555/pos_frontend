<script setup>

import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import DetailRow from '@/components/DetailRow.vue';
import { statusBadgeHtml } from '@/utils/const';
import { useRoute, useRouter } from 'vue-router';
import { onMounted, ref } from 'vue';
import { useSaleStore } from '@/stores/useSalesStore';
import moment from 'moment';

const router = useRouter();
const route = useRoute();
const useSales = useSaleStore();

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

// Navigate back to previous route with fallback
function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/sales');
  }
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
});

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
        <PageTitle title="Sales Details">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton label="Print Slip" :isLoading="useSales.loading"
                        :icon="useSales.loading ? 'fa fa-spinner' : 'fa fa-print'" severity="primary"
                        @click="printSlip" :disabled="useSales.loading" 
                    />
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary"
                      @click="goBack" />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3 w-full">
            <template #cardElements>
                <!-- Form section subtitle -->
                <SubTitle label="Basic Info" />
                <div class="grid lg:grid-cols-3 gap-x-4 mt-6">
                    <div class="col-span-2 grid grid-cols-2 gap-2 h-fit">
                        <DetailRow label="Sales ID:" :value="useSales.salesList.id" />
                        <DetailRow label="Customer Name:" :value="useSales.salesList.customer?.name" />
                        <DetailRow label="Warehouse:" :value="useSales.salesList.warehouse?.name" />
                        <DetailRow label="Sales Date" :value="useSales.salesList.sale_date" :formatter="v => moment(v).format('DD-MM-YYYY hh:mm:ss A')" />
                        <DetailRow label="Payment Method" :value="useSales.salesList.payment_method?.name" />
                        <DetailRow label="Remark" :value="useSales.salesList.remark" />
                    </div>
                    <div class="grid grid-cols-1 gap-2 h-fit">
                        <DetailRow label="Status:">
                          <span v-html="statusBadgeHtml(useSales.salesList.status?.name)"></span>
                        </DetailRow>
                        <DetailRow label="Created By" :value="useSales.salesList.created_by" />
                        <DetailRow label="Created At" :value="useSales.salesList.created_at" :formatter="v => moment(v).format('DD-MM-YYYY hh:mm:ss A')" />
                        <DetailRow label="Updated By" :value="useSales.salesList.updated_by" />
                        <DetailRow label="Updated At" :value="useSales.salesList.updated_at" :formatter="v => moment(v).format('DD-MM-YYYY hh:mm:ss A')" />
                    </div>
                </div>
                <!-- <div class="flex justify-end mt-4 gap-x-2">
                    <BaseButton label="Save & Print" :isLoading="useSales.loading"
                        :icon="useSales.loading ? 'fa fa-spinner' : 'fa fa-print'" severity="primary"
                        @click="formSubmit(true)" :disabled="useSales.loading" />
                </div> -->
            </template>
        </BaseCard>
        <div class="mt-3 max-h-[250px] overflow-y-auto">
            <table class="text-black w-full border-collapse border border-gray-200">
                <thead class="sticky top-0">
                    <tr class="bg-gray-100 text-right">
                        <th class="p-2 w-[50px]"></th>
                        <th class="p-2 text-center">Product Name</th>
                        <th class="p-2">Unit Price</th>
                        <th class="p-2">Discount Amt</th>
                        <th class="p-2">Sales Price</th>
                        <th class="p-2">Sales Qty</th>
                        <th class="p-2">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    <tr 
                        class="hover:bg-blue-50 text-right" v-for="(product, index) in selectedProducts" :key="product.id"
                    >
                        <td class="border-b border-gray-200 p-2 text-center w-[50px]">{{ index + 1 }}.</td>
                        <td class="border-b border-gray-200 p-2 text-center">{{ product.product.name }}</td>
                        <td class="border-b border-gray-200 p-2">{{ Number(product.price).toLocaleString('en-us') }}</td>
                        <td class="border-b border-gray-200 p-2">{{ Number(product.discount_amount).toLocaleString('en-us') }}</td>
                        <td class="border-b border-gray-200 p-2">{{ Number(product.discount_price == 0? product.price : product.discount_price).toLocaleString('en-us') }}</td>
                        <td class="border-b border-gray-200 p-2">{{ product.quantity }}</td>
                        <td class="border-b border-gray-200 p-2">{{ Number(product.total).toLocaleString('en-us') }}</td>
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
            <span>Ks. {{Number(formData.totalAmount).toLocaleString() }}</span>
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
            <span>Ks. {{Number(formData.totalAmount).toLocaleString() }}</span>
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
            <span>Ks. {{ + Number(formData.changeAmount).toLocaleString() }}</span>
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
