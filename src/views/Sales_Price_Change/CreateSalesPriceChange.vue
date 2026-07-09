<script setup>
import { useRouter } from 'vue-router';
import { computed, onMounted, ref, watch } from 'vue';
import moment from 'moment';
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
    buildAllTargetRows,
    formatRange,
    isRangeTarget,
    payloadForTargetRow,
    targetLabel,
    toNumber,
} from '@/utils/priceChangeTargets';

const router = useRouter();
const toast = useToast();
const usePriceChange = usePriceChangeStore();
const useProduct = useProductStore();
const useBranch = useBranchStore();

const userData = ref({});
const formData = ref({
    description: '',
    type: 'sale',
    startDate: moment().format('YYYY-MM-DDTHH:mm'),
    endDate: '',
    priceValueType: 'INCREASE',
    priceChangeValue: '',
});
const selectedRows = ref([]);
const productList = ref([]);
const searchTerm = ref('');
const selectionBuffer = ref([]);
const isProductDialogVisible = ref(false);
const changedOnly = ref(false);
const expandedProductIds = ref([]);
const rangeModal = ref({
    visible: false,
    title: '',
    rows: [],
});
const errorMsg = ref({
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
});

const branchOptions = computed(() => useBranch.branchList || []);

const changedRows = computed(() => selectedRows.value.filter((row) => Number(row.new_price) !== Number(row.old_price)));

const selectedProductCount = computed(() => new Set(selectedRows.value.map((row) => Number(row.product_id))).size);

const productGroups = computed(() => {
    const groupMap = new Map();
    selectedRows.value.forEach((row) => {
        if (!groupMap.has(row.product_id)) {
            groupMap.set(row.product_id, {
                product_id: row.product_id,
                product_name: row.product_name,
                product_barcode: row.product_barcode,
                image_url: row.image_url,
                rows: [],
            });
        }
        groupMap.get(row.product_id).rows.push(row);
    });

    return [...groupMap.values()].map((group) => {
        const visibleRows = changedOnly.value ? group.rows.filter(isChangedRow) : group.rows;
        const nonRangeRows = visibleRows.filter((row) => !isRangeTarget(row.target_type));
        const rangeRows = visibleRows.filter((row) => isRangeTarget(row.target_type));
        const branchMap = new Map();

        nonRangeRows.filter((row) => row.branch_id).forEach((row) => {
            if (!branchMap.has(row.branch_id)) {
                branchMap.set(row.branch_id, {
                    branch_id: row.branch_id,
                    branch_name: row.branch_name,
                    rows: [],
                });
            }
            branchMap.get(row.branch_id).rows.push(row);
        });

        return {
            ...group,
            visibleRows,
            globalRows: nonRangeRows.filter((row) => !row.branch_id),
            branchGroups: [...branchMap.values()],
            rangeGroups: groupRangeRows(rangeRows),
            changedCount: group.rows.filter(isChangedRow).length,
            totalCount: group.rows.length,
        };
    }).filter((group) => group.visibleRows.length);
});

const filteredProducts = computed(() => {
    const q = (searchTerm.value || '').toString().trim().toLowerCase();
    if (!q) return productList.value || [];
    return (productList.value || []).filter((product) => (
        (product.name || '').toString().toLowerCase().includes(q)
        || (product.barcode || '').toString().toLowerCase().includes(q)
    ));
});

function openProductDialog() {
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
    const rows = selectionBuffer.value.flatMap((product) => buildAllTargetRows(product, branchOptions.value));
    const selectedProductIds = new Set(selectionBuffer.value.map((product) => Number(product.id)));
    const customRows = selectedRows.value.filter((row) => row.is_custom && selectedProductIds.has(Number(row.product_id)));

    selectedRows.value = rows.map((row) => {
        const existing = existingByKey.get(row.rowKey);
        return existing ? { ...row, new_price: existing.new_price, min_qty: existing.min_qty, max_qty: existing.max_qty } : row;
    }).concat(customRows);
    if (!expandedProductIds.value.length && selectionBuffer.value.length) {
        expandedProductIds.value = [selectionBuffer.value[0].id];
    }
    isProductDialogVisible.value = false;
}

function cancelProductSelection() {
    isProductDialogVisible.value = false;
}

function removeRow(rowKey) {
    selectedRows.value = selectedRows.value.filter((row) => row.rowKey !== rowKey);
    if (rangeModal.value.visible) {
        rangeModal.value.rows = rangeModal.value.rows.filter((row) => row.rowKey !== rowKey);
    }
}

function resetRow(row) {
    row.new_price = row.old_price;
}

