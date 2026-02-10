<script setup>
import Button from 'primevue/button';
import { useCollapseSidebar } from '@/stores/collapseSidebar';
import { onMounted, ref, onBeforeUnmount } from 'vue';
import BaseButton from './BaseButton.vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/useUserStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { Dialog, useToast } from 'primevue';
import BaseInput from './BaseInput.vue';
import SubTitle from './SubTitle.vue';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useProductStore } from '@/stores/useProductStore';
import { usePromotionStore } from '@/stores/usePromotionStore';
import { useSaleStore } from '@/stores/useSalesStore';

const collapseSidebar = useCollapseSidebar();
const openDropdown = ref(false);
const dropdownRef = ref(null);
const router = useRouter();
const route = useRoute();
const useUser = useUserStore();
const usePermission = usePermissionStore();
const useCustomer = useCustomerStore();
const useInventory = useInventoryStore();
const useProduct = useProductStore();
const usePromo = usePromotionStore();
const useSales = useSaleStore();
const toast = useToast();
const userData = ref({});
const errorMsg = ref({
  name: "",
  email: "",
  password: "",
});
const openEditModal = ref(false);
const isSyncLoading = ref(false);

onMounted(() => {
  userData.value = JSON.parse(localStorage.getItem('user'));
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

function handleClickOutside(event) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    openDropdown.value = false;
  }
}

function toggleDropdown() {
  openDropdown.value = !openDropdown.value;
}

async function logout() {
  await useUser.logout();
  router.push('/login');
}

// Update user function
async function formSubmit() {
  if (userData.value.name === "") {
    errorMsg.value = {
      name: errMsgList.name,
      role: "",
      email: "",
      password: ""
    };
    return
  } else if (userData.value.email === "") {
    errorMsg.value = {
      name: "",
      role: "",
      email: errMsgList.email,
      password: ""
    };
    return
  } else if (userData.value.password) {
    if (userData.value.password.length < 8) {
      errorMsg.value = {
        name: "",
        role: "",
        email: "",
        password: "Password must have 8 characters."
      };
      return
    }
  }
  let updatedData = {
    name: userData.value.name,
    email: userData.value.email,
    password: userData.value.password,
    updated_by: userData.value.id,
  };
  await useUser.editUser(updatedData, userData.value.id);
  if (useUser.error.length) {
    useUser.error.forEach((msg) => {
      toast.add({
        severity: 'error',
        summary: 'Error Message',
        detail: msg,
        life: 3000
      });
    });
    return
  }
  if (useUser.users) {
    toast.add({ severity: 'success', summary: 'Success Message', detail: 'User updated successfully.', life: 3000 });
    localStorage.setItem('user', JSON.stringify({
      id: userData.value.id,
      name: userData.value.name,
      branch: userData.value.branch,
      counter: userData.value.counter,
      email: userData.value.email,
      permissions: [...userData.value.permissions]
    }));
    openEditModal.value = false;
  }
}

async function syncAll() {
  try {
    isSyncLoading.value = true;
    await Promise.all([
      await useCustomer.syncFromCloud({updated_by: userData.value.id}),
      await useProduct.syncFromCloud({updated_by: userData.value.id}),
      await useInventory.syncFromCloud({updated_by: userData.value.id}),
      await usePromo.syncFromCloud({updated_by: userData.value.id}),
    ]).finally (() => {
      isSyncLoading.value = false;
      router.push('/pos');
    })
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: err,
      life: 3000
    });
  }
}

async function syncFromCloud() {
  try {
    isSyncLoading.value = true;
    await Promise.all([
      await useCustomer.syncFromCloud({updated_by: userData.value.id}),
      await useProduct.syncFromCloud({updated_by: userData.value.id}),
      await useInventory.syncFromCloud({updated_by: userData.value.id}),
      await usePromo.syncFromCloud({updated_by: userData.value.id}),
    ]).finally (() => {
      isSyncLoading.value = false;
      router.go(0);
    });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: err,
      life: 3000
    });
  }
}

async function syncToCloud() {
  isSyncLoading.value = true;
  await useSales.syncToCloud({updated_by: userData.value.id});
  isSyncLoading.value = false
  if (useSales.error.length) {
    useSales.error.forEach((msg) => {
      toast.add({
        severity: 'error',
        summary: 'Error Message',
        detail: msg,
        life: 3000
      });
    });
    return
  }
  if (useSales.data.message === 'success') {
    toast.add({ severity: 'success', summary: 'Success Message', detail: 'Synced successfully.', life: 3000 });
  }
}

</script>

