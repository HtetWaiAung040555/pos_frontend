<script setup>
    defineProps({
        label: {type: String, default: ''},
    })
</script>

<template>
    <p class="text-[11px] text-red-500">
        {{ label }}
    </p>
</template>