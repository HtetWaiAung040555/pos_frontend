export function productUnitOptions(product) {
  return Array.isArray(product?.product_units) ? product.product_units : [];
}

export function defaultProductUnitId(product) {
  const units = productUnitOptions(product);
  return product?.productUnitId
    ?? product?.promotion_product_unit_id
    ?? product?.default_product_unit_id
    ?? units.find((unit) => unit.is_default_sale_unit)?.id
    ?? units.find((unit) => unit.is_base_unit)?.id
    ?? units[0]?.id
    ?? '';
}

export function withPromotionUnit(product, preferredProductUnitId = undefined) {
  if (!product) return null;

  let productUnitId;
  if (preferredProductUnitId !== undefined) {
    productUnitId = preferredProductUnitId;
  } else if (Object.prototype.hasOwnProperty.call(product, 'productUnitId')) {
    productUnitId = product.productUnitId;
  } else if (Object.prototype.hasOwnProperty.call(product, 'promotion_product_unit_id')) {
    productUnitId = product.promotion_product_unit_id;
  } else {
    productUnitId = defaultProductUnitId(product);
  }

  return {
    ...product,
    productUnitId: productUnitId ? Number(productUnitId) : '',
  };
}

export function selectedProductUnit(product) {
  const selectedId = Number(product?.productUnitId || 0);
  return productUnitOptions(product).find((unit) => Number(unit.id) === selectedId) || null;
}

export function selectedUnitName(product) {
  const productUnit = selectedProductUnit(product);
  return productUnit?.unit_id?.name || product?.unit_id?.name || product?.unit?.name || '-';
}

export function selectedUnitPrice(product) {
  return Number(selectedProductUnit(product)?.price ?? product?.price ?? 0);
}

export function promotionUomPayload(product) {
  const productUnit = selectedProductUnit(product);

  return {
    product_unit_id: productUnit?.id || null,
    unit_id: productUnit?.unit_id?.id
      ?? product?.promotion_unit_id
      ?? product?.unit_id?.id
      ?? product?.unit?.id
      ?? null,
  };
}

export function promotionProductPayload(product) {
  const uom = promotionUomPayload(product);

  if (Object.prototype.hasOwnProperty.call(product || {}, 'productUnitId')) {
    const productUnitId = Number(product.productUnitId || 0);
    uom.product_unit_id = productUnitId || null;

    if (!productUnitId) {
      uom.unit_id = null;
    }
  }

  return {
    product_id: Number(product.id),
    ...uom,
  };
}

export function hasMissingPromotionUnit(products) {
  return (products || []).some((product) => (
    productUnitOptions(product).length > 0 && !selectedProductUnit(product)
  ));
}
