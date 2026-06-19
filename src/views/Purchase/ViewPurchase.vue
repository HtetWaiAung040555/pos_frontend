<script setup>

import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import DetailRow from '@/components/DetailRow.vue';
import { statusBadgeHtml } from '@/utils/const';
import { useRoute, useRouter } from 'vue-router';
import { onMounted, ref } from 'vue';
import { usePurchaseStore } from '@/stores/usePurchaseStore';
import moment from 'moment';
import { purchaseDetailQuantity, purchaseDetailUnitName } from '@/utils/purchaseUom';

const router = useRouter();
const route = useRoute();
const usePurchase = usePurchaseStore();

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
});

// Navigate back to previous route with fallback
function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/purchase');
  }
}

onMounted(async () => {
    userData.value = JSON.parse(localStorage.getItem('user'));
    await usePurchase.fetchPurchase(route.query.id);
    formData.value = {
        purchaseId: usePurchase.purchaseList.id,
        warehouseId: usePurchase.purchaseList.warehouse?.id,
        warehouseName: usePurchase.purchaseList.warehouse?.name,
        supplierName: usePurchase.purchaseList.supplier?.name,
        supplierId: usePurchase.purchaseList.supplier?.id,
        paymentId: usePurchase.purchaseList.payment?.id,
        paymentMethodName: usePurchase.purchaseList.payment?.name,
        totalAmount: usePurchase.purchaseList.total_amount,
        paidAmount: usePurchase.purchaseList.paid_amount,
        statusId: usePurchase.purchaseList.status?.id,
        remark: usePurchase.purchaseList.remark,
        purchaseDate: moment(usePurchase.purchaseList.purchase_date).format('YYYY-MM-DDTHH:mm'),
    };
    selectedProducts.value = usePurchase.purchaseList.details || [];
});

