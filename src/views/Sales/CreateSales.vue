<script setup>

import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useRouter } from 'vue-router';
import BaseInput from '@/components/BaseInput.vue';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import BaseLabel from '@/components/BaseLabel.vue';
import moment from 'moment';
import { usePaymentMethodStore } from '@/stores/usePaymentMethodStore';
import { useWarehouseStore } from '@/stores/useWarehouseStore';
import BaseErrorLabel from '@/components/BaseErrorLabel.vue';
import { Select } from 'primevue';
import { useProductStore } from '@/stores/useProductStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useSaleStore } from '@/stores/useSalesStore';
import axios from 'axios';
import { useStatusStore } from '@/stores/useStatusStore';
import { useBranchStore } from '@/stores/useBranchStore';

const router = useRouter();
const toast = useToast();
const useSales = useSaleStore();
const usePaymentMethod = usePaymentMethodStore();
const useCustomer = useCustomerStore();
const useWarehouse = useWarehouseStore();
const useProduct = useProductStore();
const useStatus = useStatusStore();
const useBranch = useBranchStore();

const userData = ref({});
const customerSelect = ref(null)
const selectedProducts = ref([]);
const isProductDialogVisible = ref(false);
const productList = ref([]);
const searchTerm = ref('');
const selectionBuffer = ref([]);
const headerCheckboxRef = ref(null);
const isCheckingAll = ref(false);
const isSelectAllLoading = ref(false);
const selectedCustomer = ref([]);
const selectedBranch = ref(null);
const selectedWarehouse = ref(null);
const orderDiscountAmount = ref(0);
const appliedPromotions = ref([]);
const formData = ref({
    salesId: '',
    warehouseId: '',
    customerId: '',
    paymentId: '1',
    remark: '',
    paidAmount: 0,
    salesDate: moment().format('YYYY-MM-DDTHH:mm'),
    statusId: 5, // default to 'Hold' status
    products: [],
})
const errorMsg = ref({
    customer: "",
    branch: "",
    warehouse: "",
});

// Change route function
function changeRoute(pathname) {
    router.push(pathname);
}

onMounted(async () => {
    userData.value = JSON.parse(localStorage.getItem('user'));
    await Promise.all([
        useCustomer.fetchAllCustomer(),
        useWarehouse.fetchAllWarehouse(),
        useBranch.fetchAllBranch(),
        usePaymentMethod.fetchAllPaymentMethod(),
    ]);
    selectedCustomer.value = useCustomer.customerList.filter(c => c.is_default)[0];
    selectedBranch.value = null;
    syncWarehouseFromBranch(null);
    await useStatus.fetchAllStatus();
});

function branchWarehouse(branch) {
    return branch?.warehouse
        || (useWarehouse.warehouseList || []).find(warehouse => Number(warehouse.id) === Number(branch?.warehouse_id))
        || null;
}

function syncWarehouseFromBranch(branch) {
    const warehouse = branchWarehouse(branch);
    selectedWarehouse.value = warehouse;
    formData.value.warehouseId = warehouse?.id || branch?.warehouse_id || '';
}

async function loadProductsForBranch(branchId) {
    if (!branchId) {
        productList.value = [];
        return;
    }

    await useProduct.fetchSalesProduct({ branch_id: branchId });
    productList.value = useProduct.productList || [];
}

function hydrateSelectedProductsFromCatalog() {
    selectedProducts.value = selectedProducts.value.map((product) => {
        const catalogProduct = (productList.value || []).find(item => Number(item.id) === Number(product.id));
        if (!catalogProduct) return product;

        return {
            ...product,
            image_url: product.image_url || catalogProduct.image_url,
            base_barcode: product.base_barcode || catalogProduct.barcode,
            product_units: catalogProduct.product_units || product.product_units || [],
        };
    });
}

const productTotalAmount = computed(() => {
    return selectedProducts.value.reduce((sum, p) => {
        if (p.is_foc) return sum;
        const price = p.promotion_id ? Number(p.discount_price || 0) : Number(p.price || 0);
        return sum + (price * Number(p.quantity || 0));
    }, 0);
});

