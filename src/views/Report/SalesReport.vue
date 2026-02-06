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
	const start = moment().startOf('weeks').toDate();
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

		if (selectedCustomer.value && sale.customer?.id !== selectedCustomer.value.id) return false;
		if (selectedWarehouse.value && sale.warehouse?.id !== selectedWarehouse.value.id) return false;
		if (selectedPaymentMethod.value && String(sale.payment_method?.id) !== String(selectedPaymentMethod.value)) return false;
		if (selectedStatus.value && sale.status?.name && sale.status.name.toLowerCase() !== selectedStatus.value.toLowerCase()) return false;

		if (selectedProduct.value) {
			const hasProduct = (sale.details || []).some(d => d.product?.id === selectedProduct.value.id);
			if (!hasProduct) return false;
		}
		return true;
	});
});

const matchesSelectedProduct = (detail) => {
	if (!selectedProduct.value) return true;
	return detail.product?.id === selectedProduct.value.id;
};

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
	{ key: 'warehouse', label: 'Warehouse' },
	{ key: 'customer', label: 'Customer' },
	{ key: 'payment', label: 'Payment' },
	{ key: 'amount', label: 'Amount', align: 'right', formatter: (row) => Number(row.amount || 0).toLocaleString('en-us') },
];

const amountRows = computed(() => {
	const totals = new Map();
	(filteredSales.value || []).forEach((s) => {
		const warehouseName = s.warehouse?.name || 'Unknown Warehouse';
		const customerName = s.customer?.name || 'Unknown Customer';
		const paymentName = s.payment_method?.name || 'Unknown';
		const key = `${s.warehouse?.id}-${s.customer?.id}-${s.payment_method?.id}`;
		const entry = totals.get(key) || {
			warehouse: warehouseName,
			customer: customerName,
			payment: paymentName,
			amount: 0,
		};
		entry.amount += Number(s.total_amount || 0);
		totals.set(key, entry);
	});

	const rows = Array.from(totals.values()).sort((a, b) => {
		const w = a.warehouse.localeCompare(b.warehouse);
		if (w !== 0) return w;
		const c = a.customer.localeCompare(b.customer);
		if (c !== 0) return c;
		return a.payment.localeCompare(b.payment);
	});

	let lastWarehouse = null;
	let lastCustomer = null;

	return rows.map((row, index) => {
		const showWarehouse = row.warehouse !== lastWarehouse;
		const showCustomer = showWarehouse || row.customer !== lastCustomer;

		const displayWarehouse = showWarehouse ? row.warehouse : '';
		const displayCustomer = showCustomer ? row.customer : '';

		lastWarehouse = row.warehouse;
		lastCustomer = row.customer;

		return {
			no: index + 1,
			warehouse: displayWarehouse,
			customer: displayCustomer,
			payment: row.payment,
			amount: Number(row.amount || 0),
		};
	});
});

// amount details rows
const amountDetailColumns = [
	{ key: 'no', label: '#' },
	{ key: 'warehouse', label: 'Warehouse' },
	{ key: 'invoice', label: 'Invoice', formatter: (row) => row.invoice, onClick: (row) => {
		router.push({ name: 'View Sales', query: { id: row.invoice } });
	}},
	{ key: 'date', label: 'Sales Date' },
	{ key: 'status', label: 'Status' },
	{ key: 'customer', label: 'Customer' },
	{ key: 'payment', label: 'Payment' },
	{ key: 'amount', label: 'Amount', align: 'right', formatter: (row) => Number(row.amount || 0).toLocaleString('en-us') },
];

// Prepare amount detail rows
const amountDetailRows = computed(() => {
	const grouped = new Map();

	(filteredSales.value || []).forEach(sale => {
		const warehouseId = sale.warehouse?.id || 'unknown';
		const customerId = sale.customer?.id || 'unknown';
		const key = `${warehouseId}-${customerId}`;
		const entry = grouped.get(key) || {
			warehouse: sale.warehouse?.name || 'Unknown Warehouse',
			customer: sale.customer?.name || 'Unknown Customer',
			rows: [],
		};

		entry.rows.push({
			invoice: sale.id,
			date: sale.sale_date ? moment(sale.sale_date).format('DD-MM-YYYY HH:mm') : '-',
			status: sale.status?.name || 'Unknown',
			customer: sale.customer?.name || 'Unknown Customer',
			payment: sale.payment_method?.name || 'Unknown',
			amount: Number(sale.total_amount || 0),
		});
		grouped.set(key, entry);
	});

	const flat = [];
	grouped.forEach(entry => {
		entry.rows
			.sort((a, b) => moment(b.date, 'DD-MM-YYYY HH:mm').valueOf() - moment(a.date, 'DD-MM-YYYY HH:mm').valueOf())
			.forEach((row, idx) => {
				flat.push({
					warehouse: idx === 0 ? entry.warehouse : '',
					invoice: row.invoice,
					date: row.date,
					status: row.status,
					customer: idx === 0 ? entry.customer : '',
					payment: row.payment,
					amount: Number(row.amount || 0),
				});
			});
	});
	return flat.map((row, index) => ({
		no: index + 1,
		warehouse: row.warehouse,
		invoice: row.invoice,
		date: row.date,
		status: row.status,
		customer: row.customer,
		payment: row.payment,
		amount: Number(row.amount || 0),
	}));
});

