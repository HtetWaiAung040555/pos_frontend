<script setup>
import { useRoute, useRouter } from 'vue-router';
import { computed, onMounted, ref, watch } from 'vue';
import moment from 'moment';
import { Select } from 'primevue';
import BaseInput from '@/components/BaseInput.vue';
import BaseLabel from '@/components/BaseLabel.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseErrorLabel from '@/components/BaseErrorLabel.vue';
import PageTitle from '@/components/PageTitle.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import { errMsgList } from '@/utils/const';
import { useToast } from 'primevue';
import { useBranchStore } from '@/stores/useBranchStore';
import { useProductStore } from '@/stores/useProductStore';
import { usePriceChangeStore } from '@/stores/usePriceChangeStore';
import {
    PRICE_CHANGE_TARGETS,
    buildTargetRows,
    isBranchTarget,
    isRangeTarget,
    payloadForTargetRow,
    rowFromPriceChangeItem,
    targetLabel,
    toNumber,
} from '@/utils/priceChangeTargets';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const usePriceChange = usePriceChangeStore();
const useProduct = useProductStore();
const useBranch = useBranchStore();

const priceChangeId = ref(route.query.id || route.params.id || null);
const userData = ref({});
const formData = ref({
    description: '',
    type: 'sale',
    startDate: moment().format('YYYY-MM-DDTHH:mm'),
    endDate: '',
    priceValueType: 'INCREASE',
    priceChangeValue: '',
});
const targetType = ref('GLOBAL_PRODUCT_PRICE');
const selectedBranch = ref(null);
const selectedRows = ref([]);
const productList = ref([]);
const searchTerm = ref('');
const selectionBuffer = ref([]);
const isProductDialogVisible = ref(false);
const isHydrating = ref(false);
const errorMsg = ref({
    branch: '',
    target: '',
    products: '',
    priceChangeValue: '',
});

function changeRoute(pathname) {
    router.push(pathname);
}

onMounted(async () => {
    userData.value = JSON.parse(localStorage.getItem('user'));
    await Promise.all([
        useBranch.fetchAllBranch(),
        useProduct.fetchAllProduct(),
    ]);
    productList.value = useProduct.productList || [];

    if (!priceChangeId.value) return;

    isHydrating.value = true;
    await usePriceChange.fetchPriceChange(priceChangeId.value);
    const priceChange = usePriceChange.priceChangeList || {};
    const rows = (priceChange.products || []).map(rowFromPriceChangeItem);
    selectedRows.value = rows;
    targetType.value = rows[0]?.target_type || 'GLOBAL_PRODUCT_PRICE';

    const firstBranchId = rows.find((row) => row.branch_id)?.branch_id;
    selectedBranch.value = (useBranch.branchList || []).find((branch) => Number(branch.id) === Number(firstBranchId)) || null;

    formData.value.description = priceChange.description || '';
    formData.value.type = priceChange.type || 'sale';
    formData.value.startDate = priceChange.start_at ? moment(priceChange.start_at).format('YYYY-MM-DDTHH:mm') : formData.value.startDate;
    formData.value.endDate = priceChange.end_at ? moment(priceChange.end_at).format('YYYY-MM-DDTHH:mm') : '';
    isHydrating.value = false;
});

const branchOptions = computed(() => useBranch.branchList || []);

const filteredProducts = computed(() => {
    const q = (searchTerm.value || '').toString().trim().toLowerCase();
    if (!q) return productList.value || [];
    return (productList.value || []).filter((product) => (
        (product.name || '').toString().toLowerCase().includes(q)
        || (product.barcode || '').toString().toLowerCase().includes(q)
    ));
});

function branchRequired() {
    return isBranchTarget(targetType.value);
}

function onTargetTypeChange() {
    selectedRows.value = [];
    selectionBuffer.value = [];
    errorMsg.value = { branch: '', target: '', products: '', priceChangeValue: '' };
}

function openProductDialog() {
    if (branchRequired() && !selectedBranch.value) {
        errorMsg.value.branch = errMsgList.branch || 'Please select a branch.';
        return;
    }

    const selectedIds = new Set(selectedRows.value.map((row) => Number(row.product_id)));
    selectionBuffer.value = productList.value.filter((product) => selectedIds.has(Number(product.id)));
    searchTerm.value = '';
    isProductDialogVisible.value = true;
}