const grandTotalAmount = computed(() => {
    return Math.max(0, productTotalAmount.value - Number(orderDiscountAmount.value || 0));
});

const changeAmount = computed(() => {
    return Number(formData.value.paidAmount || 0) - grandTotalAmount.value;
});

function recordId(value) {
    return value?.id || value || null;
}

function defaultProductUnit(product) {
    if (product?.default_product_unit?.id) return product.default_product_unit;
    return product?.product_units?.find((unit) => unit.is_default_sale_unit)
        || product?.product_units?.find((unit) => unit.is_base_unit)
        || product?.product_units?.[0]
        || null;
}

function productUnitId(product) {
    return product?.product_unit_id || defaultProductUnit(product)?.id || null;
}

function productUnitUnitId(product) {
    return recordId(product?.unit_id) || recordId(defaultProductUnit(product)?.unit_id);
}

function selectedProductUnit(product) {
    const units = Array.isArray(product?.product_units) ? product.product_units : [];
    const selectedUnitId = product?.product_unit_id;
    return units.find((unit) => Number(unit.id) === Number(selectedUnitId))
        || defaultProductUnit(product);
}

function productUnitName(product) {
    const unit = selectedProductUnit(product);
    return product?.unit_name || unit?.unit_name || unit?.unit_id?.name || null;
}

function productUnitBarcode(product) {
    const unit = selectedProductUnit(product);
    return product?.unit_barcode || unit?.barcode || (product?.product_unit_id ? product?.barcode : null) || null;
}

function productConversionToBase(product) {
    const unit = selectedProductUnit(product);
    const conversion = Number(product?.conversion_to_base || unit?.conversion_to_base || 1);
    return conversion > 0 ? conversion : 1;
}

function productLineUomSnapshot(product, quantity) {
    const unitQuantity = Number(quantity || 0);
    const conversionToBase = productConversionToBase(product);

    return {
        product_unit_id: product?.product_unit_id || productUnitId(product),
        unit_id: productUnitUnitId(product),
        unit_name: productUnitName(product),
        unit_quantity: unitQuantity,
        base_quantity: unitQuantity * conversionToBase,
        conversion_to_base: conversionToBase,
        unit_barcode: productUnitBarcode(product),
        price_range_id: product?.price_range_id || null,
    };
}

function sameProductUnit(left, right) {
    return Number(left.product_id || left.id) === Number(right.product_id || right.id)
        && Number(left.product_unit_id || 0) === Number(right.product_unit_id || 0);
}

function pricedItemFor(product, pricedItems = []) {
    return pricedItems.find(item => sameProductUnit(item, product))
        || pricedItems.find(item => Number(item.product_id || item.id) === Number(product.id));
}

