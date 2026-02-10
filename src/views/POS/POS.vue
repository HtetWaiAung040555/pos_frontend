<script setup>
import BaseButton from '@/components/BaseButton.vue';
import BaseInput from '@/components/BaseInput.vue';
import ProductCard from '@/components/ProductCard.vue';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { Dialog, Select, useToast } from 'primevue';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useStatusStore } from '@/stores/useStatusStore';
import { useSaleStore } from '@/stores/useSalesStore';
import { useRouter } from 'vue-router';
import moment from 'moment';
import axios from 'axios';
import { useProductStore } from '@/stores/useProductStore';
import { usePromotionStore } from '@/stores/usePromotionStore';
import BaseLabel from '@/components/BaseLabel.vue';
import BaseTextarea from '@/components/BaseTextarea.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useWalletStore } from '@/stores/useWalletStore';

const toast = useToast();
const router = useRouter();
const useCustomer = useCustomerStore();
const useStatus = useStatusStore();
const useSales = useSaleStore();
const useProduct = useProductStore();
const usePromo = usePromotionStore();
const useWallet = useWalletStore();

const productList = ref([]);
const userData = ref({});
const selectedProducts = ref([]);
const salesData = ref({
  paymentId: 1,
  paidAmount: 0,
});
const visible = ref(false);
const qty = ref("");
const qtyInputRef = ref(null);
const selectedPId = ref("");
const selectedCustomer = ref({});
const searchQuery = ref("");
const barcodeInput = ref(null); // Hidden barcode input reference
const pendingAddIds = ref(new Set());
// Hold sales UI
const visibleHoldList = ref(false);
const holdList = ref([]);
const loadingHolds = ref(false);
const selectedHold = ref('');
const openWalletModal = ref(false);
const walletData = ref({
  payDate: Date.now(),
  amount: 0,
  paymentId: 1,
  remark: '',
});
const errorMsg = ref({
  amount: "",
});
const savedSalesData = ref({});
const defaultCurrency = ref('Ks');
const oldCustomerBalance = ref(0);
const initialLoading = ref(false);

