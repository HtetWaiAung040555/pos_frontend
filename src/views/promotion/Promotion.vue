<script setup>
import PageTitle from '@/components/PageTitle.vue';
import DataTable from '@/components/DataTable.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseInput from '@/components/BaseInput.vue';
import { useRouter } from 'vue-router';
import { onMounted, ref, computed, watch } from 'vue';
import { useToast } from 'primevue';
import moment from 'moment';
import { useFilterStore } from '@/stores/filterStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { usePromotionStore } from '@/stores/usePromotionStore';
import { getPromotionLifecycleStatusName } from '@/utils/const';

const router = useRouter();
const usePromo = usePromotionStore();
const toast = useToast();
const filter = useFilterStore();
const usePermission = usePermissionStore();

const promoList = ref([]);
const searchValue = ref('');
const typeFilter = ref('');
const statusFilter = ref('');
const startDate = ref('');
const endDate = ref('');
const showDateFilters = ref(false);

const promotionTypes = {
    PRODUCT_DISCOUNT: 'Product discount',
    ORDER_DISCOUNT: 'Order discount',
    FOC: 'Free item (FOC)',
    PRICE_OVERRIDE: 'Price override',
};

const lifecycleLabels = {
    Applied: 'Ongoing',
    Active: 'Upcoming',
    Inactive: 'Ended',
};

onMounted(async () => {
    const saved = filter.getPageFilter('promotion-list');
    if (saved) {
        searchValue.value = saved.searchValue || '';
        typeFilter.value = saved.typeFilter || '';
        statusFilter.value = saved.statusFilter || '';
        startDate.value = saved.startDate || '';
        endDate.value = saved.endDate || '';
        showDateFilters.value = !!(startDate.value || endDate.value);
    }

    await loadPromotions();
    saveFilters();
});

watch([searchValue, typeFilter, statusFilter, startDate, endDate], saveFilters);

async function loadPromotions() {
    await usePromo.fetchAllPromo();
    promoList.value = Array.isArray(usePromo.promoList) ? usePromo.promoList : [];
}

function saveFilters() {
    filter.setPageFilter('promotion-list', {
        searchValue: searchValue.value,
        typeFilter: typeFilter.value,
        statusFilter: statusFilter.value,
        startDate: startDate.value,
        endDate: endDate.value,
    });
}

function promotionStatusName(row) {
    return getPromotionLifecycleStatusName(row.start_at, row.end_at);
}

function promotionTypeLabel(type) {
    return promotionTypes[type] || String(type || '-').replaceAll('_', ' ');
}

function promotionTypeBadge(row) {
    const styles = {
        PRODUCT_DISCOUNT: 'bg-orange-50 text-orange-700 ring-orange-200',
        ORDER_DISCOUNT: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
        FOC: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
        PRICE_OVERRIDE: 'bg-violet-50 text-violet-700 ring-violet-200',
    };
    const classes = styles[row.promo_type] || 'bg-gray-100 text-gray-700 ring-gray-200';
    return `<span class="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${classes}">${promotionTypeLabel(row.promo_type)}</span>`;
}

function promotionStatusBadge(row) {
    const status = promotionStatusName(row);
    const styles = {
        Applied: 'bg-green-50 text-green-700 ring-green-200',
        Active: 'bg-blue-50 text-blue-700 ring-blue-200',
        Inactive: 'bg-gray-100 text-gray-600 ring-gray-200',
    };
    const classes = styles[status] || 'bg-gray-100 text-gray-600 ring-gray-200';
    return `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${classes}">${lifecycleLabels[status] || status}</span>`;
}

function promotionUnitScope(row) {
    const products = Array.isArray(row.products) ? row.products : [];
    if (products.length === 0) return '-';

    const unitScoped = products.filter(product => product.promotion_product_unit_id).length;
    if (unitScoped === 0) return 'All product units';
    if (unitScoped === products.length) return `${unitScoped} unit-specific`;
    return `${unitScoped} unit-specific / ${products.length - unitScoped} all-units`;
}

function promotionQuantityLimits(row) {
    if (row.promo_type !== 'PRICE_OVERRIDE') return '';

    const products = Array.isArray(row.products) ? row.products : [];
    if (products.length === 0) return '';

    const unlimitedCount = products.filter(product => product.max_qty_per_sales_order == null).length;
    const limitedCount = products.length - unlimitedCount;

    if (limitedCount === 0) return 'Unlimited per order';
    if (unlimitedCount === 0) return `${limitedCount} quantity-limited`;
    return `${limitedCount} limited / ${unlimitedCount} unlimited`;
}

