<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import moment from 'moment';
import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import DetailRow from '@/components/DetailRow.vue';
import DataTable from '@/components/DataTable.vue';
import DatePicker from 'primevue/datepicker';
import Dialog from 'primevue/dialog';
import { Select } from 'primevue';

import { useSaleStore } from '@/stores/useSalesStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useProductStore } from '@/stores/useProductStore';
import { useWarehouseStore } from '@/stores/useWarehouseStore';
import { usePaymentMethodStore } from '@/stores/usePaymentMethodStore';
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
const selectedCustomer = ref(null);
const selectedProduct = ref(null);
const selectedWarehouse = ref(null);
const selectedPaymentMethod = ref('');
const selectedStatus = ref(''); // Hold, Complete, Void

// Stores
const router = useRouter();
const useSales = useSaleStore();
const filter = useFilterStore();
const customerStore = useCustomerStore();
const productStore = useProductStore();
const warehouseStore = useWarehouseStore();
const paymentMethodStore = usePaymentMethodStore();

onMounted(async () => {
	// default range: current month to today
	const start = moment().startOf('month').toDate();
	const end = moment().endOf('day').toDate();

	await Promise.all([
		customerStore.fetchAllCustomer(),
		productStore.fetchAllProduct(),
		warehouseStore.fetchAllWarehouse?.() ?? Promise.resolve(),
		paymentMethodStore.fetchAllPaymentMethod(),
	]);

	const saved = filter.getPageFilter('salesReport');
	if (saved) {
		if (saved.reportType) reportType.value = saved.reportType;
		if (saved.viewMode) viewMode.value = saved.viewMode;
		if (saved.dateRange) dateRange.value = saved.dateRange;
		if (saved.selectedCustomer) selectedCustomer.value = saved.selectedCustomer;
		if (saved.selectedProduct) selectedProduct.value = saved.selectedProduct;
		if (saved.selectedWarehouse) selectedWarehouse.value = saved.selectedWarehouse;
		if (saved.selectedPaymentMethod) selectedPaymentMethod.value = saved.selectedPaymentMethod;
		if (saved.selectedStatus) selectedStatus.value = saved.selectedStatus;
	}
	dateRange.value = [start, end];
	await fetchSales();
});

async function fetchSales() {
	dataLoading.value = true;
	try {
		const [start, end] = dateRange.value || [];
		
		const startedDate = start ? moment(start).startOf('day').format('YYYY-MM-DD HH:mm:ss') : "";
		const endedDate = end ? moment(end).endOf('day').format('YYYY-MM-DD HH:mm:ss') : "";
		console.log('Fetching sales from', startedDate, 'to', endedDate);
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
	selectedCustomer.value = null;
	selectedProduct.value = null;
	selectedWarehouse.value = null;
	selectedPaymentMethod.value = '';
	selectedStatus.value = '';
	const start = moment().startOf('month').toDate();
	const end = moment().endOf('day').toDate();
	dateRange.value = [start, end];
}

function saveFilters() {
	filter.setPageFilter('salesReport', {
		reportType: reportType.value,
		viewMode: viewMode.value,
		dateRange: dateRange.value,
		selectedCustomer: selectedCustomer.value,
		selectedProduct: selectedProduct.value,
		selectedWarehouse: selectedWarehouse.value,
		selectedPaymentMethod: selectedPaymentMethod.value,
		selectedStatus: selectedStatus.value,
	});
}

watch([
	() => reportType.value,
	() => viewMode.value,
	() => dateRange.value,
	() => selectedCustomer.value,
	() => selectedProduct.value,
	() => selectedWarehouse.value,
	() => selectedPaymentMethod.value,
	() => selectedStatus.value,
], () => {
	saveFilters();
});

watch(dateRange, async (val) => {
	await fetchSales();
});

function applyPresetRange(preset) {
	let range = getPresetRange(preset);
	dateRange.value = range ? range : null;
}

// Filtering logic (client-side)
const isProductReport = computed(() => reportType.value === 'product');
const isCustomerReport = computed(() => reportType.value === 'customer');
const isPaymentReport = computed(() => reportType.value === 'payment');
const isDiscountReport = computed(() => reportType.value === 'discount');

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

		if (!isCustomerReport.value && selectedCustomer.value && sale.customer?.id !== selectedCustomer.value.id) return false;
		if (selectedWarehouse.value && sale.warehouse?.id !== selectedWarehouse.value.id) return false;
		if (!isPaymentReport.value && selectedPaymentMethod.value && String(sale.payment_method?.id) !== String(selectedPaymentMethod.value)) return false;
		if (selectedStatus.value && sale.status?.name && sale.status.name.toLowerCase() !== selectedStatus.value.toLowerCase()) return false;

		if (!isProductReport.value && selectedProduct.value) {
			const hasProduct = (sale.details || []).some(d => d.product?.id === selectedProduct.value.id);
			if (!hasProduct) return false;
		}
		return true;
	});
});

