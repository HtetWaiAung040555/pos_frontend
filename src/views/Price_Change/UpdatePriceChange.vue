<script setup>
import { useRoute, useRouter } from 'vue-router';
import { watch, ref, computed, onMounted } from 'vue';
import axios from 'axios';
import moment from 'moment';
import BaseInput from '@/components/BaseInput.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import BaseButton from '@/components/BaseButton.vue';
import { errMsgList } from '@/utils/const';
import { useToast } from 'primevue';
import PageTitle from '@/components/PageTitle.vue';
import BaseCard from '@/components/BaseCard.vue';
import BaseSwitch from '@/components/BaseSwitch.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useProductStore } from '@/stores/useProductStore';
import { usePriceChangeStore } from '@/stores/usePriceChangeStore';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const usePriceChange = usePriceChangeStore();
const useProduct = useProductStore();

const priceChangeId = ref(route.query.id || route.params.id || null);

const userData = ref({});
const formData = ref({
  description: '',
  type: '',
  startDate: moment().format('YYYY-MM-DDTHH:mm'),
  endDate: moment().add(1, 'days').format('YYYY-MM-DDTHH:mm'),
  priceValueType: '',
  priceChangeValue: '',
});

const selectedProducts = ref([]);
const priceChangeStatus = ref(true);
const isProductDialogVisible = ref(false);
const productList = ref([]);
const searchTerm = ref('');
const selectionBuffer = ref([]);
const headerCheckboxRef = ref(null);
const isCheckingAll = ref(false);
const isSelectAllLoading = ref(false);
const individual_new_price=ref(false);


const errorMsg = ref({
  type: "",
  priceChangeValue: "",
  products: "",
});

// Navigation
function changeRoute(pathname) {
  router.push(pathname);
}

// Fetch products and price change data
onMounted(async () => {
  userData.value = JSON.parse(localStorage.getItem('user'));

  await useProduct.fetchAllProduct();
  productList.value = useProduct.productList;

  if (priceChangeId.value) {
    await usePriceChange.fetchPriceChange(priceChangeId.value);
    const priceChange = usePriceChange.priceChangeList || {};

    selectedProducts.value = usePriceChange.priceChangeList.products.map(p => {
        return {
        id: p.id,
        name: p.name,
        image_url: p.image_url,
        old_price: Number(p.old_price) || 0,
        new_price: Number(p.price),
        individual_new_price: false
        }
    });

    formData.value.description = priceChange.description || '';
    formData.value.type = priceChange.type || '';
    formData.value.startDate = priceChange.start_at ? moment(priceChange.start_at).format('YYYY-MM-DDTHH:mm') : formData.value.startDate;
    formData.value.endDate = priceChange.end_at ? moment(priceChange.end_at).format('YYYY-MM-DDTHH:mm') : formData.value.endDate;
    priceChangeStatus.value = String(priceChange.status_id || '1') === '1';

  }
});


// Product filtering
const filteredProducts = computed(() => {
  const q = (searchTerm.value || '').toLowerCase().trim();
  if (!q) return productList.value || [];
  return (productList.value || []).filter(p => {
    return (p.name || '').toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q);
  });
});

// Open product modal
function openProductDialog() {
  selectionBuffer.value = selectedProducts.value.slice();
  searchTerm.value = '';
  isProductDialogVisible.value = true;
}

// Toggle single product selection
async function toggleProductInBuffer(event, product) {
  const idx = selectionBuffer.value.findIndex(p => p.id === product.id);
  if (idx !== -1) { selectionBuffer.value.splice(idx, 1); return; }

  try {
    const response = await axios.get(`/promotions/checkprice/${product.id}`);
    const data = response.data;
    if (data && data.promotion_id) {
      try { if (event && event.target) event.target.checked = false; } catch(e){}
      toast.add({ severity: 'warn', summary: 'Product In Promotion', detail: `${product.name} is already in a promotion (discount ${data.discount_amount}).`, life: 4000 });
      return;
    }
  } catch (err) {
    try { if (event && event.target) event.target.checked = false; } catch(e){}
    toast.add({ severity: 'error', summary: 'Check Failed', detail: `Failed to verify promotion for ${product.name}.`, life: 3000 });
    return;
  }

  selectionBuffer.value.push(product);
}

function isBufferSelected(product) { return selectionBuffer.value.some(p => p.id === product.id); }