function toggleProductInBuffer(product) {
    const idx = selectionBuffer.value.findIndex((item) => Number(item.id) === Number(product.id));
    if (idx >= 0) {
        selectionBuffer.value.splice(idx, 1);
        return;
    }
    selectionBuffer.value.push(product);
}

function isBufferSelected(product) {
    return selectionBuffer.value.some((item) => Number(item.id) === Number(product.id));
}

function confirmProductSelection() {
    const existingByKey = new Map(selectedRows.value.map((row) => [row.rowKey, row]));
    const rows = selectionBuffer.value.flatMap((product) => buildTargetRows(product, targetType.value, selectedBranch.value));

    selectedRows.value = rows.map((row) => {
        const existing = existingByKey.get(row.rowKey);
        return existing ? { ...row, new_price: existing.new_price, min_qty: existing.min_qty, max_qty: existing.max_qty } : row;
    });
    isProductDialogVisible.value = false;
}

function cancelProductSelection() {
    isProductDialogVisible.value = false;
}

function removeRow(rowKey) {
    selectedRows.value = selectedRows.value.filter((row) => row.rowKey !== rowKey);
}

function addCustomRange(row) {
    if (!isRangeTarget(row.target_type)) return;
    selectedRows.value.push({
        ...row,
        rowKey: `${row.rowKey}:custom:${Date.now()}`,
        product_unit_price_range_id: null,
        branch_product_unit_price_range_id: null,
        min_qty: 0,
        max_qty: null,
        old_price: row.old_price,
        new_price: row.new_price,
    });
}

function formatPrice(value) {
    return Number(value || 0).toLocaleString('en-us');
}

function calculateNewPrices() {
    const changeValue = Number(formData.value.priceChangeValue);
    if (!Number.isFinite(changeValue) || changeValue <= 0) return;

    selectedRows.value.forEach((row) => {
        const oldPrice = toNumber(row.old_price);
        row.new_price = formData.value.priceValueType === 'INCREASE'
            ? oldPrice + changeValue
            : Math.max(0, oldPrice - changeValue);
    });
}

watch([() => formData.value.priceChangeValue, () => formData.value.priceValueType], calculateNewPrices);

watch(selectedBranch, () => {
    if (isHydrating.value) return;
    if (branchRequired()) {
        selectedRows.value = [];
        selectionBuffer.value = [];
    }
    errorMsg.value.branch = '';
});

const hasChangedPrice = computed(() => selectedRows.value.some((row) => Number(row.new_price) !== Number(row.old_price)));

function validateForm() {
    errorMsg.value = { branch: '', target: '', products: '', priceChangeValue: '' };

    if (!priceChangeId.value) {
        toast.add({ severity: 'error', summary: 'Missing ID', detail: 'Price change ID is missing.', life: 3000 });
        return false;
    }
    if (!targetType.value) {
        errorMsg.value.target = 'Please select a price change target.';
        return false;
    }
    if (branchRequired() && !selectedBranch.value) {
        errorMsg.value.branch = errMsgList.branch || 'Please select a branch.';
        return false;
    }
    if (!selectedRows.value.length) {
        errorMsg.value.products = errMsgList.product;
        return false;
    }
    if (!hasChangedPrice.value) {
        errorMsg.value.priceChangeValue = 'New price and old price are same in the selected targets.';
        return false;
    }

    const invalidRange = selectedRows.value.some((row) => (
        isRangeTarget(row.target_type)
        && (row.min_qty === '' || row.min_qty === null || row.min_qty === undefined)
    ));
    if (invalidRange) {
        errorMsg.value.products = 'Range targets require min qty.';
        return false;
    }

    return true;
}

async function formSubmit() {
    if (!validateForm()) return;

    const payload = {
        description: formData.value.description,
        type: formData.value.type,
        start_at: formData.value.startDate,
        end_at: formData.value.endDate || null,
        updated_by: userData.value.id,
        products: selectedRows.value.map(payloadForTargetRow),
    };

    await usePriceChange.editPriceChange(payload, priceChangeId.value);

    if (usePriceChange.error.length) {
        usePriceChange.error.forEach((msg) => {
            toast.add({ severity: 'error', summary: 'Error Message', detail: msg, life: 3000 });
        });
        return;
    }

    toast.add({ severity: 'success', summary: 'Success Message', detail: 'Sales price change updated successfully.', life: 3000 });
    router.push('/sales_price_change');
}
</script>