// Payment method: aggregate by payment method
const paymentColumns = [
	{ key: 'no', label: '#' },
	{ key: 'method', label: 'Payment Method' },
	{ key: 'orders', label: 'Orders' },
	{ key: 'amount', label: 'Total Amount' },
];

const paymentRows = computed(() => {
	const totals = new Map();

	(filteredSales.value || []).forEach(sale => {
		const methodId = sale.payment_method?.id || 'unknown';
		const entry = totals.get(methodId) || {
			method: sale.payment_method?.name || 'Unknown',
			orders: 0,
			amount: 0,
		};

		entry.orders += 1;
		entry.amount += Number(sale.total_amount || 0);
		totals.set(methodId, entry);
	});

	return Array.from(totals.values())
		.sort((a, b) => b.amount - a.amount || b.orders - a.orders)
		.map((item, index) => ({
			no: index + 1,
			method: item.method,
			orders: item.orders,
			amount: Number(item.amount || 0),
		}));
});

// Discount report: group by discounted item + promo
const discountColumns = [
	{ key: 'no', label: '#' },
	{ key: 'product', label: 'Discount Item' },
	{ key: 'promo', label: 'Promo Name' },
	{ key: 'discountType', label: 'Discount Type' },
	{ key: 'prodPrice', label: 'Product Price' },
	{ key: 'discountValueLabel', label: 'Discount Value' },
	{ key: 'salePrice', label: 'Sale Price' },
	{ key: 'qty', label: 'Total Qty' },
	{ key: 'amount', label: 'Total Amount' },
];

const discountRows = computed(() => {
	const totals = new Map();

	(filteredSales.value || []).forEach(sale => {
		(sale.details || []).forEach(detail => {
			const discountAmount = Number(detail.discount_amount || 0);
			const discountValue = Number(detail.promotion.discount_value || 0);
			const discountType = detail.promotion.discount_type;
			const hasDiscount =  detail.promotion.id;
			if (!hasDiscount) return;

			const productId = detail.product?.id || `unknown_${detail.product?.name || ''}`;
			const promoName = detail.promotion?.name || detail.promotion_name || '-';
			const prodPrice = detail.product.price || 0;
			const salePrice = detail.discount_price || detail.price;
			const qty = Number(detail.quantity || 0);
			const amount = Number(detail.total != null ? detail.total : salePrice * qty);

			const key = `${productId}-${promoName}-${discountType || 'none'}-${discountValue || discountAmount}`;
			const entry = totals.get(key) || {
				product: detail.product?.name || 'Unknown',
				promo: promoName,
				discountType: discountType || '-',
				discountValue: discountValue || discountAmount || 0,
				prodPrice,
				salePrice,
				qty: 0,
				amount: 0,
			};

			entry.qty += qty;
			entry.amount += amount;
			totals.set(key, entry);
		});
	});

	return Array.from(totals.values())
		.sort((a, b) => b.amount - a.amount || b.qty - a.qty)
		.map((item, index) => ({
			no: index + 1,
			product: item.product,
			promo: item.promo,
			discountType: item.discountType || '-',
			prodPrice: Number(item.prodPrice || 0).toLocaleString('en-us'),
			discountValueLabel: item.discountType === 'percent'
				? `${item.discountValue}%`
				: Number(item.discountValue || 0).toLocaleString('en-us'),
			salePrice: Number(item.salePrice || 0).toLocaleString('en-us'),
			qty: Number(item.qty || 0),
			amount: Number(item.amount || 0).toLocaleString('en-us'),
		}));
});

