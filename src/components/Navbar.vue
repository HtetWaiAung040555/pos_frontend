<script setup>
  import Button from 'primevue/button';
  import { useCollapseSidebar } from '@/stores/collapseSidebar';
  import { onMounted, ref } from 'vue';
  import BaseButton from './BaseButton.vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useUserStore } from '@/stores/useUserStore';
  import { usePermissionStore } from '@/stores/usePermissionStore';

  const collapseSidebar = useCollapseSidebar();
  const openDropdown = ref(false);
  const router = useRouter();
  const route = useRoute();
  const useUser = useUserStore();
  const usePermission = usePermissionStore();
  const userData = ref({});

  onMounted(() => {
    userData.value = JSON.parse(localStorage.getItem('user'));
  })

  function toggleDropdown() {
    openDropdown.value = !openDropdown.value;
  }

  async function logout() {
    await useUser.logout();
    router.push('/login');
  }

</script>

<template>
  <div class="w-full h-16 shadow flex items-center px-4 justify-between bg-[#ffffff] sticky top-0 z-10">
    <!-- Collapse Button -->
    <div
      v-if="route.path === '/pos'"
      class="flex gap-2 items-center justify-between"
    >
      <img src="../assets/images/logo.png" class="w-10 h-10" alt="Fusion Mart" />
      <div class="flex flex-col">
        <span class="text-black text-lg font-semibold transition-all duration-300 origin-left">Fusion Mart</span>
        <span class="text-gray-800 text-[11px] transition-all duration-300 origin-left">POS System</span>
      </div>
    </div>
    <div 
      v-else
      class="flex justify-end" 
    >
      <Button 
        severity="contrast" 
        variant="text" 
        @click="collapseSidebar.toggleSidebar" 
        icon="pi pi-bars" 
        rounded 
      />
    </div>
    
    <div class="flex items-center gap-x-2">
      <BaseButton class="w-10 h-10" severity="primary" variant="outlined" icon="fa fa-question" rounded />
      <BaseButton class="w-10 h-10" severity="primary" variant="solid" icon="pi pi-bell" rounded />
      <div class="relative overflow-visible">
        <div
        class="flex justify-between text-black items-center bg-[#F8FAFC] hover:bg-gray-200 rounded-xl py-2 px-3 cursor-pointer"
        @click="toggleDropdown"
        >
          <div class="flex items-center gap-x-2">
            <i  class="fa fa-user-circle text-2xl"></i>
            <div class="flex flex-col">
              <span
                class="text-sm transition-all duration-300 origin-left"
              >
                {{ userData?.name }}
              </span>
              <span
                class="text-[11px] transition-all duration-300 origin-left"
              >
                {{ userData.branch?.name }}
              </span>
            </div>
            <!-- <i :class="openDropdown? 'fa fa-chevron-up' : 'fa fa-chevron-down'" class="text-sm"></i> -->
          </div>
        </div>
        <Transition name="fade">
          <div
            v-if="openDropdown"
            class="absolute right-0 mt-2 w-40 bg-white border-1 border-gray-100 text-black rounded shadow-lg z-10"
          >
            <div
              class="flex px-2 items-center py-3 gap-3 hover:bg-blue-100 cursor-pointer transition-all"
            >
              <i class="pi pi-user-edit"></i>
              <span>
                Setting
              </span>
            </div>
            <router-link v-if="route.path !== '/pos' && usePermission.can('POS', 'View')" to="/pos">
              <div
                class="flex px-2 items-center py-3 gap-3 hover:bg-blue-100 cursor-pointer transition-all"
              >
                <i class="pi pi-shop"></i>
                <span>Go to POS</span>
              </div>
            </router-link>
            <router-link v-else to="/">
              <div
                class="flex px-2 items-center py-3 gap-3 hover:bg-blue-100 cursor-pointer transition-all"
              >
                <i class="pi pi-shop"></i>
                <span>Admin Panel</span>
              </div>
            </router-link>
            <div
              class="flex px-2 items-center py-3 gap-3 hover:bg-blue-100 cursor-pointer transition-all"
              @click="logout"
            >
              <i class="pi pi-sign-out"></i>
              <span>
                Logout
              </span>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style>
  .nav-bg {
    background-color: #007FFF;
  }
</style>