const sortedHoldList = computed(() => {
  return [...(holdList.value || [])].sort((a, b) => {
    const aDate = a?.sale_date;
    const bDate = b?.sale_date;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
});

onMounted(async () => {
  initialLoading.value = true;
  await Promise.all([
    useCustomer.fetchAllCustomer(),
    usePromo.fetchAllPromo(),
    useProduct.fetchSalesProduct({ warehouse_id: JSON.parse(localStorage.getItem('user')).branch.warehouse_id }),
    useStatus.fetchAllStatus(),
  ]);
  selectedCustomer.value = useCustomer.customerList.find(c => c.is_default);
  productList.value = useProduct.productList;
  userData.value = JSON.parse(localStorage.getItem('user'));
  initialLoading.value = false;
});

const filteredProducts = computed(() => {
  if (!searchQuery.value) return productList.value;
  const query = searchQuery.value.toLocaleLowerCase().trim();
  return productList.value.filter(item => {
    return (
      item.name.toLocaleLowerCase().includes(query) ||
      String(item.id).includes(query) ||
      item.barcode?.toLocaleLowerCase().includes(query)
    );
  })
});

// Computed totals for template alignment
const totalAmount = computed(() => {
  const amount = selectedProducts.value.reduce((sum, item) => {
    const price = item.promotion_id ? Number(item.discount_price || 0) : Number(item.price || 0);
    return sum + (Number(item.qty || 0) * price);
  }, 0);
  salesData.value.paidAmount = amount;
  return amount;
});

const remainingBalance = computed(() => {
  const balance = Number(selectedCustomer.value?.balance || 0);
  return balance - totalAmount.value;
});

watch(visible, (newVal) => {
  if (newVal) {
    nextTick(() => {
      qty.value = "";
      qtyInputRef.value?.focus();
    });
  }
});

async function addProduct(product) {
  const productId = product?.id;
  if (!productId) return;
  if (pendingAddIds.value.has(productId)) return;
  pendingAddIds.value.add(productId);

  let checkQty = product.qty <= 0;
  if (checkQty) {
    toast.add({
      severity: 'warn',
      summary: 'Stock Qty Warning',
      detail: "Insufficient quantity.",
      life: 3000
    });
  }
  try {
    let exist = selectedProducts.value.find(p => p.id === product.id);
    if (exist) {
      selectedPId.value = product.id;
      increaseQty(exist);
      //visible.value = true;
      return;
    }
    const checkPromo = await axios.post(`/promotions/checkprice`, { product_id: product.id });
    if (checkPromo.data.promotion_id) {
      selectedProducts.value = [
        ...selectedProducts.value,
        {
          ...product,
          qty: 1,
          promotion_id: checkPromo.data.promotion_id,
          discount_value: checkPromo.data.discount_value,
          discount_amount: checkPromo.data.discount_amount,
          discount_type: checkPromo.data.discount_type,
          discount_price: product.price - checkPromo.data.discount_amount
        }
      ];
      selectedPId.value = product.id;
    } else {
      selectedProducts.value = [
        ...selectedProducts.value,
        {
          ...product,
          qty: 1
        }
      ];
      selectedPId.value = product.id;
    }
  } finally {
    pendingAddIds.value.delete(productId);
  }
}

function openDialog(product) {
  let exist = selectedProducts.value.find(p => p.id === product.id);
  if (exist) {
    selectedPId.value = product.id;
    visible.value = true;
    return;
  }
  selectedProducts.value = [
    ...selectedProducts.value,
    {
      ...product,
      qty: 0
    }
  ];
  selectedPId.value = product.id;
}

// Add quantity to the selected product
function addQty() {
  if (!selectedProducts.value || !qty.value) return;

  const product = selectedProducts.value.find(
    (p) => p.id === selectedPId.value
  );

  if (product) {
    // If product already has qty, add new qty
    product.qty = Number(product.qty) + Number(qty.value);
  }

  visible.value = false;
}

// Increase quantity by 1
function increaseQty(product) {
  product.qty += 1;
  nextTick(() => barcodeInput.value?.focus());
}

// Decrease quantity by 1
function decreaseQty(product) {
  if (product.qty <= 1) {
    nextTick(() => barcodeInput.value?.focus());
    return
  } else {
    product.qty -= 1;
    nextTick(() => barcodeInput.value?.focus());
  }
}

// 🧾 Barcode Scan Handler
function handleBarcodeInput(e) {
  //If Enter key is pressed after typing the barcode 
  if (e.key === "Enter" && e.target.value.trim() !== "") {
    const query = e.target.value.toLowerCase().trim();
    // Try to find matching product by barcode or ID 
    const matchedProduct = productList.value.find(item => {
      return (item.barcode?.toLowerCase() === query);
    });
    if (matchedProduct) {
      // Auto add product to POS
      addProduct(matchedProduct);
      // Clear the search bar for next scan 
      e.target.value = "";
    } else {

    }
  }
}

// When Enter is pressed in the Select filter input, pick a matching customer
function onSelectEnter(e) {
  // Prefer the event target value, fall back to the active element value (works on mobile)
  const inputVal = (e.target?.value || (document.activeElement && (document.activeElement.value || '')) || '').toString().trim();
  if (!inputVal) return;

  const q = inputVal.toLowerCase();
  const found = useCustomer.customerList.find(c => {
    if (!c) return false;
    const idStr = String(c.id || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    return idStr === q || idStr.includes(q) || name.includes(q);
  });

  if (found) {
    selectedCustomer.value = found;
    try { e.target.blur(); } catch (err) { }
  }
}

// -------------------------
// Hold / Resume Sale logic
// -------------------------

async function holdSale() {
  if (!selectedProducts.value || selectedProducts.value.length === 0) return;

  await useCustomer.fetchCustomer(selectedCustomer.value.id);
  if (useCustomer.singleCustomer.balance < totalAmount.value && salesData.value.paymentId == 3) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: "Insufficient wallet balance.",
      life: 3000
    });
    selectedCustomer.value = useCustomer.singleCustomer;
    oldCustomerBalance.value = useCustomer.singleCustomer.balance || 0;
    salesData.value.paymentId = useCustomer.singleCustomer.is_default ? 1 : 3;
    return
  }

  // Build payload expected by backend. Assumptions noted below.
  const payload = {
    customer_id: selectedCustomer.value?.id ?? null,
    paid_amount: 0,
    warehouse_id: userData.value.branch.warehouse_id,
    products: selectedProducts.value.map(p => ({
      product_id: p.id,
      quantity: p.qty,
      price: p.price,
      discount_amount: Number(p.discount_amount) || 0,
      discount_price: p.discount_price || 0,
      promotion_id: p.promotion_id || null,
    })),
    payment_id: selectedCustomer.value?.is_default ? 1 : 3,
    sale_date: moment().format("YYYY/MM/DD HH:mm:ss"),
    status_id: useStatus.getStatusId('Hold'),
    created_by: userData.value.id,
  };
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
    nextTick(() => barcodeInput.value?.focus());
    return
  }
  if (useSales.salesList) {
    toast.add({ severity: 'success', summary: 'Success Message', detail: 'Sales hold successfully.', life: 3000 });
    selectedProducts.value = [];
    nextTick(() => barcodeInput.value?.focus());
  }
}

async function fetchHoldList() {
  loadingHolds.value = true;
  let status_id = useStatus.getStatusId('Hold');
  try {
    await useSales.fetchSalesByStatus(status_id);
    holdList.value = useSales.salesList;
  } catch (err) {
    console.error('Failed to fetch hold list', err);
    holdList.value = [];
  } finally {
    loadingHolds.value = false;
  }
}

