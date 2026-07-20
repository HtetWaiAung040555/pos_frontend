function normalizedId(value) {
  const id = Number(value || 0);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function allocationProductId(allocation) {
  return normalizedId(
    allocation?.productId
    ?? allocation?.product_id
    ?? allocation?.product?.id,
  );
}

function allocationBranchId(allocation) {
  return normalizedId(
    allocation?.branchId
    ?? allocation?.branch_id
    ?? allocation?.branch?.id,
  );
}

function allocationProductUnitId(allocation) {
  return normalizedId(
    allocation?.productUnitId
    ?? allocation?.product_unit_id
    ?? allocation?.uom?.product_unit_id,
  );
}

export function focAllocationKey(allocation) {
  return [
    allocationBranchId(allocation) || 'branch',
    allocationProductId(allocation) || 'product',
    allocationProductUnitId(allocation) || 'unit',
  ].join(':');
}

function rewardUnitName(reward, productUnitId) {
  const productUnits = Array.isArray(reward?.product_units) ? reward.product_units : [];
  const productUnit = productUnits.find(unit => Number(unit.id) === Number(productUnitId));

  return productUnit?.unit_id?.name
    ?? reward?.uom?.unit_name
    ?? reward?.unitName
    ?? '-';
}

export function distinctFocRewards(tiers) {
  const rewardsByKey = new Map();

  (tiers || []).forEach((tier) => {
    (tier?.rewards || []).forEach((reward) => {
      const productId = normalizedId(reward?.productId ?? reward?.product_id ?? reward?.id);
      const productUnitId = allocationProductUnitId(reward);
      if (!productId) return;

      const key = `${productId}:${productUnitId || 'unit'}`;
      if (rewardsByKey.has(key)) return;

      rewardsByKey.set(key, {
        productId,
        productUnitId,
        productName: reward?.name ?? reward?.product?.name ?? `Product #${productId}`,
        imageUrl: reward?.image_url ?? reward?.product?.image_url ?? '',
        unitName: rewardUnitName(reward, productUnitId),
      });
    });
  });

  return Array.from(rewardsByKey.values());
}

export function syncFocAllocationMatrix({ branches, rewards, allocations }) {
  const existingByKey = new Map(
    (allocations || []).map(allocation => [focAllocationKey(allocation), allocation]),
  );

  return (branches || []).flatMap((branch) => (
    (rewards || []).map((reward) => {
      const branchId = normalizedId(branch?.id);
      const key = focAllocationKey({
        branchId,
        productId: reward.productId,
        productUnitId: reward.productUnitId,
      });
      const existing = existingByKey.get(key);
      const warehouseId = normalizedId(
        existing?.warehouseId
        ?? existing?.allocated_warehouse_id
        ?? existing?.warehouse?.id
        ?? branch?.warehouse?.id,
      );

      return {
        allocationId: normalizedId(existing?.allocationId ?? existing?.allocation_id ?? existing?.id),
        branchId,
        branchName: branch?.name ?? existing?.branchName ?? existing?.branch?.name ?? `Branch #${branchId}`,
        warehouseId,
        warehouseName: existing?.warehouseName
          ?? existing?.warehouse?.name
          ?? branch?.warehouse?.name
          ?? (warehouseId ? `Warehouse #${warehouseId}` : 'No warehouse linked'),
        productId: reward.productId,
        productName: reward.productName,
        imageUrl: reward.imageUrl,
        productUnitId: reward.productUnitId,
        unitName: reward.unitName,
        allocatedQty: existing?.allocatedQty ?? existing?.allocated_qty ?? 1,
        usedQty: Number(existing?.usedQty ?? existing?.used_qty ?? 0),
        availableQty: existing?.availableQty ?? existing?.available_qty ?? null,
        availabilityLoaded: Boolean(existing?.availabilityLoaded),
      };
    })
  ));
}

export function validateFocAllocationMatrix({ branches, rewards, allocations }) {
  const general = [];
  const byKey = {};
  const branchIds = new Set((branches || []).map(branch => normalizedId(branch?.id)).filter(Boolean));
  const rewardKeys = new Set((rewards || []).map(reward => (
    `${reward.productId}:${reward.productUnitId || 'unit'}`
  )));
  const expectedKeys = new Set();
  const seenKeys = new Set();
  const sharedWarehouseGroups = new Map();

  (branches || []).forEach((branch) => {
    (rewards || []).forEach((reward) => {
      expectedKeys.add(focAllocationKey({
        branchId: branch?.id,
        productId: reward.productId,
        productUnitId: reward.productUnitId,
      }));
    });
  });

  if (branchIds.size === 0) general.push('At least one branch is required for an FOC promotion.');
  if ((rewards || []).length === 0) general.push('At least one FOC reward product is required.');
  if ((rewards || []).some(reward => !reward.productUnitId)) {
    general.push('Select a product unit for every FOC reward product.');
  }

  (allocations || []).forEach((allocation) => {
    const key = focAllocationKey(allocation);
    const messages = [];
    const productId = allocationProductId(allocation);
    const branchId = allocationBranchId(allocation);
    const productUnitId = allocationProductUnitId(allocation);
    const rewardKey = `${productId}:${productUnitId || 'unit'}`;
    const allocatedQty = Number(allocation?.allocatedQty ?? allocation?.allocated_qty);
    const usedQty = Number(allocation?.usedQty ?? allocation?.used_qty ?? 0);
    const availableQty = Number(allocation?.availableQty ?? allocation?.available_qty);

    if (seenKeys.has(key)) messages.push('Duplicate branch, product, and product-unit allocation.');
    seenKeys.add(key);

    if (!branchIds.has(branchId)) messages.push('The allocation branch is not selected.');
    if (!rewardKeys.has(rewardKey)) messages.push('The allocation product and unit are not in the FOC rewards.');
    if (!Number.isInteger(allocatedQty) || allocatedQty <= 0) {
      messages.push('Allocated quantity must be a positive whole number.');
    }
    if (Number.isFinite(usedQty) && allocatedQty < usedQty) {
      messages.push(`Allocated quantity cannot be less than the used quantity (${usedQty}).`);
    }
    if (allocation?.availabilityLoaded && Number.isFinite(availableQty)) {
      if (availableQty <= 0) {
        messages.push('This branch has no available stock for the selected reward product unit.');
      } else if (allocatedQty > availableQty) {
        messages.push(`Allocated quantity cannot exceed the available quantity (${availableQty}).`);
      }

      const warehouseId = normalizedId(allocation?.warehouseId ?? allocation?.warehouse_id);
      if (warehouseId) {
        const sharedKey = `${warehouseId}:${productId}:${productUnitId || 'unit'}`;
        const group = sharedWarehouseGroups.get(sharedKey) || {
          allocations: [],
          branchIds: new Set(),
          totalAllocatedQty: 0,
          availableQty,
        };
        group.allocations.push(allocation);
        group.branchIds.add(branchId);
        group.totalAllocatedQty += Number.isFinite(allocatedQty) ? allocatedQty : 0;
        group.availableQty = Math.min(group.availableQty, availableQty);
        sharedWarehouseGroups.set(sharedKey, group);
      }
    }

    if (messages.length > 0) byKey[key] = messages.join(' ');
  });

  expectedKeys.forEach((key) => {
    if (!seenKeys.has(key)) general.push('Every selected branch must have every FOC reward allocation.');
  });

  sharedWarehouseGroups.forEach((group) => {
    if (group.branchIds.size <= 1 || group.totalAllocatedQty <= group.availableQty) return;
    const message = `Combined branch allocations (${group.totalAllocatedQty}) exceed the shared warehouse availability (${group.availableQty}).`;
    group.allocations.forEach((allocation) => {
      const key = focAllocationKey(allocation);
      byKey[key] = [byKey[key], message].filter(Boolean).join(' ');
    });
  });

  return {
    valid: general.length === 0 && Object.keys(byKey).length === 0,
    general: [...new Set(general)],
    byKey,
  };
}

export function mergeFocAvailability(allocations, availabilityRows) {
  const availabilityByKey = new Map(
    (availabilityRows || []).map(row => [focAllocationKey(row), row]),
  );
  let missingCount = 0;

  const mergedAllocations = (allocations || []).map((allocation) => {
    const availability = availabilityByKey.get(focAllocationKey(allocation));
    if (!availability) {
      missingCount += 1;
      return {
        ...allocation,
        availableQty: null,
        availabilityLoaded: false,
      };
    }

    const availableQty = Number(availability.available_qty ?? availability.availableQty);
    return {
      ...allocation,
      warehouseId: normalizedId(availability.warehouse_id ?? availability.warehouse?.id)
        ?? allocation.warehouseId,
      warehouseName: availability.warehouse_name
        ?? availability.warehouse?.name
        ?? allocation.warehouseName,
      availableQty: Number.isFinite(availableQty) ? availableQty : null,
      availabilityLoaded: Number.isFinite(availableQty),
    };
  });

  return { allocations: mergedAllocations, missingCount };
}

export function mapFocAllocationValidationErrors(validationErrors, allocations) {
  const general = [];
  const byKey = {};

  Object.entries(validationErrors || {}).forEach(([path, rawMessages]) => {
    if (!path.startsWith('foc_allocations')) return;

    const messages = (Array.isArray(rawMessages) ? rawMessages : [rawMessages])
      .filter(Boolean)
      .join(' ');
    const match = path.match(/^foc_allocations\.(\d+)(?:\.|$)/);
    const allocation = match ? allocations?.[Number(match[1])] : null;

    if (allocation) {
      const key = focAllocationKey(allocation);
      byKey[key] = [byKey[key], messages].filter(Boolean).join(' ');
    } else if (messages) {
      general.push(messages);
    }
  });

  return { general: [...new Set(general)], byKey };
}

export function focAllocationPayload(allocation, includeId = false) {
  return {
    ...(includeId && allocation?.allocationId ? { id: Number(allocation.allocationId) } : {}),
    branch_id: Number(allocation.branchId),
    product_id: Number(allocation.productId),
    product_unit_id: Number(allocation.productUnitId),
    allocated_qty: Number(allocation.allocatedQty),
  };
}
