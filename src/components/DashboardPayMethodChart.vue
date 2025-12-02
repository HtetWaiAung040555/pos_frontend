<script setup>
import { ref, computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement } from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, ArcElement)

// --- Sample Orders ---
const orders = ref([
  { id: 1, payment: 'Credit Card', amount: 50, date: '2025-11-01' },
  { id: 2, payment: 'Paypal', amount: 30, date: '2025-11-03' },
  { id: 3, payment: 'Credit Card', amount: 20, date: '2025-11-05' },
  { id: 4, payment: 'Cash', amount: 10, date: '2025-11-07' },
  { id: 5, payment: 'Paypal', amount: 60, date: '2025-11-10' },
  { id: 6, payment: 'Credit Card', amount: 40, date: '2025-11-12' },
  { id: 7, payment: 'Cash', amount: 25, date: '2025-11-12' },
  { id: 8, payment: 'Paypal', amount: 15, date: '2025-11-13' },
  { id: 9, payment: 'Credit Card', amount: 70, date: '2025-11-14' },
  { id: 10, payment: 'Cash', amount: 35, date: '2025-11-15' },
])

// --- Filters ---
const selectedPayment = ref('All')
const startDate = ref('')
const endDate = ref('')

// --- Filtered Orders ---
const filteredOrders = computed(() =>
  orders.value.filter(order => {
    const matchesPayment = selectedPayment.value === 'All' || order.payment === selectedPayment.value
    const matchesStart = !startDate.value || new Date(order.date) >= new Date(startDate.value)
    const matchesEnd = !endDate.value || new Date(order.date) <= new Date(endDate.value)
    return matchesPayment && matchesStart && matchesEnd
  })
)

// --- Pagination ---
const currentPage = ref(1)
const itemsPerPage = 10
const totalPages = computed(() => Math.ceil(filteredOrders.value.length / itemsPerPage))
const paginatedOrders = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return filteredOrders.value.slice(start, start + itemsPerPage)
})
function changePage(direction) {
  if (direction === 'next' && currentPage.value < totalPages.value) currentPage.value++
  if (direction === 'prev' && currentPage.value > 1) currentPage.value--
}

// --- Doughnut Chart ---
const chartData = computed(() => {
  const counts = {}
  filteredOrders.value.forEach(order => {
    counts[order.payment] = (counts[order.payment] || 0) + 1
  })
  return {
    labels: Object.keys(counts),
    datasets: [
      {
        data: Object.values(counts),
        backgroundColor: ['#3B82F6', '#F97316', '#10B981', '#EF4444', '#8B5CF6'],
        hoverOffset: 20,
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '70%',
  animation: { animateRotate: true, duration: 1200, easing: 'easeOutCubic' },
  plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 12 } } },
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
            <option>Credit Card</option>
            <option>Paypal</option>
            <option>Cash</option>
          </select>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm text-gray-600">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="px-2 py-2 font-medium">ID</th>
              <th class="px-2 py-2 font-medium">Payment</th>
              <th class="px-2 py-2 font-medium">Amount</th>
              <th class="px-2 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in paginatedOrders" :key="order.id" class="hover:bg-gray-50">
              <td class="px-2 py-2">{{ order.id }}</td>
              <td class="px-2 py-2">{{ order.payment }}</td>
              <td class="px-2 py-2">${{ order.amount }}</td>
              <td class="px-2 py-2">{{ order.date }}</td>
            </tr>
            <tr v-if="paginatedOrders.length === 0">
              <td colspan="4" class="px-2 py-3 text-center text-gray-400">No orders found</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex justify-between items-center mt-3 text-gray-600 text-sm">
        <button @click="changePage('prev')" :disabled="currentPage===1" class="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-40">← Previous</button>
        <span>Page {{ currentPage }} of {{ totalPages }}</span>
        <button @click="changePage('next')" :disabled="currentPage===totalPages" class="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200">Next →</button>
      </div>
    </div>

  </div>
</div>
</template>