// Amount view rows
const amountColumns = [
    { key: 'no', label: '#' },
	{ key: 'invoice', label: 'Invoice' },
	{ key: 'date', label: 'Date' },
	{ key: 'customer', label: 'Customer' },
	{ key: 'warehouse', label: 'Warehouse' },
	{ key: 'payment', label: 'Payment' },
	{ key: 'status', label: 'Status' },
	{ key: 'amount', label: 'Amount' },
];

const amountRows = computed(() => {
	return (filteredSales.value || []).map((s, index) => ({
		no: index + 1,
		invoice: s.id,
		date: s.sale_date ? moment(s.sale_date).format('DD-MM-YYYY HH:mm') : '-',
		customer: s.customer?.name || '-',
		warehouse: s.warehouse?.name || '-',
		payment: s.payment_method?.name || '-',
		status: s.status?.name || '-',
		amount: Number(s.total_amount || 0).toLocaleString('en-us'),
	}));
});

// Product sales: aggregate by product
const productColumns = [
	{ key: 'no', label: '#' },
	{ key: 'product', label: 'Product' },
	{ key: 'qty', label: 'Total Qty' },
	{ key: 'amount', label: 'Total Amount', formatter: (row) => Number(row.amount || 0).toLocaleString('en-us') },
];

const productRows = computed(() => {
	const totals = new Map();

	(filteredSales.value || []).forEach(sale => {
		(sale.details || []).forEach(detail => {
			const productId = detail.product?.id;
			if (!productId) return;

			const qty = Number(detail.quantity || 0);
			const amount = Number(detail.total || 0);
			const entry = totals.get(productId) || {
				product: detail.product?.name || 'Unknown',
				orders: 0,
				qty: 0,
				amount: 0,
			};

			entry.orders += 1;
			entry.qty += qty;
			entry.amount += amount;
			totals.set(productId, entry);
		});
	});

	return Array.from(totals.values())
		.sort((a, b) => b.amount - a.amount || b.qty - a.qty)
		.map((item, index) => ({
			no: index + 1,
			product: item.product,
			orders: item.orders,
			qty: Number(item.qty || 0),
			amount: Number(item.amount || 0),
		}));
});

// Product details view rows
const productDetailColumns = [
	{ key: 'no', label: '#' },
	{ key: 'product', label: 'Product' },
	{ key: 'invoice', label: 'Invoice', formatter: (row) => row.invoice, onClick: (row) => {
		router.push({ name: 'View Sales', query: { id: row.invoice } });
	}},
	{ key: 'date', label: 'Sales Date' },
	{ key: 'price', label: 'Price' },
	{ key: 'qty', label: 'Qty' },
	{ key: 'amount', label: 'Total Amount', formatter: (row) => Number(row.amount || 0).toLocaleString('en-us') },
];

const productDetailRows = computed(() => {
	const grouped = new Map();

	(filteredSales.value || []).forEach(sale => {
		(sale.details || []).forEach(detail => {
			const productId = detail.product?.id;
			if (!productId) return;

			const invoice = sale.id;
			const saleDate = sale.sale_date ? moment(sale.sale_date).format('DD-MM-YYYY HH:mm') : '-';
			const qty = Number(detail.quantity || 0);
			const amount = Number(detail.total || 0);
			const salePrice = detail.discount_price == 0 ? detail.price : detail.discount_price;
			const entry = grouped.get(productId) || {
				product: detail.product?.name || 'Unknown',
				rows: [],
			};

			entry.rows.push({
				product: detail.product?.name || 'Unknown',
				date: saleDate,
				invoice,
				qty,
				amount,
				price: salePrice,
			});
			grouped.set(productId, entry);
		});
	});

	const flat = [];
	grouped.forEach(entry => {
		entry.rows
			.sort((a, b) => b.qty - a.qty)
			.forEach((row, idx) => {
				flat.push({
					product: idx === 0 ? row.product : '',
					invoice: row.invoice,
					date: row.date,
					price: row.price,
					qty: row.qty,
					amount: Number(row.amount || 0),
				});
			});
	});

	return flat.map((row, index) => ({
		no: index + 1,
		product: row.product,
		invoice: row.invoice,
		date: row.date,
		price: row.price,
		qty: row.qty,
		amount: row.amount,
	}));
});

