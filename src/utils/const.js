export const errMsgList = {
    name: "Name field is required.",
    phone: "Phone number is required.",
    email: "Email is required.",
    address: "Address is required.",
    desc: "Description is required.",
    role: "Role is required.",
    branch: "Branch is required.",
    counter: "Counter is required.",
    password: "Password is required.",
    permission: "Select at least one permission.",
    price: "Price must be greater than 0.",
    unit: "Unit is required.",
    sec_prop: "Secondary property is required.",
    warehouse: "Warehouse is required.",
    product: "Product is required.",
    qty: "Stock qty must be greater than 0.",
    paymentMethod: "Payment method is required.",
}

// Shared helper: render colored badge HTML for a status name
// Usage: statusBadgeHtml('Hold') → "<span class=...>Hold</span>"
export function statusBadgeHtml(name) {
    const n = String(name || '').toLowerCase();
    
    let cls = 'bg-gray-200 text-gray-800';
    if (n.includes('hold')) cls = 'bg-yellow-100 text-yellow-800';
    else if (n.includes('void')) cls = 'bg-red-100 text-red-800';
    else if (n.includes('inactive')) cls = 'bg-gray-200 text-gray-800';
    else if (n.includes('complete') || n.includes('active')) cls = 'bg-green-100 text-green-800';
    else if (n.includes('applied')) cls = 'bg-blue-100 text-blue-800';
    else if (n.includes('foc')) cls = 'bg-indigo-100 text-indigo-800';
    else if (n.includes('product_discount')) cls = 'bg-orange-100 text-orange-800';
    else if (n.includes('order_discount')) cls = 'bg-cyan-100 text-cyan-800';

    return `<span class="px-2 py-1 rounded ${cls}">${name ?? ''}</span>`;
}

export const promotionStatusFallbackIds = {
    Active: 1,
    Inactive: 2,
    Applied: 9,
};

export function getPromotionLifecycleStatusName(startAt, endAt, now = new Date()) {
    const parseDate = (value) => {
        if (!value) return null;
        const normalized = String(value).replace(' ', 'T');
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? null : date;
    };

    const startDate = parseDate(startAt);
    const endDate = parseDate(endAt);
    const currentDate = now instanceof Date ? now : parseDate(now);

    if (endDate && currentDate && currentDate > endDate) return 'Inactive';
    if (startDate && currentDate && currentDate >= startDate) return 'Applied';
    return 'Active';
}

export function getPromotionStatusId(statusStore, statusName) {
    return statusStore?.getStatusId?.(statusName) || promotionStatusFallbackIds[statusName] || null;
}

export function formatPrice(value) {
    return Number(value).toLocaleString();
}
