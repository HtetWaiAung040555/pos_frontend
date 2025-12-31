<script setup>
    import { computed } from 'vue'

    const { title, value, icon, color } = defineProps({
    title: { type: String, required: true },
    value: { type: [String, Number], required: true },
    icon: { type: String, required: true },
    color: { type: String, default: 'blue' }
    })

    //  border color
    const borderColor = computed(() => {
    switch (color) {
        case 'green': return 'border-t-green-500'
        case 'blue': return 'border-t-blue-500'
        case 'yellow': return 'border-t-yellow-500'
        case 'red': return 'border-t-red-500'
        case 'purple': return 'border-t-purple-500'
        case 'gray': return 'border-t-gray-500'
    }
    })

    // Icon  color 
    const bgColor = computed(() => {
    switch (color) {
        case 'green': return 'bg-gradient-to-tr from-green-500 to-green-600'
        case 'blue': return 'bg-gradient-to-tr from-blue-500 to-blue-600'
        case 'yellow': return 'bg-gradient-to-tr from-yellow-400 to-yellow-500'
        case 'red': return 'bg-gradient-to-tr from-red-500 to-red-600'
        case 'purple': return 'bg-gradient-to-tr from-purple-500 to-purple-600'
        case 'gray': return 'bg-gradient-to-tr from-gray-500 to-gray-600'
    }
    })
</script>


<template>
  <div class="flex items-center justify-between p-5 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border-t-4"
    :class="borderColor"
  >
    <!-- Icon  -->
    <div class="flex items-center justify-center w-14 h-14 rounded-full shadow-md" :class="bgColor">
      <i :class="[icon, 'text-white text-2xl']"></i>
    </div>

    <!--  Info -->
    <div class="text-right">
      <h3 class="text-gray-500 text-sm font-medium tracking-wide">
        {{ title }}
      </h3>
      <p class="text-2xl font-bold text-gray-800 mt-1">
        {{ value }}
      </p>
    </div>
  </div>
</template>