function addCustomRange(row) {
    if (!isRangeTarget(row.target_type)) return;
    const newRow = {
        ...row,
        rowKey: `${row.rowKey}:custom:${Date.now()}`,
        is_custom: true,
        product_unit_price_range_id: null,
        branch_product_unit_price_range_id: null,
        min_qty: 0,
        max_qty: null,
        old_price: row.old_price,
        new_price: row.new_price,
    };
    selectedRows.value.push(newRow);
    if (rangeModal.value.visible) {
        rangeModal.value.rows.push(newRow);
    }
}

function formatPrice(value) {
    return Number(value || 0).toLocaleString('en-us');
}

function isChangedRow(row) {
    return Number(row.new_price) !== Number(row.old_price);
}

function toggleProduct(productId) {
    const id = Number(productId);
    if (expandedProductIds.value.some((item) => Number(item) === id)) {
        expandedProductIds.value = expandedProductIds.value.filter((item) => Number(item) !== id);
        return;
    }
    expandedProductIds.value = [...expandedProductIds.value, id];
}

function isProductExpanded(productId) {
    return expandedProductIds.value.some((item) => Number(item) === Number(productId));
}

function rangeGroupKey(row) {
    return [
        row.target_type,
        row.branch_id || 0,
        row.product_id,
        row.product_unit_id || 0,
        row.branch_product_unit_price_id || 0,
    ].join(':');
}

function groupRangeRows(rows) {
    const groupMap = new Map();
    rows.forEach((row) => {
        const key = rangeGroupKey(row);
        if (!groupMap.has(key)) {
            groupMap.set(key, {
                key,
                target_type: row.target_type,
                product_name: row.product_name,
                branch_name: row.branch_name,
                unit_name: row.unit_name,
                rows: [],
            });
        }
        groupMap.get(key).rows.push(row);
    });

    return [...groupMap.values()].map((group) => ({
        ...group,
        changedCount: group.rows.filter(isChangedRow).length,
        rangeCount: group.rows.length,
    }));
}

function openRangeModal(group) {
    rangeModal.value = {
        visible: true,
        title: `${targetLabel(group.target_type)} / ${group.branch_name} / ${group.unit_name}`,
        rows: group.rows,
    };
}