function promotionScope(row) {
    const productCount = Array.isArray(row.products) ? row.products.length : 0;
    if (productCount > 0) return `${productCount} ${productCount === 1 ? 'product' : 'products'}`;
    if (row.promo_type === 'ORDER_DISCOUNT') return 'Order-wide';
    if (row.promo_type === 'FOC') return 'Tier rewards';
    return 'No products';
}

function promotionScopeDetail(row) {
    return [promotionUnitScope(row), promotionQuantityLimits(row)].filter(value => value && value !== '-').join(' · ') || 'No unit restriction';
}

function formatDate(value) {
    return value ? moment(value).format('DD MMM YY, HH:mm') : '-';
}

function scheduleDetail(row) {
    return row.end_at ? `Ends ${formatDate(row.end_at)}` : 'No end date';
}

const columns = [
    {
        key: 'name',
        label: 'Promotion',
        align: 'left',
        class: 'promotion-primary min-w-[220px] max-w-[360px]',
        contentClass: 'min-w-0',
        formatter: (row) => row.name || `Promotion #${row.id}`,
        secondaryFormatter: (row) => `#${row.id} · ${row.created_by?.name || 'Unknown creator'}`,
        secondaryClass: 'mt-0.5 block truncate text-xs text-gray-500',
        onClick: (row) => router.push({ name: 'View Promotion', query: { id: row.id } }),
    },
    {
        key: 'promo_type',
        label: 'Type',
        class: 'hidden min-w-[150px] md:table-cell',
        formatter: promotionTypeBadge,
    },
    {
        key: 'products',
        label: 'Scope',
        align: 'left',
        class: 'hidden min-w-[190px] lg:table-cell',
        formatter: promotionScope,
        secondaryFormatter: promotionScopeDetail,
    },
    {
        key: 'start_at',
        label: 'Schedule',
        align: 'left',
        class: 'hidden min-w-[180px] xl:table-cell',
        formatter: (row) => formatDate(row.start_at),
        secondaryFormatter: scheduleDetail,
    },
    {
        key: 'status',
        label: 'Status',
        class: 'promotion-status min-w-[100px]',
        formatter: promotionStatusBadge,
    },
];

const typeOptions = computed(() => (
    [...new Set(promoList.value.map(row => row.promo_type).filter(Boolean))]
        .sort((a, b) => promotionTypeLabel(a).localeCompare(promotionTypeLabel(b)))
));

const promotionStats = computed(() => {
    const stats = { total: promoList.value.length, Applied: 0, Active: 0, Inactive: 0 };
    promoList.value.forEach((row) => {
        const status = promotionStatusName(row);
        if (Object.prototype.hasOwnProperty.call(stats, status)) stats[status] += 1;
    });
    return stats;
});

const hasActiveFilters = computed(() => (
    !!searchValue.value || !!typeFilter.value || !!statusFilter.value || !!startDate.value || !!endDate.value
));

const filteredRows = computed(() => {
    const query = searchValue.value.trim().toLowerCase();
    const searchedData = promoList.value.filter((row) => {
        const searchText = [
            row.id,
            row.name,
            promotionTypeLabel(row.promo_type),
            promotionStatusName(row),
            lifecycleLabels[promotionStatusName(row)],
            row.created_by?.name,
            ...(row.products || []).flatMap(product => [
                product.name,
                product.barcode,
                product.product?.name,
                product.product?.barcode,
            ]),
        ].filter(Boolean).join(' ').toLowerCase();

        const matchesSearch = !query || searchText.includes(query);
        const matchesType = !typeFilter.value || row.promo_type === typeFilter.value;
        const matchesStatus = !statusFilter.value || promotionStatusName(row) === statusFilter.value;
        return matchesSearch && matchesType && matchesStatus;
    });

    return filter.dateRangeFilter(searchedData, {
        dateField: 'start_at',
        startDate: startDate.value,
        endDate: endDate.value,
    });
});

function setStatusFilter(status) {
    statusFilter.value = statusFilter.value === status ? '' : status;
}

function clearFilters() {
    searchValue.value = '';
    typeFilter.value = '';
    statusFilter.value = '';
    startDate.value = '';
    endDate.value = '';
    showDateFilters.value = false;
}

function changeRoute(pathname) {
    router.push(pathname);
}

