<script setup>
import BaseButton from '@/components/BaseButton.vue';
import BaseInput from '@/components/BaseInput.vue';
import ProductCard from '@/components/ProductCard.vue';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { Dialog, Select, useToast } from 'primevue';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useStatusStore } from '@/stores/useStatusStore';
import { useSaleStore } from '@/stores/useSalesStore';
import { useRouter } from 'vue-router';
import moment from 'moment';
import axios from 'axios';
import { useProductStore } from '@/stores/useProductStore';

const toast = useToast();
const router = useRouter();
const useInventory = useInventoryStore();
const useCustomer = useCustomerStore();
const useStatus = useStatusStore();
const useSales = useSaleStore();
const useProduct = useProductStore();

const productList = ref([]);
const userData = ref({});
const selectedProducts = ref([]);
const salesData = ref({
  customer_id: '',
  sale_date: '',
  payment_method: '',
  paid_amount: 0,
  status_id: '',
  created_by: '',
  products: [],
});
const visible = ref(false);
const qty = ref("");
const qtyInputRef = ref(null);
const selectedPId = ref("");
const selectedCustomer = ref("");
const searchQuery = ref("");
const barcodeInput = ref(null); // Hidden barcode input reference
// Hold sales UI
const visibleHoldList = ref(false);
const holdList = ref([]);
const loadingHolds = ref(false);
const selectedHold = ref('');
let barcodeBuffer = '';
let barcodeTimer = null;

onMounted(async () => {
  await useStatus.fetchAllStatus();
  await useInventory.fetchAllStock();
  await useCustomer.fetchAllCustomer();
  // const inventory = useInventory.stockList.filter(item => item.warehouse.id === JSON.parse(localStorage.getItem('user')).branch.warehouse_id);
  userData.value = JSON.parse(localStorage.getItem('user'));
  selectedCustomer.value = useCustomer.customerList.find(c => c.is_default);
  // productList.value = inventory;
  await useProduct.fetchSalesProduct({warehouse_id: JSON.parse(localStorage.getItem('user')).branch.warehouse_id});
  productList.value = useProduct.productList;
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

watch(visible, (newVal) => {
  if (newVal) {
    nextTick(() => {
      qty.value = "";
      qtyInputRef.value?.focus();
    });
  }
});

async function addProduct(product) {
  let checkQty = product.qty <= 0;
  if (checkQty) {
    toast.add({
      severity: 'warn',
      summary: 'Stock Qty Warning',
      detail: "Insufficient quantity.",
      life: 3000
    });
    return
  }
  let exist = selectedProducts.value.find(p => p.id === product.id);
  if (exist) {
    selectedPId.value = product.id;
    increaseQty(exist);
    //visible.value = true;
    return;
  }
  const checkPromo = await axios.get(`/promotions/checkprice/${product.id}`);
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
  const inputVal = (e.target?.value || '').toString().trim();
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
    try { e.target.blur(); } catch (err) {}
  }
}

// -------------------------
// Hold / Resume Sale logic
// -------------------------

async function holdSale() {
  if (!selectedProducts.value || selectedProducts.value.length === 0) return;

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
    status_id: useStatus.statusList.find(el => el.name === 'Hold').id,
    created_by: JSON.parse(localStorage.getItem('user')).id,
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
  let status_id = useStatus.statusList.find(el => el.name === 'Hold').id;
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

async function onPayClick() {
  if (selectedHold.value) {
    const payload = {
      paid_amount: 0,
      payment_id: 1,
      sale_date: moment().format("YYYY/MM/DD HH:mm:ss"),
      status_id: useStatus.statusList.find(el => el.name === 'Pending').id,
      updated_by: JSON.parse(localStorage.getItem('user')).id
    }
    await useSales.editSales(selectedHold.value.id, payload);
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
      router.push({ path: '/payment/create', query: { id: useSales.salesList.id } });
    }
  } else {
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
      status_id: useStatus.statusList.find(el => el.name === 'Hold').id,
      created_by: JSON.parse(localStorage.getItem('user')).id,
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
      router.push({ path: '/payment/create', query: { id: useSales.salesList.id } });
    }
  }
}

</script>

