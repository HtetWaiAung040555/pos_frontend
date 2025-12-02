<script setup>
import { ref } from 'vue'
import DashboardCard from '@/components/DashboardCard.vue'
import DashboardSaleChart from '@/components/DashboardSaleChart.vue'
import DashboardPayMethodChart from '@/components/DashboardPayMethodChart.vue'
import DashboardStockChart from '@/components/DashboardStockChart.vue'

//  data
const summary = ref({
  totalRevenue: 25500,
  averageSale: 850,
  totalOrders: 30,
  topProduct: 'Iced Latte',
})

const formatCurrency = (num) => `Ks. ${num.toLocaleString()}`
</script>

<template>
  <div class="bg-gray-50 min-h-screen p-6 space-y-12">

    <!-- Cards -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <DashboardCard title="Total Revenue" :value="formatCurrency(summary.totalRevenue)" icon="fa fa-sack-dollar" color="green" />
      <DashboardCard title="Average Sale" :value="formatCurrency(summary.averageSale)" icon="fa fa-chart-line" color="blue" />
      <DashboardCard title="Total Orders" :value="summary.totalOrders" icon="fa fa-receipt" color="yellow" />
      <DashboardCard title="Top Product" :value="summary.topProduct" icon="fa fa-star" color="red" />
    </section>

    <!-- Charts -->
    <section class="space-y-6">
      <div class="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <h2 class="text-xl font-semibold mb-4 text-gray-800">Daily Sales</h2>
        <DashboardSaleChart />
      </div>

      <div class="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <h2 class="text-xl font-semibold mb-4 text-gray-800">Payment Methods</h2>
        <DashboardPayMethodChart />
      </div>

      <div class="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <h2 class="text-xl font-semibold mb-4 text-gray-800">Product Stock Levels</h2>
        <DashboardStockChart />
      </div>
    </section>

  </div>
</template>
