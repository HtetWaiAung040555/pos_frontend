<script setup>
import Button from 'primevue/button';
import { useCollapseSidebar } from '@/stores/collapseSidebar';
import { onMounted, ref } from 'vue';
import BaseButton from './BaseButton.vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/useUserStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { Dialog, useToast } from 'primevue';
import BaseInput from './BaseInput.vue';
import SubTitle from './SubTitle.vue';

const collapseSidebar = useCollapseSidebar();
const openDropdown = ref(false);
const router = useRouter();
const route = useRoute();
const useUser = useUserStore();
const usePermission = usePermissionStore();
const toast = useToast();
const userData = ref({});
const errorMsg = ref({
  name: "",
  email: "",
  password: "",
});
const openEditModal = ref(false);

onMounted(() => {
  userData.value = JSON.parse(localStorage.getItem('user'));
});

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

    <div class="flex items-center gap-x-2">
      <BaseButton class="w-10 h-10" severity="primary" variant="outlined" icon="fa fa-question" rounded />
      <BaseButton class="w-10 h-10" severity="primary" variant="solid" icon="pi pi-bell" rounded />
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
            <router-link v-else to="/">
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
    <!-- Quantity dialog -->
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
  </div>
</template>

<style>
.nav-bg {
  background-color: #007FFF;
}
</style>