export function salesPriceChangeRowKey(row) {
  return [
    Number(row?.branch_id || row?.branch?.id || 0),
    Number(row?.product_id || row?.id || row?.product?.id || 0),
    Number(row?.product_unit_id || row?.productUnitId || row?.product_unit?.id || 0),
  ].join(':');
}

export function productUnitOptions(product) {
  return Array.isArray(product?.product_units) ? product.product_units : [];
}

export function unitName(unit) {
  return unit?.unit_id?.name || unit?.unit_name || unit?.unit?.name || unit?.name || '-';
}

export function defaultProductUnit(product) {
  const units = productUnitOptions(product);
  return product?.default_product_unit?.id
    ? product.default_product_unit
    : units.find((unit) => Number(unit.id) === Number(product?.default_product_unit_id))
      || units.find((unit) => unit.is_default_sale_unit)
      || units.find((unit) => unit.is_base_unit)
      || units[0]
      || null;
}

export function findProductUnit(product, productUnitId) {
  const selectedId = Number(productUnitId || 0);
  if (!selectedId) return defaultProductUnit(product);
  return productUnitOptions(product).find((unit) => Number(unit.id) === selectedId) || defaultProductUnit(product);
}

export function productSalePrice(product, productUnitId) {
  const productUnit = findProductUnit(product, productUnitId);
  return Number(productUnit?.price ?? product?.price ?? 0);
}

export function normalizeSalesPriceRow(product, branch, overrides = {}) {
  const productUnit = findProductUnit(product, overrides.product_unit_id);
  const oldPrice = overrides.old_price ?? productSalePrice(product, productUnit?.id);
  const newPrice = overrides.new_price ?? oldPrice;

  return {
    ...product,
    rowKey: overrides.rowKey,
    id: product.id,
    product_id: product.id,
    branch_id: branch?.id || overrides.branch_id || '',
    branch_name: branch?.name || overrides.branch_name || '-',
    product_unit_id: productUnit?.id || '',
    unit_name: unitName(productUnit) || product?.unit_id?.name || '-',
    old_price: Number(oldPrice) || 0,
    new_price: Number(newPrice) || 0,
  };
}

export function currentBranchUnitPrice(priceChanges, branchId, productId, productUnitId, fallbackPrice) {
  const now = Date.now();
  const branchKey = Number(branchId || 0);
  const productKey = Number(productId || 0);
  const unitKey = Number(productUnitId || 0);

  const matches = (priceChanges || [])
    .filter((change) => {
      if (change?.type !== 'sale') return false;
      if ((change?.status?.name || '').toLowerCase() !== 'applied') return false;

      const start = change.start_at ? new Date(change.start_at).getTime() : 0;
      const end = change.end_at ? new Date(change.end_at).getTime() : Number.MAX_SAFE_INTEGER;
      return start <= now && end >= now;
    })
    .flatMap((change) => (change.products || []).map((item) => ({ change, item })))
    .filter(({ item }) => (
      Number(item?.branch_id || item?.branch?.id || 0) === branchKey
      && Number(item?.product?.id || item?.product_id || 0) === productKey
      && Number(item?.product_unit_id || item?.product_unit?.id || 0) === unitKey
    ))
    .sort((left, right) => {
      const leftStart = left.change.start_at ? new Date(left.change.start_at).getTime() : 0;
      const rightStart = right.change.start_at ? new Date(right.change.start_at).getTime() : 0;
      if (leftStart !== rightStart) return rightStart - leftStart;
      return Number(right.item?.id || 0) - Number(left.item?.id || 0);
    });

  return matches.length ? Number(matches[0].item.new_price || 0) : Number(fallbackPrice || 0);
}
