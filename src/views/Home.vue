<script setup>
import { onMounted, ref } from 'vue'
import DashboardCard from '@/components/DashboardCard.vue'
import DashboardSaleChart from '@/components/DashboardSaleChart.vue'
import DashboardPayMethodChart from '@/components/DashboardPayMethodChart.vue'
import DashboardStockChart from '@/components/DashboardStockChart.vue'
import axios from 'axios'

//  data
const summary = ref({
  totalRevenue: 0,
  averageSale: 0,
  totalOrders: 0,
  topProduct: '',
})

const formatCurrency = (num) => `Ks. ${num.toLocaleString()}`

const fetchSummary = async () => {
  try {
    const { data } = await axios.get('/dashboard/summary')
    summary.value = data
  } catch (err) {
    console.error('Failed to fetch summary', err)
  }
}

onMounted(() => {
  fetchSummary()
})

</script>

<template>
  <div class="min-h-screen bg-gray-50">

    <div class="w-full px-6 py-6 space-y-8">

      <!-- Summary Cards -->
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard
          title="Total Revenue"
          :value="formatCurrency(summary.totalRevenue)"
          icon="fa fa-sack-dollar"
          color="green"
        />
        <DashboardCard
          title="Average Sale"
          :value="formatCurrency(summary.averageSale)"
          icon="fa fa-chart-line"
          color="blue"
        />
        <DashboardCard
          title="Total Orders"
          :value="summary.totalOrders"
          icon="fa fa-receipt"
          color="yellow"
        />
        <DashboardCard
          title="Top Product"
          :value="summary.topProduct"
          icon="fa fa-star"
          color="red"
        />
      </section>

      <!-- Charts -->
      <section class="space-y-6">

        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <h2 class="text-2xl font-semibold text-gray-800 mb-10">
            Sales
          </h2>
          
          <DashboardSaleChart />
        </div>

        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <h2 class="text-2xl font-semibold text-gray-800 mb-10">
            Payment Methods
          </h2>
          <DashboardPayMethodChart />
        </div>

        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <h2 class="text-2xl font-semibold text-gray-800 mb-10">
            Product Stock Levels
          </h2>
          <DashboardStockChart />
        </div>

      </section>

    </div>
  </div>
</template>