// Product sales: aggregate by product
const productColumns = [
	{ key: 'no', label: '#' },
	{ key: 'warehouse', label: 'Warehouse' },
	{ key: 'barcode', label: 'Barcode' },
	{ key: 'product', label: 'Product' },
	{ key: 'qty', label: 'Total Qty', align: 'right' },
	{ key: 'amount', label: 'Total Amount', align: 'right', formatter: (row) => Number(row.amount || 0).toLocaleString('en-us') },
];

const productRows = computed(() => {
	const totals = new Map();

	(filteredSales.value || []).forEach(sale => {
		(sale.details || []).forEach(detail => {
			if (!matchesSelectedProduct(detail)) return;
			const productId = detail.product?.id;
			const warehouseId = sale.warehouse?.id || 'unknown';
			const key = `${productId}-${warehouseId}`;

			const qty = Number(detail.quantity || 0);
			const amount = Number(detail.total || 0);
			const entry = totals.get(key) || {
				warehouse: sale.warehouse?.name || 'Unknown Warehouse',
				product: detail.product?.name || 'Unknown',
				barcode: detail.product?.barcode || '',
				orders: 0,
				qty: 0,
				amount: 0,
			};

			entry.orders += 1;
			entry.qty += qty;
			entry.amount += amount;
			totals.set(key, entry);
		});
	});

	let lastWarehouse = null;

	return Array.from(totals.values())
		.sort((a, b) => b.amount - a.amount || b.qty - a.qty)
		.map((item, index) => {
			const showWarehouse = item.warehouse !== lastWarehouse;

			const displayWarehouse = showWarehouse ? item.warehouse : '';

			lastWarehouse = item.warehouse;

			return {
				no: index + 1,
				warehouse: displayWarehouse,
				product: item.product,
				barcode: item.barcode,
				orders: item.orders,
				qty: Number(item.qty || 0),
				amount: Number(item.amount || 0),
			}
		});
});

// Product details view rows
const productDetailColumns = [
	{ key: 'no', label: '#' },
	{ key: 'invoice', label: 'Invoice', formatter: (row) => row.invoice, onClick: (row) => {
		router.push({ name: 'View Sales', query: { id: row.invoice } });
	}},
	{ key: 'date', label: 'Sales Date', formatter: (row) => row.date ? moment(row.date).format('DD-MM-YYYY HH:mm') : '' },
	{ key: 'warehouse', label: 'Warehouse' },
	{ key: 'status', label: 'Status' },
	{ key: 'barcode', label: 'Barcode' },
	{ key: 'product', label: 'Product' },
	{ key: 'qty', label: 'Qty', align: 'right' },
	{ key: 'price', label: 'Price', align: 'right', formatter: (row) => Number(row.price || 0).toLocaleString('en-us') },
	{ key: 'amount', label: 'Total Amount', align: 'right', formatter: (row) => Number(row.amount || 0).toLocaleString('en-us') },
];

