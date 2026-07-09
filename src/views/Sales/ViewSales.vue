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
    subTotalAmount: 0,
    totalAmount: 0,
    orderDiscountAmount: 0,
    salesDate: moment().format('YYYY-MM-DDTHH:mm'),
    products: [],
})

function salesDetailUnitName(detail = {}) {
  return detail.uom?.unit_name
    || detail.unit_name
    || detail.unit?.name
    || detail.product_unit?.unit_name
    || detail.product_unit?.unit_id?.name
    || detail.product?.unit_id?.name
    || '-';
}

function salesDetailQuantity(detail = {}) {
  return Number(detail.uom?.unit_quantity ?? detail.quantity ?? 0);
}

function salesDetailConversion(detail = {}) {
  return Number(detail.uom?.conversion_to_base ?? detail.conversion_to_base ?? detail.product_unit?.conversion_to_base ?? 1);
}

function salesDetailProductUnitId(detail = {}) {
  return detail.uom?.product_unit_id
    || detail.product_unit_id
    || detail.product_unit?.product_unit_id
    || detail.product_unit?.id
    || null;
}

function salesDetailUnitId(detail = {}) {
  return detail.uom?.unit_id
    || detail.unit_id
    || detail.unit?.id
    || detail.product_unit?.unit_id?.id
    || detail.product_unit?.unit_id
    || null;
}

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
        branchId: useSales.salesList.branch?.id,
        branchName: useSales.salesList.branch?.name,
        warehouseId: useSales.salesList.warehouse.id,
        warehouseName: useSales.salesList.warehouse.name,
        customerName: useSales.salesList.customer.name,
        customerId: useSales.salesList.customer.id,
        paymentId: useSales.salesList.payment_method.id,
        paymentMethodName: useSales.salesList.payment_method.name,
        subTotalAmount: Number(useSales.salesList.total_amount) + Number(useSales.salesList.order_discount_amount),
        totalAmount: useSales.salesList.total_amount,
        paidAmount: useSales.salesList.paid_amount,
        changeAmount: useSales.salesList.due_amount,
        orderDiscountAmount: useSales.salesList.order_discount_amount,
        statusId: useSales.salesList.status.id,
        remark: useSales.salesList.remark,
        salesDate: moment(useSales.salesList.sale_date).format('YYYY-MM-DDTHH:mm'),
    };
    selectedProducts.value = mergeSelectedProducts(useSales.salesList.details || []);
});

function mergeSelectedProducts(details = []) {
  const mergedProducts = new Map();

  details.forEach((item, index) => {
    const product = item.product || {};
    const productId = item.product_id ?? product.id;
    if (!productId) return;

    const quantity = Number(item.quantity || 0);
    if (quantity <= 0) return;

    const promotionId = item.promotion?.id ?? item.promotion_id ?? null;
    const discountType = item.promotion?.discount_type ?? item.discount_type ?? null;
    const discountValue = Number(item.promotion?.discount_value ?? item.discount_value ?? 0);
    const productUnitId = salesDetailProductUnitId(item);
    const unitId = salesDetailUnitId(item);
    const unitName = salesDetailUnitName(item);
    const unitQuantity = salesDetailQuantity(item);
    const conversionToBase = salesDetailConversion(item);
    const unitPrice = Number(item.price ?? product.price ?? 0);
    const unitDiscountAmount = Number(item.discount_amount ?? 0);
    const unitDiscountPrice = Number(item.discount_price ?? (unitPrice - unitDiscountAmount));
    const totalPrice = unitDiscountPrice * quantity;
    const isFree = item.is_foc;

    const mergeKey = [
      productId,
      productUnitId ?? 'base-unit',
      unitId ?? 'no-unit',
      unitName,
      promotionId ?? 'no-promo',
      discountType ?? 'NO_DISCOUNT',
      discountValue,
      unitPrice,
      unitDiscountAmount,
      unitDiscountPrice,
      isFree ? 1 : 0,
    ].join('|');

    const existing = mergedProducts.get(mergeKey);
    if (existing) {
      existing.quantity += quantity;
      existing.uom.unit_quantity += unitQuantity;
      existing.uom.base_quantity += Number(item.uom?.base_quantity ?? item.base_quantity ?? (unitQuantity * conversionToBase));
      existing.total += totalPrice;
      return;
    }

    mergedProducts.set(mergeKey, {
      id: `merged-${productId}-${promotionId ?? 'none'}-${index}`,
      product: {
        ...product,
        id: productId,
        name: product.name || item.product_name || 'Unknown Product',
        price: unitPrice,
      },
      quantity,
      price: unitPrice,
      uom: {
        product_unit_id: productUnitId,
        unit_id: unitId,
        unit_name: unitName,
        unit_quantity: unitQuantity,
        base_quantity: Number(item.uom?.base_quantity ?? item.base_quantity ?? (unitQuantity * conversionToBase)),
        conversion_to_base: conversionToBase,
        unit_barcode: item.uom?.unit_barcode || item.unit_barcode || item.product_unit?.barcode || null,
      },
      product_unit_id: productUnitId,
      unit_id: unitId,
      unit_name: unitName,
      conversion_to_base: conversionToBase,
      discount_amount: unitDiscountAmount,
      discount_price: unitDiscountPrice,
      total: totalPrice,
      promotion: {
        ...(item.promotion || {}),
        id: promotionId,
        discount_type: discountType,
        discount_value: discountValue,
      },
      is_foc: isFree,
    });
  });

  return Array.from(mergedProducts.values());
}

