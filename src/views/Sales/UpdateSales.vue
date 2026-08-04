<script setup>

import PageTitle from '@/components/PageTitle.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseCard from '@/components/BaseCard.vue';
import SubTitle from '@/components/SubTitle.vue';
import { useRoute, useRouter } from 'vue-router';
import BaseInput from '@/components/BaseInput.vue';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import BaseLabel from '@/components/BaseLabel.vue';
import { useSaleStore } from '@/stores/useSalesStore';
import moment from 'moment';
import { usePaymentMethodStore } from '@/stores/usePaymentMethodStore';
import { useProductStore } from '@/stores/useProductStore';
import axios from 'axios';
import { Select } from 'primevue';
import { useBranchStore } from '@/stores/useBranchStore';
import { useWarehouseStore } from '@/stores/useWarehouseStore';
import BaseErrorLabel from '@/components/BaseErrorLabel.vue';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const useSales = useSaleStore();
const usePaymentMethod = usePaymentMethodStore();
const useProduct = useProductStore();
const useBranch = useBranchStore();
const useWarehouse = useWarehouseStore();

const userData = ref({});
const selectedProducts = ref([]);
const oldSelectedProducts = ref([]);
const selectedBranch = ref(null);
const selectedWarehouse = ref(null);
const isProductDialogVisible = ref(false);
const productList = ref([]);
const searchTerm = ref('');
const selectionBuffer = ref([]);
const headerCheckboxRef = ref(null);
const isCheckingAll = ref(false);
const isSelectAllLoading = ref(false);
const appliedPromotions = ref([]);
const isInitializing = ref(true);
const formData = ref({
  salesId: '',
  warehouseId: '',
  customerId: '',
  paymentId: '1',
  remark: '',
  productTotal: 0,
  totalAmount: 0,
  paidAmount: 0,
  changeAmount: 0,
  orderDiscountAmount: 0,
  salesDate: moment().format('YYYY-MM-DDTHH:mm'),
  products: [],
})
const errorMsg = ref({
  branch: "",
  warehouse: "",
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

const totalAmount = computed(() => {
  return selectedProducts.value.reduce((sum, p) => {
    if (p.isFoc) return sum;
    return sum + (saleLinePrice(p) * Number(p.quantity || 0));
  }, 0);
});

const grandTotalAmount = computed(() => {
  return Math.max(0, totalAmount.value - Number(formData.value.orderDiscountAmount || 0));
});

const changeAmount = computed(() => Number(formData.value.paidAmount || 0) - grandTotalAmount.value);

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

function explicitProductUnitId(item = {}) {
  return item.product_unit_id
    || item.uom?.product_unit_id
    || item.product_unit?.product_unit_id
    || item.product_unit?.id
    || null;
}

function lineKey(product) {
  return `${Number(product?.product_id || product?.id || 0)}:${Number(product?.product_unit_id || 0)}`;
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

function productHasSelectedUnit(product) {
  return (product.product_units || []).some(unit => Number(unit.id) === Number(product.product_unit_id));
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
    price_range_id: product?.priceRangeId || product?.price_range_id || null,
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

function promotionIdFor(value) {
  return value?.promotion_id ?? value?.promotion?.id ?? null;
}

function promotionDetailsFor(pricedItem, promotionItems = []) {
  const promotionId = promotionIdFor(pricedItem);
  if (!promotionId) return null;

  return promotionItems.find(item => (
    sameProductUnit(item, pricedItem)
    && Number(promotionIdFor(item)) === Number(promotionId)
  )) || null;
}

function saleLinePrice(product) {
  if (product?.isFoc) return 0;
  if (product?.finalPrice !== null && product?.finalPrice !== undefined) {
    return Number(product.finalPrice) || 0;
  }
  return Number(product?.price || 0);
}

function promotionTypeLabel(type) {
  const labels = {
    PRODUCT_DISCOUNT: 'Product discount',
    PRICE_OVERRIDE: 'Price override',
    ORDER_DISCOUNT: 'Order discount',
    FOC: 'Free item',
  };
  return labels[type] || 'Promotion';
}

function promotionDisplayLabel(product) {
  if (!product?.promotionId) return '';
  const suffix = product.promotionName || `#${product.promotionId}`;
  return `${promotionTypeLabel(product.promoType)} · ${suffix}`;
}

// Change route function
function changeRoute(pathname) {
  router.push(pathname);
}

onMounted(async () => {
  userData.value = JSON.parse(localStorage.getItem('user'));
  await Promise.all([
    useSales.fetchSales(route.query.id),
    usePaymentMethod.fetchAllPaymentMethod(),
    useBranch.fetchAllBranch(),
    useWarehouse.fetchAllWarehouse(),
  ]);

  const saleBranch = useSales.salesList.branch || useSales.salesList.warehouse?.branch || null;
  selectedBranch.value = (useBranch.branchList || []).find(branch => Number(branch.id) === Number(saleBranch?.id || useSales.salesList.branch_id))
    || saleBranch
    || null;
  syncWarehouseFromBranch(selectedBranch.value);

  formData.value = {
    salesId: useSales.salesList.id,
    branchId: selectedBranch.value?.id || '',
    branchName: selectedBranch.value?.name || '',
    warehouseId: selectedWarehouse.value?.id || '',
    warehouseName: selectedWarehouse.value?.name || '',
    customerName: useSales.salesList.customer.name,
    customerId: useSales.salesList.customer.id,
    paymentId: useSales.salesList.payment_method.id,
    paymentMethodName: useSales.salesList.payment_method.name,
    productTotal: Number(useSales.salesList.totalAmount) + Number(useSales.salesList.order_discount_amount),
    orderDiscountAmount: Number(useSales.salesList.order_discount_amount),
    totalAmount: Number(useSales.salesList.total_amount),
    paidAmount: Number(useSales.salesList.paid_amount),
    changeAmount: Number(useSales.salesList.due_amount),
    statusId: useSales.salesList.status.id,
    remark: useSales.salesList.remark,
    salesDate: moment(useSales.salesList.sale_date).format('YYYY-MM-DDTHH:mm'),
  };
  console.log('Sales Details:', useSales.salesList.details);
  selectedProducts.value = mergeSelectedProducts(useSales.salesList.details || []);
  appliedPromotions.value = useSales.salesList.applied_promotions || [];
  oldSelectedProducts.value = JSON.parse(JSON.stringify(selectedProducts.value));
  await loadProductsForBranch(selectedBranch.value?.id);
  hydrateSelectedProductsFromCatalog();
  await nextTick();
  isInitializing.value = false;
});

function branchWarehouse(branch) {
  return branch?.warehouse
    || (useWarehouse.warehouseList || []).find(warehouse => Number(warehouse.id) === Number(branch?.warehouse_id))
    || null;
}

function syncWarehouseFromBranch(branch) {
  if (!branch) {
    selectedWarehouse.value = null;
    formData.value.branchId = '';
    formData.value.branchName = '';
    formData.value.warehouseId = '';
    formData.value.warehouseName = '';
    return;
  }

  const warehouse = branchWarehouse(branch);
  selectedWarehouse.value = warehouse || null;
  formData.value.branchId = branch?.id || '';
  formData.value.branchName = branch?.name || '';
  formData.value.warehouseId = selectedWarehouse.value?.id || branch?.warehouse_id || '';
  formData.value.warehouseName = selectedWarehouse.value?.name || '';
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
    console.log('Catalog Product for Selected Product', product.id, catalogProduct);
    const catalogUnits = catalogProduct.product_units || product.product_units || [];
    console.log('Catalog Units for Product', product.id, catalogUnits);
    const matchedUnit = catalogUnits.find(unit => Number(unit.id) === Number(product.product_unit_id))
      || catalogUnits.find(unit => Number(recordId(unit.unit_id)) === Number(recordId(product.unit_id)))
      || catalogUnits.find(unit => (unit.unit_id?.name || unit.unit_name) === product.unit_name)
      || null;

    return {
      ...product,
      image_url: product.image_url || catalogProduct.image_url,
      base_barcode: product.base_barcode || catalogProduct.barcode,
      product_units: catalogUnits,
      product_unit_id: matchedUnit?.id || product.product_unit_id || null,
      unit_id: matchedUnit ? recordId(matchedUnit.unit_id) : product.unit_id,
      unit_name: matchedUnit ? (matchedUnit.unit_id?.name || matchedUnit.unit_name || product.unit_name) : product.unit_name,
      unit_barcode: matchedUnit?.barcode || product.unit_barcode,
      conversion_to_base: matchedUnit ? Number(matchedUnit.conversion_to_base || 1) : product.conversion_to_base,
      barcode: matchedUnit?.barcode || product.barcode,
    };
  });
}

function mergeSelectedProducts(details = []) {
  const mergedProducts = new Map();

  details.forEach((item, index) => {
    const product = item.product || {};
    const productId = item.product_id ?? product.id;
    if (!productId) return;

    const quantity = Number(item.quantity || 0);
    if (quantity <= 0) return;

    const promotionId = item.promotion?.id ?? item.promotion_id ?? null;
    const promoType = item.promo_type ?? item.promotion?.promo_type ?? null;
    const promotionName = item.promotion_name ?? item.promotion?.name ?? null;
    const discountType = item.promotion?.discount_type ?? item.discount_type ?? null;
    const discountValue = Number(item.promotion?.discount_value ?? item.discount_value ?? 0);
    const unitPrice = Number(item.price ?? product.price ?? 0);
    const unitDiscountAmount = Number(item.discount_amount ?? 0);
    const unitDiscountPrice = Number(item.discount_price ?? (unitPrice - unitDiscountAmount));
    const totalPrice = Number(item.total ?? 0);
    const isFree = Boolean(item.is_foc ?? false);
    const rewardId = item.reward_id ?? item.reward?.id ?? null;

    const mergeKey = [
      productId,
      promotionId ?? 'no-promo',
      discountType ?? 'NO_DISCOUNT',
      discountValue,
      unitPrice,
      unitDiscountAmount,
      unitDiscountPrice,
      isFree ? 1 : 0,
      rewardId ?? 'no-reward',
    ].join('|');

    const existing = mergedProducts.get(mergeKey);
    if (existing) {
      existing.quantity += quantity;
      existing.total += totalPrice;
      return;
    }

    mergedProducts.set(mergeKey, {
      id: productId,
      name: product.name || '',
      barcode: product.barcode || '',
      base_barcode: product.base_barcode || product.barcode || '',
      image_url: product.image_url || '',
      quantity: quantity,
      product_units: product.product_units || [],
      product_unit_id: explicitProductUnitId(item),
      unit_id: item.unit_id || item.unit?.id || recordId(item.product_unit?.unit_id) || null,
      unit_name: item.unit_name || item.unit?.name || item.product_unit?.unit_name || productUnitName(product),
      unit_barcode: item.unit_barcode || item.product_unit?.barcode || productUnitBarcode(product),
      conversion_to_base: item.conversion_to_base || item.product_unit?.conversion_to_base || productConversionToBase(product),
      price: unitPrice,
      originalPrice: Number(item.original_price ?? unitPrice),
      finalPrice: Number(item.final_price ?? unitDiscountPrice),
      discountAmount: unitDiscountAmount,
      discountPrice: unitDiscountPrice,
      total: totalPrice,
      promotionId: promotionId,
      promoType: promoType,
      promotionName: promotionName,
      discountType: discountType,
      discountValue: discountValue,
      isFoc: isFree,
      rewardId: rewardId,
    });
  });

  console.log('Merged selected products:', Array.from(mergedProducts.values()));
  return Array.from(mergedProducts.values());
}

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

  const selectedIds = new Set(selectedProducts.value.filter(p => !p.isFoc).map(p => Number(p.id)));
  selectionBuffer.value = (productList.value || []).filter(p => selectedIds.has(Number(p.id)));
  searchTerm.value = '';
  isProductDialogVisible.value = true;
}

async function toggleProductInBuffer(event, product) {
  const idx = selectionBuffer.value.findIndex(p => p.id === product.id);
  if (idx !== -1) {
    selectionBuffer.value.splice(idx, 1);
    return;
  }
  selectionBuffer.value.push(product);
}

function isBufferSelected(product) {
  return selectionBuffer.value.some(p => p.id === product.id);
}

async function selectAllInBuffer() {
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

async function toggleHeaderSelection(event) {
  const checked = event.target.checked;
  if (checked) await selectAllInBuffer();
  else removeFilteredFromBuffer();
}

watch([() => selectionBuffer.value, () => productList.value, () => searchTerm.value], () => {
  if (headerCheckboxRef.value) {
    headerCheckboxRef.value.indeterminate = someFilteredSelected.value;
  }
});

async function confirmProductSelection() {
  const existingByLine = new Map(selectedProducts.value.filter(p => !p.isFoc).map(p => [lineKey(p), p]));
  const existingByProduct = new Map(selectedProducts.value.filter(p => !p.isFoc).map(p => [Number(p.id), p]));
  const selected = selectionBuffer.value.map((p) => {
    const defaultUnitId = productUnitId(p);
    const existing = existingByLine.get(`${Number(p.id)}:${Number(defaultUnitId || 0)}`)
      || existingByProduct.get(Number(p.id));
    const basePrice = Number(existing?.price ?? p.price ?? 0);

    return {
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      base_barcode: p.base_barcode || p.barcode,
      quantity: Number(existing?.quantity) || 1,
      image_url: p.image_url,
      product_units: p.product_units || [],
      product_unit_id: existing?.product_unit_id || productUnitId(p),
      unit_id: existing?.unit_id || productUnitUnitId(p),
      unit_name: existing?.unit_name || productUnitName(p),
      unit_barcode: existing?.unit_barcode || productUnitBarcode(p),
      conversion_to_base: existing?.conversion_to_base || productConversionToBase(p),
      price: basePrice,
      originalPrice: Number(existing?.originalPrice ?? basePrice),
      finalPrice: existing?.finalPrice ?? null,
      promotionId: existing?.promotionId || null,
      promoType: existing?.promoType || null,
      promotionName: existing?.promotionName || null,
      discountAmount: Number(existing?.discountAmount) || 0,
      discountPrice: Number(existing?.discountPrice ?? basePrice),
      discountValue: Number(existing?.discountValue) || 0,
      discountType: existing?.discountType || '',
      isFoc: false,
      rewardId: null,
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
  if (product.isFoc) return;
  product.quantity = Number(product.quantity) || 0;
  if (product.quantity < 0) product.quantity = 0;
  recalculatePromotions();
}

function onChangePrice(product) {
  if (product.isFoc) return;
  product.price = Number(product.price) || 0;
  if (product.price < 0) product.price = 0;
  recalculatePromotions();
}

function onProductUnitChange(product) {
  if (product.isFoc) return;

  const unit = (product.product_units || []).find(item => Number(item.id) === Number(product.product_unit_id));
  product.unit_id = recordId(unit?.unit_id) || null;
  product.unit_name = unit?.unit_id?.name || unit?.unit_name || '-';
  product.unit_barcode = unit?.barcode || null;
  product.conversion_to_base = Number(unit?.conversion_to_base || 1);
  product.barcode = unit?.barcode || product.base_barcode || product.barcode || '';
  product.price = 0;
  product.originalPrice = 0;
  product.finalPrice = null;
  product.discountAmount = 0;
  product.discountPrice = 0;
  product.promotionId = null;
  product.promoType = null;
  product.promotionName = null;
  product.priceSource = null;
  product.priceRangeId = null;
  recalculatePromotions();
}

function removeProduct(product) {
  selectedProducts.value = selectedProducts.value.filter(p => p.id !== product.id);
  recalculatePromotions();
}

async function recalculatePromotions() {
  const normalProducts = selectedProducts.value.filter(p => !p.isFoc && Number(p.quantity || 0) > 0);

  if (normalProducts.length === 0) {
    selectedProducts.value = [];
    formData.value.orderDiscountAmount = 0;
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
      if (!pricedItem) {
        throw new Error(`Missing priced item for product ${p.id}.`);
      }

      const promotionId = promotionIdFor(pricedItem);
      const promotionDetails = promotionDetailsFor(pricedItem, data.items || []);
      const originalPrice = Number(pricedItem.original_price ?? pricedItem.price ?? p.price ?? 0);
      const finalPrice = Number(pricedItem.final_price ?? originalPrice);

      return {
        ...p,
        price: originalPrice,
        originalPrice,
        finalPrice,
        priceSource: pricedItem?.price_source || null,
        priceRangeId: pricedItem?.price_range_id || null,
        promotionId,
        promoType: pricedItem.promo_type ?? promotionDetails?.promo_type ?? null,
        promotionName: pricedItem.promotion_name
          ?? pricedItem.promotion?.name
          ?? promotionDetails?.promotion_name
          ?? promotionDetails?.promotion?.name
          ?? null,
        discountAmount: promotionId
          ? Number(pricedItem.discount_amount ?? Math.max(0, originalPrice - finalPrice))
          : 0,
        discountPrice: finalPrice,
        discountValue: promotionId
          ? Number(pricedItem.discount_value ?? promotionDetails?.discount_value ?? 0)
          : 0,
        discountType: promotionId
          ? (pricedItem.discount_type ?? promotionDetails?.discount_type ?? '')
          : '',
        isFoc: false,
        rewardId: null,
      };
    });

    formData.value.orderDiscountAmount = Number(data.order?.total_discount) || 0;
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
          originalPrice: 0,
          finalPrice: 0,
          promotionId: free.promotion_id || null,
          promoType: free.promo_type || 'FOC',
          promotionName: free.promotion_name || free.promotion?.name || null,
          discountAmount: 0,
          discountPrice: 0,
          discountValue: 0,
          discountType: '',
          isFoc: true,
          rewardId: free.reward_id || null,
        });
      });
    }

    return true;
  } catch (err) {
    selectedProducts.value = normalProducts.map(p => ({
      ...p,
      originalPrice: Number(p.price || 0),
      finalPrice: Number(p.price || 0),
      promotionId: null,
      promoType: null,
      promotionName: null,
      discountAmount: 0,
      discountPrice: Number(p.price || 0),
      discountValue: 0,
      discountType: '',
      isFoc: false,
      rewardId: null,
    }));
    formData.value.orderDiscountAmount = 0;
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
  if (isInitializing.value) return;

  errorMsg.value.branch = "";
  syncWarehouseFromBranch(branch);
  await loadProductsForBranch(branch?.id);
  hydrateSelectedProductsFromCatalog();

  if (!branch) {
    selectedProducts.value = [];
    formData.value.orderDiscountAmount = 0;
    appliedPromotions.value = [];
    return;
  }

  if (selectedProducts.value.length > 0) {
    await recalculatePromotions();
  }
});

