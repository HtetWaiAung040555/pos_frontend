<script setup>
  import { useRoute } from 'vue-router';
  import Sidebar from './components/Sidebar.vue';
  import Navbar from './components/Navbar.vue';
  import Toast from 'primevue/toast';


  const route = useRoute();
  

</script>

<template>
  <Toast class="my-toast" />
  <div class="flex h-screen text-sm">
    <Sidebar v-if="route.path !== '/login' && route.path !== '/pos' && route.path !== '/payment/create'" />
    <!-- Main content -->
    <div class="w-full p-0 main-bg max-h-full overflow-y-auto">
      <Navbar v-if="route.path !== '/login' && route.path !== '/payment/create'" />
      <router-view></router-view>
    </div>
  </div>
  <!-- <router-link to="/">Home</router-link>
  <router-link to="/sales">Sales</router-link> -->
  
</template>

<style>
  .main.bg {
    background-color: #F8FAFC;
  }
  .my-toast .p-toast-message {
    font-size: 10px;
  }
</style>