<template>
    <div class="p-3 sm:p-4 lg:p-6">
        <div class="mx-auto w-full max-w-screen-2xl">
            <PageTitle title="Update Sales Price Change">
                <template #titleButtons>
                    <div class="flex gap-x-2 items-center">
                        <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary" @click="changeRoute('/sales_price_change')" />
                    </div>
                </template>
            </PageTitle>

            <BaseCard class="mt-3">
                <template #cardElements>
                    <div class="space-y-8">
                        <section>
                            <div class="flex items-center justify-between border-b border-gray-200 pb-3">
                                <SubTitle label="Price Change Header" />
                                <span class="rounded bg-red-50 px-2 py-1 text-xs text-red-600">* Required</span>
                            </div>
                            <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <BaseInput size="sm" v-model="formData.startDate" label="Started Datetime" height="h-[35px]" type="datetime-local" />
                                <BaseInput size="sm" v-model="formData.endDate" label="Ended Datetime" height="h-[35px]" type="datetime-local" />
                                <div class="md:col-span-2">
                                    <BaseInput v-model="formData.description" label="Description" placeholder="Description" height="h-[35px]" />
                                </div>
                            </div>
                        </section>

                        <section class="border-t border-gray-200 pt-6">
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <SubTitle label="Target Setup" />
                                <span class="text-xs text-gray-500">Choose one target type per price change</span>
                            </div>
                            <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <div class="flex flex-col gap-y-1">
                                    <BaseLabel label="Price Change Target" :isRequire="true" />
                                    <select v-model="targetType" class="h-[35px] rounded border border-gray-500 p-2 text-sm text-black" @change="onTargetTypeChange">
                                        <option v-for="target in PRICE_CHANGE_TARGETS" :key="target.value" :value="target.value">
                                            {{ target.label }}
                                        </option>
                                    </select>
                                    <BaseErrorLabel v-if="errorMsg.target" :label="errorMsg.target" />
                                </div>

                                <div v-if="branchRequired()" class="flex flex-col gap-y-1">
                                    <BaseLabel label="Branch" :isRequire="true" />
                                    <Select
                                        v-model="selectedBranch"
                                        :options="branchOptions"
                                        showClear
                                        filter
                                        optionLabel="name"
                                        placeholder="Select a branch"
                                        class="h-[35px] items-center"
                                    />
                                    <BaseErrorLabel v-if="errorMsg.branch" :label="errorMsg.branch" />
                                </div>

                                <div class="flex flex-col gap-1">
                                    <BaseLabel label="Quick Change Value" />
                                    <div class="flex gap-x-2">
                                        <select v-model="formData.priceValueType" class="h-[35px] w-[120px] rounded border border-gray-500 p-2 text-sm text-black">
                                            <option value="INCREASE">Increase</option>
                                            <option value="DECREASE">Decrease</option>
                                        </select>
                                        <BaseInput size="sm" v-model="formData.priceChangeValue" height="h-[35px]" type="number" />
                                    </div>
                                    <BaseErrorLabel v-if="errorMsg.priceChangeValue" :label="errorMsg.priceChangeValue" />
                                </div>

                                <div class="flex items-end">
                                    <BaseButton label="Select Products" icon="fa fa-boxes-stacked" class="w-full md:w-fit" @click="openProductDialog" />
                                </div>
                            </div>
                        </section>

                        <section class="border-t border-gray-200 pt-6">
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <SubTitle label="Selected Price Targets" />
                                <span class="text-xs text-gray-500">{{ targetLabel(targetType) }}</span>
                            </div>
                            <BaseErrorLabel v-if="errorMsg.products" :label="errorMsg.products" />

                            <div class="mt-4 overflow-x-auto rounded border border-gray-200">
                                <table class="w-full min-w-[1050px] text-sm">
                                    <thead>
                                        <tr class="bg-gray-100 text-left text-gray-700">
                                            <th class="p-2">Target</th>
                                            <th class="p-2">Branch</th>
                                            <th class="p-2">Product</th>
                                            <th class="p-2">Unit</th>
                                            <th class="p-2">Range</th>
                                            <th class="p-2 text-right">Old Price</th>
                                            <th class="p-2 text-right">New Price</th>
                                            <th class="p-2 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="row in selectedRows" :key="row.rowKey" class="border-t hover:bg-gray-50">
                                            <td class="p-2">{{ targetLabel(row.target_type) }}</td>
                                            <td class="p-2">{{ row.branch_name }}</td>
                                            <td class="p-2">
                                                <div class="font-medium text-black">{{ row.product_name }}</div>
                                                <div class="text-xs text-gray-500">{{ row.product_barcode || '-' }}</div>
                                            </td>
                                            <td class="p-2">{{ row.unit_name }}</td>
                                            <td class="p-2">
                                                <div v-if="isRangeTarget(row.target_type)" class="grid grid-cols-2 gap-2">
                                                    <BaseInput size="sm" v-model="row.min_qty" height="h-[32px]" type="number" />
                                                    <BaseInput size="sm" v-model="row.max_qty" placeholder="No max" height="h-[32px]" type="number" />
                                                </div>
                                                <span v-else>-</span>
                                            </td>
                                            <td class="p-2 text-right">{{ formatPrice(row.old_price) }}</td>
                                            <td class="p-2 text-right">
                                                <input v-model.number="row.new_price" type="number" class="h-[32px] w-28 rounded border px-2 text-right" />
                                            </td>
                                            <td class="p-2 text-center">
                                                <div class="flex justify-center gap-1">
                                                    <button v-if="isRangeTarget(row.target_type)" class="px-2 py-1 text-blue-600 hover:text-blue-800" @click="addCustomRange(row)">
                                                        <i class="fa fa-plus"></i>
                                                    </button>
                                                    <button class="px-2 py-1 text-red-600 hover:text-red-800" @click="removeRow(row.rowKey)">
                                                        <i class="pi pi-trash"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr v-if="!selectedRows.length">
                                            <td colspan="8" class="p-4 text-center text-gray-500">No price targets selected</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>

                    <div class="sticky bottom-0 z-10 mt-8 border-t border-gray-200 bg-white/95 py-4 backdrop-blur">
                        <div class="flex justify-end">
                            <BaseButton
                                label="Update"
                                :isLoading="usePriceChange.loading"
                                :icon="usePriceChange.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'"
                                severity="primary"
                                class="w-full sm:w-auto"
                                :disabled="usePriceChange.loading"
                                @click="formSubmit"
                            />
                        </div>
                    </div>
                </template>
            </BaseCard>
        </div>
    </div>

    <div v-if="isProductDialogVisible" class="fixed inset-0 z-50 flex items-center justify-center text-black">
        <div class="absolute inset-0 bg-black opacity-50" @click="cancelProductSelection"></div>
        <div class="z-10 max-h-[80vh] w-[94%] max-w-5xl overflow-hidden rounded bg-white p-4 shadow-lg">
            <div class="flex items-center justify-between border-b py-4">
                <SubTitle label="Select Products" />
                <div class="text-sm text-gray-600">{{ selectionBuffer.length }} selected</div>
            </div>
            <div class="py-4">
                <input v-model="searchTerm" placeholder="Search by name or barcode" class="h-[35px] w-full rounded border p-2" />
            </div>
            <div class="max-h-[50vh] overflow-auto">
                <table class="w-full min-w-[650px] text-sm">
                    <thead>
                        <tr class="border-b text-left text-gray-600">
                            <th class="py-2"></th>
                            <th class="py-2">Image</th>
                            <th class="py-2">Name</th>
                            <th class="py-2">Barcode</th>
                            <th class="py-2 text-right">Global Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="product in filteredProducts" :key="product.id" class="hover:bg-gray-50">
                            <td class="py-2">
                                <input type="checkbox" :checked="isBufferSelected(product)" @change="toggleProductInBuffer(product)" />
                            </td>
                            <td class="py-2"><img class="h-10 w-10 rounded object-cover" :src="product.image_url" /></td>
                            <td class="py-2">{{ product.name }}</td>
                            <td class="py-2">{{ product.barcode || '-' }}</td>
                            <td class="py-2 text-right">{{ formatPrice(product.price) }}</td>
                        </tr>
                        <tr v-if="!filteredProducts.length">
                            <td colspan="5" class="py-4 text-center text-gray-500">No products found</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="flex justify-end gap-x-2 border-t py-4">
                <BaseButton severity="secondary" label="Cancel" @click="cancelProductSelection" />
                <BaseButton label="Add Targets" @click="confirmProductSelection" />
            </div>
        </div>
    </div>
</template>
