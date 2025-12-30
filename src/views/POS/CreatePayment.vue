<script setup>
import { useRoute, useRouter } from 'vue-router';
import { ref, computed, onMounted } from 'vue';
import moment from 'moment';

import BaseInput from '@/components/BaseInput.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import BaseTextarea from '@/components/BaseTextarea.vue';
import BaseButton from '@/components/BaseButton.vue';
import { useSaleStore } from '@/stores/useSalesStore';
import { useStatusStore } from '@/stores/useStatusStore';
import { usePaymentMethodStore } from '@/stores/usePaymentMethodStore';
import { Dialog, useToast } from 'primevue';
import SubTitle from '@/components/SubTitle.vue';
import { useWalletStore } from '@/stores/useWalletStore';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const useSales = useSaleStore();
const useStatus = useStatusStore();
const usePaymentMethod = usePaymentMethodStore();
const useWallet = useWalletStore();

const salesData = ref({ customer: { id: '', balance: 0 }, details: [], total_amount: 0, payment_method: { id: 1, name: 'Cash' } });
const userData = ref({});
const data = ref({
  payAmount: 0,
  note: "",
  date: Date.now(),
  currency: 'Ks. ',
  taxRate: 3,
  statusId: '',
  walletAmt: 0,
  walletPaymentId: 1,
  walletRemark: '',
});
const openWalletModal = ref(false);
const errorMsg = ref({
  amount: "",
});

onMounted(async () => {
  await useSales.fetchSales(route.query.id);
  salesData.value = useSales.salesList || salesData.value;
  data.value.payAmount = salesData.value.total_amount || data.value.payAmount;
  await usePaymentMethod.fetchAllPaymentMethod();
  await useStatus.fetchAllStatus();
  userData.value = JSON.parse(localStorage.getItem('user'));
  data.value.statusId = useStatus.statusList.find(el => el.name === 'Complete').id;
});

const subtotal = computed(() => {
  return salesData.value.details?.reduce((sum, item) => sum + item.quantity * (item.promotion.id? item.discount_price : item.product.price), 0);
});

const tax = computed(() => {
  return (subtotal.value * data.value.taxRate) / 100;
});

const total = computed(() => {
  return
});


const changeReturn = computed(() => {
  const received = parseFloat(salesData.value.total_amount);
  const paying = parseFloat(data.value.payAmount);
  const change = paying - received;
  return change;
});

async function formSubmit() {
  const payload = {
    sale_date: moment(data.value.date).format("YYYY/MM/DD HH:mm:ss"),
    payment_id: salesData.value.payment_method.id,
    paid_amount: parseFloat(data.value.payAmount),
    due_amount: changeReturn.value,
    remark: data.value.note,
    status_id: data.value.statusId,
    updated_by: userData.value.id
  }
  await useSales.editSales(payload, salesData.value.id);
  if (useSales.error.length) {
    useSales.error.forEach((msg) => {
      toast.add({
        severity: 'error',
        summary: 'Error Message',
        detail: msg,
        life: 3000
      });
    });
    return
  }
  if (useSales.salesList) {
    toast.add({ severity: 'success', summary: 'Success Message', detail: 'Sales created successfully.', life: 3000 });
    router.push('/pos');
  }
}

async function formSubmitAndPrint() {
  // First submit the form (persist payment) then print slip
  try {
    await formSubmit();
  } catch (err) {
    console.error('Error submitting before print', err);
  }
  printSlip();
}

async function formCancel() {
  router.push('/pos');
}

function changePaymentMethod(e) {
  if (!e.target.value) return
  if (e.target.value === '2') {
    let statusData = useStatus.statusList.find(el => el.name === 'Unpaid');
    data.value.statusId = statusData.id;
    return
  } else {
    let statusData = useStatus.statusList.find(el => el.name === 'Complete');
    data.value.statusId = statusData.id;
    return
  }
}