async function openHoldDialog() {
  visibleHoldList.value = true;
  await fetchHoldList();
}

// Load hold into current cart for editing/resuming
async function editHold(hold) {
  try {
    // Map items into selectedProducts shape: { ...product, qty }

    selectedHold.value = hold;
    salesData.value.paymentId = hold.payment_method.id;
    salesData.value.paidAmount = hold.paid_amount || 0;

    if (Array.isArray(hold.details)) {
      selectedProducts.value = hold.details.map(i => {
        // If backend includes full product data
        if (i.product) {
          return {
            ...i.product,
            qty: i.quantity,
            price: i.price ?? i.product.price,
            promotion_id: i.promotion.id || null,
            discount_amount: i.discount_amount || 0,
            discount_type: i.promotion.discount_type,
            discount_value: i.promotion.discount_value,
            discount_price: i.discount_price
          }
        }
      });
    }

    // Set customer if included
    if (hold.customer) selectedCustomer.value = useCustomer.customerList.filter(el => el.id === hold.customer.id)[0];
    oldCustomerBalance.value = selectedCustomer.value?.balance || 0;

    // Close hold list dialog
    visibleHoldList.value = false;
  } catch (err) {
    console.error('Failed to fetch hold detail', err);
  }
}

function resetData() {
  selectedProducts.value = [];
  selectedHold.value = [];
}

// Compare current cart to the products stored on the selected hold
function areHoldProductsEqual() {
  if (!selectedHold.value || !Array.isArray(selectedHold.value.details)) return false;

  const holdMap = new Map();
  selectedHold.value.details.forEach((d) => {
    const id = d.product_id || d.product?.id;
    if (!id) return;
    holdMap.set(id, Number(d.quantity));
  });

  if (holdMap.size !== selectedProducts.value.length) return false;

  for (const p of selectedProducts.value) {
    const holdQty = holdMap.get(p.id);
    if (holdQty === undefined) return false;
    if (Number(holdQty) !== Number(p.qty)) return false;
  }

  return true;
}

async function deleteHold(hold) {
  if (!confirm('Delete this hold sale? This may be irreversible depending on backend settings.')) return;
  const payload = {
    void_by: JSON.parse(localStorage.getItem('user')).id
  }
  await useSales.deleteSales(payload, hold.id);
  if (useSales.error) {
    toast.add({ severity: 'error', summary: 'Error Message', detail: useSales.error, life: 3000 });
    return
  }
  if (useSales.data.status === 200) {
    toast.add({ severity: 'success', summary: 'Success Message', detail: 'Inventory deleted successfully.', life: 3000 });
    await useSales.fetchHoldList();
    dataList.value = useSales.customerList;
  }
}

async function updateProductQty(ProductId, qty) {
  const idx = productList.value.findIndex(p => p.id === ProductId);
  if (idx !== -1) {
    productList.value[idx].qty -= qty;
  }
}