<template>
    <div class="flex flex-col h-[calc(100vh-64px)] bg-blue-100/30">
      <!-- Main POS content fills remaining height -->
      <div class="flex flex-1 overflow-hidden">
        <!-- Left section (Products) -->
        <div class="flex flex-col w-2/3 p-4 overflow-hidden">
          <!-- Fixed Search Bar -->
          <div class="shrink-0 flex gap-x-2 justify-between items-center">
            <BaseInput v-model="searchQuery" height="h-[33px]" placeholder="Search products by name, id, or barcode..."
              width="350px" icon="pi pi-search" @keyup.escape="searchQuery = ' '" />
            <BaseButton label="Holds" severity="info" icon="fa fa-folder-open" @click="openHoldDialog" />
          </div>

          <!-- Scrollable product grid -->
          <div class="flex-1 overflow-y-auto mt-4 pr-1">
            <div class="grid grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              <ProductCard v-for="product in filteredProducts" :key="product.id" :name="product.name"
                :price="product.price" :imageUrl="product.image_url" :qty="product.qty"
                @click="addProduct(product)" />
            </div>
          </div>
        </div>

        <!-- Right section (Cart + Totals) -->
        <div class="flex flex-col w-1/3 bg-white text-black p-4 overflow-hidden">
          <!-- Top: Customer selection -->
          <div class="shrink-0 mb-2 flex gap-x-2 items-center">
            <Select v-model="selectedCustomer" :options="useCustomer.customerList" filter optionLabel="id"
              placeholder="Select a customer" class="w-[200px] h-[30px] items-center" @keydown.enter="onSelectEnter">
              <template #option="slotProps">
                <div class="flex items-center text-[13px]">
                  {{ slotProps.option.id }} | {{ slotProps.option.name }}
                </div>
              </template>
            </Select>
            <BaseInput id="barcodeInput" type="text" height="h-[33px]" width="350px" placeholder="Scan products by barcode..."
            @keyup="handleBarcodeInput" />
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
                        <i class="fa fa-circle-minus text-xl cursor-pointer text-gray-500"
                          @click="decreaseQty(item)"></i>
                        <span class="font-semibold"> {{ item.qty }} </span>
                        <i class="fa fa-circle-plus text-xl cursor-pointer text-gray-500"
                          @click="increaseQty(item)"></i>
                        <span> x </span>
                        <span class="font-semibold">{{ Number(item.price).toLocaleString() }}</span>
                      </div>
                      <div>
                        <span v-if="item.promotion_id" class="font-semibold">Discount: [ - {{ item.discount_type ===
                          'AMOUNT' ?
                          Number(item.discount_value).toLocaleString()+" Ks." : item.discount_value+'%' }} ]</span>
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
          <div class="flex justify-end items-center">
            <span colspan="2" class="p-2 font-semibold text-end">Total :</span>
            <span colspan="2" class="p-2 text-end font-semibold">
              Ks. {{selectedProducts.reduce((sum, item) => sum + (item.qty * (item.promotion_id ? item.discount_price :
                item.price)), 0).toLocaleString('en-us')}}
            </span>
          </div>

          <!-- Fixed bottom button group -->
          <div class="shrink-0 mt-4 flex justify-end gap-x-2 items-center">
            <BaseButton label="Reset" severity="danger" icon="fa fa-rotate-left"
              :disabled="selectedProducts.length === 0" @click="resetData" />
            <BaseButton label="Hold" severity="secondary" icon="fa fa-hand" :disabled="selectedProducts.length === 0 || selectedHold.length != 0"
              @click="holdSale" />
            <BaseButton label="Pay" severity="primary" icon="fa fa-credit-card"
              :disabled="selectedProducts.length === 0" @click="onPayClick" />
          </div>
        </div>
      </div>

      <!-- Quantity dialog -->
      <Dialog v-model:visible="visible" :style="{ width: '300px' }" :modal="true" :draggable="false"
        :position="'center'">
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

            <div v-if="loadingHolds" class="text-center py-8">Loading...</div>

            <div v-else>
              <table class="table-auto w-full border-collapse">
                <thead class="bg-gray-100 text-sm">
                  <tr>
                    <th class="p-2 text-left">#</th>
                    <th class="p-2 text-left">Hold ID</th>
                    <th class="p-2 text-left">Customer</th>
                    <th class="p-2 text-right">Total</th>
                    <th class="p-2 text-left">Date</th>
                    <th class="p-2 w-[80px]"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(h, idx) in holdList" :key="h.id" class="border-t text-sm">
                    <td class="p-2">{{ idx + 1 }}</td>
                    <td class="p-2">{{ h.id }}</td>
                    <td class="p-2">{{ h.customer?.name ?? 'Walk-in' }}</td>
                    <td class="p-2 text-right font-semibold">Ks. {{ (h.total_amount || 0).toLocaleString('en-us') }}
                    </td>
                    <td class="p-2">{{ h.created_at ? new Date(h.created_at).toLocaleString() : '' }}</td>
                    <td class="p-2">
                      <div class="flex gap-x-2">
                        <BaseButton severity="info" size="sm" icon="pi pi-pen-to-square" @click="editHold(h)" />
                        <BaseButton severity="danger" size="sm" icon="pi pi-trash" @click="deleteHold(h)" />
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
    </div>
</template>
