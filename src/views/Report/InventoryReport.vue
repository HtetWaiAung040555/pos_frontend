<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import moment from 'moment';
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import DataTable from '@/components/DataTable.vue';
import DatePicker from 'primevue/datepicker';
import Dialog from 'primevue/dialog';
import { Select } from 'primevue';

import { useSaleStore } from '@/stores/useSalesStore';
import { useProductStore } from '@/stores/useProductStore';
import { useWarehouseStore } from '@/stores/useWarehouseStore';
import BaseLabel from '@/components/BaseLabel.vue';
import { useRouter } from 'vue-router';
import { useFilterStore } from '@/stores/filterStore';
import { getPresetRange } from '@/utils/datePresets';
import { exportToXlsx } from '@/utils/exportXlsx';

const reportType = ref('amount'); // 'amount' | 'details' | 'product' | 'customer' | 'payment' | 'discount'
const showFilter = ref(true);
const viewMode = ref('summary'); // 'summary' | 'details' for product/customer report
const dataLoading = ref(false);
const salesList = ref([]);

const dateRange = ref(null); // [startDate, endDate]
const selectedProduct = ref(null);
const selectedWarehouse = ref(null);

// Stores
const router = useRouter();
const useSales = useSaleStore();
const filter = useFilterStore();
const productStore = useProductStore();
const warehouseStore = useWarehouseStore();

onMounted(async () => {
	// default range: current weeks to today
	const start = moment().startOf('weeks').toDate();
	const end = moment().endOf('day').toDate();

	await Promise.all([
		productStore.fetchAllProduct(),
		warehouseStore.fetchAllWarehouse?.() ?? Promise.resolve(),
	]);

	const saved = filter.getPageFilter('salesReport');
	if (saved) {
		if (saved.reportType) reportType.value = saved.reportType;
		if (saved.viewMode) viewMode.value = saved.viewMode;
		if (saved.dateRange) dateRange.value = saved.dateRange;
		if (saved.selectedProduct) selectedProduct.value = saved.selectedProduct;
		if (saved.selectedWarehouse) selectedWarehouse.value = saved.selectedWarehouse;
	}
	dateRange.value = [start, end];
	await fetchStockList();
});

async function fetchStockList() {
	dataLoading.value = true;
	try {
		const [start, end] = dateRange.value || [];
		
		const startedDate = start ? moment(start).startOf('day').format('YYYY-MM-DD HH:mm:ss') : "";
		const endedDate = end ? moment(end).endOf('day').format('YYYY-MM-DD HH:mm:ss') : "";
		await useSales.fetchAllSales({
			start_date: startedDate,
			end_date: endedDate
		});
		salesList.value = useSales.salesList || [];
		// persist current filters after fetch
		saveFilters();
	} catch (error) {
		console.error('Error fetching sales:', error);
	} finally {
		dataLoading.value = false;
	}
}

function applyFilters() {
	showFilter.value = false;
}

function resetFilters() {
	reportType.value = 'amount';
	viewMode.value = 'summary';
	selectedProduct.value = null;
	selectedWarehouse.value = null;
	const start = moment().startOf('month').toDate();
	const end = moment().endOf('day').toDate();
	dateRange.value = [start, end];
}

function saveFilters() {
	filter.setPageFilter('salesReport', {
		reportType: reportType.value,
		viewMode: viewMode.value,
		dateRange: dateRange.value,
		selectedProduct: selectedProduct.value,
		selectedWarehouse: selectedWarehouse.value,
	});
}

watch([
	() => reportType.value,
	() => viewMode.value,
	() => dateRange.value,
	() => selectedProduct.value,
	() => selectedWarehouse.value,
], () => {
	saveFilters();
});

watch(dateRange, async (val) => {
	await fetchStockList();
});

function applyPresetRange(preset) {
	let range = getPresetRange(preset);
	dateRange.value = range ? range : null;
}

const currentReportLabel = computed(() => {
    switch (reportType.value) {
        case 'amount':
            return 'By Amount';
        case 'details':
            return 'Details';
        case 'product':
            return 'Product Sales';
        case 'customer':
            return 'Customer Sales';
		case 'payment':
			return 'Payment Method';
		case 'discount':
			return 'Discount';
        default:
            return 'By Amount';
    }
});

const filteredSales = computed(() => {
	const rows = Array.isArray(salesList.value) ? salesList.value : [];

	return rows.filter(sale => {

		if (selectedWarehouse.value && sale.warehouse?.id !== selectedWarehouse.value.id) return false;

		if (selectedProduct.value) {
			const hasProduct = (sale.details || []).some(d => d.product?.id === selectedProduct.value.id);
			if (!hasProduct) return false;
		}
		return true;
	});
});


const invoiceColumns = [
	{ key: 'invoice', label: 'Invoice No' },
	{ key: 'date', label: 'Date' },
	{ key: 'customerId', label: 'Customer ID' },
	{ key: 'customerName', label: 'Customer Name' },
	{ key: 'warehouse', label: 'Warehouse' },
	{ key: 'payment', label: 'Payment' },
	{ key: 'status', label: 'Status' },
	{ key: 'amount', label: 'Amount' },
]

// Prepare rows for exporting details: parent columns (amountColumns) + items in `items` field
const exportDetailRows = computed(() => {
	return (filteredSales.value || []).map(sale => ({
		invoice: sale.id,
		date: sale.sale_date ? moment(sale.sale_date).format('DD-MM-YYYY HH:mm') : '',
		customerId: sale.customer?.id || '',
		customerName: sale.customer?.name || '',
		warehouse: sale.warehouse?.name || '',
		payment: sale.payment_method?.name || '',
		status: sale.status?.name || '',
		amount: Number(sale.total_amount || 0),
		items: sale.details || []
	}));
});

