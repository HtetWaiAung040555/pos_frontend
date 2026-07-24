export const PRICE_CHANGE_TARGETS = [
  { value: 'GLOBAL_PRODUCT_PRICE', label: 'Global product price' },
  { value: 'GLOBAL_UOM_PRICE', label: 'Global product UOM price' },
  { value: 'GLOBAL_UOM_RANGE', label: 'Global product UOM price range' },
  { value: 'BRANCH_PRODUCT_PRICE', label: 'Branch product price' },
  { value: 'BRANCH_UOM_PRICE', label: 'Branch product UOM price' },
  { value: 'BRANCH_UOM_RANGE', label: 'Branch product UOM price range' },
];

export function targetLabel(value) {
  return PRICE_CHANGE_TARGETS.find((target) => target.value === value)?.label || value || '-';
}

export function isBranchTarget(targetType) {
  return targetType?.startsWith('BRANCH_');
}

export function isRangeTarget(targetType) {
  return targetType?.endsWith('_RANGE');
}

export function isUomTarget(targetType) {
  return targetType?.includes('_UOM_') || targetType === 'GLOBAL_UOM_PRICE';
}

export function toNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  return Number(value);
}

function isBlank(value) {
  return value === '' || value === null || value === undefined;
}

function isValidNumber(value) {
  if (isBlank(value)) return false;
  return Number.isFinite(Number(value));
}

function rangeValidationKey(row) {
  return [
    row.target_type,
    row.branch_id || 0,
    row.product_id,
    row.product_unit_id || 0,
    row.branch_product_id || 0,
    row.branch_product_unit_price_id || 0,
  ].join(':');
}

export function unitId(unit) {
  return unit?.unit_id?.id || unit?.unit_id || '';
}

export function unitName(unit) {
  return unit?.unit_id?.name || unit?.unit_name || unit?.unit?.name || '-';
}

export function productUnits(product) {
  const units = Array.isArray(product?.product_units) ? product.product_units : [];
  if (units.length) return units;

  return [{
    id: null,
    unit_id: product?.unit_id?.id || product?.unit?.id || '',
    unit_name: product?.unit_id?.name || product?.unit?.name || '-',
    conversion_to_base: 1,
    price: product?.price || 0,
    price_ranges: [],
  }];
}

export function branchProductFor(product, branchId) {
  return (product?.branch_products || []).find((item) => Number(item.branch_id || item.branch?.id) === Number(branchId)) || null;
}

export function branchUnitPriceFor(branchProduct, productUnit) {
  return (branchProduct?.unit_prices || []).find((item) => {
    const itemProductUnitId = item.product_unit_id?.id || item.product_unit_id;
    const productUnitId = productUnit?.id || productUnit?.product_unit_id;
    if (productUnitId && Number(itemProductUnitId) === Number(productUnitId)) return true;
    return Number(item.unit_id || item.unit?.id) === Number(unitId(productUnit));
  }) || null;
}

function matchingGlobalRange(productUnit, range) {
  return (productUnit?.price_ranges || []).find((item) => (
    Number(item.min_qty) === Number(range?.min_qty)
    && String(item.max_qty ?? '') === String(range?.max_qty ?? '')
  )) || null;
}

function rangeRows(productUnit, branchUnitPrice = null) {
  const branchRanges = branchUnitPrice?.price_ranges || [];
  const globalRanges = productUnit?.price_ranges || [];
  const sourceRanges = branchRanges.length ? branchRanges : globalRanges;

  if (!sourceRanges.length) {
    return [{
      id: null,
      min_qty: 0,
      max_qty: null,
      price: branchUnitPrice?.price ?? productUnit?.price ?? 0,
      source: 'new',
    }];
  }

  return sourceRanges.map((range) => ({
    ...range,
    source: branchRanges.length ? 'branch' : 'global',
  }));
}

function baseRow(product, targetType, branch = null) {
  return {
    rowKey: '',
    target_type: targetType,
    product_id: product.id,
    product_name: product.name,
    product_barcode: product.barcode || '',
    image_url: product.image_url,
    branch_id: branch?.id || null,
    branch_name: branch?.name || '-',
    branch_product_id: null,
    product_unit_id: null,
    branch_product_unit_price_id: null,
    product_unit_price_range_id: null,
    branch_product_unit_price_range_id: null,
    unit_name: '-',
    min_qty: null,
    max_qty: null,
    old_price: 0,
    new_price: 0,
    old_price_source: '',
    inherits_global_price: false,
    will_create_branch_price: false,
  };
}