const productDetailRows = computed(() => {
	const grouped = new Map();

	(filteredSales.value || []).forEach(sale => {
		const warehouseName = sale.warehouse?.name || 'Unknown Warehouse';
		const warehouseId = sale.warehouse?.id || 'unknown';
		const ts = sale.sale_date ? new Date(sale.sale_date).getTime() : 0;

		(sale.details || []).forEach(detail => {
			if (!matchesSelectedProduct(detail)) return;

			const product = detail.product;
			if (!product?.id) return;

			const key = `${product.id}-${warehouseId}`;
			const entry = grouped.get(key) || {
				productName: product.name || 'Unknown',
				barcode: product.barcode || '',
				warehouse: warehouseName,
				rows: [],
			};

			entry.rows.push({
				productName: product.name || 'Unknown',
				barcode: product.barcode || '',
				warehouse: warehouseName,
				ts,
				invoice: sale.id,
				qty: Number(detail.quantity || 0),
				amount: Number(detail.total || 0),
				price: detail.promotion?.id ? detail.discount_price : detail.price,
				status: sale.status?.name || 'Unknown',
			});

			grouped.set(key, entry);
		});
	});

	const flat = [];
	let last = { productName: null, barcode: null, warehouse: null, invoice: null };

	grouped.forEach(entry => {
		entry.rows
			.sort((a, b) => b.ts - a.ts)
			.forEach((row) => {

				const showProduct = row.productName !== last.productName;
				const showBarcode =  row.barcode !== last.barcode;
				const showWarehouse = row.warehouse !== last.warehouse;
				const showInvoice = row.invoice !== last.invoice;

				flat.push({
					product: showProduct ? row.productName : '',
					barcode: showBarcode ? row.barcode : '',
					warehouse: showWarehouse ? row.warehouse : '',
					invoice: showInvoice ? row.invoice : '',
					date: showInvoice ? row.ts : '',
					price: row.price,
					qty: row.qty,
					amount: row.amount,
					status: showInvoice ? row.status : '',
				});

				last = {
					productName: row.productName,
					barcode: row.barcode,
					warehouse: row.warehouse,
					invoice: row.invoice,
				};
			});
	});

	return flat.map((row, i) => ({ no: i + 1, ...row}));
});


// Customer sales: aggregate by customer
const customerColumns = [
	{ key: 'no', label: '#' },
	{ key: 'warehouse', label: 'Warehouse' },
	{ key: 'customerId', label: 'Customer ID' },
	{ key: 'customerName', label: 'Name' },
	{ key: 'product', label: 'Product' },
	{ key: 'qty', label: 'Total Qty', align: 'right' },
	{ key: 'amount', label: 'Total Amount', align: 'right', formatter: (row) => Number(row.amount || 0).toLocaleString('en-us') },
];

const customerRows = computed(() => {
	const prodGrouped = new Map();

	(filteredSales.value || []).forEach(sale => {
		const customer = sale.customer;
		if (!customer?.id) return;

		(sale.details || []).forEach(detail => {
			if (!matchesSelectedProduct(detail)) return;

			const key = `${customer.id}-${detail.product?.id}-${sale.warehouse?.id}`;

			const entry = prodGrouped.get(key) || {
				customerId: customer.id,
				customerName: customer.name || 'Unknown',
				warehouse: sale.warehouse?.name || 'Unknown Warehouse',
				product: detail.product?.name || 'Unknown',
				qty: 0,
				amount: 0,
			};

			entry.qty += Number(detail.quantity || 0);
			entry.amount += Number(detail.total || 0);

			prodGrouped.set(key, entry);
		});
	});

	const flat = [...prodGrouped.values()].sort((a, b) =>
		a.customerName.localeCompare(b.customerName) ||
		a.warehouse.localeCompare(b.warehouse) ||
		a.product.localeCompare(b.product)
	);

	let lastCustomerId = null;
	let lastWarehouse = null;

	return flat.map((row, index) => {
		const showCustomer = row.customerId !== lastCustomerId;
		const showWarehouse = showCustomer || row.warehouse !== lastWarehouse;

		lastCustomerId = row.customerId;
		lastWarehouse = row.warehouse;

		return {
			no: index + 1,
			customerId: showCustomer ? row.customerId : '',
			customerName: showCustomer ? row.customerName : '',
			warehouse: showWarehouse ? row.warehouse : '',
			product: row.product,
			qty: row.qty,
			amount: row.amount,
			amountFormatted: row.amount.toLocaleString('en-US'),
		};
	});
});


const customerDetailColumns = [
	{ key: 'no', label: '#' },
	{ key: 'invoice', label: 'Invoice', formatter: (row) => row.invoice, onClick: (row) => {
		router.push({ name: 'View Sales', query: { id: row.invoice } });
	}},
	{ key: 'warehouse', label: 'Warehouse' },
	{ key: 'status', label: 'Status' },
	{ key: 'date', label: 'Sales Date' },
	{ key: 'customerId', label: 'Customer ID' },
	{ key: 'customerName', label: 'Customer' },
	{ key: 'product', label: 'Product' },
	{ key: 'qty', label: 'Qty', align: 'right' },
	{ key: 'price', label: 'Price', align: 'right', formatter: (row) => Number(row.price || 0).toLocaleString('en-us') },
	{ key: 'amount', label: 'Total Amount', align: 'right', formatter: (row) => Number(row.amount || 0).toLocaleString('en-us') },
];