function buildSlipSalesData(sales = {}) {
  return {
    ...sales,
    details: mergeSelectedProducts(sales.details || []),
  };
}

function getAndroidPrintBridge() {
  if (typeof window === 'undefined') return null;

  const bridge = window.Android;
  return bridge && typeof bridge.print === 'function' ? bridge : null;
}

function buildAndroidPrintPayload(slip) {
  return {
    type: 'sales_receipt',
    printerLanguage: 'ESC_POS',
    receiptWidth: '80mm',
    source: 'ViewSales',
    printedAt: moment().format('YYYY-MM-DDTHH:mm:ss'),
    branch: {
      id: formData.value.branchId,
      name: formData.value.branchName,
      location: useSales.salesList.branch?.location || userData.value.branch?.location || '',
      phone: useSales.salesList.branch?.phone || userData.value.branch?.phone || '',
    },
    sale: {
      id: formData.value.salesId,
      counter: useSales.salesList.counter || '',
      cashier: useSales.salesList.created_by || '',
      customerName: formData.value.customerName || '',
      paymentMethodName: formData.value.paymentMethodName || '',
      saleDate: formData.value.salesDate,
      subTotalAmount: Number(formData.value.subTotalAmount || 0),
      orderDiscountAmount: Number(formData.value.orderDiscountAmount || 0),
      totalAmount: Number(formData.value.totalAmount || 0),
      paidAmount: Number(formData.value.paidAmount || 0),
      changeAmount: Number(formData.value.changeAmount || 0),
      items: selectedProducts.value.map((item) => ({
        productName: item.product?.name || '',
        unitName: salesDetailUnitName(item),
        quantity: salesDetailQuantity(item),
        unitPrice: Number(item.product?.price ?? item.price ?? 0),
        discountAmount: Number(item.discount_amount || 0),
        discountPrice: Number(item.discount_price || 0),
        totalAmount: Number(item.total || 0),
        promotion: item.promotion || null,
        isFree: Boolean(item.is_foc),
      })),
    },
    slipHtml: slip.innerHTML,
  };
}

function printWithAndroidBridge(slip) {
  const bridge = getAndroidPrintBridge();
  if (!bridge) return false;

  try {
    bridge.print(JSON.stringify(buildAndroidPrintPayload(slip)));
    return true;
  } catch (error) {
    console.error('Android print bridge failed', error);
    alert('Android printer error. Please check printer connection.');
    return true;
  }
}

