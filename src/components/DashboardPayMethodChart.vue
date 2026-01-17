<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement } from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, ArcElement)

const orders = ref([])

const fetchData = async () => {
  const [paymentsRes, ordersRes] = await Promise.all([
    axios.get('/dashboard/paymentmethods'),
    axios.get('/dashboard/orders')
  ])

  orders.value = ordersRes.data.map((o, i) => ({
    id: i + 1,
    payment: o.payment,
    amount: o.total,
    date: o.sale_date
  }))

  paymentSummary.value = paymentsRes.data
}

const paymentSummary = ref([])
onMounted(fetchData)

// Filters
const selectedPayment = ref('All')

const filteredOrders = computed(() =>
  orders.value.filter(o =>
    selectedPayment.value === 'All' || o.payment === selectedPayment.value
  )
)

// Pagination
const currentPage = ref(1)
const itemsPerPage = 10
const totalPages = computed(() => Math.ceil(filteredOrders.value.length / itemsPerPage))
const paginatedOrders = computed(() =>
  filteredOrders.value.slice((currentPage.value - 1) * itemsPerPage, currentPage.value * itemsPerPage)
)

const changePage = dir => {
  if (dir === 'next' && currentPage.value < totalPages.value) currentPage.value++
  if (dir === 'prev' && currentPage.value > 1) currentPage.value--
}

// Doughnut
const chartData = computed(() => ({
  labels: paymentSummary.value.map(p => p.paymentMethod.name),
  datasets: [{
    data: paymentSummary.value.map(p => p.total_count),
    backgroundColor: ['#3B82F6','#10B981','#F59E0B','#EF4444']
  }]
}))

const chartOptions = {
  responsive: true,
  cutout: '70%',
  plugins: { legend: { position: 'right' } }
}
</script>

<template>
<div class="p-4">

  <div class="flex flex-col lg:flex-row gap-3">

    <!-- Doughnut Chart -->
    <div class="bg-white/90 p-4 rounded-xl shadow-md flex items-center justify-center" style="width: 100%; max-width: 500px; height: 400px;">
      <Doughnut :data="chartData" :options="chartOptions"/>
    </div>

    <!-- Orders Table -->
    <div class="bg-white/90 p-4 rounded-xl shadow-md flex-1">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
        <h2 class="text-lg font-semibold text-gray-800">Orders</h2>
        <div class="flex items-center gap-2">
          <label class="text-sm font-medium text-gray-700">Payment:</label>
          <select v-model="selectedPayment" class="text-black rounded-md border border-gray-300 px-2 py-1 text-sm">
            <option>All</option>
            <option>Cash</option>
            <option>Credit</option>
            <option>Wallet</option>
            <option>Kpay</option>
          </select>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm text-gray-600">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="px-2 py-2 font-medium">ID</th>
              <th class="px-2 py-2 font-medium">Payment</th>
              <th class="px-2 py-2 font-medium">Amount (Ks.)</th>
              <th class="px-2 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in paginatedOrders" :key="order.id" class="hover:bg-gray-50">
              <td class="px-2 py-2">{{ order.id }}</td>
              <td class="px-2 py-2">{{ order.payment }}</td>
              <td class="px-2 py-2">{{ order.amount }}</td>
              <td class="px-2 py-2">{{ order.date }}</td>
            </tr>
            <tr v-if="paginatedOrders.length === 0">
              <td colspan="4" class="px-2 py-3 text-center text-gray-400">No orders found</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex justify-between items-center mt-3 text-gray-600 text-sm">
        <button @click="changePage('prev')" :disabled="currentPage===1" class="px-4 py-2 rounded-md border border-gray-300
                  bg-white text-gray-700
                  hover:bg-gray-100 hover:text-gray-900
                  disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
        <span>Page {{ currentPage }} of {{ totalPages }}</span>
        <button @click="changePage('next')" :disabled="currentPage===totalPages" class="px-4 py-2 rounded-md border border-gray-300
                  bg-white text-gray-700
                  hover:bg-gray-100 hover:text-gray-900
                  disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
      </div>
    </div>

  </div>
</div>
</template>