// Select all filtered
async function selectAllInBuffer() {
  if (isCheckingAll.value) return;
  isCheckingAll.value = true;
  isSelectAllLoading.value = true;

  try {
    const ids = new Set(selectionBuffer.value.map(p => p.id));
    const candidates = (filteredProducts.value || []).filter(p => !ids.has(p.id));
    if (candidates.length === 0) return;

    const checks = await Promise.allSettled(
      candidates.map(p => axios.get(`/promotions/checkprice/${p.id}`))
    );

    const skipped = [];
    checks.forEach((res, idx) => {
      const product = candidates[idx];
      if (res.status === 'fulfilled') {
        const data = res.value.data;
        if (data && data.promotion_id) skipped.push(product);
        else if (!selectionBuffer.value.some(s => s.id === product.id)) selectionBuffer.value.push(product);
      } else skipped.push(product);
    });

    if (skipped.length > 0) {
      const names = skipped.slice(0,5).map(p => p.name).join(', ');
      const more = skipped.length > 5 ? ` and ${skipped.length - 5} more` : '';
      toast.add({ severity: 'warn', summary: 'Some products skipped', detail: `Skipped ${skipped.length} product(s) already in promotion: ${names}${more}`, life: 5000 });
    }
  } finally {
    isCheckingAll.value = false;
    isSelectAllLoading.value = false;
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

watch([() => selectionBuffer.value, () => productList.value, () => searchTerm.value], () => {
  if (headerCheckboxRef.value) headerCheckboxRef.value.indeterminate = someFilteredSelected.value;
});

watch([() => formData.value.priceChangeValue, () => formData.value.priceValueType], () => {
  if (!selectedProducts.value.length) return;
  calculateNewPrices();
});

function confirmProductSelection() {
  selectedProducts.value = selectionBuffer.value.map(p => ({
    ...p,
    old_price: Number(p.old_price) || 0,
    new_price: Number(p.price) || Number(p.old_price),

    individual_new_price: false, 
  }));
  isProductDialogVisible.value = false;
}


function cancelProductSelection() { isProductDialogVisible.value = false; }

// Price calculation
function calculateNewPrices() {
  const changeValue = Number(formData.value.priceChangeValue) || 0;

   if (!changeValue) return; 

  const isIncrease = formData.value.priceValueType === 'INCREASE';
  selectedProducts.value.forEach(product => {
    if (!product.individual_new_price) {
      const base = Number(product.old_price) || 0;
      product.new_price = isIncrease ? base + changeValue : Math.max(0, base - changeValue);
    }
  });
}

function formatPrice(value) { return Number(value).toLocaleString(); }

const hasManualPrice = computed(() => selectedProducts.value.some(
  p => p.individual_new_price && Number(p.new_price) >= 0 && Number(p.new_price) !== Number(p.old_price)
));

// Submit form
async function formSubmit() {
  if (formData.value.type === "") {
    errorMsg.value = { type: errMsgList.type, priceChangeValue: "", products: "" };
    return;
  } else if (!formData.value.priceChangeValue && !hasManualPrice.value) {
    errorMsg.value = { type: "", priceChangeValue: "Please enter a price change value or manually set new prices.", products: "" };
    return;
  } else if (selectedProducts.value.length === 0) {
    errorMsg.value = { type: "", priceChangeValue: "", products: errMsgList.product };
    return;
  }

  const payload = {
    description: formData.value.description,
    type: formData.value.type,
    start_at: formData.value.startDate,
    end_at: formData.value.endDate,
    status_id: priceChangeStatus.value ? 1 : 2,
    updated_by: userData.value.id,
    products: selectedProducts.value.map(p => ({
      product_id: p.id,
      old_price: p.old_price,
      new_price: p.new_price
    }))
  };

  if (!priceChangeId.value) {
    toast.add({ severity: 'error', summary: 'Missing ID', detail: 'Price change ID is missing.', life: 3000 });
    return;
  }

  await usePriceChange.editPriceChange(payload, priceChangeId.value);

  if (usePriceChange.error.length) {
    usePriceChange.error.forEach(msg => toast.add({ severity: 'error', summary: 'Error Message', detail: msg, life: 3000 }));
    return;
  }

  toast.add({ severity: 'success', summary: 'Success Message', detail: 'Price change updated successfully.', life: 3000 });
  router.push('/price_change');
}
</script>

<template>
<div class="p-4">
  <PageTitle title="Update Price Change">
    <template #titleButtons>
      <div class="flex gap-x-2 items-center">
        <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary" @click="changeRoute('/price_change')" />
      </div>
    </template>
  </PageTitle>

  <BaseCard class="mt-3">
    <template #cardElements>
      <!-- Basic Info -->
      <SubTitle label="Basic Info" />
      <div class="flex gap-x-4 mt-6">
        <div class="flex flex-col gap-1 w-[300px]">
          <BaseLabel label="Price Change Type" />
          <select class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px]" v-model="formData.type">
            <option value="sale">Sale</option>
            <option value="purchase">Purchase</option>
          </select>
        </div>
        <div class="flex flex-col gap-y-1 w-[200px]">
          <BaseLabel label="Status" />
          <BaseSwitch v-model="priceChangeStatus" />
        </div>
      </div>

      <!-- Dates -->
      <div class="flex gap-x-4 mt-6">
        <BaseInput size="sm" v-model="formData.startDate" label="Started Datetime" width="300px" height="h-[35px]" type="datetime-local" />
        <BaseInput size="sm" v-model="formData.endDate" label="Ended Datetime" width="300px" height="h-[35px]" type="datetime-local" />
      </div>

      <!-- Price Value -->
      <div class="flex flex-col gap-1 mt-6 w-[420px]">
        <BaseLabel label="Price Change Value" />
        <div class="flex gap-x-2 items-center">
          <select class="text-md border border-gray-500 rounded-sm p-2 text-black w-[120px] h-[35px]" v-model="formData.priceValueType">
            <option value="" disabled>Select</option>
            <option value="INCREASE">Increase</option>
            <option value="DECREASE">Decrease</option>
          </select>
          <BaseInput size="sm" v-model="formData.priceChangeValue" width="280px" height="h-[35px]" type="number" />
        </div>
      </div>

      <!-- Description -->
      <div class="flex gap-x-4 mt-4">
        <BaseInput v-model="formData.description" label="Description" placeholder="Description" />
      </div>

      <!-- Products -->
      <div class="flex flex-col">
        <BaseButton label="Select Products" class="w-fit mt-4 mb-4" @click="openProductDialog()" />

        <div class="mt-4">
          <div class="max-h-[350px] overflow-y-auto rounded">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="text-left text-gray-600">
                  <th class="py-2 sticky top-0 bg-white z-10 border-b">Image</th>
                  <th class="py-2 sticky top-0 bg-white z-10 border-b">Product Name</th>
                  <th class="py-2 text-right sticky top-0 bg-white z-10 border-b">Old Price</th>
                  <th class="py-2 text-right sticky top-0 bg-white z-10 border-b">New Price</th>
                  <th class="py-2 sticky top-0 bg-white z-10 border-b">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="product in selectedProducts" :key="product.id" class="border-b hover:bg-gray-50">
                    <td class="py-2">
                        <div class="w-12 h-12 overflow-hidden rounded">
                            <img :src="product.image_url" alt="product" class="w-full h-full object-cover" />
                        </div>
                    </td>
                    <td class="py-2">{{ product.name }}</td>
                    <td class="py-2 text-right">{{ formatPrice(product.old_price) }}</td>

                    
             
                    <td class="py-2 text-right">
                       <input 
                            type="number"
                            class="w-24 text-right px-1 py-1 border rounded"
                            v-model.number="product.new_price"
                            @input="product.individual_new_price = true"
                        />
                    </td>

                    <td class="py-2 text-right"><button class="text-red-600 hover:text-red-800 px-2 py-1" @click="selectedProducts = selectedProducts.filter(p => p.id !== product.id)"><i class="pi pi-trash"></i></button></td>
                </tr>
                <tr v-if="selectedProducts.length === 0"><td colspan="5" class="py-4 text-center text-gray-500">No products selected</td></tr>
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
            <div class="text-sm text-gray-600">{{ selectionBuffer.length }} selected</div>
          </div>
          <div class="py-4 flex gap-x-2 items-center">
            <input v-model="searchTerm" placeholder="Search by name or barcode" class="border p-2 rounded w-full" />
          </div>
          <div class="py-4 overflow-auto max-h-[50vh]">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-gray-600 border-b">
                  <th class="py-2">
                    <div class="flex items-center gap-x-2">
                      <span v-if="isSelectAllLoading" class="text-sm text-gray-600"><i class="fa fa-spinner fa-spin"></i></span>
                      <input v-else type="checkbox" :checked="allFilteredSelected" @change="toggleHeaderSelection" ref="headerCheckboxRef" :disabled="isCheckingAll || isSelectAllLoading" />
                    </div>
                  </th>
                  <th>Image</th>
                  <th class="py-2">Name</th>
                  <th class="py-2">Barcode</th>
                  <th class="py-2 text-end">Price</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="product in filteredProducts" :key="product.id" class="hover:bg-gray-50">
                  <td class="py-2"><input type="checkbox" :checked="isBufferSelected(product)" @change="toggleProductInBuffer($event, product)" /></td>
                  <td class="py-2"><img class="object-cover w-10 h-10 rounded" :src="product.image_url" /></td>
                  <td class="py-2">{{ product.name }}</td>
                  <td class="py-2">{{ product.barcode }}</td>
                  <td class="py-2 text-end">{{ Number(product.price).toLocaleString() || 0 }}</td>
                </tr>
                <tr v-if="(filteredProducts || []).length === 0"><td colspan="5" class="py-4 text-center text-gray-500">No products found</td></tr>
              </tbody>
            </table>
          </div>
          <div class="flex justify-end gap-x-2 py-4 border-t">
            <BaseButton severity="secondary" label="Cancel" @click="cancelProductSelection" />
            <BaseButton label="Add Product" class="px-4 py-2 bg-blue-600 text-white rounded" @click="confirmProductSelection" />
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div class="flex justify-end mt-4">
        <BaseButton 
          label="Update" 
          :isLoading="usePriceChange.loading"
          :icon="usePriceChange.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" 
          severity="primary"
          @click="formSubmit" 
          :disabled="usePriceChange.loading" 
        />
      </div>
    </template>
  </BaseCard>
</div>
</template>