function finalizeRow(row) {
  row.rowKey = [
    row.target_type,
    row.branch_id || 0,
    row.product_id,
    row.product_unit_id || 0,
    row.branch_product_id || 0,
    row.branch_product_unit_price_id || 0,
    row.product_unit_price_range_id || 0,
    row.branch_product_unit_price_range_id || 0,
    row.min_qty ?? 'null',
    row.max_qty ?? 'null',
  ].join(':');
  row.new_price = toNumber(row.new_price, row.old_price);
  return row;
}

export function buildTargetRows(product, targetType, branch = null) {
  const rows = [];
  const branchProduct = isBranchTarget(targetType) ? branchProductFor(product, branch?.id) : null;

  if (targetType === 'GLOBAL_PRODUCT_PRICE') {
    const row = baseRow(product, targetType);
    row.old_price = toNumber(product.price);
    row.old_price_source = 'Global product price';
    row.new_price = row.old_price;
    rows.push(finalizeRow(row));
  }

  if (targetType === 'BRANCH_PRODUCT_PRICE') {
    const row = baseRow(product, targetType, branch);
    const hasBranchPrice = !isBlank(branchProduct?.price);
    row.branch_product_id = branchProduct?.id || null;
    row.old_price = toNumber(branchProduct?.price, product.price || 0);
    row.old_price_source = hasBranchPrice
      ? 'Branch product price'
      : 'Inherited from global product price';
    row.inherits_global_price = !hasBranchPrice;
    row.will_create_branch_price = !branchProduct?.id;
    row.new_price = row.old_price;
    rows.push(finalizeRow(row));
  }

  if (targetType === 'GLOBAL_UOM_PRICE' || targetType === 'BRANCH_UOM_PRICE') {
    productUnits(product).forEach((productUnit) => {
      const branchUnitPrice = targetType === 'BRANCH_UOM_PRICE'
        ? branchUnitPriceFor(branchProduct, productUnit)
        : null;
      const hasBranchUnitPrice = !isBlank(branchUnitPrice?.price);
      const row = baseRow(product, targetType, targetType === 'BRANCH_UOM_PRICE' ? branch : null);
      row.branch_product_id = branchProduct?.id || null;
      row.product_unit_id = productUnit.id || productUnit.product_unit_id || null;
      row.branch_product_unit_price_id = branchUnitPrice?.id || null;
      row.unit_name = unitName(productUnit);
      row.old_price = toNumber(branchUnitPrice?.price, productUnit.price || 0);
      row.old_price_source = targetType === 'BRANCH_UOM_PRICE'
        ? (hasBranchUnitPrice ? 'Branch UOM price' : 'Inherited from global UOM price')
        : 'Global UOM price';
      row.inherits_global_price = targetType === 'BRANCH_UOM_PRICE' && !hasBranchUnitPrice;
      row.will_create_branch_price = targetType === 'BRANCH_UOM_PRICE' && !branchUnitPrice?.id;
      row.new_price = row.old_price;
      rows.push(finalizeRow(row));
    });
  }

  if (targetType === 'GLOBAL_UOM_RANGE' || targetType === 'BRANCH_UOM_RANGE') {
    productUnits(product).forEach((productUnit) => {
      const branchUnitPrice = targetType === 'BRANCH_UOM_RANGE'
        ? branchUnitPriceFor(branchProduct, productUnit)
        : null;

      rangeRows(productUnit, branchUnitPrice).forEach((range) => {
        const globalRange = targetType === 'GLOBAL_UOM_RANGE'
          ? range
          : matchingGlobalRange(productUnit, range);
        const row = baseRow(product, targetType, targetType === 'BRANCH_UOM_RANGE' ? branch : null);
        row.branch_product_id = branchProduct?.id || null;
        row.product_unit_id = productUnit.id || productUnit.product_unit_id || null;
        row.branch_product_unit_price_id = branchUnitPrice?.id || null;
        row.product_unit_price_range_id = targetType === 'GLOBAL_UOM_RANGE' ? range.id || null : globalRange?.id || null;
        row.branch_product_unit_price_range_id = targetType === 'BRANCH_UOM_RANGE' && range.source === 'branch' ? range.id || null : null;
        row.unit_name = unitName(productUnit);
        row.min_qty = range.min_qty ?? 0;
        row.max_qty = range.max_qty ?? null;
        row.old_price = toNumber(range.price, branchUnitPrice?.price ?? productUnit.price ?? 0);
        if (targetType === 'GLOBAL_UOM_RANGE') {
          row.old_price_source = range.id ? 'Global UOM range' : 'Global UOM fallback';
        } else if (range.source === 'branch') {
          row.old_price_source = 'Branch UOM range';
        } else if (range.source === 'global') {
          row.old_price_source = 'Inherited from global UOM range';
        } else {
          row.old_price_source = branchUnitPrice?.price !== null && branchUnitPrice?.price !== undefined
            ? 'Inherited from branch UOM price'
            : 'Inherited from global UOM price';
        }
        row.inherits_global_price = targetType === 'BRANCH_UOM_RANGE'
          && (range.source === 'global'
            || (range.source === 'new' && isBlank(branchUnitPrice?.price)));
        row.will_create_branch_price = targetType === 'BRANCH_UOM_RANGE'
          && !row.branch_product_unit_price_range_id;
        row.new_price = row.old_price;
        rows.push(finalizeRow(row));
      });
    });
  }

  return rows;
}

