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
    
    let cls = 'bg-gray-100 text-gray-800';
    if (n.includes('hold')) cls = 'bg-yellow-100 text-yellow-800';
    else if (n.includes('complete')) cls = 'bg-green-100 text-green-800';
    else if (n.includes('void') || n.includes('cancel')) cls = 'bg-red-100 text-red-800';
    else if (n.includes('applied')) cls = 'bg-blue-100 text-blue-800';

    return `<span class="px-2 py-1 rounded ${cls}">${name ?? ''}</span>`;
}