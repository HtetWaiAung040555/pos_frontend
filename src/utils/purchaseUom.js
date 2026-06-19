export function purchaseLineKey(item) {
  const productId = item?.productId ?? item?.product_id ?? item?.product?.id ?? item?.id;
  const productUnitId = item?.productUnitId ?? item?.product_unit_id ?? item?.uom?.product_unit_id;
  return `${productId || ''}:${productUnitId || 'base'}`;
}

export function buildPurchaseOptions(products) {
  return (products || []).flatMap((product) => {
    const units = Array.isArray(product.product_units) ? product.product_units : [];

    if (!product.uom_enabled || units.length === 0) {
      return [{
        ...product,
        purchase_line_key: `${product.id}:base`,
        product_unit_id: null,
        unit_id: product.unit_id?.id || null,
        unit_name: product.unit_id?.name || '-',
        conversion_to_base: 1,
        purchase_price: Number(product.purchase_price || 0),
      }];
    }

    return units.map((unit) => ({
      ...product,
      purchase_line_key: `${product.id}:${unit.id}`,
      product_unit_id: unit.id,
      unit_id: unit.unit_id?.id || null,
      unit_name: unit.unit_id?.name || '-',
      barcode: unit.barcode || product.barcode,
      conversion_to_base: Number(unit.conversion_to_base || 1),
      purchase_price: Number(unit.purchase_price || 0),
      is_base_unit: !!unit.is_base_unit,
    }));
  });
}

export function findPurchaseOption(options, productId, productUnitId) {
  return (options || []).find((option) => (
    Number(option.id) === Number(productId)
    && Number(option.product_unit_id || 0) === Number(productUnitId || 0)
  ));
}

export function purchaseDetailUnitName(detail) {
  return detail?.uom?.unit_name || detail?.product_unit?.unit_id?.name || '-';
}

export function purchaseDetailQuantity(detail) {
  return Number(detail?.uom?.unit_quantity ?? detail?.quantity ?? 0);
}