async function onPayClick() {
  await useCustomer.fetchCustomer(selectedCustomer.value.id);
  if (useCustomer.singleCustomer.balance < totalAmount.value && salesData.value.paymentId == 3) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: "Insufficient wallet balance.",
      life: 3000
    });
    selectedCustomer.value = useCustomer.singleCustomer;
    oldCustomerBalance.value = useCustomer.singleCustomer.balance || 0;
    salesData.value.paymentId = useCustomer.singleCustomer.is_default ? 1 : 3;
    return
  }
  if (selectedHold.value) {
    const productsChanged = !areHoldProductsEqual();
    const payload = {
      paid_amount: salesData.value.paidAmount,
      total_amount: totalAmount.value,
      payment_id: salesData.value.paymentId,
      sale_date: moment().format("YYYY/MM/DD HH:mm:ss"),
      status_id: useStatus.getStatusId('Complete'),
      updated_by: userData.value.id,
    }

    if (productsChanged) {
      payload.products = selectedProducts.value.map(p => ({
        product_id: p.id,
        quantity: p.qty,
        price: p.price,
        discount_amount: Number(p.discount_amount) || 0,
        discount_price: p.discount_price || 0,
        promotion_id: p.promotion_id || null,
      }));
    }
    await useSales.editSales(payload, selectedHold.value.id);
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
      savedSalesData.value = useSales.salesList;

      if (useSales.salesList.customer) {
        useCustomer.updateCustomerBalance(
          useSales.salesList.customer.id,
          useSales.salesList.customer.balance
        );
      }

      await nextTick();

      setTimeout(() => {
        printSlip();
      }, 100);

      selectedProducts.value = [];
      selectedCustomer.value = useCustomer.customerList.find(c => c.is_default);
      salesData.value.paymentId = 1;
      salesData.value.paidAmount = 0;
      selectedHold.value = "";
      // router.push({ path: '/payment/create', query: { id: useSales.salesList.id } });
    }
  } else {
    const payload = {
      customer_id: selectedCustomer.value?.id ?? null,
      payment_id: salesData.value.paymentId,
      paid_amount: salesData.value.paidAmount,
      status_id: useStatus.getStatusId('Complete'),
      warehouse_id: userData.value.branch.warehouse_id,
      products: selectedProducts.value.map(p => ({
        product_id: p.id,
        quantity: p.qty,
        price: p.price,
        discount_amount: Number(p.discount_amount) || 0,
        discount_price: p.discount_price || 0,
        promotion_id: p.promotion_id || null,
      })),
      sale_date: moment().format("YYYY/MM/DD HH:mm:ss"),
      created_by: userData.value.id,
    };
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
      return
    }
    if (useSales.salesList) {
      toast.add({ severity: 'success', summary: 'Success Message', detail: 'Sales created successfully.', life: 3000 });
      savedSalesData.value = useSales.salesList;

      if (useSales.salesList.customer) {
        useCustomer.updateCustomerBalance(
          useSales.salesList.customer.id,
          useSales.salesList.customer.balance
        );
      }

      await Promise.all(
        selectedProducts.value.map(p => updateProductQty(p.id, p.qty)),
        selectedProducts.value.map(p => useProduct.updateProductStock(p.id, p.qty)),
      );

      await nextTick();

      setTimeout(() => {
        printSlip();
      }, 100);

      selectedProducts.value = [];
      selectedCustomer.value = useCustomer.customerList.find(c => c.is_default);
      salesData.value.paymentId = 1;
      salesData.value.paidAmount = 0;
    }
  }
}

async function onCustomerFilter(e) {
  const query = e.value?.trim()
  if (!query) return

  // Barcode scanners usually end with Enter → full ID present
  const matched = useCustomer.customerList.find(
    c => String(c.id) === query
  )

  if (matched) {
    selectedCustomer.value = matched;
    await useCustomer.fetchCustomer(matched.id);
    selectedCustomer.value = useCustomer.singleCustomer;
    oldCustomerBalance.value = useCustomer.singleCustomer.balance || 0;
    salesData.value.paymentId = useCustomer.singleCustomer.is_default ? 1 : 3;

    // Return focus to barcode scanning (important for Android)
    nextTick(() => {
      document.activeElement?.blur()
    })
  }
}

async function createWallet() {
  if (walletData.value.amount <= 0) {
    errorMsg.value = {
      amount: "Top-up amount must be greater than zero",
    };
    return
  }
  let payload = {
    customer_id: selectedCustomer.value.id,
    amount: parseFloat(walletData.value.amount),
    payment_id: walletData.value.paymentId,
    remark: walletData.value.remark,
    pay_date: moment(walletData.value.payDate).format("YYYY/MM/DD HH:mm:ss"),
    created_by: userData.value.id
  };
  await useWallet.addWallet(payload);
  if (useWallet.error.length) {
    useWallet.error.forEach((msg) => {
      toast.add({
        severity: 'error',
        summary: 'Error Message',
        detail: msg,
        life: 3000
      });
    });
    return
  }
  if (useWallet.walletList) {
    toast.add({ severity: 'success', summary: 'Success Message', detail: 'Wallet top-up successfully.', life: 3000 });

    printSlip(false);
    await useCustomer.fetchAllCustomer();
    selectedCustomer.value = useCustomer.customerList.find(c => c.id === selectedCustomer.value.id);
    oldCustomerBalance.value = selectedCustomer.value.balance || 0;
    openWalletModal.value = false;
    walletData.value.amount = 0;
  }
}

const changeAmount = computed(() => {
  const paid = Number(salesData.value.paidAmount || 0);
  const total = Number(totalAmount.value || 0);
  const diff = paid - total;
  return (diff >= 0 ? diff : 0).toLocaleString('en-us');
});

function changePaymentMethod() {
  if (salesData.value.paymentId != 3) {
    // Cash
    selectedCustomer.value = useCustomer.customerList.find(c => c.is_default);
  } else {
    // Wallet
    if (selectedCustomer.value.is_default) {
      selectedCustomer.value = {};
    }
  }
}

async function changeCustomer() {
  await useCustomer.fetchCustomer(selectedCustomer.value.id);
  selectedCustomer.value = useCustomer.singleCustomer;
  salesData.value.paymentId = useCustomer.singleCustomer.is_default ? 1 : 3;
  oldCustomerBalance.value = useCustomer.singleCustomer.balance ?? 0;
}

function clickCustomerSelect() {
  console.log('Customer select clicked');
}

