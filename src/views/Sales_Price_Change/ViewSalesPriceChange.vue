<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import moment from 'moment';
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseInput from '@/components/BaseInput.vue';
import Loading from '@/components/Loading.vue';
import EndSalesPriceChangeDialog from '@/components/EndSalesPriceChangeDialog.vue';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { usePriceChangeStore } from '@/stores/usePriceChangeStore';
import {
    formatRange,
    isRangeTarget,
    rowFromPriceChangeItem,
    targetLabel,
} from '@/utils/priceChangeTargets';

const PRICE_TABS = [
    { value: 'GLOBAL', label: 'Global' },
    { value: 'BRANCH', label: 'Branch' },
    { value: 'RANGE', label: 'Ranges' },
];

const router = useRouter();
const route = useRoute();
const usePermission = usePermissionStore();
const usePriceChange = usePriceChangeStore();

const isReady = ref(false);
const loadError = ref('');
const selectedProducts = ref([]);
const searchTerm = ref('');
const expandedProductIds = ref([]);
const activeProductTabs = ref({});
const endDialogVisible = ref(false);
const priceChangeRecord = ref(null);
const formData = ref({
    id: '',
    description: '',
    type: '',
    startDate: '',
    endDate: '',
    status: '',
    createdBy: '-',
    createdAt: '',
    updatedBy: '-',
    updatedAt: '',
    effectiveState: '',
    canEnd: false,
    endedAt: '',
    endedBy: '-',
    endReason: '',
});

const numberFormatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
});

const productGroups = computed(() => {
    const groups = new Map();

    selectedProducts.value.forEach((row) => {
        const productId = row.product_id || row.product_name;
        if (!groups.has(productId)) {
            groups.set(productId, {
                product_id: productId,
                product_name: row.product_name,
                product_barcode: row.product_barcode,
                image_url: row.image_url,
                rows: [],
            });
        }
        groups.get(productId).rows.push(row);
    });

    return [...groups.values()];
});

const filteredProductGroups = computed(() => {
    const query = searchTerm.value.trim().toLowerCase();
    if (!query) {
        return productGroups.value.map((group) => ({ ...group, visibleRows: group.rows }));
    }

    return productGroups.value.map((group) => {
        const productMatches = [group.product_name, group.product_barcode]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query);
        const visibleRows = productMatches
            ? group.rows
            : group.rows.filter((row) => rowSearchText(row).includes(query));

        return { ...group, visibleRows };
    }).filter((group) => group.visibleRows.length);
});

const changedRows = computed(() => selectedProducts.value.filter(isChangedRow));
const branchCount = computed(() => new Set(
    selectedProducts.value.map((row) => row.branch_id).filter(Boolean)
).size);
const canEdit = computed(() => (
    usePermission.can('Sales price change', 'Update')
    && !['Applied', 'Ended'].includes(formData.value.status)
    && !['ongoing', 'ending_scheduled', 'ended'].includes(formData.value.effectiveState)
));
const canEnd = computed(() => (
    usePermission.can('Sales price change', 'End')
    && formData.value.canEnd === true
));
const effectiveStateLabel = computed(() => {
    const label = {
        scheduled: 'Scheduled',
        ongoing: 'Ongoing',
        ending_scheduled: 'End scheduled',
        ended: 'Ended',
    }[formData.value.effectiveState] || '';
    return label.toLowerCase() === formData.value.status.toLowerCase() ? '' : label;
});
const statusClasses = computed(() => {
    if (formData.value.status === 'Active') return 'bg-green-50 text-green-700 ring-green-200';
    if (formData.value.status === 'Applied') return 'bg-blue-50 text-blue-700 ring-blue-200';
    if (String(formData.value.status).toLowerCase().includes('void')) return 'bg-red-50 text-red-700 ring-red-200';
    return 'bg-gray-100 text-gray-700 ring-gray-200';
});

watch(searchTerm, (query) => {
    if (!query.trim()) return;
    expandedProductIds.value = filteredProductGroups.value.map((group) => String(group.product_id));
});