// Print only the slip section between the markers
function printSlip() {
  const slip = document.getElementById('slip-section');
  if (!slip) {
    alert('Slip section not found');
    return;
  }

  if (printWithAndroidBridge(slip)) {
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
                        <DetailRow label="Branch:" :value="useSales.salesList.branch?.name" />
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
                        <th class="p-2 text-center">Unit</th>
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
                        <td class="border-b border-gray-200 p-2 text-center">
                          {{ product.product.name }}
                          <span v-if="product.is_foc" class="text-blue-500 bg-blue-100 font-bold px-2 py-1 rounded-md"> FREE GIFT </span>
                        </td>
                        <td class="border-b border-gray-200 p-2 text-center">{{ salesDetailUnitName(product) }}</td>
                        <td class="border-b border-gray-200 p-2">{{ Number(product.price).toLocaleString('en-us') }}</td>
                        <td class="border-b border-gray-200 p-2">{{ Number(product.discount_amount).toLocaleString('en-us') }}</td>
                        <td class="border-b border-gray-200 p-2">{{ Number(product.discount_price == 0? product.price : product.discount_price).toLocaleString('en-us') }}</td>
                        <td class="border-b border-gray-200 p-2">{{ salesDetailQuantity(product).toLocaleString('en-us') }}</td>
                        <td class="border-b border-gray-200 p-2">{{ Number(product.total).toLocaleString('en-us') }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <!-- Sub Total Amount -->
        <div class="mt-2 text-black font-semibold flex justify-end">
            <div class="grid grid-cols-[auto_0.5rem_minmax(140px,220px)] items-center gap-x-3" >
                <span class="whitespace-nowrap">Subtotal Amount</span>
                <span class="text-right">:</span>
                <span class="font-bold text-right">{{ Number(formData.subTotalAmount).toLocaleString('en-us') }}</span>
            </div>
        </div>
        <!-- Order Discount Amount -->
        <div class="mt-2 text-black font-semibold flex justify-end">
            <div class="grid grid-cols-[auto_0.5rem_minmax(140px,220px)] items-center gap-x-3" >
                <span class="whitespace-nowrap">Order Discount Amount</span>
                <span class="text-right">:</span>
                <span class="font-bold text-right">- {{ Number(formData.orderDiscountAmount).toLocaleString('en-us') }}</span>
            </div>
        </div>
        <!-- Total Amount -->
        <div class="mt-2 text-black font-semibold flex justify-end">
            <div class="grid grid-cols-[auto_0.5rem_minmax(140px,220px)] items-center gap-x-3" >
                <span class="whitespace-nowrap">Total Amount</span>
                <span class="text-right">:</span>
                <span class="font-bold text-right">{{ Number(formData.totalAmount).toLocaleString('en-us') }}</span>
            </div>
        </div>
        <!-- Paid Amount -->
        <div class="mt-2 text-black font-semibold flex justify-end">
            <div class="grid grid-cols-[auto_0.5rem_minmax(140px,220px)] items-center gap-x-3" >
                <span class="whitespace-nowrap">Paid Amount</span>
                <span class="text-right">:</span>
                <span class="font-bold text-right">{{ Number(formData.paidAmount).toLocaleString('en-us') }}</span>
            </div>
        </div>
        <!-- Change Amount -->
        <div class="mt-2 text-black font-semibold flex justify-end">
            <div class="grid grid-cols-[auto_0.5rem_minmax(140px,220px)] items-center gap-x-3" >
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
          <div>{{ useSales.salesList.branch?.location || userData.branch?.location }}</div>
          <div>{{ useSales.salesList.branch?.phone || userData.branch?.phone }}</div>
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
                    {{ `${item.product.name} (${salesDetailUnitName(item)})` }}
                  </span>
                  <span v-if="item.promotion.id && !item.is_foc" style="font-size: 12px;">
                    Dis[-{{ item.promotion.discount_type === 'AMOUNT' ? Number(item.promotion.discount_value).toLocaleString()+" Ks." : item.discount_value+'%' }}]
                  </span>
                  <span v-if="item.is_foc" style="font-weight: bold;"> [FREE GIFT] </span>
                </div>
              </td>
              <td style="padding: 2px 0; text-align: center;">{{ salesDetailQuantity(item) }}</td>
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
                  <span>{{ (salesDetailQuantity(item) * item.product.price).toLocaleString() }}</span>
                  <span v-if="item.promotion.id && !item.is_foc">- {{ (salesDetailQuantity(item) * item.discount_amount).toLocaleString() }}</span>
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
            <span>Ks. {{formData.subTotalAmount.toLocaleString() }}</span>
          </div>
          <div 
            v-if="formData.orderDiscountAmount > 0" style="
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
            "
          >
            <span>Order Discount</span>
            <span>-Ks. {{ Number(formData.orderDiscountAmount).toLocaleString('en-us') }}</span>
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
