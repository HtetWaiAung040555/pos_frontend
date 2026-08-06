<script setup>

import PageTitle from '@/components/PageTitle.vue';
import DataTable from '@/components/DataTable.vue';
import BaseButton from '@/components/BaseButton.vue';
import DatePicker from 'primevue/datepicker';
import { useRouter } from 'vue-router';
import { onMounted, ref, computed, watch } from 'vue';
import { useToast } from 'primevue';
import moment from 'moment'
import { useFilterStore } from '@/stores/filterStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import BaseInput from '@/components/BaseInput.vue';

import { useWalletStore } from '@/stores/useWalletStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { usePaymentMethodStore } from '@/stores/usePaymentMethodStore';
import DashboardCard from '@/components/DashboardCard.vue';
import { statusBadgeHtml } from '@/utils/const';
import { getPresetRange } from '@/utils/datePresets';
import {
    normalizeCell,
    toNumber,
    readWorkbookFromFile,
    readNormalizedSheetRows,
    parseExcelDateTime,
    resolveIdByIdOrName
} from '@/utils/excelImport';

const router = useRouter();
const toast = useToast();
const filter = useFilterStore();
const usePermission = usePermissionStore();
const useWallet = useWalletStore();
const useCustomer = useCustomerStore();
const usePaymentMethod = usePaymentMethodStore();
const searchValue = ref('');
const walletList = ref([]);
const importInputRef = ref(null);
const isImporting = ref(false);
const selectedPaymentMethod = ref('');
const selectedType = ref('');
const transactionTypes = [
    { value: 'deposit', label: 'Deposit' },
    { value: 'withdraw', label: 'Withdraw' },
];
const filteredData = ref({
    startedDate: moment().startOf('week').format('YYYY-MM-DD HH:mm:ss'),
    endedDate: moment().format('YYYY-MM-DD HH:mm:ss'),
});

// New DatePicker range state
const dateRange = ref(null); // [startDate, endDate]
const isDateLoading = ref(false);

// Persist filters for this page under the key 'wallet'
function saveFilters() {
    filter.setPageFilter('wallet', {
        startedDate: filteredData.value.startedDate,
        endedDate: filteredData.value.endedDate,
        selectedPaymentMethod: selectedPaymentMethod.value,
        selectedType: selectedType.value,
        searchValue: searchValue.value,
    });
}

onMounted(async () => {
    // restore saved filters if present
    const saved = filter.getPageFilter('wallet');
    if (saved) {
        if (saved.startedDate) filteredData.value.startedDate = saved.startedDate;
        if (saved.endedDate) filteredData.value.endedDate = saved.endedDate;
        if (saved.selectedPaymentMethod) selectedPaymentMethod.value = saved.selectedPaymentMethod;
        if (saved.selectedType) selectedType.value = saved.selectedType;
        if (saved.searchValue) searchValue.value = saved.searchValue;
        // initialize DatePicker range from saved dates if present
        if (saved.startedDate && saved.endedDate) {
            filteredData.value.startedDate = saved.startedDate;
            filteredData.value.endedDate = saved.endedDate;
        }
    }
    dateRange.value = [
        moment(filteredData.value.startedDate).toDate(),
        moment(filteredData.value.endedDate).toDate()
    ];
    await fetchTransaction();
});

async function ensureImportLookups() {
    const jobs = [];
    if (!Array.isArray(useCustomer.customerList) || useCustomer.customerList.length === 0) jobs.push(useCustomer.fetchAllCustomer());
    if (!Array.isArray(usePaymentMethod.paymentMethodList) || usePaymentMethod.paymentMethodList.length === 0) jobs.push(usePaymentMethod.fetchAllPaymentMethod());
    if (jobs.length > 0) await Promise.all(jobs);
}

async function fetchTransaction() {
    isDateLoading.value = true;
    try {
        // convert local datetime-local strings to backend friendly format (YYYY-MM-DD HH:mm:ss)
        const start = filteredData.value.startedDate
            ? moment(filteredData.value.startedDate).format('YYYY-MM-DD HH:mm:ss')
            : "";
        const end = filteredData.value.endedDate
            ? moment(filteredData.value.endedDate).format('YYYY-MM-DD HH:mm:ss')
            : "";
        await useWallet.fetchAllWallet({
            start_date: start,
            end_date: end,
            customer_id: "",
            status_id: 7, // completed status only
            type: selectedType.value,
        });
        walletList.value = useWallet.walletList || [];
        // persist current filters after fetch
        saveFilters();
    } finally {
        isDateLoading.value = false;
    }
}

