<script setup>

    import Breadcrumb from './Breadcrumb.vue';

    defineProps({
        title: {
            type: String,
            required: true,
        },
        showBreadcrumb: {
            type: Boolean,
            default: true,
        }
    })

</script>

<template>

    <div class="flex items-start justify-between gap-x-4">
        <div>
            <!-- Page Title -->
            <p class="text-black font-semibold text-xl">{{ title }}</p>

            <!-- Breadcrumb (optional) -->
            <Breadcrumb v-if="showBreadcrumb" class="mt-1" />
        </div>
        <slot name="titleButtons">

        </slot>
    </div>

</template>