async function deleteHandle(id) {
    await usePromo.deletePromo({ void_by: JSON.parse(localStorage.getItem('user')).id }, id);
    if (usePromo.error.length) {
        usePromo.error.forEach((msg) => {
            toast.add({ severity: 'error', summary: 'Error Message', detail: msg, life: 3000 });
        });
        return;
    }

    if (usePromo.data?.status === 200) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Promotion deleted successfully.', life: 3000 });
        await loadPromotions();
    }
}
</script>

<template>
    <div class="p-3 sm:p-4 lg:p-6">
        <div class="mx-auto w-full max-w-screen-2xl">
            <PageTitle title="Promotions">
                <template #titleButtons>
                    <div class="promotion-title-actions flex items-center gap-2">
                        <BaseButton
                            :icon="usePromo.loading ? 'fa fa-spinner' : 'fa fa-rotate-right'"
                            label="Refresh"
                            variant="outlined"
                            severity="secondary"
                            :isLoading="usePromo.loading"
                            :disabled="usePromo.loading"
                            title="Refresh promotions"
                            aria-label="Refresh promotions"
                            @click="loadPromotions"
                        />
                        <BaseButton
                            v-if="usePermission.can('Promotion', 'Create')"
                            icon="fa fa-circle-plus"
                            label="New promotion"
                            severity="primary"
                            title="New promotion"
                            aria-label="New promotion"
                            @click="changeRoute('/promotion/create')"
                        />
                    </div>
                </template>
            </PageTitle>

            <div class="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <button
                    type="button"
                    class="rounded-xl border bg-white p-3 text-left shadow-sm transition hover:border-blue-300 hover:shadow"
                    :class="!statusFilter ? 'border-blue-400 ring-1 ring-blue-400' : 'border-slate-200'"
                    @click="statusFilter = ''"
                >
                    <span class="text-xs font-medium text-slate-500">Total promotions</span>
                    <span class="mt-1 flex items-end justify-between"><strong class="text-xl text-slate-900">{{ promotionStats.total }}</strong><i class="fa fa-tags text-slate-300"></i></span>
                </button>
                <button
                    type="button"
                    class="rounded-xl border bg-white p-3 text-left shadow-sm transition hover:border-green-300 hover:shadow"
                    :class="statusFilter === 'Applied' ? 'border-green-400 ring-1 ring-green-400' : 'border-slate-200'"
                    @click="setStatusFilter('Applied')"
                >
                    <span class="text-xs font-medium text-slate-500">Ongoing</span>
                    <span class="mt-1 flex items-end justify-between"><strong class="text-xl text-green-700">{{ promotionStats.Applied }}</strong><i class="fa fa-circle-play text-green-200"></i></span>
                </button>
                <button
                    type="button"
                    class="rounded-xl border bg-white p-3 text-left shadow-sm transition hover:border-blue-300 hover:shadow"
                    :class="statusFilter === 'Active' ? 'border-blue-400 ring-1 ring-blue-400' : 'border-slate-200'"
                    @click="setStatusFilter('Active')"
                >
                    <span class="text-xs font-medium text-slate-500">Upcoming</span>
                    <span class="mt-1 flex items-end justify-between"><strong class="text-xl text-blue-700">{{ promotionStats.Active }}</strong><i class="fa fa-clock text-blue-200"></i></span>
                </button>
                <button
                    type="button"
                    class="rounded-xl border bg-white p-3 text-left shadow-sm transition hover:border-slate-400 hover:shadow"
                    :class="statusFilter === 'Inactive' ? 'border-slate-500 ring-1 ring-slate-400' : 'border-slate-200'"
                    @click="setStatusFilter('Inactive')"
                >
                    <span class="text-xs font-medium text-slate-500">Ended</span>
                    <span class="mt-1 flex items-end justify-between"><strong class="text-xl text-slate-700">{{ promotionStats.Inactive }}</strong><i class="fa fa-circle-stop text-slate-300"></i></span>
                </button>
            </div>

            <div class="promotion-list">
                <DataTable
                    :columns="columns"
                    :rows="filteredRows"
                    :pageSize="50"
                    :isPaginate="true"
                    :editPath="'Update Promotion'"
                    :isLoading="usePromo.loading"
                    @delete="deleteHandle"
                    :defaultSort="{ key: 'id', order: 'desc' }"
                    :isEdit="(row) => !usePermission.can('Promotion', 'Update') || promotionStatusName(row) === 'Inactive'"
                    :isDelete="() => !usePermission.can('Promotion', 'Delete')"
                    filename="Promotion"
                >
                    <template #filters>
                        <div class="flex min-w-0 flex-col gap-3">
                            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_180px_160px_auto_auto]">
                                <BaseInput
                                    v-model="searchValue"
                                    size="sm"
                                    placeholder="Search name, ID, product or creator..."
                                    height="h-[40px]"
                                    icon="pi pi-search"
                                />

                                <select v-model="typeFilter" class="h-[40px] min-w-0 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-900">
                                    <option value="">All promotion types</option>
                                    <option v-for="type in typeOptions" :key="type" :value="type">{{ promotionTypeLabel(type) }}</option>
                                </select>

                                <select v-model="statusFilter" class="h-[40px] min-w-0 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-900">
                                    <option value="">All statuses</option>
                                    <option value="Applied">Ongoing</option>
                                    <option value="Active">Upcoming</option>
                                    <option value="Inactive">Ended</option>
                                </select>

                                <BaseButton
                                    :label="showDateFilters ? 'Hide dates' : 'Start dates'"
                                    icon="fa fa-calendar-days"
                                    variant="outlined"
                                    severity="secondary"
                                    class="h-[40px] whitespace-nowrap"
                                    @click="showDateFilters = !showDateFilters"
                                />

                                <BaseButton
                                    v-if="hasActiveFilters"
                                    label="Clear"
                                    icon="fa fa-xmark"
                                    variant="text"
                                    severity="secondary"
                                    class="h-[40px]"
                                    @click="clearFilters"
                                />
                            </div>

                            <div v-if="showDateFilters" class="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-end">
                                <div class="w-full sm:w-[210px]">
                                    <label class="mb-1 block text-xs font-medium text-gray-600">Starts from</label>
                                    <BaseInput v-model="startDate" size="sm" type="date" height="h-[38px]" :max="endDate || undefined" />
                                </div>
                                <div class="w-full sm:w-[210px]">
                                    <label class="mb-1 block text-xs font-medium text-gray-600">Starts to</label>
                                    <BaseInput v-model="endDate" size="sm" type="date" height="h-[38px]" :min="startDate || undefined" />
                                </div>
                            </div>

                            <div class="flex items-center gap-1.5 text-xs text-gray-500">
                                <span v-if="usePromo.loading">Loading promotions...</span>
                                <template v-else>
                                    <span class="font-medium text-gray-700">{{ filteredRows.length.toLocaleString('en-US') }}</span>
                                    <span>{{ filteredRows.length === 1 ? 'promotion' : 'promotions' }}</span>
                                    <span v-if="hasActiveFilters">of {{ promoList.length.toLocaleString('en-US') }}</span>
                                </template>
                            </div>
                        </div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>