function setFilteredDatesFromRange(range) {
    if (Array.isArray(range) && range[0] && range[1]) {
        const start = moment(range[0]).startOf('day');
        const end = moment(range[1]).endOf('day');
        filteredData.value.startedDate = start.format('YYYY-MM-DD HH:mm:ss');
        filteredData.value.endedDate = end.format('YYYY-MM-DD HH:mm:ss');
    } else {
        filteredData.value.startedDate = "";
        filteredData.value.endedDate = "";
    }
}

function applyPresetRange(preset) {
    const range = getPresetRange(preset);
    dateRange.value = range ? range : null;
}

// Sync and auto-fetch when DatePicker range changes
watch(dateRange, async (val) => {
    setFilteredDatesFromRange(val);
    const hasFullRange = Array.isArray(val) && val[0] && val[1];
    const cleared = val === null;
    if (hasFullRange || cleared) {
        await fetchTransaction();
    }
});

// watch filter inputs and persist changes so coming back restores them
watch([
    () => filteredData.value.startedDate,
    () => filteredData.value.endedDate,
    () => selectedPaymentMethod.value,
    () => selectedType.value,
    () => searchValue.value
], () => {
    saveFilters();
});

watch(selectedType, async () => {
    await fetchTransaction();
});

function getWalletType(row) {
    return String(row?.type || 'deposit').toLowerCase();
}

function getWalletTypeLabel(row) {
    return getWalletType(row) === 'withdraw' ? 'Withdraw' : 'Deposit';
}

function getSignedWalletAmount(wallet) {
    const amount = Number(wallet?.amount) || 0;
    return getWalletType(wallet) === 'withdraw' && amount > 0 ? -amount : amount;
}

// Table headers
const columns = [
    { key: 'id', label: 'ID' },
    { key: 'customer.id', label: 'Customer ID', formatter: (row) => row.customer?.id },
    { key: 'customer.name', label: 'Name', formatter: (row) => row.customer?.name },
    { key: 'type', label: 'Type', formatter: (row) => {
        const isWithdraw = getWalletType(row) === 'withdraw';
        return `<span class="px-2 py-1 rounded text-xs font-semibold ${isWithdraw ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}">
            ${getWalletTypeLabel(row)}
        </span>`
    } },
    { key: 'amount', label: 'Amount', formatter: (row) => {
        const amount = getSignedWalletAmount(row);
        return `<span class="${amount < 0 ? 'text-red-700' : 'text-blue-700'}">
            ${amount.toLocaleString('en-us')}
        </span>`
    } },
    { key: 'payment_method.name', label: 'Payment Method', formatter: (row) => row.payment_method?.name },
    { key: 'pay_date', label: 'Date', formatter: (row) => moment(row.pay_date).format('DD-MM-YY hh:mm') },
    { key: 'status.name', label: 'Status', formatter: (row) => statusBadgeHtml(row.status?.name) },
    { key: 'created_by', label: 'Created By', },
    { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY hh:mm') },
    // { key: 'updated_by', label: 'Updated By', },
    // { key: 'updated_at', label: 'Updated At', formatter: (row) => moment(row.updated_at).format('DD-MM-YY hh:mm') },
];

// Route change function: need to pass route path.
function changeRoute(pathname) {
    router.push(pathname);
}

const paymentMethods = computed(() => {
    const map = new Map();
    (walletList.value || []).forEach(w => {
        if (w.payment_method.name) map.set(w.payment_method.name);
    });
    return Array.from(map.entries()).map(([name]) => ({ name }));
});

// Filter Function
const filteredRows = computed(() => {
    let list = (walletList.value || []).slice();
    // filter by payment method
    if (selectedPaymentMethod.value) {
        list = list.filter(w => String(w.payment_method.name) === String(selectedPaymentMethod.value));
    }
    // filter by transaction type. Kept for imported/current rows; backend also filters when selectedType changes.
    if (selectedType.value) {
        list = list.filter(w => getWalletType(w) === String(selectedType.value));
    }
    if (searchValue.value && searchValue.value.trim() !== '') {
        const q = searchValue.value.toLowerCase().trim();
        
        list = list.filter(w => {
            const customer = w.customer?.name || '';
            const id = w.customer_id || '';
            return customer.toLowerCase().includes(q) || id.toLowerCase().includes(q);
        });
    }
    return list;
});

const totalAmount = computed(() => {
        return filteredRows.value.reduce((sum, wallet) => sum + getSignedWalletAmount(wallet), 0);
    });

    const totalDepositAmount = computed(() => {
        return filteredRows.value.reduce((sum, wallet) => {
            if (getWalletType(wallet) === 'deposit') {
                return sum + Math.abs(Number(wallet.amount) || 0);
            }
            return sum;
        }, 0);
    });

    const totalWithdrawAmount = computed(() => {
        return filteredRows.value.reduce((sum, wallet) => {
            if (getWalletType(wallet) === 'withdraw') {
                return sum + Math.abs(Number(wallet.amount) || 0);
            }
            return sum;
        }, 0);
    });

    const totalCashAmount = computed(() => {
        return filteredRows.value.reduce((sum, wallet) => {
            if (wallet.payment_method && wallet.payment_method.name === 'Cash') {
                return sum + getSignedWalletAmount(wallet);
            }
            return sum;
        }, 0);
    });

    const totalKpayAmount = computed(() => {
        return filteredRows.value.reduce((sum, wallet) => {
            if (wallet.payment_method && wallet.payment_method.name === 'Kpay') {
                return sum + getSignedWalletAmount(wallet);
            }
            return sum;
        }, 0);
    });

//  Delete function
async function deleteHandle(id) {
    await useWallet.deleteWallet(id);
    if (useWallet.error.length) {
        useWallet.error.forEach((msg) => {
            toast.add({
                severity: 'error',
                summary: 'Error Message',
                detail: msg,
                life: 3000
            });
        });
        return
    }
    if (useWallet.data.status === 200) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Wallet transaction deleted successfully.', life: 3000 });
        fetchTransaction();
    }
}