async function addWallet() {
  if (data.value.walletAmt <= 0) {
    errorMsg.value = {
      amount: "Top-up amount must be greater than zero",
    };
    return
  }
  let payload = {
    customer_id: salesData.value.customer.id,
    amount: parseFloat(data.value.walletAmt),
    payment_id: data.value.walletPaymentId,
    remark: data.value.walletAmt,
    pay_date: moment(data.value.date).format("YYYY/MM/DD HH:mm:ss"),
    created_by: userData.value.id
  }
  await useWallet.addWallet(payload);
  if (useWallet.error) {
    Object.values(useWallet.error).forEach((err) => {
      err.forEach((msg) => {
        toast.add({ severity: 'error', summary: 'Error Message', detail: msg, life: 3000 });
      })
    })
    return
  }
  if (useWallet.walletList) {
    toast.add({ severity: 'success', summary: 'Success Message', detail: 'Wallet top-up successfully.', life: 3000 });
    openWalletModal.value = false;
    data.value.walletAmt = 0;
    await useSales.fetchSales(route.query.id);
    salesData.value = useSales.salesList || salesData.value;
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
    <h3 class="text-black text-xl font-bold border-b pb-2 mb-4">Make Payment</h3>

    <div class="flex gap-4 items-start">
      <!-- PAYMENT FORM -->
      <div class="flex-[1.2] grid grid-cols-2 gap-4 bg-white p-6 rounded-sm border border-gray-300 shadow-sm">
        <!-- Pay Amount Display -->
        <BaseInput size="sm" v-model="data.payAmount" type="number" label="Received Amount:" height="h-[35px]" />
        <!-- Total Amount Display -->
        <BaseInput size="sm" v-model="salesData.total_amount" label="Paying Amount:" height="h-[35px]" disabled />
        <!-- Change Amount -->
        <BaseInput size="sm" v-model="changeReturn" label="Change Return:" height="h-[35px]" disabled />
        <!-- Select Payment Method -->
        <div class="flex flex-col gap-1">
          <BaseLabel label="Payment Type:" />
          <select class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px]"
            v-model="salesData.payment_method.id" @change="changePaymentMethod">
            <option value="1" v-if="usePaymentMethod.loading">Loading. . .</option>
            <option v-for="pm in usePaymentMethod.paymentMethodList" :value="pm.id">
              {{ pm.name }}
            </option>
          </select>
        </div>
        <!-- Customer ID -->
        <BaseInput v-if="salesData.payment_method.id === 3" size="sm" v-model="salesData.customer.id" label="Customer ID:"
          height="h-[35px]" disabled />
        <!-- Customer Balance Display -->
        <div v-if="salesData.payment_method.id === 3" class="flex gap-x-1 items-end">
          <BaseInput size="sm" v-model="salesData.customer.balance" type="number" label="Customer Balance:"
            height="h-[35px]" disabled />
          <BaseButton icon="fa fa-plus" @click="openWalletModal = true" />
        </div>

        <!-- Remarks Input -->
        <div class="flex flex-col col-span-2">
          <BaseLabel label="Note:" />
          <BaseTextarea v-model="data.note" placeholder="Enter Note" autoResize class="w-full text-black" />
        </div>

        <!-- Status Input -->
        <div class="flex flex-col col-span-2">
          <BaseLabel label="Payment Status:" />
          <select class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px]"
            v-model="data.statusId">
            <option v-for="status in useStatus.statusList.filter(el => el.name === 'Complete' || el.name === 'Unpaid')"
              :value="status.id">
              {{ status.name === 'Complete' ? 'Paid' : status.name }}
            </option>
          </select>
        </div>

        <!-- Submit Button Group -->
        <div class="flex gap-3 mt-5">
          <BaseButton label="Submit" @click="formSubmit" />
          <BaseButton label="Submit & Print" @click="formSubmitAndPrint" />
          <BaseButton label="Cancel" severity="danger" @click="formCancel" />
        </div>

      </div>

      <!-- Start of Slip Section-->
      <div
        class="flex-[1.8] max-w-md w-full mx-auto p-6 bg-white shadow-lg border border-gray-300 rounded-sm text-sm font-mono text-black"
        id="slip-section">
        <!-- Header -->
        <header style="
            text-align: center;
            padding-bottom: 6px;
            margin-bottom: 6px;
            border-bottom: 1px solid black;
          ">
          <h1 class="text-lg font-bold">FUSION MART</h1>
          <div>53 Street, Between 36 & 37 ST (MA-68/2), Ye Mon Taung Quater, Mandalay</div>
          <div>Tel: +959740010055</div>
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
              <span style="font-weight: bold;">Receipt:</span> {{ salesData.id }}
            </div>
            <div><span style="font-weight: bold;">Counter:</span> {{ userData.counter?.name }}</div>
          </div>
          <div style="text-align: left;">
            <div><span style="font-weight: bold;">Cashier:</span> {{ userData.name }}</div>
            <div><span style="font-weight: bold;">Date:</span> {{ moment(data.date).format('DD/MM/YY HH:mm:ss') }}</div>
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
            <tr v-for="item in salesData.details" :key="item.id" style="border-top: 1px solid #dee2e6;">
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
            <span>{{ data.currency + Number(subtotal).toLocaleString() }}</span>
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
            <span>{{ data.currency + Number(subtotal).toLocaleString() }}</span>
            <!-- <span>{{ data.currency + (subtotal + tax).toLocaleString() }}</span> -->
          </div>
          <!-- Pay Amount -->
          <div v-if="salesData.payment_method.id === 1" style="
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
            ">
            <span>Pay Amt ({{ salesData.payment_method.name }})</span>
            <span>{{ data.currency + Number(data.payAmount).toLocaleString() }}</span>
          </div>
          <!-- Change Amount -->
          <div v-if="salesData.payment_method.id === 1" style="
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
            ">
            <span>Change Amt</span>
            <span>{{ data.currency + Number(changeReturn).toLocaleString() }}</span>
          </div>
          <!-- Customer current balance -->
          <div v-if="salesData.payment_method.id === 3" style="
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
            ">
            <span>Current Balance</span>
            <span>{{ data.currency + Number(salesData.customer.balance).toLocaleString() }}</span>
          </div>
          <!-- Customer buying amount -->
          <div v-if="salesData.payment_method.id === 3" style="
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
            ">
            <span>Pay Amount ({{ salesData.payment_method.name }})</span>
            <span>{{ data.currency + '-' + Number(subtotal).toLocaleString() }}</span>
          </div>
          <!-- Customer Remain Balance -->
          <div v-if="salesData.payment_method.id === 3" style="
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
            ">
            <span>Remaining Balance</span>
            <span>{{ data.currency + Number(salesData.customer.balance - subtotal).toLocaleString() }}</span>
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
      <!-- End of Slip Section -->

    </div>

    <!-- Wallet Top-up Modal -->
    <Dialog v-model:visible="openWalletModal" :modal="true" :draggable="true" :position="'center'">
      <template #container="{ closeCallback }">
        <div class="flex flex-col gap-y-4 p-4">
          <div class="flex justify-between items-center">
            <SubTitle label="Wallet Info" />
            <BaseButton severity="secondary" @click="openWalletModal = false" icon="fa fa-x" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <!-- Customer Id for Wallet -->
            <BaseInput size="sm" v-model="salesData.customer.id" label="Customer ID:" height="h-[35px]" disabled />
            <!-- Top-up date -->
            <BaseInput size="sm" :modelValue="moment(data.date).format('DD/MM/YY HH:mm:ss')" label="Datetime:"
              height="h-[35px]" disabled />
            <!-- Top-up Amount -->
            <BaseInput size="sm" type="number" v-model="data.walletAmt" label="Top-up Amount:" height="h-[35px]"
              :isRequire="true" :error="errorMsg.amount" />
            <!-- Select Payment Method for Wallet -->
            <div class="flex flex-col gap-1">
              <BaseLabel label="Payment Method:" />
              <select class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px]"
                v-model="data.walletPaymentId" @change="changePaymentMethod">
                <option value="1" v-if="usePaymentMethod.loading">Loading. . .</option>
                <option v-for="pm in usePaymentMethod.paymentMethodList" :value="pm.id">
                  {{ pm.name }}
                </option>
              </select>
            </div>
            <BaseTextarea class="col-span-2" v-model="data.walletRemark" label="Remark" autoResize />
            <div class="col-span-2 flex justify-end items-center">
              <BaseButton label="Add Wallet" @click="addWallet" />
            </div>
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>