export function buildAllTargetRows(product, branchList = []) {
  const rows = [
    ...buildTargetRows(product, 'GLOBAL_PRODUCT_PRICE'),
    ...buildTargetRows(product, 'GLOBAL_UOM_PRICE'),
    ...buildTargetRows(product, 'GLOBAL_UOM_RANGE'),
  ];

  const branchProducts = Array.isArray(product?.branch_products) ? product.branch_products : [];
  const branchesById = new Map();

  (Array.isArray(branchList) ? branchList : []).forEach((branch) => {
    if (!branch?.id) return;
    branchesById.set(String(branch.id), branch);
  });

  branchProducts.forEach((branchProduct) => {
    const branchId = branchProduct.branch_id || branchProduct.branch?.id;
    if (!branchId || branchesById.has(String(branchId))) return;

    branchesById.set(String(branchId), branchProduct.branch || {
      id: branchId,
      name: branchProduct.branch_name || `Branch ${branchId}`,
    });
  });

  branchesById.forEach((branch) => {
    if (!branch?.id) return;

    rows.push(...buildTargetRows(product, 'BRANCH_PRODUCT_PRICE', branch));
    rows.push(...buildTargetRows(product, 'BRANCH_UOM_PRICE', branch));
    rows.push(...buildTargetRows(product, 'BRANCH_UOM_RANGE', branch));
  });

  return rows;
}

export function detectTargetType(item) {
  const hasBranch = !!(item?.branch_id || item?.branch?.id);
  const hasUnit = !!item?.product_unit_id;
  const hasRange = item?.min_qty !== null && item?.min_qty !== undefined;

  if (hasBranch && hasUnit && hasRange) return 'BRANCH_UOM_RANGE';
  if (!hasBranch && hasUnit && hasRange) return 'GLOBAL_UOM_RANGE';
  if (hasBranch && hasUnit) return 'BRANCH_UOM_PRICE';
  if (hasBranch) return 'BRANCH_PRODUCT_PRICE';
  if (hasUnit) return 'GLOBAL_UOM_PRICE';
  return 'GLOBAL_PRODUCT_PRICE';
}

export function rowFromPriceChangeItem(item) {
  const targetType = detectTargetType(item);
  return finalizeRow({
    rowKey: '',
    target_type: targetType,
    product_id: item.product?.id,
    product_name: item.product?.name || '-',
    product_barcode: item.product?.barcode || '',
    image_url: item.product?.image_url,
    branch_id: item.branch_id || item.branch?.id || null,
    branch_name: item.branch?.name || '-',
    branch_product_id: item.branch_product_id || null,
    product_unit_id: item.product_unit_id || null,
    branch_product_unit_price_id: item.branch_product_unit_price_id || null,
    product_unit_price_range_id: item.product_unit_price_range_id || null,
    branch_product_unit_price_range_id: item.branch_product_unit_price_range_id || null,
    unit_name: item.product_unit?.unit_name || item.unit_name || item.unit?.name || '-',
    min_qty: item.min_qty ?? null,
    max_qty: item.max_qty ?? null,
    old_price: toNumber(item.old_price),
    new_price: toNumber(item.new_price),
    old_price_source: targetLabel(targetType),
  });
}