// Customer sales: aggregate by customer
const customerColumns = [
	{ key: 'no', label: '#' },
	{ key: 'customerName', label: 'Name' },
	{ key: 'orders', label: 'Orders' },
	{ key: 'amount', label: 'Total Amount' },
];

const customerRows = computed(() => {
	const totals = new Map();

	(filteredSales.value || []).forEach(sale => {
		const customerId = sale.customer?.id;
		if (!customerId) return;

		const amount = Number(sale.total_amount || 0);
		const qty = (sale.details || []).reduce((sum, d) => sum + Number(d.quantity || 0), 0);

		const entry = totals.get(customerId) || {
			customerId: customerId,
			customerName: sale.customer?.name || 'Unknown',
			orders: 0,
			qty: 0,
			amount: 0,
		};

		entry.orders += 1;
		entry.qty += qty;
		entry.amount += amount;
		totals.set(customerId, entry);
	});

	return Array.from(totals.values())
		.sort((a, b) => b.amount - a.amount || b.qty - a.qty)
		.map((item, index) => ({
			no: index + 1,
			customerId: item.customerId,
			customerName: item.customerName,
			orders: item.orders,
			qty: Number(item.qty || 0),
			amount: Number(item.amount || 0),
		}));
});

// Customer details rows (per sale)
const customerDetailColumns = [
	{ key: 'no', label: '#' },
	{ key: 'customerId', label: 'Customer ID' },
	{ key: 'customerName', label: 'Customer' },
	{ key: 'invoice', label: 'Invoice', formatter: (row) => row.invoice, onClick: (row) => {
		router.push({ name: 'View Sales', query: { id: row.invoice } });
	}},
	{ key: 'date', label: 'Sales Date' },
	{ key: 'qty', label: 'Qty' },
	{ key: 'amount', label: 'Total Amount' },
];

