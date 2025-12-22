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
import { usePromotionStore } from '@/stores/usePromotionStore';
import PageTitle from '@/components/PageTitle.vue';
import BaseCard from '@/components/BaseCard.vue';
import BaseSwitch from '@/components/BaseSwitch.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useProductStore } from '@/stores/useProductStore';

const router = useRouter();
const toast = useToast();
const usePromo = usePromotionStore();
const useProduct = useProductStore();

const userData = ref({});
const formData = ref({
    name: '',
    description: '',
    discountType: 'AMOUNT',
    discountValue: 0,
    startDate: moment().format('YYYY-MM-DD HH:mm:ss'),
    endDate: moment().add(1, 'days').format('YYYY-MM-DD HH:mm:ss'),
});
const selectedProducts = ref([]);
const promoStatus = ref(true);
const isProductDialogVisible = ref(false);
const productList = ref([]);
const searchTerm = ref('');
const selectionBuffer = ref([]);
const headerCheckboxRef = ref(null);
const isCheckingAll = ref(false);
const isSelectAllLoading = ref(false);

const errorMsg = ref({
    name: "",
    discountValue: "",
    products: "",
});

// Change route function
function changeRoute(pathname) {
    router.push(pathname);
}

onMounted(async () => {
    userData.value = JSON.parse(localStorage.getItem('user'));
    await useProduct.fetchAllProduct();
    productList.value = useProduct.productList;
});

const filteredProducts = computed(() => {
    const q = (searchTerm.value || '').toString().trim().toLowerCase();
    if (!q) return productList.value || [];
    return (productList.value || []).filter(p => {
        const name = (p.name || '').toString().toLowerCase();
        const barcode = (p.barcode || '').toString().toLowerCase();
        return name.includes(q) || barcode.includes(q);
    });
});

function openProductDialog() {
    // create a shallow copy buffer to allow canceling
    selectionBuffer.value = selectedProducts.value.slice();
    searchTerm.value = '';
    isProductDialogVisible.value = true;
}

async function toggleProductInBuffer(event, product) {
    const idx = selectionBuffer.value.findIndex(p => p.id === product.id);
    // If already selected -> unselect immediately
    if (idx !== -1) {
        selectionBuffer.value.splice(idx, 1);
        return;
    }

    // Check remote API whether product is already in a promotion
    try {
        const response = await axios.get(`/promotions/checkprice/${product.id}`);
        const data = response.data;
        // If promotion_id is present and not null -> product already in promotion
        if (data && data.promotion_id) {
            // force-uncheck the checkbox visually
            try { if (event && event.target) event.target.checked = false; } catch(e) {}
            toast.add({ severity: 'warn', summary: 'Product In Promotion', detail: `${product.name} is already in a promotion (discount ${data.discount_amount}).`, life: 4000 });
            return;
        }
    } catch (err) {
        // On error, force-uncheck and show a toast and prevent selection to avoid inconsistent state
        try { if (event && event.target) event.target.checked = false; } catch(e) {}
        toast.add({ severity: 'error', summary: 'Check Failed', detail: `Failed to verify promotion for ${product.name}.`, life: 3000 });
        return;
    }

    // If not in promotion, add to buffer
    selectionBuffer.value.push(product);
}

function isBufferSelected(product) {
    return selectionBuffer.value.some(p => p.id === product.id);
}