watch(grandTotalAmount, (amount) => {
    formData.value.paidAmount = amount;
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
    if (!selectedBranch.value) {
        errorMsg.value.branch = "Please select a branch first.";
        toast.add({
            severity: 'warn',
            summary: 'Branch Required',
            detail: 'Please select a branch before selecting products.',
            life: 3000
        });
        return;
    }

    // create a shallow copy buffer to allow canceling
    selectionBuffer.value = selectedProducts.value.filter(p => !p.is_foc).slice();
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

    // Directly add product to buffer (no promotion checks needed for purchases)
    selectionBuffer.value.push(product);
}

function isBufferSelected(product) {
    return selectionBuffer.value.some(p => p.id === product.id);
}

async function selectAllInBuffer() {
    // Add all filtered products to buffer (no promotion checks for purchases)
    if (isCheckingAll.value) return;
    isCheckingAll.value = true;
    try {
        const ids = new Set(selectionBuffer.value.map(p => p.id));
        const candidates = (filteredProducts.value || []).filter(p => !ids.has(p.id));
        if (candidates.length === 0) return;
        candidates.forEach(product => {
            if (!selectionBuffer.value.some(s => s.id === product.id)) selectionBuffer.value.push(product);
        });
    } finally {
        isCheckingAll.value = false;
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

async function confirmProductSelection() {
    const existingMap = new Map(selectedProducts.value.filter(p => !p.is_foc).map(p => [p.id, p]));
    const selected = selectionBuffer.value.map((p) => {
        const existing = existingMap.get(p.id);
        const basePrice = Number(existing?.price ?? p.price ?? 0);

        return {
            id: p.id,
            name: p.name,
            barcode: p.barcode,
            base_barcode: p.base_barcode || p.barcode,
            quantity: Number(existing?.quantity ?? p.quantity) || 1,
            image_url: p.image_url,
            product_units: p.product_units || [],
            product_unit_id: existing?.product_unit_id || productUnitId(p),
            unit_id: existing?.unit_id || productUnitUnitId(p),
            unit_name: existing?.unit_name || productUnitName(p),
            unit_barcode: existing?.unit_barcode || productUnitBarcode(p),
            conversion_to_base: existing?.conversion_to_base || productConversionToBase(p),
            price: basePrice,
            promotion_id: existing?.promotion_id || null,
            discount_amount: Number(existing?.discount_amount) || 0,
            discount_price: Number(existing?.discount_price ?? basePrice),
            discount_value: Number(existing?.discount_value) || 0,
            discount_type: existing?.discount_type || '',
            is_foc: false,
            reward_id: null,
        };
    });

    selectedProducts.value = selected;
    await recalculatePromotions();
    isProductDialogVisible.value = false;
}

function cancelProductSelection() {
    isProductDialogVisible.value = false;
}

function onChangeQty(product) {
    if (product.is_foc) return;
    product.quantity = Number(product.quantity) || 0;
    if (product.quantity < 0) product.quantity = 0;
    recalculatePromotions();
}

function onChangePrice(product) {
    if (product.is_foc) return;
    product.price = Number(product.price) || 0;
    if (product.price < 0) product.price = 0;
    recalculatePromotions();
}

function onProductUnitChange(product) {
    if (product.is_foc) return;

    const unit = (product.product_units || []).find(item => Number(item.id) === Number(product.product_unit_id));
    product.unit_id = recordId(unit?.unit_id) || null;
    product.unit_name = unit?.unit_id?.name || unit?.unit_name || '-';
    product.unit_barcode = unit?.barcode || null;
    product.conversion_to_base = Number(unit?.conversion_to_base || 1);
    product.barcode = unit?.barcode || product.base_barcode || product.barcode || '';
    product.price = 0;
    product.discount_amount = 0;
    product.discount_price = 0;
    product.promotion_id = null;
    product.price_source = null;
    product.price_range_id = null;
    recalculatePromotions();
}

function removeSelectedProduct(product) {
    selectedProducts.value = selectedProducts.value.filter(p => p.id !== product.id);
    recalculatePromotions();
}

async function recalculatePromotions() {
    const normalProducts = selectedProducts.value.filter(p => !p.is_foc && Number(p.quantity || 0) > 0);

    if (normalProducts.length === 0) {
        selectedProducts.value = [];
        orderDiscountAmount.value = 0;
        appliedPromotions.value = [];
        return true;
    }

    try {
        const payload = {
            branch_id: selectedBranch.value?.id ?? null,
            warehouse_id: selectedWarehouse.value?.id ?? selectedBranch.value?.warehouse_id ?? null,
            cart: normalProducts.map(p => ({
                product_id: p.id,
                product_unit_id: p.product_unit_id || null,
                unit_id: recordId(p.unit_id),
                qty: Number(p.quantity || 0),
            })),
            sale_date: moment(formData.value.salesDate).format('YYYY-MM-DD HH:mm:ss'),
        };

        const res = await axios.post('/promotions/checkprice', payload);
        const data = res.data || {};

        selectedProducts.value = normalProducts.map(p => {
            const pricedItem = pricedItemFor(p, data.priced_items || []);
            const price = Number(pricedItem?.price ?? 0);

            return {
                ...p,
                price,
                price_source: pricedItem?.price_source || null,
                price_range_id: pricedItem?.price_range_id || null,
                promotion_id: null,
                discount_amount: 0,
                discount_price: price,
                discount_value: 0,
                discount_type: '',
                is_foc: false,
                reward_id: null,
            };
        });

        if (Array.isArray(data.items) && data.items.length > 0) {
            selectedProducts.value = selectedProducts.value.map(p => {
                const promo = data.items.find(item => sameProductUnit(item, p))
                    || data.items.find(item => Number(item.product_id) === Number(p.id));
                if (!promo) return p;

                const discountPrice = Number(promo.discount_price ?? Math.max(0, Number(p.price || 0) - Number(promo.discount_amount || 0)));
                const discountAmount = Math.max(0, Number(p.price || 0) - discountPrice);

                return {
                    ...p,
                    promotion_id: promo.promotion_id || null,
                    discount_value: Number(promo.discount_value) || 0,
                    discount_type: promo.discount_type || '',
                    discount_amount: discountAmount,
                    discount_price: discountPrice,
                };
            });
        }

        orderDiscountAmount.value = Number(data.order?.total_discount) || 0;
        appliedPromotions.value = data.order?.applied_promotions || [];

        if (Array.isArray(data.foc_items) && data.foc_items.length > 0) {
            data.foc_items.forEach((free) => {
                const product = productList.value.find(p => Number(p.id) === Number(free.product_id));
                if (!product) return;

                selectedProducts.value.push({
                    id: product.id,
                    name: product.name,
                    barcode: product.barcode,
                    base_barcode: product.base_barcode || product.barcode,
                    quantity: Number(free.qty) || 1,
                    image_url: product.image_url,
                    product_units: product.product_units || [],
                    product_unit_id: free.product_unit_id || productUnitId(product),
                    unit_id: free.unit_id || productUnitUnitId(product),
                    unit_name: free.unit_name || productUnitName(product),
                    unit_barcode: free.unit_barcode || productUnitBarcode(product),
                    conversion_to_base: free.conversion_to_base || productConversionToBase(product),
                    price: 0,
                    promotion_id: free.promotion_id || null,
                    discount_amount: 0,
                    discount_price: 0,
                    discount_value: 0,
                    discount_type: '',
                    is_foc: true,
                    reward_id: free.reward_id || null,
                });
            });
        }

        return true;
    } catch (err) {
        selectedProducts.value = normalProducts.map(p => ({
            ...p,
            promotion_id: null,
            discount_amount: 0,
            discount_price: Number(p.price || 0),
            discount_value: 0,
            discount_type: '',
            is_foc: false,
            reward_id: null,
        }));
        orderDiscountAmount.value = 0;
        appliedPromotions.value = [];
        toast.add({
            severity: 'error',
            summary: 'Promotion Check Failed',
            detail: 'Unable to calculate promotions for selected products.',
            life: 3000
        });
        return false;
    }
}

watch(selectedBranch, async (branch) => {
    errorMsg.value.branch = "";
    syncWarehouseFromBranch(branch);
    await loadProductsForBranch(branch?.id);
    hydrateSelectedProductsFromCatalog();

    if (!branch) {
        selectedProducts.value = [];
        orderDiscountAmount.value = 0;
        appliedPromotions.value = [];
        return;
    }

    if (selectedProducts.value.length > 0) {
        await recalculatePromotions();
    }
});

watch([selectedWarehouse, () => formData.value.salesDate], () => {
    if (selectedProducts.value.length > 0) {
        recalculatePromotions();
    }
});

// Form Submit function
async function formSubmit(isPrint = false) {
    errorMsg.value = {
        customer: "",
        branch: "",
        warehouse: "",
    };

    if (!selectedCustomer.value?.id) {
        errorMsg.value.customer = "Please select a customer.";
        return;
    }

    if (!selectedBranch.value?.id) {
        errorMsg.value.branch = "Please select a branch.";
        return;
    }

    if (!selectedWarehouse.value?.id && !selectedBranch.value?.warehouse_id) {
        errorMsg.value.warehouse = "Selected branch does not have a warehouse.";
        return;
    }

    const promotionsOk = await recalculatePromotions();
    if (!promotionsOk) return;

    let payload = {
        customer_id: selectedCustomer.value.id,
        payment_id: formData.value.paymentId,
        status_id: useStatus.getStatusId('Complete'),
        remark: formData.value.remark,
        sale_date: formData.value.salesDate,
        branch_id: selectedBranch.value.id,
        warehouse_id: selectedWarehouse.value?.id || selectedBranch.value.warehouse_id,
        created_by: userData.value.id,
        paid_amount: formData.value.paidAmount,
        order_discount_amount: orderDiscountAmount.value,
        applied_promotions: appliedPromotions.value,
        products: selectedProducts.value.map(p => ({
            product_id: p.id,
            ...productLineUomSnapshot(p, p.quantity),
            quantity: p.quantity,
            price: p.is_foc ? 0 : p.price,
            original_price: p.is_foc ? 0 : p.price,
            promotion_id: p.promotion_id || null,
            discount_amount: p.is_foc ? 0 : (p.discount_amount || 0),
            discount_price: p.is_foc ? 0 : (p.discount_price || 0),
            is_foc: p.is_foc ? true : false,
            reward_id: p.reward_id || null,
        }))
    }
    console.log('Final sales create payload:', payload);
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
        return;
    }
    if (useSales.salesList) {
        // let updatedSales = {
        //     payment_id: formData.value.paymentId,
        //     status_id: 7, // set to 'Completed' after creation
        //     paid_amount: useSales.salesList.total_amount,
        //     remark: formData.value.remark,
        //     sale_date: formData.value.salesDate,
        //     updated_by: userData.value.id,
        // };
        // await useSales.editSales(updatedSales, useSales.salesList.id);
        // if (useSales.error.length) {
        //     useSales.error.forEach((msg) => {
        //         toast.add({
        //             severity: 'error',
        //             summary: 'Error Message',
        //             detail: msg,
        //             life: 3000
        //         });
        //     });
        //     return;
        // }
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Sales create successfully.', life: 3000 });
        if (isPrint) printSlip();
        router.push('/sales');
    }
    
}

function onCustomerFilter(e) {
  const query = e.value?.trim()
  if (!query) return

  // Barcode scanners usually end with Enter → full ID present
  const matched = useCustomer.customerList.find(
    c => String(c.id) === query
  )

  if (matched) {
    selectedCustomer.value = matched

    // Clear filter input
    customerSelect.value?.resetFilter()

    // Return focus to barcode scanning (important for Android)
    nextTick(() => {
      document.activeElement?.blur()
    })
  }
}

// Print only the slip section between the markers
function printSlip() {
  const slip = document.getElementById('slip-section');
  if (!slip) {
    alert('Slip section not found');
    return;
  }

  // Build minimal printable document
  const printWindow = window.open('', '', 'width=400,height=600')
  if (!printWindow) {
    alert('Unable to open print window. Please allow popups.');
    return;
  }

  const doc = printWindow.document;
  const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Receipt</title>
          <style>
            /* ============ PRINT STYLES FOR 80MM THERMAL RECEIPT ============ */
            @page {
              size: 384px auto;
              margin: 5mm;
            }

            body {
              width: 384px;
              font-family: 'Courier New', monospace;
              font-size: 11px;
              color: #000;
              margin: 0 auto;
              padding: 0;
              line-height: 1.3;
            }

            

            /* Hide anything extra in print */
            @media print {
              body {
                width: 80mm;
              }
            }
          </style>
        </head>
        <body>
          ${slip.innerHTML}
        </body>
      </html>
    `;

  doc.open();
  doc.write(html);
  doc.close();

  // Wait a short time to ensure images/fonts load
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    // Optionally close window after printing
    // printWindow.close();
  }, 500);
}

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Create Sales">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary"
                        @click="changeRoute('/sales')" />
                </div>
            </template>
        </PageTitle>
        <!-- Form Section -->
        <BaseCard class="mt-3 w-full">
            <template #cardElements>
                <!-- Form section subtitle -->
                <SubTitle label="Basic Info" />
                <div class="grid lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                    <!-- Customer -->
                    <div class="flex flex-col gap-y-1">
                        <BaseLabel label="Customer" :isRequire="true" />
                        <Select
                            ref="customerSelect"
                            v-model="selectedCustomer"
                            :options="useCustomer.customerList"
                            filter
                            showClear
                            optionLabel="id"
                            placeholder="Select a customer"
                            class="h-[35px] items-center"
                            @filter="onCustomerFilter"
                        >
                            <template #value="{ value }">
                                <div v-if="value" class="flex flex-col">
                                <span>{{ value.id }} | {{ value.name }}</span>
                                </div>
                            </template>

                            <template #option="{ option }">
                                <div class="flex flex-col">
                                <span>{{ option.id }} | {{ option.name }}</span>
                                </div>
                            </template>
                        </Select>
                        <BaseErrorLabel v-if="errorMsg.customer" :label="errorMsg.customer" />
                    </div>
                    <!-- Branch -->
                    <div class="flex flex-col gap-y-1">
                        <BaseLabel label="Branch" :isRequire="true" />
                        <Select v-model="selectedBranch" :options="useBranch.branchList" showClear filter
                            optionLabel="name" placeholder="Select a branch"
                            class="h-[35px] items-center" />
                        <BaseErrorLabel v-if="errorMsg.branch" :label="errorMsg.branch" />
                    </div>
                    <!-- Warehouse -->
                    <div class="flex flex-col gap-y-1">
                        <BaseLabel label="Warehouse" :isRequire="true" />
                        <BaseInput size="sm" :modelValue="selectedWarehouse?.name || ''" placeholder="Warehouse"
                            height="h-[35px]" disabled />
                        <BaseErrorLabel v-if="errorMsg.warehouse" :label="errorMsg.warehouse" />
                    </div>
                    <!-- Sales date input -->
                    <BaseInput size="sm" v-model="formData.salesDate" label="Sales Date" height="h-[35px]"
                        type="datetime-local" />
                    <div class="flex flex-col gap-1">
                        <BaseLabel label="Payment Method:" />
                        <select class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px]"
                            v-model="formData.paymentId">
                            <option v-for="payment in usePaymentMethod.paymentMethodList" :value="payment.id">{{
                                payment.name }}</option>
                        </select>
                    </div>
                    <!-- Remark input -->
                    <BaseInput class="col-span-2" size="sm" v-model="formData.remark" label="Remark"
                        placeholder="Reason for adjustment" height="h-[35px]" type="text" />
                </div>
                <!-- Selected Product Section -->
                <div class="flex flex-col">
                    <!-- Select Product Button -->
                    <BaseButton label="Select Products" class="w-fit mt-4 mb-4"
                        :icon="useProduct.loading ? 'fa fa-spinner' : ''"
                        :isLoading="useProduct.loading"
                        :disabled="!selectedBranch || useProduct.loading"
                        @click="openProductDialog()" />
                    <!-- Selected Products Table (scrollable with fixed header) -->
                    <div class="mt-4">
                        <div class="max-h-[350px] overflow-y-auto rounded">
                            <table class="w-full text-sm border-separate border-spacing-0 border border-gray-200">
                                <thead class="sticky top-0">
                                    <tr class="text-left text-black bg-gray-100">
                                        <th class="p-2">Image</th>
                                        <th class="p-2">Product Name</th>
                                        <th class="p-2">Unit</th>
                                        <th class="p-2">Barcode</th>
                                        <th class="p-2 text-right">Unit Price</th>
                                        <th class="p-2 text-right">Discount</th>
                                        <th class="p-2 text-right">Price</th>
                                        <th class="p-2 text-right">Qty</th>
                                        <th class="p-2 text-right">Total</th>
                                        <th class="p-2">&nbsp;</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="product in selectedProducts" :key="`${product.id}-${product.is_foc ? 'foc' : 'sale'}-${product.reward_id || 'none'}`"
                                        class="border-b border-gray-200 hover:bg-blue-50">
                                        <td class="p-2">
                                            <div class="w-12 h-12 overflow-hidden rounded">
                                                <img :src="product.image_url" alt="product"
                                                    class="w-full h-full object-cover" />
                                            </div>
                                        </td>
                                        <td class="p-2">{{ product.name }}</td>
                                        <td class="p-2">
                                            <select
                                                v-model="product.product_unit_id"
                                                class="border border-gray-300 rounded px-2 py-1 min-w-[120px]"
                                                :disabled="product.is_foc"
                                                @change="onProductUnitChange(product)"
                                            >
                                                <option v-if="(product.product_units || []).length === 0" :value="null">{{ product.unit_name || '-' }}</option>
                                                <option v-for="unit in product.product_units" :key="unit.id" :value="unit.id">{{ unit.unit_id?.name || unit.unit_name }}</option>
                                            </select>
                                        </td>
                                        <td class="p-2">{{ product.barcode }}</td>
                                        <td class="p-2 text-right">
                                            <input type="number" min="0" class="w-32 text-right px-1 py-1 border rounded" :class="{ 'bg-gray-100': product.is_foc }" v-model.number="product.price" @input="onChangePrice(product)" :readonly="product.is_foc" />
                                            <!-- {{ Number(product.price).toLocaleString() }} -->
                                        </td>
                                        <td class="p-2 text-right">
                                            <span v-if="product.is_foc">FOC</span>
                                            <span v-else-if="product.promotion_id">
                                                {{ product.discount_type === 'AMOUNT' ? Number(product.discount_amount || 0).toLocaleString() : product.discount_value + '%' }}
                                            </span>
                                            <span v-else>0</span>
                                        </td>
                                        <td class="p-2 text-right">
                                            {{ product.promotion_id ? Number(product.discount_price).toLocaleString() : Number(product.price).toLocaleString() }}
                                        </td>
                                        <td class="p-2 text-right">
                                            <input type="number" min="0" class="w-20 text-right px-1 py-1 border rounded" :class="{ 'bg-gray-100': product.is_foc }" v-model.number="product.quantity" @input="onChangeQty(product)" :readonly="product.is_foc" />
                                        </td>
                                        <td class="p-2 text-right">{{ product.promotion_id ? Number(product.discount_price) * product.quantity : Number(product.price) * product.quantity }}</td>
                                        <td class="p-2 text-right">
                                            <button v-if="!product.is_foc" class="text-red-600 hover:text-red-800 px-2 py-1"
                                                @click="removeSelectedProduct(product)"><i
                                                    class="pi pi-trash"></i></button>
                                        </td>
                                    </tr>
                                    <tr v-if="selectedProducts.length === 0">
                                        <td colspan="10" class="py-4 text-center text-gray-500">No products selected</td>
                                    </tr>
                                </tbody>
                                <tfoot class="sticky bottom-0 z-20 bg-gray-100">
                                    <tr class="font-bold">
                                        <td colspan="7" class="p-2 text-right bg-gray-100 border-t border-gray-300">Product Total</td>
                                        <td class="p-2 text-right bg-gray-100 border-t border-gray-300">
                                            {{
                                                selectedProducts.reduce((sum, p) => {
                                                    return sum + Number(p.quantity);
                                                }, 0).toLocaleString()
                                            }}
                                        </td>
                                        <td class="p-2 text-right bg-gray-100 border-t border-gray-300">{{ productTotalAmount.toLocaleString() }}</td>
                                        <td class="bg-gray-100 border-t border-gray-300">&nbsp;</td>
                                    </tr>
                                    <tr v-if="orderDiscountAmount > 0" class="font-bold">
                                        <td colspan="7" class="p-2 text-right bg-gray-100 border-t border-gray-200">Order Discount Amount</td>
                                        <td class="bg-gray-100 border-t border-gray-200">&nbsp;</td>
                                        <td class="p-2 text-right bg-gray-100 border-t border-gray-200">-{{ Number(orderDiscountAmount).toLocaleString() }}</td>
                                        <td class="bg-gray-100 border-t border-gray-200">&nbsp;</td>
                                    </tr>
                                    <tr class="font-bold">
                                        <td colspan="7" class="p-2 text-right bg-gray-100 border-t border-gray-300">Grand Total</td>
                                        <td class="bg-gray-100 border-t border-gray-300">&nbsp;</td>
                                        <td class="p-2 text-right bg-gray-100 border-t border-gray-300">{{ grandTotalAmount.toLocaleString() }}</td>
                                        <td class="bg-gray-100 border-t border-gray-300">&nbsp;</td>
                                    </tr>
                                </tfoot>
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
                            <div class="text-sm text-black">{{ selectionBuffer.length }} selected</div>
                        </div>
                        <div class="py-4 flex gap-x-2 items-center">
                            <input v-model="searchTerm" placeholder="Search by name or barcode"
                                class="border p-2 rounded w-full" />
                        </div>
                        <div class="py-4 overflow-auto max-h-[50vh]">
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="text-left text-black border-b">
                                        <th class="py-2">
                                            <div class="flex items-center gap-x-2">
                                                <span v-if="isSelectAllLoading" class="text-sm text-black"><i
                                                        class="fa fa-spinner fa-spin"></i></span>
                                                <input v-else type="checkbox" :checked="allFilteredSelected"
                                                    @change="toggleHeaderSelection" ref="headerCheckboxRef"
                                                    :disabled="isCheckingAll || isSelectAllLoading" />
                                            </div>
                                        </th>
                                        <th>Image</th>
                                        <th class="py-2">Name</th>
                                        <th class="py-2">Barcode</th>
                                        <th class="py-2 text-end">Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="product in filteredProducts" :key="product.id" class="hover:bg-blue-50">
                                        <td class="py-2">
                                            <input type="checkbox" :checked="isBufferSelected(product)"
                                                @change="toggleProductInBuffer($event, product)" />
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
                            <BaseButton severity="secondary" label="Cancel" @click="cancelProductSelection" />
                            <BaseButton label="Add Product" class="px-4 py-2 bg-blue-600 text-white rounded"
                                @click="confirmProductSelection" />
                        </div>
                    </div>
                </div>
                <div class="mt-4 text-black font-semibold flex justify-end">
                    <div class="grid items-center gap-x-3" style="grid-template-columns: auto 0.5rem minmax(140px,220px);">
                        <span class="whitespace-nowrap">Paid Amount</span>
                        <span class="text-right">:</span>
                        <BaseInput size="sm" v-model="formData.paidAmount" height="h-[35px]" type="number" />
                    </div>
                </div>
                <div class="mt-1 text-black font-semibold flex justify-end">
                    <div class="grid items-center gap-x-3" style="grid-template-columns: auto 0.5rem minmax(140px,220px);">
                        <span class="whitespace-nowrap">Change Amount</span>
                        <span class="text-right">:</span>
                        <span class="font-bold text-right">{{ Number(changeAmount).toLocaleString('en-us') }}</span>
                    </div>
                </div>
                <div class="flex justify-end mt-4">
                    <!-- Save Button -->
                    <BaseButton label="Save" :isLoading="useSales.loading"
                        :icon="useSales.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary"
                        @click="formSubmit" :disabled="useSales.loading" />
                </div>
            </template>
        </BaseCard>
    </div>
</template>