watch([() => formData.value.warehouseId, () => formData.value.salesDate], () => {
  if (isInitializing.value) return;

  if (selectedProducts.value.length > 0) {
    recalculatePromotions();
  }
});

function areSelectedProdsEqual() {
  if (!Array.isArray(oldSelectedProducts.value)) return false;

  const normalize = (products = []) => products
    .map(p => ({
      id: Number(p.id),
      productUnitId: Number(p.product_unit_id || 0),
      unitId: Number(recordId(p.unit_id) || 0),
      quantity: Number(p.quantity) || 0,
      price: Number(p.price) || 0,
      promotionId: p.promotionId || null,
      discountAmount: Number(p.discountAmount) || 0,
      discountPrice: Number(p.discountPrice) || 0,
      finalPrice: Number(p.finalPrice ?? p.price) || 0,
      promoType: p.promoType || null,
      isFoc: p.isFoc ? true : false,
      rewardId: p.rewardId || null,
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

  return JSON.stringify(normalize(oldSelectedProducts.value)) === JSON.stringify(normalize(selectedProducts.value));
}

// Form Submit function
async function formSubmit(isPrint = false) {
  errorMsg.value = {
    branch: "",
    warehouse: "",
  };

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
  const isProdsEqual = areSelectedProdsEqual();

  const payload = {
    remark: formData.value.remark,
    sale_date: formData.value.salesDate,
    updated_by: userData.value.id,
    payment_id: formData.value.paymentId,
    status_id: formData.value.statusId,
    paid_amount: formData.value.paidAmount,
    total_amount: grandTotalAmount.value,
    order_discount_amount: formData.value.orderDiscountAmount,
    applied_promotions: appliedPromotions.value,
    branch_id: selectedBranch.value.id,
    warehouse_id: selectedWarehouse.value?.id || selectedBranch.value.warehouse_id,
  }

  if (!isProdsEqual) {
    payload.products = selectedProducts.value.map(p => ({
      product_id: p.id,
      ...productLineUomSnapshot(p, p.quantity),
      quantity: p.quantity,
      price: p.isFoc ? 0 : Number(p.originalPrice ?? p.price),
      original_price: p.isFoc ? 0 : Number(p.originalPrice ?? p.price),
      promotion_id: p.promotionId || null,
      discount_amount: p.isFoc ? 0 : (Number(p.discountAmount) || 0),
      discount_price: p.isFoc ? 0 : saleLinePrice(p),
      is_foc: p.isFoc ? true : false,
      reward_id: p.rewardId || null,
    }));
  }

  console.log('Final sales update payload:', payload);
  await useSales.editSales(payload, route.query.id);
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
  toast.add({ severity: 'success', summary: 'Success Message', detail: 'Sales update successfully.', life: 3000 });
  if (isPrint) printSlip();
  router.push('/sales');
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
    <PageTitle title="Update Sales">
      <template #titleButtons>
        <div class="flex gap-x-2 items-center">
          <BaseButton icon="fa fa-chevron-left" label="Back" severity="secondary" @click="changeRoute('/sales')" />
        </div>
      </template>
    </PageTitle>
    <!-- Form Section -->
    <BaseCard class="mt-3 w-full">
      <template #cardElements>
        <!-- Form section subtitle -->
        <SubTitle label="Basic Info" />
        <div class="grid lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
          <!-- Sales Id Select -->
          <BaseInput size="sm" v-model="formData.salesId" label="Sales ID" placeholder="Sales ID" height="h-[35px]"
            disabled />
          <!-- Customer -->
          <BaseInput size="sm" v-model="formData.customerName" label="Customer" placeholder="Customer" height="h-[35px]"
            disabled />
          <!-- Branch -->
          <div class="flex flex-col gap-y-1">
            <BaseLabel label="Branch" :isRequire="true" />
            <Select v-model="selectedBranch" :options="useBranch.branchList" showClear filter
              optionLabel="name" placeholder="Select a branch" class="h-[35px] items-center" />
            <BaseErrorLabel v-if="errorMsg.branch" :label="errorMsg.branch" />
          </div>
          <!-- Warehouse -->
          <div class="flex flex-col gap-y-1">
            <BaseInput size="sm" v-model="formData.warehouseName" label="Warehouse" placeholder="Warehouse"
              height="h-[35px]" disabled />
            <BaseErrorLabel v-if="errorMsg.warehouse" :label="errorMsg.warehouse" />
          </div>
          <!-- Expired date input -->
          <BaseInput size="sm" v-model="formData.salesDate" label="Sales Date" height="h-[35px]"
            type="datetime-local" />
          <div class="flex flex-col gap-1">
            <BaseLabel label="Payment Method:" />
            <select class="text-md border border-gray-500 rounded-sm p-2 text-black w-full h-[35px]"
              v-model="formData.paymentId">
              <option v-for="payment in usePaymentMethod.paymentMethodList" :value="payment.id">{{ payment.name }}
              </option>
            </select>
          </div>
          <!-- Remark input -->
          <BaseInput class="col-span-2" size="sm" v-model="formData.remark" label="Remark"
            placeholder="Reason for adjustment" height="h-[35px]" type="text" />
        </div>
        <div class="flex justify-end mt-4 gap-x-2">
          <!-- Save Button -->
          <BaseButton label="Save" :isLoading="useSales.loading"
            :icon="useSales.loading ? 'fa fa-spinner' : 'fa fa-floppy-disk'" severity="primary" @click="formSubmit"
            :disabled="useSales.loading" />
          <BaseButton label="Save & Print" :isLoading="useSales.loading"
            :icon="useSales.loading ? 'fa fa-spinner' : 'fa fa-print'" severity="primary" @click="formSubmit(true)"
            :disabled="useSales.loading" />
        </div>
      </template>
    </BaseCard>
    <div class="flex flex-col">
      <BaseButton label="Select Products" class="w-fit mt-4 mb-4"
        :icon="useSales.loading || usePaymentMethod.loading || useProduct.loading ? 'fa fa-spinner' : ''"
        :isLoading="useSales.loading || usePaymentMethod.loading || useProduct.loading"
        :disabled="!selectedBranch || useSales.loading || usePaymentMethod.loading || useProduct.loading" @click="openProductDialog()" />
    </div>
    <div class="mt-3 max-h-[250px] overflow-y-auto">
      <table class="text-black w-full border-separate border-spacing-0 border border-gray-200">
        <thead class="sticky top-0">
          <tr class="text-left text-black bg-gray-100">
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
          <tr v-for="product in selectedProducts" :key="`${product.id}-${product.isFoc ? 'foc' : 'sale'}-${product.promotionId || 'none'}-${product.rewardId || 'none'}`"
            class="border-b border-gray-200 hover:bg-blue-50 text-right">
            <!-- <td class="p-2 text-left">
                      <div class="w-10 h-10 overflow-hidden rounded">
                        <img :src="product.image_url" alt="product" class="w-full h-full object-cover" />
                      </div>
                    </td> -->
            <td class="p-2 text-left">
              {{ product.name }}
              <span v-if="product.isFoc" class="text-blue-500 bg-blue-100 font-bold px-2 py-1 rounded-md"> FREE GIFT </span>
            </td>
            <td class="p-2 text-left">
              <select
                v-model="product.product_unit_id"
                class="border border-gray-300 rounded px-2 py-1 min-w-[120px]"
                :disabled="product.isFoc"
                @change="onProductUnitChange(product)"
              >
                <option v-if="(product.product_units || []).length === 0" :value="null">{{ product.unit_name || '-' }}</option>
                <option v-else-if="!productHasSelectedUnit(product)" :value="product.product_unit_id">{{ product.unit_name || '-' }}</option>
                <option v-for="unit in product.product_units" :key="unit.id" :value="unit.id">{{ unit.unit_id?.name || unit.unit_name }}</option>
              </select>
            </td>
            <td class="p-2 text-left">{{ product.barcode }}</td>
            <td class="p-2 text-right">
              <input type="number" min="0" class="w-32 text-right px-1 py-1 border rounded"
                :class="{ 'bg-gray-100': product.isFoc }" v-model.number="product.price"
                @input="onChangePrice(product)" :readonly="product.isFoc" />
            </td>
            <td class="p-2 text-right">
              <span v-if="product.isFoc">FOC</span>
              <div v-else-if="product.promotionId" class="flex flex-col items-end">
                <span class="font-medium text-emerald-700">{{ promotionDisplayLabel(product) }}</span>
                <span v-if="product.promoType === 'PRODUCT_DISCOUNT'" class="text-xs text-gray-500">
                  {{ product.discountType === 'AMOUNT' ? Number(product.discountAmount || 0).toLocaleString() : product.discountValue + '%' }}
                </span>
              </div>
              <span v-else>0</span>
            </td>
            <td class="p-2 text-right">
              {{ saleLinePrice(product).toLocaleString() }}
            </td>
            <td class="p-2 text-right">
              <input type="number" min="0" class="w-20 text-right px-1 py-1 border rounded"
                :class="{ 'bg-gray-100': product.isFoc }" v-model.number="product.quantity"
                @input="onChangeQty(product)" :readonly="product.isFoc" />
            </td>
            <td class="p-2 text-right">
              {{ (saleLinePrice(product) * Number(product.quantity)).toLocaleString() }}
            </td>
            <td class="p-2 text-right">
              <button v-if="!product.isFoc" class="text-red-600 hover:text-red-800 px-2 py-1" @click="removeProduct(product)">
                <i class="pi pi-trash"></i>
              </button>
            </td>
          </tr>
          <tr v-if="selectedProducts.length === 0">
            <td colspan="9" class="py-4 text-center text-gray-500">No products selected</td>
          </tr>
        </tbody>
        <!-- <tfoot class="sticky bottom-0 z-20 bg-gray-100">
          <tr class="font-bold">
            <td colspan="5" class="p-2 text-right bg-gray-100 border-t border-gray-300">Product Total</td>
            <td class="p-2 text-right bg-gray-100 border-t border-gray-300">
              {{
                selectedProducts.reduce((sum, p) => {
                  return sum + Number(p.quantity || 0);
                }, 0).toLocaleString()
              }}
            </td>
            <td class="p-2 text-right bg-gray-100 border-t border-gray-300">{{ totalAmount.toLocaleString() }}</td>
            <td class="bg-gray-100 border-t border-gray-300">&nbsp;</td>
          </tr>
          <tr class="font-bold">
            <td colspan="5" class="p-2 text-right bg-gray-100 border-t border-gray-200">Order Discount Amount</td>
            <td class="bg-gray-100 border-t border-gray-200">&nbsp;</td>
            <td class="p-2 text-right bg-gray-100 border-t border-gray-200">-{{ Number(formData.orderDiscountAmount).toLocaleString() }}</td>
            <td class="bg-gray-100 border-t border-gray-200">&nbsp;</td>
          </tr>
          <tr class="font-bold">
            <td colspan="5" class="p-2 text-right bg-gray-100 border-t border-gray-300">Grand Total</td>
            <td class="bg-gray-100 border-t border-gray-300">&nbsp;</td>
            <td class="p-2 text-right bg-gray-100 border-t border-gray-300">{{ grandTotalAmount.toLocaleString() }}</td>
            <td class="bg-gray-100 border-t border-gray-300">&nbsp;</td>
          </tr>
        </tfoot> -->
      </table>
    </div>
    <div v-if="isProductDialogVisible" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black opacity-50" @click="cancelProductSelection"></div>
      <div class="bg-white rounded shadow-lg w-[90%] max-w-4xl max-h-[80vh] overflow-hidden z-10 p-4">
        <div class="flex items-center justify-between mb-2 border-b">
          <SubTitle label="Select Products" />
          <div class="text-sm text-black">{{ selectionBuffer.length }} selected</div>
        </div>
        <div class="mb-2 flex gap-x-2 items-center">
          <BaseInput v-model="searchTerm" placeholder="Search by name or barcode" />
        </div>
        <div class="mb-2 overflow-auto max-h-[50vh]">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-black border-b">
                <th class="py-2">
                  <div class="flex items-center gap-x-2">
                    <span v-if="isSelectAllLoading" class="text-sm text-black"><i
                        class="fa fa-spinner fa-spin"></i></span>
                    <input v-else type="checkbox" :checked="allFilteredSelected" @change="toggleHeaderSelection"
                      ref="headerCheckboxRef" :disabled="isCheckingAll || isSelectAllLoading" />
                  </div>
                </th>
                <th>Image</th>
                <th class="py-2">Name</th>
                <th class="py-2">Barcode</th>
                <th class="py-2 text-end">Price</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="product in filteredProducts" :key="product.id" class="hover:bg-blue-50 text-black border-b">
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
    <!-- Total Amounts -->
    <div class="mt-3 text-black font-semibold flex justify-end">
      <div class="grid items-center gap-x-3" style="grid-template-columns: auto 0.5rem minmax(140px,220px);">
        <span class="whitespace-nowrap">
          {{ formData.orderDiscountAmount > 0 ? 'Product Total' : 'Total' }}
        </span>
        <span class="text-right">:</span>
        <span class="font-bold text-right">{{ Number(totalAmount).toLocaleString('en-us') }}</span>
      </div>
    </div>
    <div v-if="formData.orderDiscountAmount > 0" class="mt-1 text-black font-semibold flex justify-end">
      <div class="grid items-center gap-x-3" style="grid-template-columns: auto 0.5rem minmax(140px,220px);">
        <span class="whitespace-nowrap">Order Discount</span>
        <span class="text-right">:</span>
        <span class="font-bold text-right">- {{ Number(formData.orderDiscountAmount).toLocaleString('en-us') }}</span>
      </div>
    </div>
    <!-- Total Amount After Order Discount -->
    <div v-if="formData.orderDiscountAmount > 0" class="mt-1 text-black font-semibold flex justify-end">
      <div class="grid items-center gap-x-3" style="grid-template-columns: auto 0.5rem minmax(140px,220px);">
        <span class="whitespace-nowrap">Total Amount</span>
        <span class="text-right">:</span>
        <span class="font-bold text-right">{{ grandTotalAmount.toLocaleString('en-us') }}</span>
      </div>
    </div>
    <!-- Paid Amount -->
    <div class="mt-1 text-black font-semibold flex justify-end">
      <div class="grid items-center gap-x-3" style="grid-template-columns: auto 0.5rem minmax(140px,220px);">
        <span class="whitespace-nowrap">Paid Amount</span>
        <span class="text-right">:</span>
        <BaseInput size="sm" v-model="formData.paidAmount" height="h-[35px]" type="number" />
        <!-- <span class="font-bold text-right">{{ Number(formData.paidAmount).toLocaleString('en-us') }}</span> -->
      </div>
    </div>
    <!-- Change Amount -->
    <div class="mt-1 text-black font-semibold flex justify-end">
      <div class="grid items-center gap-x-3" style="grid-template-columns: auto 0.5rem minmax(140px,220px);">
        <span class="whitespace-nowrap">Change Amount</span>
        <span class="text-right">:</span>
        <span class="font-bold text-right">{{ Number(changeAmount).toLocaleString('en-us') }}</span>
      </div>
    </div>
  </div>
  <!-- Slip Section -->
  <div
    class="mb-3 flex-[1.8] max-w-md w-full mx-auto p-6 bg-white shadow-lg border border-gray-300 rounded-sm text-sm font-mono text-black"
    id="slip-section">
    <!-- Header -->
    <header style="
            text-align: center;
            padding-bottom: 6px;
            margin-bottom: 6px;
            border-bottom: 1px solid black;
          ">
      <h1 class="text-lg font-bold">FUSION MART</h1>
      <div>{{ userData.branch?.location }}</div>
      <div>{{ userData.branch?.phone }}</div>
    </header>

    <!-- Receipt Info -->
    <div style="
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px dashed black;
          ">
      <div>
        <div>
          <span style="font-weight: bold;">Receipt:</span> {{ formData.salesId }}
        </div>
        <div><span style="font-weight: bold;">Counter:</span> {{ useSales.salesList.counter }}</div>
      </div>
      <div style="text-align: left;">
        <div><span style="font-weight: bold;">Cashier:</span> {{ useSales.salesList.created_by }}</div>
        <div><span style="font-weight: bold;">Date:</span> {{ moment(formData.salesDate).format('DD/MM/YY HH:mm:ss') }}
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <table style="
            width: 100%;
            font-size: 12px;
            border-bottom: 1px solid #dee2e6;
            margin-bottom: 8px;
          ">
      <thead>
        <tr style="
                font-weight: bold;
                text-align: left;
              ">
          <th style="padding: 2px 0;">Description</th>
          <th style="padding: 2px 0; text-align: center;">Qty</th>
          <th style="padding: 2px 0; text-align: right;">Price</th>
          <th style="padding: 2px 0; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="useSales.loading">
          <td colspan="4" class="text-center">
            <i class="fa fa-spinner animate-spin"></i>
          </td>
        </tr>
        <tr v-for="item in selectedProducts" :key="`${item.id}-${item.isFoc ? 'foc' : 'sale'}-${item.promotionId || 'none'}-${item.rewardId || 'none'}`" style="border-top: 1px solid #dee2e6;">
          <td style="padding: 2px 0; width: 150px;">
            <div style="
                  display: flex;
                  flex-direction: column;
                ">
              <span style="
                    overflow: hidden;
                    display: -webkit-box;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2;
                  ">
                {{ item.name }}
              </span>
              <span v-if="item.promotionId && !item.isFoc" style="font-size: 12px;">
                {{ promotionDisplayLabel(item) }}
              </span>
            </div>
          </td>
          <td style="padding: 2px 0; text-align: center;">{{ item.quantity }}</td>
          <td style="padding: 2px 0; text-align: right;">
            <div class="flex flex-col">
              <span>{{ saleLinePrice(item).toLocaleString() }}</span>
            </div>
          </td>
          <td style="padding: 2px 0; text-align: right;">
            <div style="
                  display: flex;
                  flex-direction: column;
                ">
              <span>{{ (Number(item.quantity || 0) * saleLinePrice(item)).toLocaleString() }}</span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Totals -->
    <div style="text-align: right; margin-bottom: 16px;">
      <div style="
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
            ">
        <span>SUBTOTAL</span>
        <span>Ks. {{ totalAmount.toLocaleString() }}</span>
      </div>
      <div v-if="formData.orderDiscountAmount > 0"
        style="
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        "
      >
        <span>Order Discount</span>
        <span>- Ks. {{ Number(formData.orderDiscountAmount).toLocaleString() }}</span>
      </div>
      <!-- <div class="flex justify-between">
            <span>TAX ({{ data.taxRate }}%)</span>
            <span>{{ data.currency + tax.toLocaleString() }}</span>
          </div> -->
      <div style="
              display: flex;
              justify-content: space-between;
              font-size: large;
              font-weight: bold;
              border-top: 1px solid black;
              padding-top: 4px;
            ">
        <span>TOTAL</span>
        <span>Ks. {{ grandTotalAmount.toLocaleString() }}</span>
        <!-- <span>{{ data.currency + (subtotal + tax).toLocaleString() }}</span> -->
      </div>
      <!-- Pay Amount -->
      <div style="
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
            ">
        <span>Pay Amt ({{ formData.paymentMethodName }})</span>
        <span>Ks. {{ Number(formData.paidAmount || 0).toLocaleString() }}</span>
      </div>
      <!-- Change Amount -->
      <div style="
              display: flex;
              justify-content: space-between;
              padding-top: 4px;
            ">
        <span>Change Amt</span>
        <span>Ks. {{ changeAmount.toLocaleString() }}</span>
      </div>
    </div>


    <!-- Footer -->
    <footer style="
            text-align: center;
            border-top: 1px dashed black;
            padding-top: 8px;
            font-size: 12px;
          ">
      <div>Thanks for shopping with us!</div>
      <div>Keep this receipt for your records</div>
    </footer>
  </div>
</template>
