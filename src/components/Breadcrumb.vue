<script setup>
    import { useRoute } from 'vue-router';
    import { computed } from 'vue';

    const route = useRoute();

    // Generate breadcrumb from route meta or path
    const breadcrumbs = computed(() => {

        // Build from path segments
        const segments = route.path.split('/').filter(Boolean);
        return segments.map((segment, index) => {
            return {
            name: segment.charAt(0).toUpperCase() + segment.slice(1),
            path: '/' + segments.slice(0, index + 1).join('/')
            };
        });
    });
</script>

<template>

    <nav class="text-sm text-gray-400 flex items-center space-x-2">
        <router-link 
          to="/" 
          class="hover:underline"
        >
          <i class="fa fa-home"></i>
        </router-link>
        <span>/</span>
      <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
        <router-link 
          v-if="index < breadcrumbs.length - 1" 
          :to="crumb.path" 
          class="hover:underline"
        >
          {{ crumb.name }}
        </router-link>
        <span v-else class="font-medium text-gray-700">{{ crumb.name }}</span>

        <!-- Divider except last -->
        <span v-if="index < breadcrumbs.length - 1">/</span>
      </template>
    </nav>

</template>