// Customer details rows (per sale)
const customerDetailRows = computed(() => {
  const sales = filteredSales.value || [];

  const sortedSales = [...sales].sort((a, b) =>
    (a.customer?.name || '').localeCompare(b.customer?.name || '')
  );

  const grouped = new Map();

  sortedSales.forEach(sale => {
    if (!sale.customer?.id) return;

    const key = sale.customer.id;
    const entry = grouped.get(key) || {
      customerId: sale.customer.id,
      customerName: sale.customer.name,
      rows: [],
    };

	    (sale.details || []).forEach(detail => {
	      if (!matchesSelectedProduct(detail)) return;
      entry.rows.push({
        customerId: entry.customerId,
        customerName: entry.customerName,
        invoice: sale.id,
		ts: sale.sale_date ? new Date(sale.sale_date).getTime() : 0,
        date: sale.sale_date ? moment(sale.sale_date).format('DD-MM-YYYY HH:mm') : '-',
        warehouse: sale.warehouse?.name || 'Unknown Warehouse',
        status: sale.status?.name || 'Unknown',
        product: detail.product?.name || 'Unknown',
        price: detail.promotion?.id ? detail.discount_price : detail.price,
        qty: Number(detail.quantity || 0),
        amount: Number(detail.total || 0),
      });
    });

    grouped.set(key, entry);
  });

  const flat = [];
  let last = { customerId: null, invoice: null, warehouse: null };

  grouped.forEach(entry => {
    entry.rows
      .sort((a, b) => b.ts - a.ts)
      .forEach(row => {
        const showCustomer = row.customerId !== last.customerId;
        const showInvoice = row.invoice !== last.invoice;
        const showWarehouse = row.warehouse !== last.warehouse;

        flat.push({
          customerId: showCustomer ? row.customerId : '',
          customerName: showCustomer ? row.customerName : '',
          invoice: showInvoice ? row.invoice : '',
          date: showInvoice ? row.date : '',
          warehouse: showWarehouse ? row.warehouse : '',
          status: showInvoice ? row.status : '',
          product: row.product,
          qty: row.qty,
          price: row.price,
          amount: row.amount,
        });

        last = {
          customerId: row.customerId,
          invoice: row.invoice,
          warehouse: row.warehouse,
        };
      });
  });

  return flat.map((row, i) => ({ no: i + 1, ...row }));
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
				:columns="viewMode === 'summary' ? amountColumns : amountDetailColumns"
				:rows="viewMode === 'summary' ? amountRows : amountDetailRows"
				:isAction="false"
				:defaultSort="{ key: 'no', order: 'asc' }"
				:filename="'sales_report_amount'"
				:isLoading="useSales.loading"
				:totals="{
					enabled: true,
					showSubtotal: viewMode === 'detail',
					showGrandTotal: true,
					groupBy: 'customer',
					groupCarryForward: true,
					columns: [{ key: 'amount', type: 'sum', formatter: v => Number(v).toLocaleString('en-us') }],
					grandTotalLabel: 'Grand Total',
				}"
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
				:totals="{
					enabled: true,
					showSubtotal: viewMode === 'detail',
					showGrandTotal: true,
					groupBy: 'product',
					groupCarryForward: true,
					columns: [
						{ key: 'qty', type: 'sum', formatter: v => Number(v).toLocaleString('en-us') },
						{ key: 'amount', type: 'sum', formatter: v => Number(v).toLocaleString('en-us') }
					],
					grandTotalLabel: 'Grand Total',
				}"
			/>
		</div>

		<!-- Customer Sales View -->
		<div v-else-if="reportType === 'customer'" class="mt-3">
			<DataTable
				:columns="viewMode === 'summary' ? customerColumns : customerDetailColumns"
				:rows="viewMode === 'summary' ? customerRows : customerDetailRows"
				:defaultSort="{ key: 'no', order: 'asc' }"
				:isAction="false"
				:filename="viewMode === 'summary' ? 'sales_report_customer' : 'sales_report_customer_details'"
				:isLoading="useSales.loading"
				:totals="{
					enabled: true,
					showGrandTotal: true,
					groupBy: 'customerName',
					groupCarryForward: true,
					columns: [
						{ key: 'qty', type: 'sum', formatter: v => Number(v).toLocaleString('en-us') },
						{ key: 'amount', type: 'sum', formatter: v => Number(v).toLocaleString('en-us') }
					],
					grandTotalLabel: 'Grand Total',
				}"
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