function formatPrice(value) {
    return numberFormatter.format(Number(value || 0));
}

function formatDate(value) {
    if (!value) return '-';
    const parsed = moment(value);
    return parsed.isValid() ? parsed.format('DD MMM YYYY, HH:mm') : '-';
}

function rowSearchText(row) {
    return [
        row.product_name,
        row.product_barcode,
        row.branch_name,
        row.unit_name,
        targetLabel(row.target_type),
        formatRange(row),
    ].filter(Boolean).join(' ').toLowerCase();
}

function isChangedRow(row) {
    return Number(row.new_price) !== Number(row.old_price);
}

function priceDelta(row) {
    return Number(row.new_price || 0) - Number(row.old_price || 0);
}

function formatPriceDelta(row) {
    const delta = priceDelta(row);
    if (delta === 0) return 'No change';

    const sign = delta > 0 ? '+' : '-';
    const oldPrice = Number(row.old_price || 0);
    const percentage = oldPrice ? ` (${Math.abs((delta / oldPrice) * 100).toFixed(1)}%)` : '';
    return `${sign}${formatPrice(Math.abs(delta))}${percentage}`;
}

function deltaClasses(row) {
    const delta = priceDelta(row);
    if (delta > 0) return 'bg-green-50 text-green-700';
    if (delta < 0) return 'bg-red-50 text-red-700';
    return 'bg-gray-100 text-gray-600';
}

function rowsForTab(group, tab) {
    const rows = group.visibleRows || group.rows;
    if (tab === 'GLOBAL') return rows.filter((row) => !row.branch_id && !isRangeTarget(row.target_type));
    if (tab === 'BRANCH') return rows.filter((row) => row.branch_id && !isRangeTarget(row.target_type));
    if (tab === 'RANGE') return rows.filter((row) => isRangeTarget(row.target_type));
    return [];
}

function tabCount(group, tab) {
    return rowsForTab(group, tab).length;
}

function activeProductTab(group) {
    const selectedTab = activeProductTabs.value[String(group.product_id)];
    if (selectedTab && tabCount(group, selectedTab)) return selectedTab;
    return PRICE_TABS.find((tab) => tabCount(group, tab.value))?.value || 'GLOBAL';
}

function setProductTab(group, tab) {
    activeProductTabs.value[String(group.product_id)] = tab;
}

function toggleProduct(productId) {
    const id = String(productId);
    expandedProductIds.value = expandedProductIds.value.includes(id)
        ? expandedProductIds.value.filter((item) => item !== id)
        : [...expandedProductIds.value, id];
}

function isProductExpanded(productId) {
    return expandedProductIds.value.includes(String(productId));
}

function expandAll() {
    expandedProductIds.value = filteredProductGroups.value.map((group) => String(group.product_id));
}

function collapseAll() {
    expandedProductIds.value = [];
}

function goBack() {
    if (window.history.length > 1) {
        router.back();
        return;
    }
    router.push('/sales_price_change');
}

function editPriceChange() {
    router.push({ name: 'Update Sales Price Change', query: { id: formData.value.id } });
}

function openEndDialog() {
    if (!canEnd.value) return;
    endDialogVisible.value = true;
}

async function loadPriceChange() {
    const priceChangeId = route.query.id || route.params.id;
    if (!priceChangeId) {
        goBack();
        return;
    }

    isReady.value = false;
    loadError.value = '';
    try {
        await usePriceChange.fetchPriceChange(priceChangeId);
        if (usePriceChange.error.length) {
            loadError.value = usePriceChange.error.join(' ');
            return;
        }

        const priceChange = usePriceChange.priceChangeList;
        if (!priceChange || Array.isArray(priceChange) || !priceChange.id) {
            loadError.value = 'Price change details could not be loaded.';
            return;
        }

        priceChangeRecord.value = priceChange;
        formData.value = {
            id: priceChange.id,
            description: priceChange.description || '',
            type: priceChange.type || '',
            startDate: priceChange.start_at || '',
            endDate: priceChange.end_at || '',
            status: priceChange.status?.name || '',
            createdBy: priceChange.created_by?.name || '-',
            createdAt: priceChange.created_at || '',
            updatedBy: priceChange.updated_by?.name || '-',
            updatedAt: priceChange.updated_at || '',
            effectiveState: priceChange.effective_state || '',
            canEnd: priceChange.can_end === true,
            endedAt: priceChange.ended_at || '',
            endedBy: priceChange.ended_by?.name || '-',
            endReason: priceChange.end_reason || '',
        };

        selectedProducts.value = (priceChange.products || []).map(rowFromPriceChangeItem);
        if (productGroups.value.length) {
            expandedProductIds.value = [String(productGroups.value[0].product_id)];
        }
    } catch {
        loadError.value = 'Price change details could not be loaded.';
    } finally {
        isReady.value = true;
    }
}

