<script setup>
import { ref, computed } from 'vue'
import { Chart as ChartJS, Title, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js'
import { Bar } from 'vue-chartjs'

ChartJS.register(Title, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

const { products } = defineProps({
  products: {
    type: Array,
    default: () => [
      { name: 'Iced Latte', quantity: 50, unit: 'bottle' },
      { name: 'Espresso', quantity: 20, unit: 'cup' },
      { name: 'Cappuccino', quantity: 10, unit: 'cup' },
      { name: 'Mocha', quantity: 5, unit: 'cup' },
      { name: 'Americano', quantity: 30, unit: 'cup' },
      { name: 'Latte', quantity: 40, unit: 'cup' },
      { name: 'Tea', quantity: 15, unit: 'pack' },
      { name: 'Smoothie', quantity: 25, unit: 'bottle' },
      { name: 'Cake', quantity: 12, unit: 'slice' },
      { name: 'Cookie', quantity: 8, unit: 'pcs' },
      { name: 'Sandwich', quantity: 18, unit: 'pcs' },
      { name: 'Bagel', quantity: 7, unit: 'pcs' },
      { name: 'Muffin', quantity: 22, unit: 'pcs' },
      { name: 'Croissant', quantity: 14, unit: 'pcs' },
      { name: 'Hot Chocolate', quantity: 28, unit: 'cup' },
      { name: 'Chai Latte', quantity: 16, unit: 'cup' },
      { name: 'Green Tea', quantity: 9, unit: 'pack' },
      { name: 'Fruit Juice', quantity: 35, unit: 'bottle' },
      { name: 'Bagel with Cream', quantity: 6, unit: 'pcs' },
      { name: 'Donut', quantity: 13, unit: 'pcs' },
      { name: 'Energy Bar', quantity: 19, unit: 'pcs' },
    ]
  }
})

const getStockColor = q => q > 30 ? 'rgba(34,197,94,0.7)' : q > 10 ? 'rgba(251,191,36,0.7)' : 'rgba(239,68,68,0.7)'
const getStockStatus = q => q > 30 ? ['In Stock', 'bg-green-500', 'text-green-600'] 
                               : q > 10 ? ['Limited', 'bg-yellow-400', 'text-yellow-600'] 
                                         : ['Low Stock', 'bg-red-500', 'text-red-600']

// Charts
const sortedProducts = computed(() => [...products].sort((a,b)=>b.quantity - a.quantity))
const topChartData = computed(() => ({
  labels: sortedProducts.value.slice(0,10).map(p=>p.name),
  datasets: [{ 
    label: 'Stock Quantity', 
    data: sortedProducts.value.slice(0,10).map(p=>p.quantity),
    backgroundColor: sortedProducts.value.slice(0,10).map(p=>getStockColor(p.quantity)),
    borderRadius: 6, barPercentage: 0.5
  }]
}))
const bottomChartData = computed(() => ({
  labels: sortedProducts.value.slice(-10).map(p=>p.name),
  datasets: [{ 
    label: 'Stock Quantity', 
    data: sortedProducts.value.slice(-10).map(p=>p.quantity),
    backgroundColor: sortedProducts.value.slice(-10).map(p=>getStockColor(p.quantity)),
    borderRadius: 6, barPercentage: 0.5
  }]
}))
const chartOptions = {
  responsive:true, indexAxis:'y',
  plugins:{ legend:{display:false}, tooltip:{callbacks:{label:t=>`${t.raw} units`}} },
  scales:{ 
    x:{ beginAtZero:true, grid:{color:'rgba(200,200,200,0.1)'}, ticks:{color:'#64748b'} },
    y:{ ticks:{color:'#475569'}, grid:{display:false} } 
  }
}

// Pagination
const currentPage = ref(1)
const itemsPerPage = 10
const totalPages = computed(()=>Math.ceil(products.length/itemsPerPage))
const paginatedProducts = computed(()=>products.slice((currentPage.value-1)*itemsPerPage, currentPage.value*itemsPerPage))
const changePage = dir => { 
  if(dir==='next' && currentPage.value<totalPages.value) currentPage.value++ 
  if(dir==='prev' && currentPage.value>1) currentPage.value-- 
}
</script>

<template>
<div class="space-y-4 min-h-screen">

  <!-- Charts -->
  <div class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-3">
    <div class="bg-white rounded-xl shadow p-4 hover:shadow-md transition">
      <h2 class="text-lg font-semibold text-gray-700 mb-2">Top Stocked Products</h2>
      <Bar :data="topChartData" :options="chartOptions" class="h-72" />
    </div>
    <div class="bg-white rounded-xl shadow p-4 hover:shadow-md transition">
      <h2 class="text-lg font-semibold text-gray-700 mb-2">Low Stocked Products</h2>
      <Bar :data="bottomChartData" :options="chartOptions" class="h-72" />
    </div>
  </div>

  <!-- Table -->
  <div class="bg-white rounded-xl shadow p-4 max-w-6xl mx-auto">
    <h2 class="text-xl font-semibold text-gray-700 mb-4">All Product Stock Levels</h2>
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm text-left text-gray-600">
        <thead class="border-b border-gray-200 text-gray-700 uppercase bg-gray-50">
          <tr>
            <th class="px-3 py-2 font-medium">Product</th>
            <th class="px-3 py-2 font-medium text-center">Quantity</th>
            <th class="px-3 py-2 font-medium text-center">Stock Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in paginatedProducts" :key="p.name" class="border-b border-gray-100 hover:bg-gray-50 transition">
            <td class="px-3 py-2 font-medium text-gray-800">{{p.name}}</td>
            <td class="px-3 py-2 font-semibold text-gray-700 text-center">{{p.quantity}} <span class="text-gray-500 font-normal">{{p.unit}}</span></td>
            <td class="px-3 py-2 text-center">
              <div class="flex justify-center items-center gap-1">
                <span class="inline-block w-3 h-3 rounded-full" :class="getStockStatus(p.quantity)[1]"></span>
                <span class="font-medium text-sm" :class="getStockStatus(p.quantity)[2]">{{getStockStatus(p.quantity)[0]}}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="flex justify-between items-center mt-4 text-gray-600 text-sm">
      <button @click="changePage('prev')" :disabled="currentPage===1" class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">← Previous</button>
      <div class="font-medium text-gray-700">Page {{currentPage}} of {{totalPages}}</div>
      <button @click="changePage('next')" :disabled="currentPage===totalPages" class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">Next →</button>
    </div>
  </div>

</div>
</template>
