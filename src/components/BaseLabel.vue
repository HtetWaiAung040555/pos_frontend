<script setup>
    defineProps({
        label: {type: String, default: ''},
        isRequire: {type: Boolean, default: false}
    })
</script>

<template>
    <div v-if="label" class="flex items-center gap-x-1 py-0 text-sm font-medium text-black">
      <span>{{ label }}</span> 
      <i v-if="isRequire" class="fa fa-asterisk text-red-500 text-[9px]"></i>
    </div>
</template>