<template>
  <div class="w-full h-16 shadow flex items-center px-4 justify-between bg-[#ffffff] sticky top-0 z-10">
    <!-- Collapse Button -->
    <div v-if="route.path === '/pos'" class="flex gap-2 items-center justify-between">
      <img src="../assets/images/logo.png" class="w-10 h-10" alt="Fusion Mart" />
      <div class="flex flex-col">
        <span class="text-black text-lg font-semibold transition-all duration-300 origin-left">Fusion Mart</span>
        <span class="text-gray-800 text-[11px] transition-all duration-300 origin-left">POS System</span>
      </div>
    </div>
    <div v-else class="flex justify-end">
      <Button severity="contrast" variant="text" @click="collapseSidebar.toggleSidebar" icon="pi pi-bars" rounded />
    </div>

    <div ref="dropdownRef" class="flex items-center gap-x-2">
      <BaseButton label="Sync All" severity="primary" variant="solid" icon="fa fa-sync" @click="syncAll" />
      <BaseButton label="Sync to Cloud" severity="secondary" variant="solid" icon="fa fa-cloud-arrow-up" @click="syncToCloud" />
      <BaseButton label="Sync from Cloud" severity="info" variant="solid" icon="fa fa-cloud-arrow-down" @click="syncFromCloud" />
    <div class="relative overflow-visible">
          <div
          class="flex justify-between text-black items-center bg-[#F8FAFC] hover:bg-gray-200 rounded-xl py-2 px-3 cursor-pointer"
          @click="toggleDropdown">
          <div class="flex items-center gap-x-2">
            <i class="fa fa-user-circle text-2xl"></i>
            <div class="flex flex-col">
              <span class="text-sm transition-all duration-300 origin-left">
                {{ userData?.name }}
              </span>
              <span class="text-[11px] transition-all duration-300 origin-left">
                {{ userData.branch?.name }}
              </span>
            </div>
            <!-- <i :class="openDropdown? 'fa fa-chevron-up' : 'fa fa-chevron-down'" class="text-sm"></i> -->
          </div>
        </div>
        <Transition name="fade">
          <div v-if="openDropdown"
            class="absolute right-0 mt-2 w-40 bg-white border-1 border-gray-100 text-black rounded shadow-lg z-10">
            <div class="flex px-2 items-center py-3 gap-3 hover:bg-blue-100 cursor-pointer transition-all" @click="openEditModal=true">
              <i class="pi pi-user-edit"></i>
              <span>
                Setting
              </span>
            </div>
            <router-link v-if="route.path !== '/pos' && usePermission.can('POS', 'View')" to="/pos">
              <div class="flex px-2 items-center py-3 gap-3 hover:bg-blue-100 cursor-pointer transition-all">
                <i class="pi pi-shop"></i>
                <span>Go to POS</span>
              </div>
            </router-link>
            <router-link v-else-if="usePermission.can('Admin Panel', 'View')" to="/">
              <div class="flex px-2 items-center py-3 gap-3 hover:bg-blue-100 cursor-pointer transition-all">
                <i class="pi pi-shop"></i>
                <span>Admin Panel</span>
              </div>
            </router-link>
            <div class="flex px-2 items-center py-3 gap-3 hover:bg-blue-100 cursor-pointer transition-all"
              @click="logout">
              <i class="pi pi-sign-out"></i>
              <span>
                Logout
              </span>
            </div>
          </div>
        </Transition>
      </div>
    </div>
    <!-- Edit dialog -->
    <Dialog v-model:visible="openEditModal" :modal="true" :draggable="false"
      :position="'center'">
      <template #container="{ closeCallback }">
        <div class="flex flex-col p-4">
          <SubTitle label="Basic Info" />
          <div class="flex gap-x-4 mt-4">
            <!-- User Name Input -->
            <BaseInput size="sm" v-model="userData.name" label="Name" placeholder="Name" width="300px"
                height="h-[35px]" :isRequire="true" :error="errorMsg.name" />
          </div>
          <div class="flex gap-x-4 mt-3">
            <!-- Email input -->
            <BaseInput size="sm" v-model="userData.email" label="Email" placeholder="Email" width="300px"
                height="h-[35px]" type="email" :isRequire="true" :error="errorMsg.email" />
            <!-- Password -->
            <BaseInput size="sm" v-model="userData.password" label="Password" width="300px" height="h-[35px]"
                type="password" passwordToggle :error="errorMsg.password" />
        </div>
          <div class="flex justify-end gap-x-2 mt-3">
            <BaseButton label="Cancel" severity="secondary" @click="openEditModal = false" />
            <BaseButton label="Update" severity="primary" @click="formSubmit" />
          </div>
        </div>
      </template>
    </Dialog>

    <Dialog v-model:visible="isSyncLoading" :modal="true" :draggable="false"
      :position="'center'">
      <template #container="{ closeCallback }">
        <div class="flex flex-col p-4">
          <i class="fa fa-spinner animate-spin text-3xl"></i>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style>
.nav-bg {
  background-color: #007FFF;
}
</style>