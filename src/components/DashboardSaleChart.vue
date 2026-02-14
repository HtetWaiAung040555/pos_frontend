<script setup>
import { ref, computed, onMounted } from 'vue'
import { Chart as ChartJS, Title, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale, Filler } from 'chart.js'
import { Line } from 'vue-chartjs'
import axios from 'axios'

ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale, Filler)

// --- Tabs ---
const options = ['daily', 'monthly', 'yearly']
const selected = ref('daily')

function getLastNDates(n) {
  const dates = []
  const today = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0]) 
  }
  return dates
}

const fillMissingDates = (data, days = 30) => {
  const lastDates = getLastNDates(days)
  const dataMap = {}
  data.forEach(item => {
    dataMap[item.date] = parseFloat(item.total)
  })

  return lastDates.map(date => ({
    label: date,
    total: dataMap[date] || 0,
  }))
}

const getLastNMonths = (n) => {
  const months = []
  const today = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const month = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
    months.push(month)
  }
  return months
}

const fillMissingMonths = (data, months) => {
  const lastMonths = getLastNMonths(months)
  const dataMap = {}
  data.forEach(item => {
    dataMap[item.month] = parseFloat(item.total)
  })

  return lastMonths.map(month => ({
    label: month,
    total: dataMap[month] || 0,
  }))
}

// Last N years
const getLastNYears = (n) => {
  const years = []
  const currentYear = new Date().getFullYear()
  for (let i = n - 1; i >= 0; i--) {
    years.push(currentYear - i)
  }
  return years
}

const fillMissingYears = (data, years) => {
  const lastYears = getLastNYears(years)
  const dataMap = {}
  data.forEach(item => {
    dataMap[item.year] = parseFloat(item.total)
  })

  return lastYears.map(year => ({
    label: year,
    total: dataMap[year] || 0,
  }))
}

const rawData = ref({
  daily: [],
  monthly: [],
  yearly: [],
})


const fetchSalesData = async () => {
  try {
    const endpoints = {
      daily: '/dashboard/dailysales',
      monthly: '/dashboard/monthlysales',
      yearly: '/dashboard/yearlysales'
    }

    for (const key of Object.keys(endpoints)) {
      const response = await axios.get(endpoints[key])
      let formatted = response.data.map(item => ({
        label: item.date ||item.month || item.year,
        total: parseFloat(item.total),
      }))

      // fill missing dates
      if (key === 'daily') formatted = fillMissingDates(response.data, 20)
      if (key === 'monthly') formatted = fillMissingMonths(response.data, 12)
      if (key === 'yearly') formatted = fillMissingYears(response.data, 5)
    
      rawData.value[key] = formatted
    }
  } catch (error) {
    console.error('Failed to fetch sales data:', error)
  }
}


onMounted(() => fetchSalesData())

// --- Computed Chart Data ---
const chartData = computed(() => {
  const data = rawData.value[selected.value] || []
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