// Print only the slip section between the markers
function printSlip() {
  const slip = document.getElementById('slip-section');
  if (!slip) {
    alert('Slip section not found');
    return;
  }

  const printWindow = window.open('', '', 'width=400,height=600');
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
          <title>Purchase Invoice</title>
          <style>
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

  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Purchase Details">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton label="Print Slip" :isLoading="usePurchase.loading"
                        :icon="usePurchase.loading ? 'fa fa-spinner' : 'fa fa-print'" severity="primary"
                        @click="printSlip" :disabled="usePurchase.loading" />
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
                        <DetailRow label="Purchase ID:" :value="usePurchase.purchaseList.id" />
                        <DetailRow label="Supplier Name:" :value="usePurchase.purchaseList.supplier?.name" />
                        <DetailRow label="Warehouse:" :value="usePurchase.purchaseList.warehouse?.name" />
                        <DetailRow label="Purchase Date" :value="usePurchase.purchaseList.purchase_date"
                            :formatter="v => moment(v).format('DD-MM-YYYY hh:mm:ss A')" />
                        <DetailRow label="Payment Method" :value="usePurchase.purchaseList.payment?.name" />
                        <DetailRow label="Remark" :value="usePurchase.purchaseList.remark" />
                    </div>
                    <div class="grid grid-cols-1 gap-2 h-fit">
                        <DetailRow label="Status:">
                          <span v-html="statusBadgeHtml(usePurchase.purchaseList.status?.name)"></span>
                        </DetailRow>
                        <DetailRow label="Created By" :value="usePurchase.purchaseList.created_by" />
                        <DetailRow label="Created At" :value="usePurchase.purchaseList.created_at"
                            :formatter="v => moment(v).format('DD-MM-YYYY hh:mm:ss A')" />
                        <DetailRow label="Updated By" :value="usePurchase.purchaseList.updated_by" />
                        <DetailRow label="Updated At" :value="usePurchase.purchaseList.updated_at"
                            :formatter="v => moment(v).format('DD-MM-YYYY hh:mm:ss A')" />
                    </div>
                </div>
            </template>
        </BaseCard>
        <div class="mt-3 max-h-[250px] overflow-y-auto">
            <table class="text-black w-full border-collapse border border-gray-200">
                <thead class="sticky top-0">
                    <tr class="bg-gray-100 text-right">
                        <th class="p-2 w-[50px]"></th>
                        <th class="p-2 text-center">Product Name</th>
                        <th class="p-2 text-center">Unit</th>
                        <th class="p-2">Expired Date</th>
                        <th class="p-2">Purchase Price</th>
                        <th class="p-2">Unit Qty</th>
                        <th class="p-2">Conversion</th>
                        <th class="p-2">Base Qty</th>
                        <th class="p-2">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        class="hover:bg-blue-50 text-right" v-for="(product, index) in selectedProducts" :key="product.id"
                    >
                        <td class="border-b border-gray-200 p-2 text-center w-[50px]">{{ index + 1 }}.</td>
                        <td class="border-b border-gray-200 p-2 text-center">{{ product.product?.name }}</td>
                        <td class="border-b border-gray-200 p-2 text-center">{{ purchaseDetailUnitName(product) }}</td>
                        <td class="border-b border-gray-200 p-2">{{ product.inventory?.expired_date ? moment(product.inventory?.expired_date).format('DD-MM-YYYY') : '-' }}</td>
                        <td class="border-b border-gray-200 p-2">{{ Number(product.price || 0).toLocaleString('en-us') }}</td>
                        <td class="border-b border-gray-200 p-2">{{ purchaseDetailQuantity(product).toLocaleString('en-us') }}</td>
                        <td class="border-b border-gray-200 p-2">{{ Number(product.uom?.conversion_to_base || 1).toLocaleString('en-us') }}</td>
                        <td class="border-b border-gray-200 p-2">{{ Number(product.uom?.base_quantity ?? product.quantity ?? 0).toLocaleString('en-us') }}</td>
                        <td class="border-b border-gray-200 p-2">{{ Number(product.total || 0).toLocaleString('en-us') }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <!-- Total Amounts -->
        <div class="mt-3 text-black font-semibold flex justify-end">
            <div class="grid items-center gap-x-3" style="grid-template-columns: auto 0.5rem minmax(140px,220px);">
                <span class="whitespace-nowrap">Total Amount</span>
                <span class="text-right">:</span>
                <span class="font-bold text-right">{{ Number(formData.totalAmount || 0).toLocaleString('en-us') }}</span>
            </div>
        </div>
        <!-- Paid Amount -->
        <div class="mt-3 text-black font-semibold flex justify-end">
            <div class="grid items-center gap-x-3" style="grid-template-columns: auto 0.5rem minmax(140px,220px);">
                <span class="whitespace-nowrap">Paid Amount</span>
                <span class="text-right">:</span>
                <span class="font-bold text-right">{{ Number(formData.paidAmount || 0).toLocaleString('en-us') }}</span>
            </div>
        </div>
    </div>
    <!-- Slip Section -->
    <div
        class="mb-3 flex-[1.8] max-w-md w-full mx-auto p-6 bg-white shadow-lg border border-gray-300 rounded-sm text-sm font-mono text-black hidden"
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
              <span style="font-weight: bold;">Purchase:</span> {{ formData.purchaseId }}
            </div>
            <div><span style="font-weight: bold;">Supplier:</span> {{ formData.supplierName }}</div>
          </div>
          <div style="text-align: left;">
            <div><span style="font-weight: bold;">Date:</span> {{ moment(formData.purchaseDate).format('DD/MM/YY HH:mm:ss') }}</div>
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
            <tr v-if="usePurchase.loading">
              <td colspan="4" class="text-center">
                <i class="fa fa-spinner animate-spin"></i>
              </td>
            </tr>
            <tr v-for="item in selectedProducts" :key="item.id" style="border-top: 1px solid #dee2e6;">
              <td style="padding: 2px 0; width: 150px;">
                <span style="
                  overflow: hidden;
                  display: -webkit-box;
                  -webkit-box-orient: vertical;
                  -webkit-line-clamp: 2;
                ">
                  {{ item.product?.name }} ({{ purchaseDetailUnitName(item) }})
                </span>
              </td>
              <td style="padding: 2px 0; text-align: center;">{{ purchaseDetailQuantity(item) }}</td>
              <td style="padding: 2px 0; text-align: right;">
                <span>{{ Number(item.price || 0).toLocaleString() }}</span>
              </td>
              <td style="padding: 2px 0; text-align: right;">
                <span>{{ Number(item.total || 0).toLocaleString() }}</span>
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
            <span>Ks. {{ Number(formData.totalAmount || 0).toLocaleString() }}</span>
          </div>
          <div style="
              display: flex;
              justify-content: space-between;
              font-size: large;
              font-weight: bold;
              border-top: 1px solid black;
              padding-top: 4px;
            ">
            <span>TOTAL</span>
            <span>Ks. {{ Number(formData.totalAmount || 0).toLocaleString() }}</span>
          </div>
          <div style="
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
            ">
            <span>Pay Amt ({{ formData.paymentMethodName }})</span>
            <span>Ks. {{ Number(formData.paidAmount || 0).toLocaleString() }}</span>
          </div>
        </div>

        <!-- Footer -->
        <footer style="
            text-align: center;
            border-top: 1px dashed black;
            padding-top: 8px;
            font-size: 12px;
          ">
          <div>Thanks for your business!</div>
          <div>Keep this invoice for your records</div>
        </footer>
    </div>
</template>
