<script setup>

    import Breadcrumb from './Breadcrumb.vue';

    defineProps({
        title: {
            type: String,
            required: true,
        },
        spanText: {
            type: String,
            default: '',
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
            <p class="text-black font-semibold text-xl flex items-center gap-x-2">{{ title }} <span v-if="spanText" class="text-black text-sm">( {{ spanText }} )</span></p>

            <!-- Breadcrumb (optional) -->
            <Breadcrumb v-if="showBreadcrumb" class="mt-1" />
        </div>
        <slot name="titleButtons">

        </slot>
    </div>

</template>