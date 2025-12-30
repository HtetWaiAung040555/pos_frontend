<script setup>
    import { EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/solid';
    import { ref, onMounted } from 'vue';
    import { useUserStore } from '@/stores/useUserStore';
    import { useRouter } from 'vue-router';

    const useUser = useUserStore();
    const router = useRouter();
    const showPass = ref(false);
    const formData = ref(
      {
        email: "",
        password: "",
        isEmail: false,
        isPassword: false,
      }
    )

    function toggleShowPassword() {
      showPass.value = !showPass.value;
    }

    async function formSubmit() {
      if(formData.value.email === "") {
        formData.value.isEmail = true;
        return
      } else if(formData.value.password === "") {
        formData.value.isPassword = true;
        return
      }
      await useUser.loginUser({email: formData.value.email, password: formData.value.password});
      router.push("/");
    }

</script>

<template>
  <!-- Main div -->
  <div class="container grid grid-cols-2 justify-center items-center p-10">
    <!-- Content section -->
    <div class="flex flex-col justify-center items-center text-center">
      <!-- Heading -->
      <h1 class="text-4xl font-bold text-shadow-lg">Welcome to</h1>
      <!-- Logo Section -->
      <div class="flex justify-center">
        <a href="https://vuejs.org/" target="_blank">
          <img src="../assets/images/logo_with_text.png" class="w-50 h-50" alt="Fusion Mart" />
        </a>
      </div>
      <!-- Description -->
      <p class="text-sm text-gray-400">Lorem ipsum dolor sit amet consectetur adipisicing elit. Nostrum, at veritatis? Iusto corrupti, ratione delectus tempora repudiandae vero sapiente praesentium officiis vel tempore consequuntur debitis asperiores nam? Nihil, magni voluptatum.</p>
    </div>
    <!-- End of content section -->
    <!-- Login form section -->
    <div class="w-[100%] h-[100%] flex justify-center items-center">
      <div class="w-[80%] h-fit bg-white rounded-2xl border-2 border-gray-100 shadow-xl flex flex-col py-12 px-12">
        <!-- Title -->
        <h1 class="text-2xl font-bold text-black text-center uppercase mb-12">Login Account</h1>
        <!-- Username input -->
        <!-- <div class="grid grid-rows-2 px-12 gap-1 mb-8">
          <p class="text-black text-lg font-semibold">Username</p>
          <input type="text" class="border-b-2 border-gray-500 text-black py-1 px-2 focus:outline-none focus:border-blue-500" />
        </div> -->
        <!-- Email input -->
        <div class="grid grid-rows-2 px-12 gap-1 mb-8">
          <p class="text-black text-lg font-semibold">Email</p>
          <input 
            type="email" 
            v-model="formData.email"
            class="border-b-2 border-gray-500 text-black py-1 px-2 focus:outline-none focus:border-blue-500" 
          />
          <p class="text-red-500 text-sm font-semibold mt-1 mb-0" v-if="formData.isEmail">
            Email Required
          </p>
        </div>
        <!-- Password input -->
        <div class="grid grid-rows-2 px-12 gap-1">
          <p class="text-black text-lg font-semibold">Password</p>
          <div class="flex justify-end">
            <input 
              :type="showPass ? 'text' : 'password'"
              v-model="formData.password"
              class="border-b-2 border-gray-500 text-black py-1 px-2 focus:outline-none focus:border-blue-500 w-[100%]" />
            <EyeSlashIcon v-if="showPass" @click="toggleShowPassword" class="size-6 text-black absolute cursor-pointer" />
            <EyeIcon v-else @click="toggleShowPassword" class="size-6 text-black absolute cursor-pointer"  />
          </div>
          <p class="text-red-500 text-sm font-semibold mt-1 mb-0" v-if="formData.isPassword">
            Password Required
          </p>
          <p class="text-red-500 text-sm font-semibold mt-3 mb-0" v-if="useUser.error.length">
            {{ useUser.error }}
          </p>
        </div>
        <!-- Login Button -->
        <button class="bg-black mt-12 p-3 rounded-xl text-lg mx-12 cursor-pointer" @click="formSubmit" >
          <i v-if="useUser.loading" class="fa fa-spinner animate-spin"></i>
          Login
        </button>
      </div>
    </div>
    <!-- End of login form section -->
  </div>
</template>

<style scoped>
  .container{
    background: #007FFF;
    background: linear-gradient(179deg, rgba(0, 128, 255, 0.5) 0%, rgba(83, 169, 255, 0.5) 65%, rgba(255, 255, 255, 0.5) 100%);
    width: 100%;
    height: 100vh;
  }
</style>