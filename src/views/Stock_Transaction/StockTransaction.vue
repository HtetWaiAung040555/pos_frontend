<script setup>

import PageTitle from '@/components/PageTitle.vue';
import DataTable from '@/components/DataTable.vue';
import BaseButton from '@/components/BaseButton.vue';
import { useRouter } from 'vue-router';
import { onMounted, ref, computed } from 'vue';
import { useToast } from 'primevue';
import moment from 'moment'
import { useFilterStore } from '@/stores/filterStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import BaseInput from '@/components/BaseInput.vue';
import { useStockTransactionStore } from '@/stores/useStockTransactionStore';

const router = useRouter();
const toast = useToast();
const filter = useFilterStore();
const usePermission = usePermissionStore();
const useStockTransaction = useStockTransactionStore();

const searchValue = ref('');
const selectedReference = ref('');
const selectedType = ref('');
const dataList = ref([]);
const filteredData = ref({
    startedDate: moment().startOf('month').format('YYYY-MM-DDTHH:mm'),
    endedData: moment().format('YYYY-MM-DDTHH:mm'),
    referenceType: 'adjustment',
});

onMounted(async () => {
    await useStockTransaction.fetchStockTransactions({
        start_date: moment(filteredData.value.startedDate).format('YYYY-MM-DD HH:mm:ss'),
        end_date: moment(filteredData.value.endedData).format('YYYY-MM-DD HH:mm:ss')
    });
    dataList.value = useStockTransaction.list;
});

// Table headers
const columns = [
    { key: 'id', label: 'ID' },
    {
        key: 'image_url', label: 'Image', formatter: (row) => {
            return `<img class="object-cover w-10 h-10 rounded" src="${row.inventory.product.image_url}" alt="${row.inventory.product.name}" />`;
        }
    },
    { key: 'inventory.product.name', label: 'Product', formatter: (row) => row.inventory.product.name },
    { key: 'reference_id', label: 'Reference Id'},
    { key: 'inventory.warehouse.name', label: 'Warehouse', formatter: (row) => row.inventory.warehouse.name },
    { key: 'quantity_change', label: 'Qty' },
    { key: 'type', label: 'Type',  formatter: (row) => {
            const color = row.type === 'in' ? 'bg-green-500 text-white rounded-md py-1 px-2' : 'bg-red-500 text-white rounded-md py-1 px-2';
            return `<span class="text-white px-2 py-1 rounded ${color}">${row.type.toUpperCase()}</span>`;
        }
    },
    { key: 'reference_type', label: 'Reference Type', formatter: (row) => row.reference_type.toUpperCase() },
    { key: 'inventory.expired_date', label: 'Expire', formatter: (row) => row.inventory.expired_date ? moment(row.inventory.expired_date).format('DD-MM-YY') : "N/A" },
    { key: 'created_by.name', label: 'Created By', formatter: (row) => row.created_by.name },
    { key: 'created_at', label: 'Created At', formatter: (row) => moment(row.created_at).format('DD-MM-YY HH:mm') },
];

async function fetchSalesByDate() {
    // convert local datetime-local strings to backend friendly format (YYYY-MM-DD HH:mm:ss)
    const start = filteredData.value.startedDate
        ? moment(filteredData.value.startedDate).format('YYYY-MM-DD HH:mm:ss')
        : null;
    const end = filteredData.value.endedData
        ? moment(filteredData.value.endedData).format('YYYY-MM-DD HH:mm:ss')
        : null;

    await useStockTransaction.fetchStockTransactions({
        start_date: start,
        end_date: end
    });
    dataList.value = useStockTransaction.list || [];
    // reset client-side filters when new date-range data fetched (optional)
    selectedReference.value = '';
    selectedType.value = '';
    searchValue.value = '';
}

// Route change function: need to pass route path.
function changeRoute(pathname) {
    router.push(pathname);
}

// Derived options from fetched data for client-side filters
const referenceTypes = computed(() => {
    const map = new Map();
    (dataList.value || []).forEach(st => {
        if (st.reference_type) map.set(st.reference_type);
    });
    return Array.from(map.entries()).map(([name]) => ({ name }));
});

// Filter Function
const filteredRows = computed(() => {
    let list = (dataList.value || []).slice();
    // filter by reference type
    if (selectedReference.value) {
        list = list.filter(st => String(st.reference_type) === String(selectedReference.value));
    }
    // filter by transaction type
    if (selectedType.value) {
        list = list.filter(st => String(st.type) === String(selectedType.value));
    }
    // search across product name, reference id
    if (searchValue.value && searchValue.value.trim() !== '') {
        const q = searchValue.value.toLowerCase().trim();
        list = list.filter(st => {
            const product = st.inventory.product?.name || '';
            const reference_id = st.reference_id ? String(st.reference_id) : '';
            return product.toLowerCase().includes(q) || reference_id.includes(q);
        });
    }
    return list;
});

//Branch delete function
async function deleteHandle(id) {
    await useUser.deleteUser(id);
    if (useUser.error) {
        toast.add({ severity: 'error', summary: 'Error Message', detail: useUser.error, life: 3000 });
        return
    }
    if (useUser.data.status === 200) {
        toast.add({ severity: 'success', summary: 'Success Message', detail: 'Inventory deleted successfully.', life: 3000 });
        await useUser.fetchAllUsers();
        dataList.value = useUser.users;
    }
}

</script>

<template>
    <div class="p-4">
        <!-- Page Title -->
        <PageTitle title="Stock Transaction List">
        </PageTitle>
        <!-- DataTable -->
        <DataTable 
            :columns="columns" :rows="filteredRows" :pageSize="20" :isAction="false"
            :isLoading="useStockTransaction.loading" :defaultSort="{ key: 'id', order: 'desc' }" @delete="deleteHandle"
            :filename="'Stock_Transaction'">
            <!-- Filter Section -->
            <template #filters>
                <div class="flex gap-2 items-center">
                    <BaseInput 
                        size="sm"
                        v-model="filteredData.startedDate"
                        type="datetime-local"
                        placeholder="Start DateTime"
                        width="240px"
                        height="h-[35px]"
                    />
                    <BaseInput 
                        size="sm"
                        v-model="filteredData.endedData"
                        type="datetime-local"
                        placeholder="End DateTime"
                        width="240px"
                        height="h-[35px]"
                    />
                    <BaseButton label="Fetch" severity="primary" @click="fetchSalesByDate" />

                    <select v-model="selectedReference" class="border p-2 rounded text-sm">
                        <option value="">All Status</option>
                        <option v-for="opt in referenceTypes" :key="opt.id" :value="opt.name">{{ opt.name }}</option>
                    </select>

                    <select v-model="selectedType" class="border p-2 rounded text-sm">
                        <option value="">All Type</option>
                        <option value="in">IN</option>
                        <option value="out">OUT</option>
                    </select>

                    <BaseInput 
                        size="sm"
                        v-model="searchValue"
                        placeholder="Search..."
                        icon="pi pi-search"
                        width="200px"
                        height="h-[35px]"
                    />
                </div>
            </template>
        </DataTable>
    </div>
</template>