function closeRangeModal() {
    rangeModal.value = {
        visible: false,
        title: '',
        rows: [],
    };
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

function validateForm() {
    errorMsg.value = { products: '', priceChangeValue: '' };

    if (!selectedRows.value.length) {
        errorMsg.value.products = errMsgList.product;
        return false;
    }
    if (!changedRows.value.length) {
        errorMsg.value.priceChangeValue = 'Please change at least one new price before saving.';
        return false;
    }

    const invalidRange = changedRows.value.some((row) => (
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
        created_by: userData.value.id,
        products: changedRows.value.map(payloadForTargetRow),
    };

    await usePriceChange.addPriceChange(payload);

    if (usePriceChange.error.length) {
        usePriceChange.error.forEach((msg) => {
            toast.add({ severity: 'error', summary: 'Error Message', detail: msg, life: 3000 });
        });
        return;
    }

    toast.add({ severity: 'success', summary: 'Success Message', detail: 'Create sales price change successfully.', life: 3000 });
    router.push('/sales_price_change');
}
</script>

<template>
    <div class="p-3 sm:p-4 lg:p-6">
        <div class="mx-auto w-full max-w-screen-2xl">
            <PageTitle title="Create Sales Price Change">
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
                                <SubTitle label="Product Price Setup" />
                                <span class="text-xs text-gray-500">Select products to show all global and branch price rows</span>
                            </div>
                            <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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

                                <div class="rounded border border-gray-200 bg-gray-50 p-3">
                                    <div class="text-xs text-gray-500">Selected Products</div>
                                    <div class="mt-1 text-lg font-semibold text-black">{{ selectedProductCount }}</div>
                                </div>

                                <div class="rounded border border-gray-200 bg-gray-50 p-3">
                                    <div class="text-xs text-gray-500">Changed Price Rows</div>
                                    <div class="mt-1 text-lg font-semibold text-black">{{ changedRows.length }}</div>
                                </div>
                            </div>
                        </section>

                        <section class="border-t border-gray-200 pt-6">
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <SubTitle label="Selected Product Price List" />
                                <div class="flex items-center gap-3">
                                    <label class="flex items-center gap-2 text-sm text-gray-700">
                                        <input v-model="changedOnly" type="checkbox" class="h-4 w-4" />
                                        Show changed only
                                    </label>
                                    <span class="text-xs text-gray-500">Only changed rows will be saved</span>
                                </div>
                            </div>
                            <BaseErrorLabel v-if="errorMsg.products" :label="errorMsg.products" />

                            <div class="mt-4 space-y-3">
                                <div v-for="group in productGroups" :key="group.product_id" class="overflow-hidden rounded border border-gray-200 bg-white">
                                    <button
                                        class="flex w-full flex-col gap-3 bg-gray-50 p-3 text-left sm:flex-row sm:items-center sm:justify-between"
                                        @click="toggleProduct(group.product_id)"
                                    >
                                        <div class="flex min-w-0 items-center gap-3">
                                            <img class="h-12 w-12 rounded object-cover" :src="group.image_url" />
                                            <div class="min-w-0">
                                                <div class="truncate font-semibold text-black">{{ group.product_name }}</div>
                                                <div class="text-xs text-gray-500">{{ group.product_barcode || '-' }}</div>
                                            </div>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                            <span class="rounded bg-white px-2 py-1">{{ group.totalCount }} price rows</span>
                                            <span class="rounded bg-blue-50 px-2 py-1 text-blue-700">{{ group.changedCount }} changed</span>
                                            <i :class="isProductExpanded(group.product_id) ? 'fa fa-chevron-up' : 'fa fa-chevron-down'"></i>
                                        </div>
                                    </button>

                                    <div v-if="isProductExpanded(group.product_id)" class="space-y-5 p-4">
                                        <div v-if="group.globalRows.length" class="space-y-2">
                                            <div class="text-sm font-semibold text-gray-800">Global Prices</div>
                                            <div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
                                                <div v-for="row in group.globalRows" :key="row.rowKey" class="rounded border border-gray-200 p-3">
                                                    <div class="flex items-start justify-between gap-2">
                                                        <div>
                                                            <div class="font-medium text-black">{{ targetLabel(row.target_type) }}</div>
                                                            <div class="text-xs text-gray-500">{{ row.unit_name }}</div>
                                                        </div>
                                                        <span class="rounded px-2 py-1 text-xs" :class="isChangedRow(row) ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'">
                                                            {{ row.old_price_source || '-' }}
                                                        </span>
                                                    </div>
                                                    <div class="mt-3 grid grid-cols-2 gap-2">
                                                        <div>
                                                            <div class="text-xs text-gray-500">Old Price</div>
                                                            <div class="font-semibold text-gray-800">{{ formatPrice(row.old_price) }}</div>
                                                        </div>
                                                        <div>
                                                            <div class="text-xs text-gray-500">New Price</div>
                                                            <input v-model.number="row.new_price" type="number" class="mt-1 h-[32px] w-full rounded border px-2 text-right" />
                                                        </div>
                                                    </div>
                                                    <div class="mt-2 flex justify-end">
                                                        <button class="px-2 py-1 text-gray-600 hover:text-gray-800" @click="resetRow(row)">
                                                            <i class="fa fa-rotate-left"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div v-if="group.branchGroups.length" class="space-y-3">
                                            <div class="text-sm font-semibold text-gray-800">Branch Prices</div>
                                            <div v-for="branchGroup in group.branchGroups" :key="branchGroup.branch_id" class="rounded border border-gray-200">
                                                <div class="border-b border-gray-200 bg-gray-50 px-3 py-2 font-medium text-black">{{ branchGroup.branch_name }}</div>
                                                <div class="grid grid-cols-1 gap-2 p-3 lg:grid-cols-2">
                                                    <div v-for="row in branchGroup.rows" :key="row.rowKey" class="rounded border border-gray-200 p-3">
                                                        <div class="flex items-start justify-between gap-2">
                                                            <div>
                                                                <div class="font-medium text-black">{{ targetLabel(row.target_type) }}</div>
                                                                <div class="text-xs text-gray-500">{{ row.unit_name }}</div>
                                                            </div>
                                                            <span class="rounded px-2 py-1 text-xs" :class="isChangedRow(row) ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'">
                                                                {{ row.old_price_source || '-' }}
                                                            </span>
                                                        </div>
                                                        <div class="mt-3 grid grid-cols-2 gap-2">
                                                            <div>
                                                                <div class="text-xs text-gray-500">Old Price</div>
                                                                <div class="font-semibold text-gray-800">{{ formatPrice(row.old_price) }}</div>
                                                            </div>
                                                            <div>
                                                                <div class="text-xs text-gray-500">New Price</div>
                                                                <input v-model.number="row.new_price" type="number" class="mt-1 h-[32px] w-full rounded border px-2 text-right" />
                                                            </div>
                                                        </div>
                                                        <div class="mt-2 flex justify-end">
                                                            <button class="px-2 py-1 text-gray-600 hover:text-gray-800" @click="resetRow(row)">
                                                                <i class="fa fa-rotate-left"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div v-if="group.rangeGroups.length" class="space-y-2">
                                            <div class="text-sm font-semibold text-gray-800">Range Prices</div>
                                            <div class="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
                                                <div v-for="rangeGroup in group.rangeGroups" :key="rangeGroup.key" class="rounded border border-gray-200 p-3">
                                                    <div class="font-medium text-black">{{ targetLabel(rangeGroup.target_type) }}</div>
                                                    <div class="mt-1 text-xs text-gray-500">{{ rangeGroup.branch_name }} / {{ rangeGroup.unit_name }}</div>
                                                    <div class="mt-3 flex items-center justify-between text-sm">
                                                        <span>{{ rangeGroup.rangeCount }} ranges</span>
                                                        <span class="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">{{ rangeGroup.changedCount }} changed</span>
                                                    </div>
                                                    <BaseButton label="Manage Ranges" icon="fa fa-sliders" severity="secondary" class="mt-3 w-full" @click="openRangeModal(rangeGroup)" />
                                                </div>
                                            </div>
                                        </div>

                                        <div v-if="!group.globalRows.length && !group.branchGroups.length && !group.rangeGroups.length" class="rounded border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                                            No visible price rows for this product
                                        </div>
                                    </div>
                                </div>

                                <div v-if="!productGroups.length" class="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                                    No products selected
                                </div>
                            </div>
                        </section>
                    </div>

                    <div class="sticky bottom-0 z-10 mt-8 border-t border-gray-200 bg-white/95 py-4 backdrop-blur">
                        <div class="flex justify-end">
                            <BaseButton
                                label="Save"
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

    <div v-if="rangeModal.visible" class="fixed inset-0 z-50 flex items-center justify-center text-black">
        <div class="absolute inset-0 bg-black opacity-50" @click="closeRangeModal"></div>
        <div class="z-10 max-h-[86vh] w-[94%] max-w-5xl overflow-hidden rounded bg-white p-4 shadow-lg">
            <div class="flex flex-col gap-2 border-b py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <SubTitle label="Manage Range Prices" />
                    <div class="mt-1 text-sm text-gray-500">{{ rangeModal.title }}</div>
                </div>
                <BaseButton severity="secondary" label="Close" icon="fa fa-xmark" @click="closeRangeModal" />
            </div>

            <div class="max-h-[58vh] overflow-auto py-4">
                <table class="w-full min-w-[900px] text-sm">
                    <thead>
                        <tr class="border-b bg-gray-50 text-left text-gray-700">
                            <th class="p-2">Range</th>
                            <th class="p-2">Min Qty</th>
                            <th class="p-2">Max Qty</th>
                            <th class="p-2 text-right">Old Price</th>
                            <th class="p-2">Old Price Source</th>
                            <th class="p-2 text-right">New Price</th>
                            <th class="p-2 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in rangeModal.rows" :key="row.rowKey" class="border-b hover:bg-gray-50">
                            <td class="p-2">{{ formatRange(row) }}</td>
                            <td class="p-2">
                                <input v-model.number="row.min_qty" type="number" class="h-[32px] w-24 rounded border px-2 text-right" />
                            </td>
                            <td class="p-2">
                                <input v-model.number="row.max_qty" type="number" class="h-[32px] w-24 rounded border px-2 text-right" placeholder="No max" />
                            </td>
                            <td class="p-2 text-right">{{ formatPrice(row.old_price) }}</td>
                            <td class="p-2">
                                <span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">{{ row.old_price_source || '-' }}</span>
                            </td>
                            <td class="p-2 text-right">
                                <input v-model.number="row.new_price" type="number" class="h-[32px] w-28 rounded border px-2 text-right" />
                            </td>
                            <td class="p-2 text-center">
                                <div class="flex justify-center gap-1">
                                    <button class="px-2 py-1 text-gray-600 hover:text-gray-800" @click="resetRow(row)">
                                        <i class="fa fa-rotate-left"></i>
                                    </button>
                                    <button v-if="row.is_custom" class="px-2 py-1 text-red-600 hover:text-red-800" @click="removeRow(row.rowKey)">
                                        <i class="pi pi-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="flex justify-between gap-x-2 border-t py-4">
                <BaseButton
                    v-if="rangeModal.rows.length"
                    severity="secondary"
                    label="Add Range"
                    icon="fa fa-plus"
                    @click="addCustomRange(rangeModal.rows[0])"
                />
                <BaseButton label="Done" @click="closeRangeModal" />
            </div>
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
                <BaseButton label="Show Price List" @click="confirmProductSelection" />
            </div>
        </div>
    </div>
</template>