const customerDetailRows = computed(() => {
	const grouped = new Map();

	// Sort sales by customer id before grouping
	const sortedSales = [...(filteredSales.value || [])].sort((a, b) => {
		const aId = a.customer?.id ?? '';
		const bId = b.customer?.id ?? '';
		return String(aId).localeCompare(String(bId));
	});

	sortedSales.forEach(sale => {
		const customerId = sale.customer?.id;
		if (!customerId) return;

		const amount = Number(sale.total_amount || 0);
		const qty = (sale.details || []).reduce((sum, d) => sum + Number(d.quantity || 0), 0);
		const date = sale.sale_date ? moment(sale.sale_date).format('DD-MM-YYYY HH:mm') : '-';
		const invoice = sale.id;

		const entry = grouped.get(customerId) || {
			customerId: customerId,
			customerName: sale.customer?.name || 'Unknown',
			rows: [],
		};

		entry.rows.push({ customerId: entry.customerId, customerName: entry.customerName, invoice, date, qty, amount });
		grouped.set(customerId, entry);
	});

	const flat = [];
	grouped.forEach(entry => {
		entry.rows
			.sort((a, b) => moment(b.date, 'DD-MM-YYYY HH:mm').valueOf() - moment(a.date, 'DD-MM-YYYY HH:mm').valueOf())
			.forEach((row, idx) => {
				flat.push({
					customerId: idx === 0 ? row.customerId : '',
					customerName: idx === 0 ? row.customerName : '',
					invoice: row.invoice,
					date: row.date,
					qty: row.qty,
					amount: row.amount,
				});
			});
	});

	return flat.map((row, index) => ({
		no: index + 1,
		customerId: row.customerId,
		customerName: row.customerName,
		invoice: row.invoice,
		date: row.date,
		qty: row.qty,
		amount: row.amount,
	}));
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

// Details view: group by sale
const detailGroups = computed(() => {
	const sortedSales = [...(filteredSales.value || [])].sort((a, b) => moment(b.sale_date).valueOf() - moment(a.sale_date).valueOf());
	return sortedSales.map(sale => ({
		sale,
		items: sale.details || [],
	}));
});

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

const statusOptions = [
	{ label: 'All', value: '' },
	{ label: 'Hold', value: 'Hold' },
	{ label: 'Complete', value: 'Complete' },
	{ label: 'Void', value: 'Void' },
];

const paymentOptions = computed(() => {
	const list = paymentMethodStore.paymentMethodList || [];
	return [{ label: 'All', value: '' }].concat(list.map(p => ({ label: p.name, value: p.id })));
});

const reportTypeOptions = [
	{ label: 'By Amount', value: 'amount' },
	{ label: 'Details', value: 'details' },
	{ label: 'Product Sales', value: 'product' },
	{ label: 'Customer Sales', value: 'customer' },
	{ label: 'Payment Method', value: 'payment' },
	{ label: 'Discount', value: 'discount' },
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
				<span class="text-sm text-gray-600 self-center">Customer :</span>
				<span class="text-sm text-gray-800 font-medium bg-gray-200 px-2 py-1 rounded">
					{{ selectedCustomer ? selectedCustomer.name : 'All Customer' }}
				</span>
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
			<div class="flex gap-x-2">
				<span class="text-sm text-gray-600 self-center">Payment :</span>
				<span class="text-sm text-gray-800 font-medium bg-gray-200 px-2 py-1 rounded">
					{{
						selectedPaymentMethod
							? paymentOptions.find(p => String(p.value) === String(selectedPaymentMethod))?.label || 'Selected Payment'
							: 'All Payment Methods'
					}}
				</span>
			</div>
			<div class="flex gap-x-2">
				<span class="text-sm text-gray-600 self-center">Status :</span>
				<span class="text-sm text-gray-800 font-medium bg-gray-200 px-2 py-1 rounded">
					{{ selectedStatus ? selectedStatus : 'All Statuses' }}
				</span>
			</div>
		</div>

		<!-- Amount View -->
		<div v-if="reportType === 'amount'" class="mt-3">
			<DataTable
				:columns="amountColumns"
				:rows="amountRows"
				:isAction="false"
				:defaultSort="{ key: 'date', order: 'desc' }"
				:filename="'sales_report_amount'"
				:isLoading="useSales.loading"
			>
             <template #filters>
                <div></div>
             </template>
            </DataTable>
		</div>

		<!-- Details View -->
		<div v-else-if="reportType === 'details'" class="mt-3 flex flex-col gap-3">
			<div class="flex justify-end mb-2">
				<BaseButton label="Export Details" size="sm" icon="fa fa-file-excel" severity="success" @click="exportDetailsToExcel" />
			</div>
			<BaseCard v-for="group in detailGroups" :key="group.sale.id" class="w-full">
				<template #cardElements>
					<SubTitle :label="`Invoice #${group.sale.id}`" />
					<div class="grid lg:grid-cols-3 gap-3 mt-2">
						<div class="col-span-2 grid grid-cols-2 gap-2 h-fit">
							<DetailRow label="Date" :value="group.sale.sale_date" :formatter="v => moment(v).format('DD-MM-YYYY HH:mm:ss')" />
							<DetailRow label="Customer" :value="group.sale.customer?.name" />
							<DetailRow label="Warehouse" :value="group.sale.warehouse?.name" />
							<DetailRow label="Payment" :value="group.sale.payment_method?.name" />
							<DetailRow label="Status" :value="group.sale.status?.name" />
							<DetailRow label="Remark" :value="group.sale.remark" />
						</div>
						<div class="grid grid-cols-1 gap-2">
							<DetailRow label="Created By" :value="group.sale.created_by" />
							<DetailRow label="Created At" :value="group.sale.created_at" :formatter="v => moment(v).format('DD-MM-YYYY HH:mm:ss')" />
							<DetailRow label="Updated By" :value="group.sale.updated_by" />
							<DetailRow label="Updated At" :value="group.sale.updated_at" :formatter="v => moment(v).format('DD-MM-YYYY HH:mm:ss')" />
						</div>
					</div>

					<div class="mt-3 overflow-x-auto">
						<table class="w-full text-black border-collapse">
							<thead>
								<tr class="bg-gray-100 text-sm">
									<th class="p-2 text-left">#</th>
									<th class="p-2 text-left">Product</th>
									<th class="p-2 text-right">Price</th>
									<th class="p-2 text-right">Discount</th>
									<th class="p-2 text-right">Qty</th>
									<th class="p-2 text-right">Subtotal</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="(item, idx) in group.items" :key="item.id" class="border-t text-sm">
									<td class="p-2">{{ idx + 1 }}</td>
									<td class="p-2">{{ item.product?.name }}</td>
									<td class="p-2 text-right">{{ Number(item.price || 0).toLocaleString('en-us') }}</td>
									<td class="p-2 text-right">{{ Number(item.discount_amount || 0).toLocaleString('en-us') }}</td>
									<td class="p-2 text-right">{{ item.quantity }}</td>
									<td class="p-2 text-right">{{ Number(item.total || 0).toLocaleString('en-us') }}</td>
								</tr>
                                <tr class="border-t text-sm">
                                    <td colspan="4" class="p-2 text-right font-semibold">Total</td>
                                    <td class="p-2 text-right font-semibold">
                                        {{
                                            Number(
                                                group.items.reduce((qty, item) => qty + Number(item.quantity || 0), 0)
                                            ).toLocaleString('en-us')
                                        }}
                                    </td>
                                    <td class="p-2 text-right font-semibold">
                                        {{
                                            Number(
                                                group.items.reduce((sum, item) => sum + Number(item.total || 0), 0)
                                            ).toLocaleString('en-us')
                                        }}
                                    </td>
                                </tr>
							</tbody>
						</table>
					</div>
				</template>
			</BaseCard>
		</div>

		<!-- Product Sales View -->
		<div v-else-if="reportType === 'product'" class="mt-3">
			<DataTable
				:columns="viewMode === 'summary' ? productColumns : productDetailColumns"
				:rows="viewMode === 'summary' ? productRows : productDetailRows"
				:defaultSort="viewMode === 'summary' ? { key: 'amount', order: 'desc' } : { key: 'no', order: 'asc' }"
				:isAction="false"
				:filename="viewMode === 'summary' ? 'sales_report_product' : 'sales_report_product_details'"
				:isLoading="useSales.loading"
			/>
		</div>

		<!-- Customer Sales View -->
		<div v-else-if="reportType === 'customer'" class="mt-3">
			<DataTable
				:columns="viewMode === 'summary' ? customerColumns : customerDetailColumns"
				:rows="viewMode === 'summary' ? customerRows : customerDetailRows"
				:defaultSort="viewMode === 'summary' ? { key: 'amount', order: 'desc' } : { key: 'no', order: 'asc' }"
				:isAction="false"
				:filename="viewMode === 'summary' ? 'sales_report_customer' : 'sales_report_customer_details'"
				:isLoading="useSales.loading"
			/>
		</div>

		<!-- Payment Method Report -->
		<div v-else-if="reportType === 'payment'" class="mt-3">
			<DataTable
				:columns="paymentColumns"
				:rows="paymentRows"
				:isAction="false"
				:defaultSort="{ key: 'amount', order: 'desc' }"
				:filename="'sales_report_payment_method'"
				:isLoading="useSales.loading"
			/>
		</div>

		<!-- Discount Report -->
		<div v-else class="mt-3">
			<DataTable
				:columns="discountColumns"
				:rows="discountRows"
				:isAction="false"
				:filename="'sales_report_discount'"
				:isLoading="useSales.loading"
			/>
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
						<BaseLabel label="Customer" />
						<Select
							v-model="selectedCustomer"
							:options="customerStore.customerList"
							showClear
							filter
							optionLabel="name"
							placeholder="Select a customer"
							:disabled="isCustomerReport"
							class="w-full h-[35px] items-center mt-1"
						/>
					</div>
					<div>
						<BaseLabel label="Product" />
						<Select
							v-model="selectedProduct"
							:options="productStore.productList"
							showClear
							filter
							optionLabel="name"
							placeholder="Select a product"
							:disabled="isProductReport"
							class="w-full h-[35px] items-center mt-1"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
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
					<div>
						<BaseLabel label="Payment Method" />
						<select
							v-model="selectedPaymentMethod"
							class="w-full border border-gray-300 rounded px-2 py-2 text-sm mt-1"
							:disabled="isPaymentReport"
						>
							<option v-for="p in paymentOptions" :key="p.value" :value="p.value">{{ p.label }}</option>
						</select>
					</div>
					<div>
						<BaseLabel label="Status" />
						<select v-model="selectedStatus" class="w-full border border-gray-300 rounded px-2 py-2 text-sm mt-1">
							<option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
						</select>
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

