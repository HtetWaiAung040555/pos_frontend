<script setup>
    import { watch, onMounted, ref, computed } from 'vue';
    import BaseButton from '@/components/BaseButton.vue';
    import { useRoute, useRouter } from 'vue-router';
    import BaseInput from '@/components/BaseInput.vue';
    import BaseTextarea from '@/components/BaseTextarea.vue';
    import BaseLabel from '@/components/BaseLabel.vue';
    import { KnobStyle, useToast } from 'primevue';
    import { Select } from 'primevue';
    import moment from 'moment';
    import { useWalletStore } from '@/stores/useWalletStore';
    import { useCustomerStore } from '@/stores/useCustomerStore';
    import { usePaymentMethodStore } from '@/stores/usePaymentMethodStore';

    const router = useRouter();
    const route = useRoute();
    const toast = useToast();

    const useWallet = useWalletStore();
    const useCustomer = useCustomerStore();
    const usePaymentMethod = usePaymentMethodStore();

    const data = ref({
      pay_date: '',
    });
    const userData = ref({});
    const selectedCustomer = ref('');
    const selectedPaymentMethod = ref('');
    const currency = "Ks. "

    // Change route function
    function changeRoute(pathname) {
        router.push(pathname);
    }

    onMounted(async () => {
        await useWallet.fetchWallet(route.query.id);
        await usePaymentMethod.fetchAllPaymentMethod();
        await useCustomer.fetchAllCustomer();
        
        data.value = useWallet.walletList;
        data.value.pay_date = moment(useWallet.walletList.pay_date).format('YYYY-MM-DD HH:mm:ss');
        userData.value = JSON.parse(localStorage.getItem('user'));
        selectedPaymentMethod.value = usePaymentMethod.paymentMethodList.filter(el => el.id === data.value.payment_method.id)[0];
        selectedCustomer.value = useCustomer.customerList.filter(el => el.id === data.value.customer.id)[0];
    });

    //WALLET BALANCE AMOUNT SLIP
    const beforeBalance= ref(0);
    watch(selectedCustomer, async (newCustomer) => {
        beforeBalance.value = 0;

        if (newCustomer?.id) {
            const customer = await useCustomer.fetchSingleCustomer(newCustomer.id);
            beforeBalance.value = Number(customer?.balance || 0);
        }
    });

    const topUpAmount = computed(() => Number(data.value.amount) || 0);

    const afterBalance = computed(() => {
        return (Number(beforeBalance.value) || 0) + (Number(topUpAmount.value) || 0);
    });


    // Update function
    async function formSubmit() {
        let updatedData = {
            customer_id: selectedCustomer.value.id,
            amount: Number(data.value.amount),
            remark: data.value.remark,
            pay_date: data.value.pay_date,
            payment_id: selectedPaymentMethod.value.id,
            updated_by: userData.value.id
        }

        await useWallet.editWallet(updatedData, route.query.id);

        if(useWallet.error) {
            Object.values(useWallet.error).forEach((err) => {
                err.forEach((msg) => {
                    toast.add({ severity: 'error', summary: 'Error Message', detail: msg, life: 3000 });
                })
            })
            return
        }
        if (useWallet.walletList) {
            toast.add({ severity: 'success', summary: 'Success Message', detail: 'Wallet top up updated successfully.', life: 3000 });
            router.push('/wallet');
        }
    }

    async function formSubmitAndPrint() {
      try {
        await formSubmit();
      } catch (err) {
        console.error('Error submitting before print', err);
      }
      printSlip();
    }


    function printSlip() {
        const slip = document.getElementById('slip-section');
        if (!slip) {
        alert('Slip section not found');
        return;
        }

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

        printWindow.focus();
        setTimeout(() => {
        printWindow.print();
        }, 500);
    }
</script>

