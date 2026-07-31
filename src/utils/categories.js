function categoryKey(id) {
  return id === null || id === undefined ? null : String(id);
}

function sortCategories(left, right) {
  const sortDifference = Number(left?.sort_order ?? 0) - Number(right?.sort_order ?? 0);
  if (sortDifference !== 0) return sortDifference;
  return String(left?.name ?? '').localeCompare(String(right?.name ?? ''));
}

export function categoryCode(category) {
  const code = category?.code;
  if (code === null || code === undefined || code === '') return '';
  return String(code);
}

export function categoryLabel(category) {
  const name = String(category?.name ?? '');
  const code = categoryCode(category);
  return code ? `${name} (${code})` : name;
}

export function normalizeCategory(category) {
  if (!category || typeof category !== 'object') return category;

  return {
    ...category,
    code: categoryCode(category) || null,
    parent: category.parent ? normalizeCategory(category.parent) : category.parent,
    children: Array.isArray(category.children)
      ? category.children.map(normalizeCategory)
      : category.children,
  };
}

export function isCategoryActive(category) {
  if (!category) return false;

  const statusId = category.status_id ?? category.status?.id;
  if (statusId !== null && statusId !== undefined && statusId !== '') {
    return Number(statusId) === 1;
  }

  if (typeof category.is_active === 'boolean') return category.is_active;
  if (typeof category.active === 'boolean') return category.active;

  const statusName = category.status?.name;
  if (statusName) return String(statusName).toLowerCase() === 'active';

  // Some category payloads omit status entirely. Do not hide those records.
  return true;
}

export function categoryHasProducts(category) {
  if (!category) return false;
  if (typeof category.has_products === 'boolean') return category.has_products;

  const count = category.products_count
    ?? category.product_count
    ?? category.products?.length;

  return Number(count ?? 0) > 0;
}

export function buildCategoryTree(categories = []) {
  const nodes = (Array.isArray(categories) ? categories : []).map((category) => ({
    ...normalizeCategory(category),
    children: [],
  }));
  const nodeById = new Map(nodes.map((node) => [categoryKey(node.id), node]));
  const childrenByParent = new Map();

  nodes.forEach((node) => {
    const parentKey = categoryKey(node.parent_id);
    const siblings = childrenByParent.get(parentKey) ?? [];
    siblings.push(node);
    childrenByParent.set(parentKey, siblings);
  });

  childrenByParent.forEach((siblings) => siblings.sort(sortCategories));

  const visited = new Set();

  function attach(node, ancestors = new Set()) {
    const key = categoryKey(node.id);
    if (ancestors.has(key)) return { ...node, children: [] };

    visited.add(key);
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(key);

    const children = (childrenByParent.get(key) ?? [])
      .filter((child) => !nextAncestors.has(categoryKey(child.id)))
      .map((child) => attach(child, nextAncestors));

    return { ...node, children };
  }

  const rootNodes = nodes.filter((node) => {
    const key = categoryKey(node.id);
    const parentKey = categoryKey(node.parent_id);
    return parentKey === null || parentKey === key || !nodeById.has(parentKey);
  });

  const tree = rootNodes.sort(sortCategories).map((node) => attach(node));

  // Preserve records from malformed cyclic data instead of silently dropping them.
  nodes.forEach((node) => {
    if (!visited.has(categoryKey(node.id))) tree.push(attach(node));
  });

  return tree;
}

export function flattenCategoryTree(tree = []) {
  const flattened = [];

  function visit(nodes, ancestorLabels = [], depth = 0) {
    nodes.forEach((node) => {
      const ownLabel = categoryLabel(node);
      const path = [...ancestorLabels, ownLabel];

      flattened.push({
        ...node,
        depth,
        path,
        path_label: path.join(' > '),
      });

      visit(node.children ?? [], path, depth + 1);
    });
  }

  visit(Array.isArray(tree) ? tree : []);
  return flattened;
}

export function flattenCategories(categories = []) {
  return flattenCategoryTree(buildCategoryTree(categories));
}

export function getDescendantCategoryIds(categories = [], categoryId) {
  const targetKey = categoryKey(categoryId);
  if (targetKey === null) return new Set();

  const childrenByParent = new Map();
  (Array.isArray(categories) ? categories : []).forEach((category) => {
    const parentKey = categoryKey(category.parent_id);
    const children = childrenByParent.get(parentKey) ?? [];
    children.push(category);
    childrenByParent.set(parentKey, children);
  });

  const descendants = new Set();
  const queue = [...(childrenByParent.get(targetKey) ?? [])];

  while (queue.length) {
    const category = queue.shift();
    const key = categoryKey(category.id);
    if (key === null || descendants.has(key) || key === targetKey) continue;
    descendants.add(key);
    queue.push(...(childrenByParent.get(key) ?? []));
  }

  return descendants;
}

export function getCategoryFilterOptions(categories = []) {
  return flattenCategories(categories).map((category) => ({
    ...category,
    label: category.path_label,
  }));
}

export function getProductCategoryOptions(categories = []) {
  const list = Array.isArray(categories) ? categories : [];
  const categoryById = new Map(list.map((category) => [categoryKey(category.id), category]));
  const parentIds = new Set(
    list
      .map((category) => categoryKey(category.parent_id))
      .filter((parentId) => parentId !== null),
  );

  function hasActiveAncestors(category) {
    const visited = new Set();
    let parentKey = categoryKey(category.parent_id);

    while (parentKey !== null) {
      if (visited.has(parentKey)) return false;
      visited.add(parentKey);

      const parent = categoryById.get(parentKey);
      if (!parent || !isCategoryActive(parent)) return false;
      parentKey = categoryKey(parent.parent_id);
    }

    return true;
  }

  return flattenCategories(list)
    .filter((category) => (
      !parentIds.has(categoryKey(category.id))
      && isCategoryActive(category)
      && hasActiveAncestors(category)
    ))
    .map((category) => ({
      ...category,
      label: category.path_label,
    }));
}

export function getParentCategoryOptions(categories = [], options = {}) {
  const {
    editingId = null,
    allowUncoded = false,
    disableProductCategories = true,
  } = options;
  const excludedIds = getDescendantCategoryIds(categories, editingId);
  const editingKey = categoryKey(editingId);

  return flattenCategories(categories)
    .filter((category) => {
      const key = categoryKey(category.id);
      return key !== editingKey && !excludedIds.has(key);
    })
    .map((category) => {
      const hasProducts = disableProductCategories && categoryHasProducts(category);
      const isUncoded = !categoryCode(category);
      let reason = '';

      if (hasProducts) reason = 'has products';
      else if (isUncoded && !allowUncoded) reason = 'enter an explicit child code first';

      return {
        ...category,
        disabled: Boolean(reason),
        disabled_reason: reason,
        label: reason ? `${category.path_label} — ${reason}` : category.path_label,
      };
    });
}
