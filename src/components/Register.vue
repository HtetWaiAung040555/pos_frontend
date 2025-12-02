<script setup>
    import { EyeIcon } from '@heroicons/vue/24/solid';
    
</script>

<template>
    <div class="container grid grid-cols-2 justify-center items-center p-10">

    <div class="flex flex-col justify-center items-center text-center">
      <h1 class="text-4xl font-bold text-shadow-lg">Welcome to</h1>
      <div class="flex justify-center">
        <a href="https://vuejs.org/" target="_blank">
          <img src="../assets/images/logo_with_text.png" class="w-50 h-50" alt="Fusion Mart" />
        </a>
      </div>
      <p class="text-sm text-gray-400">Lorem ipsum dolor sit amet consectetur adipisicing elit. Nostrum, at veritatis? Iusto corrupti, ratione delectus tempora repudiandae vero sapiente praesentium officiis vel tempore consequuntur debitis asperiores nam? Nihil, magni voluptatum.</p>
    </div>
    
    <div class="w-[100%] h-[100%] flex justify-center items-center">
      <div class="w-[80%] h-fit bg-white rounded-2xl border-2 border-gray-100 shadow-xl flex flex-col py-12 px-12">
        <h1 class="text-2xl font-bold text-black text-center uppercase mb-12">Register Account</h1>
        <div class="grid grid-rows-2 px-12 gap-1 mb-8">
          <p class="text-black text-lg font-semibold">Username</p>
          <input type="text" class="border-b-2 border-gray-500 text-black py-1 px-2 focus:outline-none focus:border-blue-500" />
        </div>
        <div class="grid grid-rows-2 px-12 gap-1 mb-8">
          <p class="text-black text-lg font-semibold">Email</p>
          <input type="email" class="border-b-2 border-gray-500 text-black py-1 px-2 focus:outline-none focus:border-blue-500" />
        </div>
        <div class="grid grid-rows-2 px-12 gap-1">
          <p class="text-black text-lg font-semibold">Password</p>
          <div class="flex justify-end">
            <input type="password" class="border-b-2 border-gray-500 text-black py-1 px-2 focus:outline-none focus:border-blue-500 w-[100%]" />
            <EyeIcon class="size-6 text-black absolute cursor-pointer" />
          </div>
        </div>
        <button class="bg-black mt-12 p-3 rounded-xl text-lg mx-12">
          Register
        </button>
      </div>
    </div>

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