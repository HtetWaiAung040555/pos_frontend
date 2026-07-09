export function toNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  return Number(value);
}

export function normalizeStatusId(value) {
  return Number(value) === 2 ? 2 : 1;
}

export function hasValue(value) {
  return value !== '' && value !== null && value !== undefined;
}

export function normalizeBranchPriceRanges(ranges) {
  return (ranges || [])
    .filter((range) => range.id || hasValue(range.price))
    .map((range) => ({
      ...(range.id ? { id: range.id } : {}),
      min_qty: toNumber(range.min_qty),
      max_qty: range.max_qty === '' || range.max_qty === null ? null : toNumber(range.max_qty),
      price: toNumber(range.price),
      status_id: normalizeStatusId(range.status_id),
    }));
}

export function normalizeBranchProducts(branchProducts) {
  return (branchProducts || [])
    .filter((branchProduct) => branchProduct.branch_id)
    .map((branchProduct) => {
      const unitPrices = (branchProduct.unit_prices || [])
        .filter((unitPrice) => unitPrice.id || hasValue(unitPrice.price))
        .map((unitPrice) => {
          const payload = {
            ...(unitPrice.id ? { id: unitPrice.id } : {}),
            price: hasValue(unitPrice.price) ? toNumber(unitPrice.price) : toNumber(unitPrice.old_price),
            status_id: normalizeStatusId(unitPrice.status_id),
            price_ranges: normalizeBranchPriceRanges(unitPrice.price_ranges),
          };

          if (unitPrice.product_unit_id) {
            payload.product_unit_id = unitPrice.product_unit_id;
          } else {
            payload.unit_id = unitPrice.unit_id;
          }

          return payload;
        });

      return {
        ...(branchProduct.id ? { id: branchProduct.id } : {}),
        branch_id: branchProduct.branch_id,
        status_id: normalizeStatusId(branchProduct.status_id),
        unit_prices: unitPrices,
      };
    });
}

export function buildBranchProducts(product) {
  return (product?.branch_products || []).map((branchProduct) => ({
    id: branchProduct.id,
    branch_id: branchProduct.branch_id || branchProduct.branch?.id || '',
    branch: branchProduct.branch || null,
    price: branchProduct.price ?? null,
    old_price: branchProduct.old_price ?? null,
    status_id: branchProduct.status?.id || 1,
    unit_prices: (branchProduct.unit_prices || []).map((unitPrice) => ({
      id: unitPrice.id,
      product_unit_id: unitPrice.product_unit_id,
      unit_id: unitPrice.unit_id || unitPrice.product_unit?.unit_id || '',
      unit_name: unitPrice.unit_name || unitPrice.product_unit?.unit_name || unitPrice.unit?.name || '',
      price: unitPrice.price ?? '',
      old_price: unitPrice.old_price ?? null,
      status_id: unitPrice.status?.id || 1,
      price_ranges: (unitPrice.price_ranges || []).map((range) => ({
        id: range.id,
        min_qty: range.min_qty,
        max_qty: range.max_qty ?? '',
        price: range.price,
        old_price: range.old_price ?? null,
        status_id: range.status?.id || 1,
      })),
    })),
  }));
}