// Print only the slip section between the markers
function printSlip(isSale = true) {
  const slip = document.getElementById(isSale ? 'sales-slip' : 'wallet-slip');
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
  <div class="flex flex-col h-[calc(100vh-64px)] bg-blue-100/30">
    <!-- Main POS content fills remaining height -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Left section (Products) -->
      <div class="flex flex-col w-2/3 px-4 py-3 overflow-hidden">
        <!-- Fixed Search Bar -->
        <div class="shrink-0 flex gap-x-2 justify-between items-center">
          <BaseInput v-model="searchQuery" height="h-[33px]" placeholder="Search products by name, id, or barcode..."
            width="350px" icon="pi pi-search" @keyup.escape="searchQuery = ' '" />
          <div class="flex gap-x-2">
            <BaseButton label="Holds" severity="info" icon="fa fa-folder-open" @click="openHoldDialog" />
            <BaseButton label="Top-up" severity="secondary" icon="fa fa-plus" @click="openWalletModal = true"
              :disabled="salesData.paymentId != 3" />
          </div>
        </div>

        <!-- Scrollable product grid -->
        <div class="flex-1 overflow-y-auto mt-4 pr-1">
          <div class="grid grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            <div v-if="initialLoading" v-for="n in 18" :key="n"
              class="w-full rounded-md p-4">
              <div class="flex animate-pulse space-x-4">
                <div class="flex-1 space-y-6 py-1">
                  <div class="h-2 rounded bg-gray-300"></div>
                  <div class="space-y-3">
                    <div class="h-2 rounded bg-gray-300"></div>
                    <div class="h-2 rounded bg-gray-300"></div>
                  </div>
                </div>
              </div>
            </div>
            <ProductCard v-else v-for="product in filteredProducts" :key="product.id" :name="product.name"
              :price="product.price" :imageUrl="product.image_url" :qty="product.qty" @click="addProduct(product)" />
          </div>
        </div>
      </div>

      <!-- Right section (Cart + Totals) -->
      <div class="flex flex-col w-1/3 bg-white text-black px-4 py-3 overflow-hidden">
        <!-- Top: Customer & Payment selection -->
        <div class="shrink-0 mb-1 flex gap-x-2 items-center">
          <div class="flex flex-col gap-y-1">
            <Select 
              ref="customerSelect" 
              v-model="selectedCustomer" 
              :options="useCustomer.customerList" 
              filter 
              :loading="useCustomer.loading"
              showClear
              optionLabel="id" placeholder="Select a customer" class="h-[35px] items-center"
              @change="changeCustomer"
              @filter="onCustomerFilter"
              @click="clickCustomerSelect"
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
          </div>
          <div class="flex flex-col gap-1 w-full">
            <select class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px]"
              v-model="salesData.paymentId" @change="changePaymentMethod">
              <option value="1">Cash</option>
              <option v-if="!selectedCustomer?.is_default" value="3">Wallet</option>
              <option value="4">Kpay</option>
            </select>
          </div>
        </div>

        <!-- Barcode Input -->
        <div class="shrink-0 mb-1 flex gap-x-2 items-center">
          <BaseInput id="barcodeInput" type="text" height="h-[33px]" width="100%"
            placeholder="Scan products by barcode..." @keyup="handleBarcodeInput" />
        </div>

        <!-- Scrollable Cart Table -->
        <div class="flex-1 overflow-y-auto">
          <table class="table-auto w-full border-collapse">
            <thead class="bg-gray-100 sticky top-0">
              <tr>
                <th class="border-b p-2 border-gray-200 text-[12px]">#</th>
                <th class="border-b p-2 border-gray-200">Product</th>
                <th class="border-b p-2 border-gray-200 text-end">Total</th>
                <th class="border-b p-2 border-gray-200"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in selectedProducts" :key="item.id">
                <td class="border-b p-2 border-gray-200 text-[12px]">{{ index + 1 }}.</td>
                <td class="border-b p-2 border-gray-200">
                  <div class="flex flex-col">
                    <span class="leading-tight line-clamp-1">{{ item.name }}</span>
                    <div class="text-[13px] flex items-center gap-x-2">
                      <i class="fa fa-circle-minus text-xl cursor-pointer text-gray-500" @click="decreaseQty(item)"></i>
                      <span class="font-semibold"> {{ item.qty }} </span>
                      <i class="fa fa-circle-plus text-xl cursor-pointer text-gray-500" @click="increaseQty(item)"></i>
                      <span> x </span>
                      <span class="font-semibold">{{ Number(item.price).toLocaleString() }}</span>
                    </div>
                    <div>
                      <span v-if="item.promotion_id" class="font-semibold">Discount: [ - {{ item.discount_type ===
                        'AMOUNT' ?
                        Number(item.discount_value).toLocaleString() + " Ks." : item.discount_value + '%' }} ]</span>
                    </div>
                  </div>
                </td>
                <td class="border-b p-2 border-gray-200 text-end font-semibold">
                  <div class="flex flex-col justify-between">
                    <span class="font-semibold">{{ (item.qty * item.price).toLocaleString('en-us') }}</span>
                    <span v-if="item.promotion_id" class="font-semibold">- {{ (item.qty *
                      item.discount_amount).toLocaleString('en-us') }}</span>
                  </div>
                </td>
                <td class="border-b p-2 border-gray-200">
                  <i class="fa fa-trash text-red-500 cursor-pointer"
                    @click="selectedProducts = selectedProducts.filter(p => p.id !== item.id)"></i>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Totals Summary -->
        <div class="mt-2 w-full">
          <div class="grid grid-cols-2 gap-y-1 text-sm items-center">
            <!-- Total -->
            <div class="text-right font-semibold">Total :</div>
            <div class="text-right font-semibold">
              {{ `${defaultCurrency} ${Number(totalAmount).toLocaleString('en-us')}` }}
            </div>
            <!-- Pay Amount -->
            <div class="text-right font-semibold" v-if="salesData.paymentId == 1">Pay Amount :</div>
            <div class="flex justify-end items-center font-semibold gap-x-1" v-if="salesData.paymentId == 1">
              {{ defaultCurrency }}
              <BaseInput size="sm" type="number" v-model="salesData.paidAmount" height="h-[30px]" width="100px" />
            </div>
            <!-- Change Amount -->
            <div class="text-right font-semibold" v-if="salesData.paymentId == 1">Change Amount :</div>
            <div class="text-right font-semibold" v-if="salesData.paymentId == 1">
              {{ `${defaultCurrency} ${Number(changeAmount).toLocaleString('en-us')}` }}
            </div>
            <!-- Customer Balance Info -->
            <div class="text-right font-semibold" v-if="!selectedCustomer?.is_default">Current Balance :</div>
            <div class="text-right font-semibold" v-if="!selectedCustomer?.is_default">
              {{ `${defaultCurrency} ${Number(oldCustomerBalance).toLocaleString('en-us')}` }}
            </div>
            <div class="text-right font-semibold" v-if="!selectedCustomer?.is_default">Remaining Balance :</div>
            <div class="text-right font-semibold" v-if="!selectedCustomer?.is_default">
              {{ `${defaultCurrency} ${Number(remainingBalance).toLocaleString('en-us')}` }}
            </div>
          </div>
        </div>

        <!-- Fixed bottom button group -->
        <div class="shrink-0 mt-4 flex justify-end gap-x-2 items-center">
          <BaseButton label="Reset" severity="danger" :icon="useSales.loading ? 'fa fa-spinner' : 'fa fa-rotate-left'"
            :disabled="selectedProducts.length === 0 || useSales.loading" @click="resetData" />
          <BaseButton label="Hold" severity="secondary" :icon="useSales.loading ? 'fa fa-spinner' : 'fa fa-hand'"
            :disabled="selectedProducts.length === 0 || selectedHold.length != 0 || useSales.loading || (Number(remainingBalance) < 0 && salesData.paymentId == 3)"
            @click="holdSale" />
          <BaseButton label="Pay" severity="primary" :icon="useSales.loading ? 'fa fa-spinner' : 'fa fa-credit-card'"
            :disabled="selectedProducts.length === 0 || useSales.loading || (Number(remainingBalance) < 0 && salesData.paymentId == 3)"
            @click="onPayClick" />
        </div>
      </div>
    </div>

    <!-- Quantity dialog -->
    <Dialog v-model:visible="visible" :style="{ width: '300px' }" :modal="true" :draggable="false" :position="'center'">
      <template #container="{ closeCallback }">
        <div class="flex flex-col justify-center items-center gap-y-4 py-4">
          <BaseInput v-model="qty" ref="qtyInputRef" height="h-[35px]" placeholder="Enter qty" width="250px"
            type="number" @keyup.enter="addQty" />
          <div class="flex justify-center gap-x-2">
            <BaseButton label="Cancel" severity="secondary" @click="visible = false" />
            <BaseButton label="Add" severity="primary" @click="addQty" />
          </div>
        </div>
      </template>
    </Dialog>

    <!-- Holds list dialog -->
    <Dialog v-model:visible="visibleHoldList" :style="{ width: '700px' }" :modal="true" :draggable="false"
      :position="'center'">
      <template #container="{ closeCallback }">
        <div class="p-4">
          <div class="flex justify-between items-center mb-3">
            <h3 class="text-lg font-semibold text-black">Hold Sales</h3>
            <div class="flex gap-x-2">
              <BaseButton severity="secondary" variant="outlined" @click="fetchHoldList" icon="pi pi-refresh" />
              <BaseButton severity="secondary" @click="visibleHoldList = false" icon="fa fa-x" />
            </div>
          </div>

          <div v-if="loadingHolds" class="w-full rounded-md p-4">
            <div class="flex animate-pulse space-x-4">
              <div class="flex-1 space-y-6 py-1">
                <div class="h-2 rounded bg-gray-300"></div>
                <div class="space-y-3">
                  <div class="h-2 rounded bg-gray-300"></div>
                  <div class="h-2 rounded bg-gray-300"></div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="max-h-[450px] overflow-y-auto">
            <table class="w-full border-collapse">
              <thead class="bg-gray-100 text-sm top-0 sticky">
                <tr>
                  <th class="p-2 text-left">#</th>
                  <th class="p-2 text-left">Hold ID</th>
                  <th class="p-2 text-left">Customer</th>
                  <th class="p-2 text-right">Total</th>
                  <th class="p-2 text-left">Date</th>
                  <th class="p-2 w-[40px]"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(h, idx) in sortedHoldList" :key="h.id" class="border-t text-sm">
                  <td class="p-2">{{ idx + 1 }}</td>
                  <td class="p-2">{{ h.id }}</td>
                  <td class="p-2">{{ h.customer?.name ?? '' }}</td>
                  <td class="p-2 text-right font-semibold">Ks. {{ (h.total_amount || 0).toLocaleString('en-us') }}
                  </td>
                  <td class="p-2">{{ h.created_at ? new Date(h.created_at).toLocaleString() : '' }}</td>
                  <td class="p-2">
                    <div class="flex gap-x-2">
                      <BaseButton severity="info" size="sm" icon="pi pi-pen-to-square" @click="editHold(h)" />
                      <!-- <BaseButton severity="danger" disabled size="sm" icon="pi pi-trash" @click="deleteHold(h)" /> -->
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="holdList.length === 0" class="text-center p-4 text-gray-500">No hold sales found.</div>
          </div>
        </div>
      </template>
    </Dialog>

    <!-- Wallet Top-up dialog -->
    <Dialog v-model:visible="openWalletModal" :modal="true" :draggable="true" :position="'center'">
      <template #container="{ closeCallback }">
        <div class="flex flex-col gap-y-4 p-4">
          <div class="flex justify-between items-center">
            <SubTitle label="Wallet Info" />
            <BaseButton severity="secondary" @click="openWalletModal = false" icon="fa fa-x" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <!-- Customer Id for Wallet -->
            <BaseInput size="sm" v-model="selectedCustomer.id" label="Customer ID:" height="h-[35px]" disabled />
            <!-- Top-up date -->
            <BaseInput size="sm" :modelValue="moment(walletData.payDate).format('DD-MM-YYYY hh:mm a')" label="Datetime:"
              height="h-[35px]" disabled />
            <!-- Top-up Amount -->
            <BaseInput size="sm" type="number" v-model="walletData.amount" label="Top-up Amount:" height="h-[35px]"
              :isRequire="true" :error="errorMsg.amount" />
            <!-- Select Payment Method for Wallet -->
            <div class="flex flex-col gap-1">
              <BaseLabel label="Payment Method:" />
              <select class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px]"
                v-model="walletData.paymentId">
                <option value="1">Cash</option>
                <option value="4">Kpay</option>
              </select>
            </div>
            <BaseTextarea class="col-span-2" v-model="walletData.remark" label="Remark" autoResize />
            <div class="col-span-2 flex justify-end items-center">
              <BaseButton label="Add Wallet" @click="createWallet" :disabled="useWallet.loading || useSales.loading" />
            </div>
          </div>
        </div>
      </template>
    </Dialog>

    <!-- Start of Slip Section-->
    <div v-if="savedSalesData"
      class="flex-[1.8] max-w-md w-full mx-auto p-6 bg-white shadow-lg border border-gray-300 rounded-sm text-sm font-mono text-black print-only hidden-print"
      id="sales-slip">
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
            <span style="font-weight: bold;">Receipt:</span> {{ savedSalesData.id }}
          </div>
          <div><span style="font-weight: bold;">Counter:</span> {{ userData.counter?.name }}</div>
        </div>
        <div style="text-align: left;">
          <div><span style="font-weight: bold;">Cashier:</span> {{ userData.name }}</div>
          <div><span style="font-weight: bold;">Date:</span> {{ moment(savedSalesData.date).format('DD/MM/YY HH:mm') }}</div>
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
          <tr v-for="item in savedSalesData.details" :key="item.id" style="border-top: 1px solid #dee2e6;">
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
                  Dis[-{{ item.promotion.discount_type === 'AMOUNT' ?
                    Number(item.promotion.discount_value).toLocaleString() + " Ks." : item.discount_value+'%' }}]
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
          <span>{{ `${defaultCurrency} ${Number(savedSalesData.total_amount).toLocaleString()}` }}</span>
        </div>
        <!-- <div class="flex justify-between">
            <span>TAX ({{ data.taxRate }}%)</span>
            <span>{{ defaultCurrency + tax.toLocaleString() }}</span>
          </div> -->
        <div style="
              display: flex;
              justify-content: space-between;
              font-size: large;
              font-weight: bold;
              border-top: 1px solid black;
              padding-top: 4px;
            ">
          <span>
            TOTAL
            <span style="font-weight: normal; font-size: small;">{{ savedSalesData.payment_method?.id !== 1 &&
              savedSalesData.payment_method?.id !== 2 && savedSalesData.payment_method?.id !== 3 ?
              `(${savedSalesData.payment_method?.name})` :
              '' }}</span>
          </span>
          <span>{{ `${defaultCurrency} ${Number(savedSalesData.total_amount).toLocaleString()}` }}</span>
          <!-- <span>{{ defaultCurrency + (subtotal + tax).toLocaleString() }}</span> -->
        </div>
        <!-- Pay Amount -->
        <div v-if="savedSalesData.payment_method?.id === 1" style="
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
            ">
          <span>Pay Amt ({{ savedSalesData.payment_method?.name }})</span>
          <span>{{ `${defaultCurrency} ${Number(savedSalesData.paid_amount).toLocaleString()}` }}</span>
        </div>
        <!-- Change Amount -->
        <div v-if="savedSalesData.payment_method?.id === 1" style="
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
            ">
          <span>Change Amt</span>
          <span>{{ `${defaultCurrency} ${Number(savedSalesData.due_amount).toLocaleString()}` }}</span>
        </div>
        <!-- Customer current balance -->
        <div v-if="savedSalesData.payment_method?.id === 3" style="
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
            ">
          <span>Current Balance</span>
          <span>{{ `${defaultCurrency} ${Number(oldCustomerBalance).toLocaleString()}` }}</span>
        </div>
        <!-- Customer buying amount -->
        <div v-if="savedSalesData.payment_method?.id === 3" style="
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
            ">
          <span>Pay Amount ({{ savedSalesData.payment_method?.name }})</span>
          <span>{{ `${defaultCurrency} -${Number(savedSalesData.total_amount).toLocaleString()}` }}</span>
        </div>
        <!-- Customer Remain Balance -->
        <div v-if="savedSalesData.payment_method?.id === 3" style="
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
            ">
          <span>Remaining Balance</span>
          <span>{{ `${defaultCurrency} ${Number(savedSalesData.customer.balance).toLocaleString()}` }}</span>
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

    <!-- Wallet Top-up Slip -->
    <div id="wallet-slip"
      class="max-w-md w-full mx-auto p-6 bg-white shadow-lg border border-gray-300 rounded-sm text-sm font-mono text-black print-only hidden-print">
      <!-- Header -->
      <header style="
          text-align: center;
          padding-bottom: 6px;
          margin-bottom: 6px;
          border-bottom: 1px solid black;">
        <h1 class="text-lg font-bold">FUSION MART</h1>
        <div>53 Street, Between 36 & 37 ST (MA-68/2), Ye Mon Taung Quater, Mandalay</div>
        <div>Tel: +959740010055</div>
      </header>

      <!-- Info -->
      <div style="
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1px dashed black;
        ">
        <div>
          <div><strong>Customer:</strong> {{ selectedCustomer?.name }}</div>
          <div><strong>Date:</strong> {{ moment(walletData.payDate).format('DD/MM/YY HH:mm') }}</div>
        </div>
      </div>

      <!-- Amount Section -->
      <div style="text-align: right; margin-bottom: 16px;">
        <!-- before -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Before Balance :</span>
          <span style="font-weight: bold;">{{ `${defaultCurrency} ${Number(oldCustomerBalance).toLocaleString()}` }}</span>
        </div>
        <!-- top up -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Top Up Amount ({{ walletData.paymentId == 1 ? 'Cash' : 'Kpay' }}) :</span>
          <span style="font-weight: bold;">{{ `${defaultCurrency} ${Number(walletData.amount).toLocaleString()}` }}</span>
        </div>
        <!-- after -->
        <div style="
            display: flex;
            justify-content: space-between;
            font-size: large;
            border-top: 1px solid black;
            padding-top: 4px; ">
          <span>After Balance :</span>
          <span style="font-weight: bold;">{{ `${defaultCurrency} ${(Number(oldCustomerBalance) + Number(walletData.amount)).toLocaleString()}` }}</span>
        </div>
      </div>

      <!-- Footer -->
      <footer style="
          text-align: center;
          border-top: 1px dashed black;
          padding-top: 8px;
          font-size: 12px;">
        <div>THANK YOU!</div>
      </footer>
    </div>

  </div>
</template>
