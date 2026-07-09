<script setup>
import logo from '@/assets/images/Logo.png';

defineProps({
    variant: { type: String, default: 'skeleton' },
    loadingWidth: { type: String, default: 'w-[95px]' },
    logoSrc: { type: String, default: logo },
    skeletonRows: { type: Number, default: 5 }
});
</script>

<template>
    <div
        v-if="variant === 'skeleton'"
        class="w-full space-y-2"
        role="status"
        aria-label="Loading"
    >
        <div
            v-for="row in skeletonRows"
            :key="row"
            class="loading-skeleton-row h-9 w-full rounded bg-gray-100"
        ></div>
    </div>

    <div 
        v-else
        class="relative flex aspect-square items-center justify-center"
        :class="loadingWidth"
        role="status"
        aria-label="Loading"
    >
        <div
            class="absolute inset-0 flex animate-spin items-center justify-center rounded-full border-[4px] border-gray-300 border-t-blue-400 text-4xl text-blue-400">
        </div>
        <div class="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-blue-500">
            <img :src="logoSrc" class="h-[68%] w-[68%] object-contain" alt="Fusion Mart Logo" />
        </div>
    </div>
</template>

<style scoped>
.loading-skeleton-row {
    position: relative;
    overflow: hidden;
}

.loading-skeleton-row::after {
    position: absolute;
    inset: 0;
    content: "";
    transform: translateX(-100%);
    animation: loading-shimmer 1.4s infinite;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.85), transparent);
}

@keyframes loading-shimmer {
    100% {
        transform: translateX(100%);
    }
}
</style>
