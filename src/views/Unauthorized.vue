<script setup>
    import BaseButton from '@/components/BaseButton.vue';   
    import { useRouter } from 'vue-router';

    const router = useRouter();

    function goBack() {
        if (window.history.length > 1) {
            router.back();
        } else {
            router.push('/');
        }
    }

</script>

<template>
    <div class="px-64 h-[50%] flex flex-col justify-center items-center gap-8">
        <i class="fa fa-circle-exclamation text-5xl text-yellow-500"></i>
        <p class="text-center text-black text-xl">
            The page you are attempting to reach is currently not available. This may be because you don't have permission.
        </p>
        <BaseButton 
            label="Go to back"
            size="md"
            severity="secondary"
            @click="goBack"
        />
    </div>
</template>