function openImportPicker() {
    importInputRef.value?.click();
}

function downloadImportTemplate() {
    const link = document.createElement('a');
    link.href = '/wallet_import_template.xlsx';
    link.download = 'wallet_import_template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function onImportExcel(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    isImporting.value = true;
    try {
        await ensureImportLookups();
        const workbook = await readWorkbookFromFile(file);
        const rows = readNormalizedSheetRows(workbook, ['wallets', 'wallet_topup', 'wallet']);

        if (rows.length === 0) {
            toast.add({ severity: 'error', summary: 'Import Failed', detail: 'No rows found in Excel sheet.', life: 3500 });
            return;
        }

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        let successCount = 0;
        const failedRows = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];

            const customerId = resolveIdByIdOrName(
                useCustomer.customerList,
                row.customer_id,
                row.customer_name || row.customer
            );
            const paymentId = resolveIdByIdOrName(
                usePaymentMethod.paymentMethodList,
                row.payment_id,
                row.payment_name || row.payment_method || row.payment
            );

            const amount = toNumber(row.amount, 0);
            const payDate = parseExcelDateTime(row.pay_date || row.date || row.transaction_date, 'YYYY-MM-DD HH:mm:ss');
            const remark = normalizeCell(row.remark);
            const type = String(normalizeCell(row.type) || 'deposit').toLowerCase();

            if (!customerId || !paymentId || amount <= 0 || !payDate || !['deposit', 'withdraw'].includes(type)) {
                failedRows.push(i + 2);
                continue;
            }

            const payload = {
                customer_id: customerId,
                type,
                amount,
                remark,
                pay_date: payDate,
                payment_id: paymentId,
                created_by: user.id,
            };

            await useWallet.addWallet(payload);
            if (useWallet.error.length) {
                failedRows.push(i + 2);
                continue;
            }
            successCount += 1;
        }

        await fetchTransaction();

        if (successCount > 0) {
            toast.add({
                severity: 'success',
                summary: 'Import Completed',
                detail: `${successCount} wallet transaction row(s) imported.`,
                life: 3500
            });
        }

        if (failedRows.length > 0) {
            toast.add({
                severity: 'warn',
                summary: 'Some Rows Failed',
                detail: `Invalid rows: ${failedRows.slice(0, 8).join(', ')}${failedRows.length > 8 ? ' ...' : ''}`,
                life: 5000
            });
        }
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Import Failed', detail: 'Unable to read or import this file.', life: 3500 });
    } finally {
        isImporting.value = false;
        if (event?.target) event.target.value = '';
    }
}
</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Wallet">
            <template #titleButtons>
                <div class="flex gap-x-2 items-center">
                    <input
                        ref="importInputRef"
                        type="file"
                        accept=".xlsx,.xls"
                        class="hidden"
                        @change="onImportExcel"
                    />
                    <BaseButton v-if="usePermission.can('Wallet', 'Create')" icon="fa fa-file-excel"
                        :label="isImporting ? 'Importing...' : 'Import Excel'" severity="success" :disabled="isImporting"
                        @click="openImportPicker" />
                    <BaseButton v-if="usePermission.can('Wallet', 'Create')" icon="fa fa-download"
                        label="Download Template" severity="secondary" @click="downloadImportTemplate" />
                    <BaseButton v-if="usePermission.can('Wallet', 'Create')" icon="fa fa-circle-plus" label="Create"
                        severity="primary" @click="changeRoute('/wallet/createTopUp')" />
                </div>
            </template>
        </PageTitle>
        <div class="grid grid-cols-6 my-3 gap-x-4">
            <DashboardCard title="Total" :value="filteredRows.length" icon="fa fa-receipt" color="green" />
            <DashboardCard title="Net Amount" :value="totalAmount.toLocaleString('en-us')" icon="fa fa-money-bill" color="blue" />
            <DashboardCard title="Deposit" :value="totalDepositAmount.toLocaleString('en-us')" icon="fa fa-circle-plus" color="green" />
            <DashboardCard title="Withdraw" :value="totalWithdrawAmount.toLocaleString('en-us')" icon="fa fa-circle-minus" color="red" />
            <DashboardCard title="Total Cash" :value="totalCashAmount.toLocaleString('en-us')" icon="fa fa-hand-holding-dollar" color="gray" />
            <DashboardCard title="Total Kpay" :value="totalKpayAmount.toLocaleString('en-us')" icon="fa fa-credit-card" color="blue" />
        </div>
        <!-- DataTable -->
        <DataTable :columns="columns" :rows="filteredRows" :editPath="'Update Wallet Top Up'"
            :isLoading="useWallet.loading" @delete="deleteHandle" :defaultSort="{ key: 'pay_date', order: 'desc' }"
            :isEdit="!usePermission.can('Wallet', 'Update')" :isDelete="!usePermission.can('Wallet', 'Delete')" filename="Customer_Transaction">
            <!-- Filter Section -->
            <template #filters>
                <div class="flex gap-2 items-center">
                    <DatePicker
                        v-model="dateRange"
                        selectionMode="range"
                        :manualInput="false"
                        showButtonBar
                        placeholder="Date range"
                        inputClass="h-[35px]"
                        :disabled="isDateLoading"
                    >
                        <template #buttonbar="{ clearCallback }">
                            <div class="flex justify-between w-full px-2 pb-2 gap-2 flex-wrap items-center">
                                <div class="flex gap-2 flex-wrap">
                                    <BaseButton size="sm" label="Today" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('today')" />
                                    <BaseButton size="sm" label="Yesterday" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('yesterday')" />
                                    <BaseButton size="sm" label="This Week" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisWeek')" />
                                    <BaseButton size="sm" label="This Month" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisMonth')" />
                                    <BaseButton size="sm" label="This Year" variant="outlined" :disabled="isDateLoading" @click="() => applyPresetRange('thisYear')" />
                                </div>
                                <div class="flex gap-2 items-center">
                                    <div v-if="isDateLoading" class="flex items-center text-xs text-gray-600 gap-2">
                                        <i class="pi pi-spin pi-spinner"></i>
                                        <span>Loading...</span>
                                    </div>
                                    <BaseButton size="sm" label="Clear" icon="pi pi-times" severity="danger" variant="outlined" :disabled="isDateLoading" @click="clearCallback" />
                                </div>
                            </div>
                        </template>
                    </DatePicker>
                    <BaseInput size="sm" v-model="searchValue" placeholder="Search by customer" width="200px" height="h-[35px]"
                        icon="pi pi-search" />
                    <select v-model="selectedPaymentMethod" class="border border-gray-300 p-2 rounded text-sm h-[35px]">
                        <option value="">All Payment</option>
                        <option v-for="opt in paymentMethods" :key="opt.id" :value="opt.name">{{ opt.name }}</option>
                    </select>

                    <select v-model="selectedType" class="border border-gray-300 p-2 rounded text-sm h-[35px]">
                        <option value="">All Type</option>
                        <option v-for="type in transactionTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
                    </select>
                </div>
            </template>
        </DataTable>
    </div>
</template>