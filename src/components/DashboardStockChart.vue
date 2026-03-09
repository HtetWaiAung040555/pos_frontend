<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { Chart as ChartJS, Title, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js'
import { Bar } from 'vue-chartjs'

ChartJS.register(Title, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

const products = ref([])

const fetchStock = async () => {
  const { data } = await axios.get('/dashboard/stocklevels')
  products.value = data.map(p => ({
    name: p.product,
    quantity: p.qty,
    unit: 'unit'
  }))
}

onMounted(fetchStock)

const getStockColor = q => q > 30 ? 'rgba(34,197,94,0.7)' : q > 10 ? 'rgba(251,191,36,0.7)' : 'rgba(239,68,68,0.7)'
const getStockStatus = q => q > 30 ? ['In Stock', 'bg-green-500', 'text-green-600'] 
                               : q > 10 ? ['Limited', 'bg-yellow-400', 'text-yellow-600'] 
                                         : ['Low Stock', 'bg-red-500', 'text-red-600']

// Charts
const sortedProducts = computed(() => [...products.value].sort((a,b)=>b.quantity - a.quantity))

const topChartData = computed(() => ({
  labels: sortedProducts.value.slice(0,10).map(p=>p.name),
  datasets: [{
    data: sortedProducts.value.slice(0,10).map(p=>p.quantity),
    backgroundColor: sortedProducts.value.slice(0,10).map(p=>getStockColor(p.quantity)),
    borderRadius: 6
  }]
}))

const bottomChartData = computed(() => ({
  labels: sortedProducts.value.slice(-10).map(p=>p.name),
  datasets: [{
    data: sortedProducts.value.slice(-10).map(p=>p.quantity),
    backgroundColor: sortedProducts.value.slice(-10).map(p=>getStockColor(p.quantity)),
    borderRadius: 6
  }]
}))

const chartOptions = {
  responsive:true,
  indexAxis:'y',
  plugins:{ legend:{display:false} }
}

// Pagination
const currentPage = ref(1)
const itemsPerPage = 10
const totalPages = computed(()=>Math.ceil(products.value.length/itemsPerPage))
const paginatedProducts = computed(()=>products.value.slice((currentPage.value-1)*itemsPerPage, currentPage.value*itemsPerPage))

const changePage = dir => {
  if(dir==='next' && currentPage.value<totalPages.value) currentPage.value++
  if(dir==='prev' && currentPage.value>1) currentPage.value--
}
</script>


<template>
  <div class="min-h-screen bg-gray-50">

    <div class="max-w-[1600px] mx-auto px-6 py-6 space-y-8">

      <!-- Charts -->
      <section class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div class="bg-white border border-gray-200 rounded-xl p-5">
          <h2 class="text-base font-semibold text-gray-800 mb-4">
            Top Stocked Products
          </h2>
          <Bar :data="topChartData" :options="chartOptions" class="h-64" />
        </div>

        <div class="bg-white border border-gray-200 rounded-xl p-5">
          <h2 class="text-base font-semibold text-gray-800 mb-4">
            Low Stocked Products
          </h2>
          <Bar :data="bottomChartData" :options="chartOptions" class="h-64" />
        </div>

      </section>

      <!-- Table -->
      <section class="bg-white border border-gray-200 rounded-xl p-5">

        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-semibold text-gray-800">
            Product Stock Levels
          </h2>
          <span class="text-sm text-gray-500">
            Total: {{ products.length }} products
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full text-sm text-gray-600">
            <thead class="border-b border-gray-200 bg-gray-50 text-gray-700">
              <tr>
                <th class="px-4 py-3 text-left font-medium">Product</th>
                <th class="px-4 py-3 text-center font-medium">Quantity</th>
                <th class="px-4 py-3 text-center font-medium">Status</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="p in paginatedProducts"
                :key="p.name"
                class="border-b-grey last:border-none hover:bg-gray-50 transition"
              >
                <td class="px-4 py-3 font-medium text-gray-800">
                  {{ p.name }}
                </td>

                <td class="px-4 py-3 text-center font-semibold">
                  {{ p.quantity }}
                  
                </td>

                <td class="px-4 py-3 text-center">
                  <span
                    class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
                    :class="getStockStatus(p.quantity)[2]"
                  >
                    <span
                      class="w-2 h-2 rounded-full"
                      :class="getStockStatus(p.quantity)[1]"
                    ></span>
                    {{ getStockStatus(p.quantity)[0] }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="flex items-center justify-between mt-5 text-sm">

          <button
            @click="changePage('prev')"
            :disabled="currentPage === 1"
            class="px-4 py-2 rounded-md border border-gray-300
                  bg-white text-gray-700
                  hover:bg-gray-100 hover:text-gray-900
                  disabled:opacity-40 disabled:cursor-not-allowed"
          > Previous
          </button>

          <span class="text-gray-700">
            Page <strong>{{ currentPage }}</strong> of {{ totalPages }}
          </span>

          <button
            @click="changePage('next')"
            :disabled="currentPage === totalPages"
            class="px-4 py-2 rounded-md border border-gray-300
                  bg-white text-gray-700
                  hover:bg-gray-100 hover:text-gray-900
                  disabled:opacity-40 disabled:cursor-not-allowed"
          > Next
          </button>

        </div>
      </section>
    </div>
  </div>
</template>