</template>

<style scoped>
@media (min-width: 640px) {
    .promotion-list :deep(table) {
        min-width: 920px;
        width: 100%;
    }
}

@media (max-width: 639px) {
    .promotion-title-actions :deep(button) {
        padding-left: 10px;
        padding-right: 10px;
    }

    .promotion-title-actions :deep(button span) {
        display: none;
    }

    .promotion-title-actions :deep(button i) {
        margin-right: 0;
    }

    .promotion-list :deep(.data-table-scroll) {
        overflow-x: hidden;
    }

    .promotion-list :deep(table),
    .promotion-list :deep(tbody) {
        display: block;
        min-width: 0;
        width: 100%;
    }

    .promotion-list :deep(thead) {
        display: none;
    }

    .promotion-list :deep(tbody tr) {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 5px 8px;
        border-bottom: 1px solid #e5e7eb;
        padding: 11px 0;
    }

    .promotion-list :deep(tbody tr:last-child) {
        border-bottom: 0;
    }

    .promotion-list :deep(tbody td) {
        padding: 0 4px;
    }

    .promotion-list :deep(.promotion-primary) {
        grid-column: 1;
        min-width: 0;
        width: auto;
    }

    .promotion-list :deep(.promotion-status) {
        grid-column: 1;
        text-align: left;
    }

    .promotion-list :deep(.data-table-actions) {
        grid-column: 2;
        grid-row: 1 / span 2;
        width: auto;
        white-space: nowrap;
    }

    .promotion-list :deep(tbody td[colspan]) {
        grid-column: 1 / -1;
        padding: 16px 4px;
    }
}
</style>
