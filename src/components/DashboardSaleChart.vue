<script setup>
import { ref, computed } from 'vue'
import { Chart as ChartJS, Title, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale, Filler } from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale, Filler)

// --- Tabs ---
const options = ['daily', 'weekly', 'monthly']
const selected = ref('daily')

// --- Raw Sales Data ---
const rawData = {
  daily: [
    { label: 'Nov 1', total: 1000 },
    { label: 'Nov 2', total: 1200 },
    { label: 'Nov 3', total: 900 },
    { label: 'Nov 4', total: 1500 },
    { label: 'Nov 5', total: 1100 },
  ],
  weekly: [
    { label: 'Week 1', total: 5000 },
    { label: 'Week 2', total: 6200 },
    { label: 'Week 3', total: 4800 },
    { label: 'Week 4', total: 7000 },
  ],
  monthly: [
    { label: 'Jan', total: 20000 },
    { label: 'Feb', total: 25000 },
    { label: 'Mar', total: 18000 },
    { label: 'Apr', total: 22000 },
  ],
}

// --- Computed Chart Data ---
const chartData = computed(() => {
  const data = rawData[selected.value]
  return {
    labels: data.map(d => d.label),
    datasets: [
      {
        label: 'Sales',
        data: data.map(d => d.total),
        borderColor: '#3b82f6',
        backgroundColor: context => {
          const chart = context.chart
          const { ctx, chartArea } = chart
          if (!chartArea) return null
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top)
          gradient.addColorStop(0, 'rgba(59,130,246,0.05)')
          gradient.addColorStop(1, 'rgba(59,130,246,0.2)')
          return gradient
        },
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#111827',
        pointBorderColor: '#111827',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  }
})

// --- Chart Options ---
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: '#1f2937',
      titleColor: '#f9fafb',
      bodyColor: '#f9fafb',
      padding: 10,
      cornerRadius: 8,
      callbacks: { label: tooltipItem => `Sales: Ks. ${tooltipItem.raw.toLocaleString()}` },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#6b7280', font: { weight: 500 } } },
    y: { grid: { color: '#e5e7eb', drawBorder: false }, ticks: { color: '#6b7280', font: { weight: 500 }, beginAtZero: true } },
  },
}

// --- Summary Stats ---
const summaryStats = computed(() => {
  const data = chartData.value.datasets[0].data
  return {
    total: data.reduce((a, b) => a + b, 0),
    max: Math.max(...data),
    min: Math.min(...data),
  }
})
</script>

<template>
<div class="max-w-7xl mx-auto p-4 space-y-6">

  <!-- Dashboard Container -->
  <div class="flex flex-col lg:flex-row gap-4">

    <!-- Stats Panel -->
    <div class="w-full lg:w-1/4 flex flex-col gap-3">
      <div class="bg-white p-4 rounded-xl shadow hover:shadow-md transition">
        <p class="text-gray-400 text-xs uppercase font-medium tracking-wide">Total Sales</p>
        <p class="text-2xl font-bold text-gray-900 mt-1">Ks. {{ summaryStats.total.toLocaleString() }}</p>
      </div>
      <div class="bg-white p-4 rounded-xl shadow hover:shadow-md transition">
        <p class="text-gray-400 text-xs uppercase font-medium tracking-wide">Highest Sale</p>
        <p class="text-2xl font-bold text-yellow-500 mt-1">Ks. {{ summaryStats.max.toLocaleString() }}</p>
      </div>
      <div class="bg-white p-4 rounded-xl shadow hover:shadow-md transition">
        <p class="text-gray-400 text-xs uppercase font-medium tracking-wide">Lowest Sale</p>
        <p class="text-2xl font-bold text-red-500 mt-1">Ks. {{ summaryStats.min.toLocaleString() }}</p>
      </div>
    </div>

    <!-- Chart Panel -->
    <div class="w-full lg:w-3/4 flex flex-col gap-4">
      
      <!-- Tabs -->
      <div class="flex gap-2">
        <div
          v-for="tab in options"
          :key="tab"
          @click="selected = tab"
          class="flex-1 text-center py-2 rounded-lg cursor-pointer transition-all font-medium"
          :class="selected === tab
            ? 'bg-blue-500 text-white shadow-md'
            : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'"
        >
          {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
        </div>
      </div>

      <!-- Line Chart -->
      <div class="w-full h-[450px] bg-white rounded-xl p-3 shadow-inner">
        <Line :data="chartData" :options="chartOptions" class="h-full w-full" />
      </div>

    </div>

  </div>
</div>
</template>