function exportDetailsToExcel() {
	exportToXlsx({
		columns: invoiceColumns,
		rows: exportDetailRows.value,
		filename: 'sales_report_details',
		detailHeaders: ['Barcode', 'Product','Price', 'Discount Amount', 'Discount Price', 'Qty','Subtotal'],
		detailField: 'items',
		detailKeys: ['product.barcode', 'product.name','price', 'discount_amount', 'discount_price', 'quantity','total']
	});
}

const reportTypeOptions = [
	{ label: 'By Amount', value: 'amount' },
	{ label: 'By Invoice', value: 'details' },
	{ label: 'Product Sales', value: 'product' },
	{ label: 'Customer Sales', value: 'customer' },
	{ label: 'Discount', value: 'discount' },
	//{ label: 'Payment Method', value: 'payment' },
	
];
</script>

<template>
	<div class="p-4">
		<PageTitle title="Sales Report" :spanText="currentReportLabel" />

		<div class="flex items-center gap-2 mt-3 overflow-x-auto flex-wrap">
			<BaseButton label="Filters" icon="fa fa-filter" size="sm" @click="showFilter = true" />
			<div>
				<DatePicker v-model="dateRange" selectionMode="range" showIcon showButtonBar fluid dateFormat="dd-mm-yy" class=" w-full" inputClass="h-[35px]" >
					<template #buttonbar="{ clearCallback }">
						<div class="flex justify-between w-full px-2 pb-2 gap-2 flex-wrap items-center">
							<div class="flex gap-2 flex-wrap">
								<BaseButton size="sm" label="Today" variant="outlined" :disabled="dataLoading" @click="() => applyPresetRange('today')" />
								<BaseButton size="sm" label="Yesterday" variant="outlined" :disabled="dataLoading" @click="() => applyPresetRange('yesterday')" />
								<BaseButton size="sm" label="This Week" variant="outlined" :disabled="dataLoading" @click="() => applyPresetRange('thisWeek')" />
								<BaseButton size="sm" label="This Month" variant="outlined" :disabled="dataLoading" @click="() => applyPresetRange('thisMonth')" />
								<BaseButton size="sm" label="This Year" variant="outlined" :disabled="dataLoading" @click="() => applyPresetRange('thisYear')" />
								<BaseButton size="sm" label="All" variant="outlined" :disabled="dataLoading" @click="() => applyPresetRange('all')" />
							</div>
							<div class="flex gap-2 items-center">
								<div v-if="dataLoading" class="flex items-center text-xs text-gray-600 gap-2">
									<i class="pi pi-spin pi-spinner"></i>
									<span>Loading...</span>
								</div>
								<BaseButton size="sm" label="Clear" icon="pi pi-times" severity="danger" variant="outlined" :disabled="dataLoading" @click="clearCallback" />
							</div>
						</div>
					</template>
				</DatePicker>
			</div>
			<div class="flex gap-x-2">
				<span class="text-sm text-gray-600 self-center">Product :</span>
				<span class="text-sm text-gray-800 font-medium bg-gray-200 px-2 py-1 rounded">
					{{ selectedProduct ? selectedProduct.name : 'All Product' }}
				</span>
			</div>
			<div class="flex gap-x-2">
				<span class="text-sm text-gray-600 self-center">Warehouse :</span>
				<span class="text-sm text-gray-800 font-medium bg-gray-200 px-2 py-1 rounded">
					{{ selectedWarehouse ? selectedWarehouse.name : 'All Warehouse' }}
				</span>
			</div>
		</div>

		<!-- Filter Dialog -->
		<Dialog v-model:visible="showFilter" :modal="true" :draggable="false" :style="{ width: '720px' }">
			<template #header>
				<div class="flex items-center gap-2 text-black">
					<i class="fa fa-filter"></i>
					<span>Sales Report Filters</span>
				</div>
			</template>

			<div class="flex flex-col gap-3 text-black">
				<div class="grid grid-cols-2 gap-3 items-center">
					<div>
						<BaseLabel label="Report Type" />
						<select v-model="reportType" class="mt-1 w-full border rounded px-2 py-2 text-sm">
							<option v-for="rt in reportTypeOptions" :key="rt.value" :value="rt.value">{{ rt.label }}</option>
						</select>
					</div>
					<div class="flex items-center">
						<div class="flex items-center gap-x-4 text-black">
							<label class="flex items-center gap-1 text-sm">
								<input type="radio" value="summary" v-model="viewMode" />
								<span>Summary</span>
							</label>
							<label class="flex items-center gap-1 text-sm">
								<input type="radio" value="details" v-model="viewMode" />
								<span>Details</span>
							</label>
						</div>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<BaseLabel label="Product" />
						<Select
							v-model="selectedProduct"
							:options="productStore.productList"
							showClear
							filter
							optionLabel="name"
							placeholder="Select a product"
							class="w-full h-[35px] items-center mt-1"
						/>
					</div>
                    <div>
						<BaseLabel label="Warehouse" />
						<Select
							v-model="selectedWarehouse"
							:options="warehouseStore.warehouseList"
							showClear
							filter
							optionLabel="name"
							placeholder="Select a warehouse"
							class="w-full h-[35px] items-center mt-1"
						/>
					</div>
				</div>

				<div class="flex justify-end gap-2 mt-2">
					<BaseButton label="Reset" variant="text" severity="secondary" @click="resetFilters" />
					<BaseButton label="Apply" icon="fa fa-check" severity="primary" @click="applyFilters" />
				</div>
			</div>
		</Dialog>
	</div>
</template>