async function handlePriceChangeEnded() {
    await loadPriceChange();
}

onMounted(async () => {
    await loadPriceChange();
});
</script>

<template>
    <div class="p-3 sm:p-4 lg:p-6">
        <div class="mx-auto w-full max-w-screen-2xl">
            <PageTitle title="Sales Price Change">
                <template #titleButtons>
                    <div class="view-title-actions flex items-center gap-2">
                        <BaseButton
                            v-if="canEnd"
                            icon="fa fa-circle-stop"
                            label="End price change"
                            variant="outlined"
                            severity="danger"
                            title="End price change"
                            aria-label="End price change"
                            @click="openEndDialog"
                        />
                        <BaseButton
                            v-if="canEdit"
                            icon="fa fa-pen-to-square"
                            label="Edit"
                            variant="outlined"
                            severity="info"
                            title="Edit price change"
                            aria-label="Edit price change"
                            @click="editPriceChange"
                        />
                        <BaseButton
                            icon="fa fa-chevron-left"
                            label="Back"
                            severity="secondary"
                            title="Back"
                            aria-label="Back"
                            @click="goBack"
                        />
                    </div>
                </template>
            </PageTitle>

            <div v-if="!isReady" class="mt-3 rounded border border-gray-200 bg-white p-4 shadow-sm">
                <Loading :skeletonRows="5" />
            </div>

            <div v-else-if="loadError" class="mt-3 rounded border border-red-200 bg-red-50 p-5 text-center">
                <div class="font-medium text-red-700">Unable to load this price change</div>
                <div class="mt-1 text-sm text-red-600">{{ loadError }}</div>
                <BaseButton class="mt-4" label="Back to list" icon="fa fa-chevron-left" severity="secondary" @click="router.push('/sales_price_change')" />
            </div>

            <template v-else>
                <section class="mt-3 rounded border border-gray-200 bg-white p-4 shadow-sm">
                    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <h1 class="text-lg font-semibold text-black">{{ formData.id }}</h1>
                                <span :class="['inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', statusClasses]">
                                    {{ formData.status || '-' }}
                                </span>
                                <span class="rounded bg-gray-100 px-2 py-1 text-xs font-medium uppercase text-gray-600">
                                    {{ formData.type || '-' }}
                                </span>
                                <span v-if="effectiveStateLabel" class="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                                    {{ effectiveStateLabel }}
                                </span>
                            </div>
                            <p class="mt-1 text-sm text-gray-600">{{ formData.description || 'No description' }}</p>
                        </div>

                        <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
                            <span><strong class="text-black">{{ productGroups.length }}</strong> {{ productGroups.length === 1 ? 'product' : 'products' }}</span>
                            <span><strong class="text-black">{{ selectedProducts.length }}</strong> price rows</span>
                            <span><strong class="text-black">{{ changedRows.length }}</strong> changed</span>
                            <span><strong class="text-black">{{ branchCount }}</strong> {{ branchCount === 1 ? 'branch' : 'branches' }}</span>
                        </div>
                    </div>

                    <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-gray-200 pt-4 xl:grid-cols-4">
                        <div>
                            <dt class="text-xs font-medium uppercase text-gray-500">Starts</dt>
                            <dd class="mt-1 text-sm font-medium text-gray-900">{{ formatDate(formData.startDate) }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs font-medium uppercase text-gray-500">Ends</dt>
                            <dd class="mt-1 text-sm font-medium text-gray-900">{{ formData.endDate ? formatDate(formData.endDate) : 'Ongoing' }}</dd>
                            <dd v-if="formData.endDate && formData.endedBy !== '-'" class="text-xs text-gray-500">
                                {{ formData.effectiveState === 'ending_scheduled' ? 'scheduled' : 'ended' }} by {{ formData.endedBy }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-xs font-medium uppercase text-gray-500">Created</dt>
                            <dd class="mt-1 text-sm font-medium text-gray-900">{{ formatDate(formData.createdAt) }}</dd>
                            <dd class="text-xs text-gray-500">by {{ formData.createdBy }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs font-medium uppercase text-gray-500">Last updated</dt>
                            <dd class="mt-1 text-sm font-medium text-gray-900">{{ formatDate(formData.updatedAt) }}</dd>
                            <dd class="text-xs text-gray-500">by {{ formData.updatedBy }}</dd>
                        </div>
                    </dl>
                    <div v-if="formData.endReason" class="mt-4 border-t border-gray-200 pt-3 text-sm">
                        <span class="font-medium text-gray-700">End reason:</span>
                        <span class="ml-1 text-gray-600">{{ formData.endReason }}</span>
                    </div>
                </section>

                <section class="mt-5">
                    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <h2 class="text-lg font-semibold text-black">Changed Prices</h2>
                            <p class="text-xs text-gray-500">Compare old and new prices by product and scope</p>
                        </div>
                        <div class="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(260px,420px)_auto_auto]">
                            <BaseInput
                                v-model="searchTerm"
                                class="col-span-2 sm:col-auto"
                                size="sm"
                                height="h-[38px]"
                                icon="pi pi-search"
                                placeholder="Search product, branch, target, unit..."
                            />
                            <BaseButton label="Expand all" icon="fa fa-angles-down" variant="text" severity="secondary" @click="expandAll" />
                            <BaseButton label="Collapse all" icon="fa fa-angles-up" variant="text" severity="secondary" @click="collapseAll" />
                        </div>
                    </div>

                    <div class="mt-3 space-y-3">
                        <article
                            v-for="group in filteredProductGroups"
                            :key="group.product_id"
                            class="overflow-hidden rounded border border-gray-200 bg-white"
                        >
                            <button
                                type="button"
                                class="flex w-full flex-col gap-3 bg-gray-50 p-3 text-left sm:flex-row sm:items-center sm:justify-between"
                                :aria-expanded="isProductExpanded(group.product_id)"
                                @click="toggleProduct(group.product_id)"
                            >
                                <div class="flex min-w-0 items-center gap-3">
                                    <div class="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-200 text-gray-500">
                                        <i class="fa fa-box"></i>
                                        <img
                                            v-if="group.image_url"
                                            :src="group.image_url"
                                            class="absolute inset-0 h-full w-full bg-gray-200 object-cover"
                                            alt=""
                                            @error="$event.currentTarget.style.display = 'none'"
                                        />
                                    </div>
                                    <div class="min-w-0">
                                        <div class="truncate font-semibold text-black">{{ group.product_name }}</div>
                                        <div class="truncate text-xs text-gray-500">{{ group.product_barcode || 'No barcode' }}</div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-3 text-xs text-gray-600">
                                    <span>{{ group.visibleRows.length }} price rows</span>
                                    <span class="rounded bg-blue-50 px-2 py-1 text-blue-700">
                                        {{ group.visibleRows.filter(isChangedRow).length }} changed
                                    </span>
                                    <i :class="isProductExpanded(group.product_id) ? 'fa fa-chevron-up' : 'fa fa-chevron-down'"></i>
                                </div>
                            </button>

                            <div v-if="isProductExpanded(group.product_id)" class="p-3 sm:p-4">
                                <div class="inline-flex max-w-full overflow-x-auto rounded border border-gray-200 bg-white" role="tablist" aria-label="Price scope">
                                    <button
                                        v-for="tab in PRICE_TABS"
                                        :key="tab.value"
                                        type="button"
                                        role="tab"
                                        :aria-selected="activeProductTab(group) === tab.value"
                                        :disabled="tabCount(group, tab.value) === 0"
                                        class="whitespace-nowrap border-r border-gray-200 px-3 py-2 text-sm last:border-r-0 disabled:cursor-not-allowed disabled:text-gray-300"
                                        :class="activeProductTab(group) === tab.value ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-600 hover:bg-gray-50'"
                                        @click="setProductTab(group, tab.value)"
                                    >
                                        {{ tab.label }}
                                        <span class="ml-1 text-xs">{{ tabCount(group, tab.value) }}</span>
                                    </button>
                                </div>

                                <div class="mt-3 overflow-hidden rounded border border-gray-200">
                                    <div class="hidden grid-cols-[minmax(210px,1.4fr)_minmax(150px,1fr)_110px_110px_140px] gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 sm:grid">
                                        <div>Price Target</div>
                                        <div>Location / Unit</div>
                                        <div class="text-right">Old Price</div>
                                        <div class="text-right">New Price</div>
                                        <div class="text-right">Change</div>
                                    </div>

                                    <div
                                        v-for="row in rowsForTab(group, activeProductTab(group))"
                                        :key="row.rowKey"
                                        class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 border-b border-gray-100 px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(210px,1.4fr)_minmax(150px,1fr)_110px_110px_140px] sm:items-center sm:py-2"
                                    >
                                        <div class="col-start-1 row-start-1 min-w-0 sm:col-auto sm:row-auto">
                                            <div class="text-sm font-medium text-gray-900">{{ targetLabel(row.target_type) }}</div>
                                            <div v-if="isRangeTarget(row.target_type)" class="truncate text-xs text-gray-500 sm:hidden">{{ formatRange(row) }}</div>
                                        </div>
                                        <div class="col-span-2 row-start-2 min-w-0 text-xs text-gray-500 sm:col-auto sm:row-auto">
                                            <div class="truncate text-sm text-gray-700">{{ row.branch_id ? row.branch_name : 'Global' }}</div>
                                            <div class="truncate">{{ row.unit_name || '-' }}<span v-if="isRangeTarget(row.target_type)"> / {{ formatRange(row) }}</span></div>
                                        </div>
                                        <div class="col-start-1 row-start-3 text-left sm:col-auto sm:row-auto sm:text-right">
                                            <div class="text-[11px] text-gray-500 sm:hidden">Old Price</div>
                                            <div class="tabular-nums text-gray-600">{{ formatPrice(row.old_price) }}</div>
                                        </div>
                                        <div class="col-start-2 row-start-3 text-right sm:col-auto sm:row-auto">
                                            <div class="text-[11px] text-gray-500 sm:hidden">New Price</div>
                                            <div class="font-semibold tabular-nums text-gray-900">{{ formatPrice(row.new_price) }}</div>
                                        </div>
                                        <div class="col-start-2 row-start-1 justify-self-end text-right sm:col-auto sm:row-auto">
                                            <span :class="['inline-flex rounded px-2 py-1 text-xs font-medium tabular-nums', deltaClasses(row)]">
                                                {{ formatPriceDelta(row) }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </article>

                        <div v-if="!filteredProductGroups.length" class="rounded border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
                            {{ selectedProducts.length ? 'No price rows match your search.' : 'No changed prices are available.' }}
                        </div>
                    </div>
                </section>
            </template>
        </div>

        <EndSalesPriceChangeDialog
            v-model:visible="endDialogVisible"
            :priceChange="priceChangeRecord"
            @ended="handlePriceChangeEnded"
        />
    </div>
</template>

<style scoped>
@media (max-width: 639px) {
    .view-title-actions :deep(button) {
        padding-left: 10px;
        padding-right: 10px;
    }

    .view-title-actions :deep(button span) {
        display: none;
    }

    .view-title-actions :deep(button i) {
        margin-right: 0;
    }
}
</style>
