<script setup>
    defineProps({
        label: {type: String, default: ''}
    })
</script>

<template>
    <p class="text-black text-[17px] font-semibold text-left px-1 border-l-2 border-l-blue-500 rounded">
        {{ label }}
    </p>
</template>