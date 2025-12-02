<script setup>
const props = defineProps({
  name: { type: String, default: "" },
  price: { type: String, default: "0" },
  imageUrl: { type: String, default: "" },
  qty: { type: [String, Number], default: null }
});
</script>


<template>
  <div class="flex flex-col gap-y-2 p-2 rounded-md shadow-md bg-white cursor-pointer hover:shadow-lg transition">
    <div class="relative w-full aspect-square overflow-hidden rounded-md">
      <!-- 1:1 image ratio -->
      <img
        :src="props.imageUrl"
        alt="Product"
        class="w-full h-full object-cover"
      />
      <!-- Price badge (top-right) -->
      <div
        class="absolute top-1 right-1 bg-black/70 text-white text-[12px] font-semibold px-2 py-[2px] rounded-md"
      >
        {{ Number(props.price).toLocaleString('en-US') }} Ks.
      </div>
      <!-- Inventory qty (bottom-left) -->
      <div
        v-if="props.qty !== null"
        class="absolute bottom-1 left-1 bg-white/80 text-gray-800 text-[11px] px-2 py-[1px] rounded"
      >
        Qty: {{ props.qty }}
      </div>
    </div>

    <!-- Name: max 2 lines with ellipsis -->
    <span
      class="mt-2 text-[12px] font-medium text-black leading-tight line-clamp-2"
    >
      {{ props.name }}
    </span>
  </div>
</template>