async function selectAllInBuffer() {
    // add only products that are not already in a promotion
    if (isCheckingAll.value) return;
    isCheckingAll.value = true;
    isSelectAllLoading.value = true;
    try {
        const ids = new Set(selectionBuffer.value.map(p => p.id));
        const candidates = (filteredProducts.value || []).filter(p => !ids.has(p.id));
        if (candidates.length === 0) return;

        // API checks 
        const checks = await Promise.allSettled(
            candidates.map(p => axios.get(`/promotions/checkprice/${p.id}`))
        );

        const skipped = [];
        checks.forEach((res, idx) => {
            const product = candidates[idx];
            if (res.status === 'fulfilled') {
                const data = res.value.data;
                if (data && data.promotion_id) {
                    skipped.push(product);
                } else {
                    // add to buffer if not already present
                    if (!selectionBuffer.value.some(s => s.id === product.id)) selectionBuffer.value.push(product);
                }
            } else {
                skipped.push(product);
            }
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

// keep header checkbox indeterminate state in sync
watch([() => selectionBuffer.value, () => productList.value, () => searchTerm.value], () => {
    if (headerCheckboxRef.value) {
        headerCheckboxRef.value.indeterminate = someFilteredSelected.value;
    }
});

function confirmProductSelection() {
    selectedProducts.value = selectionBuffer.value.slice();
    isProductDialogVisible.value = false;
}

function cancelProductSelection() {
    isProductDialogVisible.value = false;
}

function getFinalPrice(product) {
    const price = Number(product.price) || 0;
    const val = Number(formData.value.discountValue) || 0;
    if (formData.value.discountType === 'AMOUNT') {
        return Math.max(0, price - val);
    }
    // percentage
    return Math.max(0, price * (1 - val / 100));
}

function formatPrice(value) {
    return Number(value).toLocaleString();
}


async function formSubmit() {
    if (formData.value.name === "") {
        errorMsg.value = {
            name: errMsgList.name,
            discountValue: "",
            products: "",
        }
        return
    } else if (formData.value.discountValue <= 0) {
        errorMsg.value = {
            name: "",
            discountValue: errMsgList.discountValue,
            products: "",
        }
        return
    } else if (selectedProducts.value.length === 0) {
        errorMsg.value = {
            name: "",
            discountValue: "",
            products: errMsgList.product,
        }
        return
    }

    const payload = {
        name: formData.value.name,
        description: formData.value.description,
        discount_type: formData.value.discountType,
        discount_value: formData.value.discountValue,
        start_at: formData.value.startDate,
        end_at: formData.value.endDate,
        products: selectedProducts.value.map(product => product.id),
        status_id: promoStatus.value ? '1' : '2',
        created_by: userData.value.id,
    };

    console.log('PayLoad:', payload);

    await usePromo.addPromo(payload);

    if (usePromo.error.length) {
        usePromo.error.forEach((msg) => {
            toast.add({
            severity: 'error',
            summary: 'Error Message',
            detail: msg,
            life: 3000
            });
        });
        return;
    }

    if (usePromo.promoList) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Create promotion successfully.', life: 3000 });
        router.push('/promotion');
    }
}

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Create Promotion">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary"
                        @click="changeRoute('/promotion')" />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3">
            <template #cardElements>
                <!-- Form section subtitle -->
                <SubTitle label="Basic Info" />
                <div class="flex gap-x-4 mt-6">
                    <!-- Customer Name Input -->
                    <BaseInput 
                        size="sm" 
                        v-model="formData.name"
                        label="Name"
                        placeholder="Name"
                        width="300px"
                        height="h-[35px]"
                        :isRequire="true"
                        :error="errorMsg.name" 
                    />
                    <!-- Promotion Status -->
                    <div class="flex flex-col gap-y-1 w-[200px]">
                        <BaseLabel label="Status" />
                        <BaseSwitch v-model="promoStatus" />
                    </div>
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Started datetime input -->
                    <BaseInput 
                        size="sm" 
                        v-model="formData.startDate"
                        label="Started Datetime"
                        width="300px"
                        height="h-[35px]" 
                        type="datetime-local"
                    />
                    <!-- Ended datetime input -->
                    <BaseInput 
                        size="sm" 
                        v-model="formData.endDate"
                        label="Ended Datetime"
                        width="300px"
                        height="h-[35px]" 
                        type="datetime-local"
                    />
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Discount type select -->
                    <div class="flex flex-col gap-1 w-[300px]">
                        <BaseLabel label="Discount Type" />
                        <select
                            class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px]"
                            v-model="formData.discountType"
                        >
                            <option value="AMOUNT">Amount</option>
                            <option value="PERCENTAGE">Percentage</option>
                        </select>
                    </div>
                    <!-- Phone number input -->
                    <BaseInput 
                        size="sm" 
                        v-model="formData.discountValue"
                        label="Discount Value"
                        width="300px"
                        height="h-[35px]" 
                        type="number"
                    />
                </div>
                <div class="flex gap-x-4 mt-4">
                    <!-- Description input -->
                    <BaseInput 
                        v-model="formData.description"
                        label="Description"
                        placeholder="Description" 
                    />
                </div>
                <!-- Selected Product Section -->
                <div class="flex flex-col">
                    <!-- Select Product Button -->
                    <BaseButton 
                        label="Select Products"  
                        class="w-fit mt-4 mb-4"
                        @click="openProductDialog()"
                    />
                    <!-- Selected Products Table (scrollable with fixed header) -->
                    <div class="mt-4">
                        <div class="max-h-[350px] overflow-y-auto rounded">
                            <table class="w-full text-sm border-collapse">
                                <thead>
                                    <tr class="text-left text-gray-600">
                                        <th class="py-2 sticky top-0 bg-white z-10 border-b">Image</th>
                                        <th class="py-2 sticky top-0 bg-white z-10 border-b">Product Name</th>
                                        <th class="py-2 text-right sticky top-0 bg-white z-10 border-b">Price</th>
                                        <th class="py-2 text-right sticky top-0 bg-white z-10 border-b">Final Price</th>
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
                                        <td class="py-2 text-right">{{ formatPrice(product.price || 0) }}</td>
                                        <td class="py-2 text-right">{{ formatPrice(getFinalPrice(product)) }}</td>
                                        <td class="py-2 text-right">
                                            <button class="text-red-600 hover:text-red-800 px-2 py-1" @click="selectedProducts = selectedProducts.filter(p => p.id !== product.id)"><i class="pi pi-trash"></i></button>
                                        </td>
                                    </tr>
                                    <tr v-if="selectedProducts.length === 0">
                                        <td colspan="5" class="py-4 text-center text-gray-500">No products selected</td>
                                    </tr>
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
                                        <td class="py-2">
                                            <input type="checkbox" :checked="isBufferSelected(product)" @change="toggleProductInBuffer($event, product)" />
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
                            <BaseButton 
                                severity="secondary" 
                                label="Cancel"
                                @click="cancelProductSelection" 
                            />
                            <BaseButton 
                                label="Add Product"
                                class="px-4 py-2 bg-blue-600 text-white rounded"
                                @click="confirmProductSelection" 
                            />
                        </div>
                    </div>
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton 
                        label="Save" 
                        :isLoading="usePromo.loading"
                        :icon="usePromo.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary"
                        @click="formSubmit" 
                        :disabled="usePromo.loading" 
                    />
                </div>
            </template>
        </BaseCard>
    </div>
</template>