<template>
  <div class="p-4">
    <div class="flex justify-between items-center pb-2 mb-4">
      <h3 class="text-black text-xl font-bold">Update Top Up Wallet</h3>
      <BaseButton 
        icon="fa fa-chevron-left" 
        label="Back" 
        severity="secondary" 
        @click="changeRoute('/wallet')"
      />
    </div>
    <div class="flex gap-4 items-start">
      <!-- FORM -->
      <div class="flex-[1.2] grid grid-cols-2 gap-4 bg-white p-6 rounded-sm border border-gray-300 shadow-sm">
        <!-- Customer -->
        <div class="flex flex-col">
          <BaseLabel label="Customer" :isRequire="true" />
          <Select 
            v-model="selectedCustomer" 
            :options="useCustomer.customerList" 
            showClear
            filter
            optionLabel="name"
            placeholder="Select a customer"
            class="w-[350px] h-[35px]" />
        </div>
        <!-- Pay date Input -->
        <BaseInput
            size="sm"
            v-model="data.pay_date"
            label="Pay Date"
            placeholder="Pay Date"
            width="300px"
            height="h-[35px]"
            type="datetime-local"
        />
        <!-- Amount -->
        <div class="flex flex-col">
          <BaseLabel label="Top Up Amount :" />
          <BaseInput
            size="sm"
            v-model="data.amount"
            type="number"
            width="350px"
            height="h-[35px]"
          />
        </div>
        <!-- Payment Method Select -->
        <div class="flex flex-col gap-y-1">
            <BaseLabel 
                label="Payment Method"
                :isRequire="true"
            />
            <Select 
                v-model="selectedPaymentMethod" 
                :options="usePaymentMethod.paymentMethodList" 
                showClear
                filter
                optionLabel="name"
                placeholder="Select a payment method"
                class="w-[300px] h-[35px] items-center" 
            />
        </div>

        <!-- Remark -->
        <div class="flex flex-col col-span-2">
          <BaseLabel label="Remark:" />
          <BaseTextarea
            v-model="data.remark"
            placeholder="Write Remark"
            autoResize
            class="w-full text-black"
          />
        </div>
        <div class="flex gap-3 mt-5 col-span-2">
          <BaseButton label="Submit" @click="formSubmit" />
          <BaseButton label="Submit & Print" @click="formSubmitAndPrint" />
        </div>
      </div>

      <!-- SLIP  -->
      <div 
        id="slip-section"
        class="flex-[1.8] max-w-md w-full mx-auto p-6 bg-white shadow-lg border border-gray-300 rounded-sm text-sm font-mono text-black">
        <!-- Header -->
        <header 
          style="
            text-align: center;
            padding-bottom: 6px;
            margin-bottom: 6px;
            border-bottom: 1px solid black;">
          <h1 class="text-lg font-bold">FUSION MART</h1>
          <div>53 Street, Between 36 & 37 ST (MA-68/2), Ye Mon Taung Quater, Mandalay</div>
          <div>Tel: +959740010055</div>
        </header>

        <!-- Info -->
        <div
          style="
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px dashed black;
          "
        >
          <div>
            <div><strong>Customer:</strong> {{ selectedCustomer?.name }}</div>
            <div><strong>Date:</strong> {{ moment(data.pay_date).format('DD/MM/YY HH:mm') }}</div>
          </div>
        </div>

        <!-- Amount Section -->
        <div style="text-align: right; margin-bottom: 16px;">
          <!-- before -->
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Before Balance :</span>
            <span style="font-weight: bold;">{{ currency + (beforeBalance ?? 0).toLocaleString() }}</span>
          </div>
          <!-- top up -->
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Top Up Amount {{ selectedPaymentMethod.name }} :</span>
            <span style="font-weight: bold;">{{ currency + Number(data.amount).toLocaleString() }}</span>
          </div>
          <!-- after -->
          <div
            style="
              display: flex;
              justify-content: space-between;
              font-size: large;
              border-top: 1px solid black;
              padding-top: 4px; ">
            <span>After Balance :</span>
            <span style="font-weight: bold;">{{ currency + (afterBalance ?? 0).toLocaleString() }}</span>
          </div>
        </div>

        <!-- Footer -->
        <footer
          style="
            text-align: center;
            border-top: 1px dashed black;
            padding-top: 8px;
            font-size: 12px;">
          <div>THANK YOU!</div>
        </footer>
      </div>
    </div>
  </div>
</template>