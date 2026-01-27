<script setup>
import PageTitle from '@/components/PageTitle.vue';
import BaseCard from '@/components/BaseCard.vue';
import { useRouter } from 'vue-router';

const router = useRouter();

function go(path) {
  router.push(path);
}
</script>

<template>
  <div class="p-4">
    <PageTitle title="Reports" />

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
      <BaseCard>
        <template #cardElements>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                <i class="fa fa-chart-line"></i>
              </div>
              <div>
                <div class="text-sm text-gray-500">Sales</div>
                <div class="text-gray-800 font-semibold">Sales Reports</div>
              </div>
            </div>
            <button class="text-blue-600 hover:text-blue-800 text-sm" @click="go('/reports/sales')">Open</button>
          </div>
        </template>
      </BaseCard>

      <BaseCard>
        <template #cardElements>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
                <i class="fa fa-cart-arrow-down"></i>
              </div>
              <div>
                <div class="text-sm text-gray-500">Purchase</div>
                <div class="text-gray-800 font-semibold">Purchase Reports</div>
              </div>
            </div>
            <button class="text-blue-600 hover:text-blue-800 text-sm" @click="go('/reports/purchase')">Open</button>
          </div>
        </template>
      </BaseCard>

      <BaseCard>
        <template #cardElements>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white">
                <i class="fa fa-cubes"></i>
              </div>
              <div>
                <div class="text-sm text-gray-500">Inventory</div>
                <div class="text-gray-800 font-semibold">Inventory Stock Reports</div>
              </div>
            </div>
            <button class="text-blue-600 hover:text-blue-800 text-sm" @click="go('/reports/inventory')">Open</button>
          </div>
        </template>
      </BaseCard>
    </div>
  </div>
</template>