export function payloadForTargetRow(row) {
  const payload = {
    product_id: row.product_id,
    new_price: toNumber(row.new_price),
  };

  if (row.branch_id) payload.branch_id = row.branch_id;
  if (row.branch_product_id) payload.branch_product_id = row.branch_product_id;
  if (row.product_unit_id) payload.product_unit_id = row.product_unit_id;
  if (row.branch_product_unit_price_id) payload.branch_product_unit_price_id = row.branch_product_unit_price_id;
  if (row.product_unit_price_range_id) payload.product_unit_price_range_id = row.product_unit_price_range_id;
  if (row.branch_product_unit_price_range_id) payload.branch_product_unit_price_range_id = row.branch_product_unit_price_range_id;

  if (isRangeTarget(row.target_type)) {
    payload.min_qty = toNumber(row.min_qty);
    payload.max_qty = row.max_qty === '' || row.max_qty === null || row.max_qty === undefined
      ? null
      : toNumber(row.max_qty);
  }

  return payload;
}

export function formatRange(row) {
  if (!isRangeTarget(row.target_type)) return '-';
  const formatQuantity = (value) => Number(value || 0).toLocaleString('en-us', {
    maximumFractionDigits: 6,
  });
  const min = formatQuantity(row.min_qty);
  const hasNoMaximum = row.max_qty === null || row.max_qty === undefined || row.max_qty === '';

  if (hasNoMaximum) return `${min} and above`;
  return `${min} to ${formatQuantity(row.max_qty)}`;
}

export function validatePriceChangeDates(startAt, endAt) {
  if (!startAt) return 'Start datetime is required.';

  const startTime = new Date(startAt).getTime();
  if (!Number.isFinite(startTime)) return 'Start datetime is invalid.';

  if (!endAt) return '';

  const endTime = new Date(endAt).getTime();
  if (!Number.isFinite(endTime)) return 'End datetime is invalid.';
  if (endTime <= startTime) return 'End datetime must be after start datetime.';

  return '';
}

export function validatePriceChangeRows(rows) {
  for (const row of rows || []) {
    if (isBranchTarget(row.target_type) && !row.branch_id) {
      return 'Branch price targets require a branch.';
    }

    if (!isValidNumber(row.new_price)) return 'New price must be a valid number.';
    if (Number(row.new_price) < 0) return 'New price cannot be negative.';

    if (!isRangeTarget(row.target_type)) continue;

    if (!isValidNumber(row.min_qty)) return 'Range targets require a valid min qty.';
    if (Number(row.min_qty) < 0) return 'Range min qty cannot be negative.';

    if (!isBlank(row.max_qty)) {
      if (!isValidNumber(row.max_qty)) return 'Range max qty must be a valid number.';
      if (Number(row.max_qty) < Number(row.min_qty)) return 'Range max qty must be greater than or equal to min qty.';
    }
  }

  const rangeGroups = new Map();
  (rows || []).filter((row) => isRangeTarget(row.target_type)).forEach((row) => {
    const key = rangeValidationKey(row);
    if (!rangeGroups.has(key)) rangeGroups.set(key, []);
    rangeGroups.get(key).push(row);
  });

  for (const groupRows of rangeGroups.values()) {
    const sortedRows = [...groupRows].sort((left, right) => Number(left.min_qty) - Number(right.min_qty));

    for (let index = 0; index < sortedRows.length - 1; index += 1) {
      const currentMax = sortedRows[index].max_qty;
      const nextMin = Number(sortedRows[index + 1].min_qty);

      if (isBlank(currentMax)) return 'Only the last range can have no max qty.';
      if (Number(currentMax) >= nextMin) return 'Range quantities must not overlap.';
    }
  }

  return '';
}
